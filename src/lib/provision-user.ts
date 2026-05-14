import type { PrismaClient } from '@prisma/client';

/** Создаёт пользователя с Personal workspace, default project и mock LlmProfile (как при register). */
export async function createUserWithDefaults(
  prisma: PrismaClient,
  input: { email: string; passwordHash: string; name?: string | null },
) {
  const email = input.email.toLowerCase().trim();
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash: input.passwordHash,
        name: input.name ?? null,
      },
    });
    const workspace = await tx.workspace.create({
      data: { name: 'Personal', ownerId: user.id },
    });
    const project = await tx.project.create({
      data: {
        workspaceId: workspace.id,
        name: 'Default',
        slug: 'default',
      },
    });
    await tx.llmProfile.create({
      data: {
        projectId: project.id,
        provider: 'mock',
        baseUrl: null,
        apiKey: null,
        model: null,
      },
    });
    return { userId: user.id, projectId: project.id, email: user.email };
  });
}
