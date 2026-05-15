import { auth } from '@/auth';
import { createLlmClient, type LlmClient, type LlmRuntimeConfig } from '@/llm/provider';
import { getPrisma } from '@/lib/prisma';
import { userOwnsProject } from '@/lib/project-access';

function dbProfileToRuntime(p: {
  provider: string;
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
}): LlmRuntimeConfig | null {
  const provider = p.provider as LlmRuntimeConfig['provider'];
  if (provider === 'mock') return { provider: 'mock' };
  if (!p.apiKey?.trim()) return null;
  return {
    provider: provider === 'neurohub' ? 'neurohub' : 'openai',
    baseUrl: p.baseUrl ?? undefined,
    apiKey: p.apiKey ?? undefined,
    model: p.model ?? undefined,
    blueprintJsonMode: provider !== 'neurohub',
  };
}

/** Per-project LLM from DB when `x-project-id` header + signed-in user own the project. */
export async function resolveLlmClientFromRequest(request: Request): Promise<LlmClient> {
  const projectId = request.headers.get('x-project-id');
  const prisma = getPrisma();
  if (!projectId || !prisma) return createLlmClient();

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return createLlmClient();

  const owned = await userOwnsProject(userId, projectId);
  if (!owned) return createLlmClient();

  const profile = await prisma.llmProfile.findUnique({ where: { projectId } });
  if (!profile) return createLlmClient();

  const runtime = dbProfileToRuntime(profile);
  if (!runtime) return createLlmClient();
  try {
    return createLlmClient(runtime);
  } catch {
    return createLlmClient();
  }
}
