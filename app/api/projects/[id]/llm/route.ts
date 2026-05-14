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
    const parsed = PatchSchema.parse(body);

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
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    return internal(error);
  }
}
