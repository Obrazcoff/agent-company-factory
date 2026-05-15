import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { internal, notFound } from '@/factory/api/errors';
import { userOwnsProject } from '@/lib/project-access';

const PatchSchema = z.object({
  provider: z.enum(['mock', 'openai', 'neurohub']),
  baseUrl: z.string().max(2048).nullable().optional(),
  apiKey: z.string().max(2048).nullable().optional(),
  model: z.string().max(120).nullable().optional(),
});

/** Не отдаём apiKey в JSON клиенту (даже владельцу проекта). */
function publicLlmProfile(p: {
  id: string;
  projectId: string;
  provider: string;
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
}) {
  return {
    id: p.id,
    projectId: p.projectId,
    provider: p.provider,
    baseUrl: p.baseUrl,
    model: p.model,
    hasApiKey: Boolean(p.apiKey?.trim()),
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 });
    }
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: projectId } = await params;
    const ok = await userOwnsProject(userId, projectId);
    if (!ok) return notFound('project_not_found');

    const profile = await prisma.llmProfile.findUnique({ where: { projectId } });
    if (!profile) return NextResponse.json({ profile: null });
    return NextResponse.json({ profile: publicLlmProfile(profile) });
  } catch (error) {
    return internal(error);
  }
}

const NEUROHUB_DEFAULT_BASE_URL =
  process.env.NEUROHUB_BASE_URL || 'https://ai.nova01.click/neurohub/v1';
const NEUROHUB_DEFAULT_MODEL = process.env.NEUROHUB_MODEL || 'Qwen/Qwen3.5-27B';

function normalizeNeurohubDefaults(
  parsed: z.infer<typeof PatchSchema>,
): z.infer<typeof PatchSchema> {
  if (parsed.provider !== 'neurohub') return parsed;
  const baseTrim = parsed.baseUrl?.trim() ?? '';
  const modelTrim = parsed.model?.trim() ?? '';
  return {
    ...parsed,
    baseUrl: baseTrim ? baseTrim : NEUROHUB_DEFAULT_BASE_URL,
    model: modelTrim ? modelTrim : NEUROHUB_DEFAULT_MODEL,
  };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 });
    }
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: projectId } = await params;
    const ok = await userOwnsProject(userId, projectId);
    if (!ok) return notFound('project_not_found');

    const body = await request.json();
    const parsed = normalizeNeurohubDefaults(PatchSchema.parse(body));

    const profile = await prisma.llmProfile.upsert({
      where: { projectId },
      create: {
        projectId,
        provider: parsed.provider,
        baseUrl: parsed.baseUrl ?? null,
        apiKey: parsed.apiKey ?? null,
        model: parsed.model ?? null,
      },
      update: {
        provider: parsed.provider,
        ...(parsed.baseUrl !== undefined ? { baseUrl: parsed.baseUrl } : {}),
        ...(parsed.apiKey !== undefined ? { apiKey: parsed.apiKey } : {}),
        ...(parsed.model !== undefined ? { model: parsed.model } : {}),
        ...(parsed.provider === 'mock' ? { baseUrl: null, apiKey: null, model: null } : {}),
      },
    });

    return NextResponse.json({ profile: publicLlmProfile(profile) });
  } catch (error) {
    return internal(error);
  }
}
