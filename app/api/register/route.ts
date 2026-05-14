import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getPrisma } from '@/lib/prisma';
import { internal } from '@/factory/api/errors';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().max(80).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 });
    }
    const body = await request.json();
    const parsed = RegisterSchema.parse(body);
    const email = parsed.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }
    const passwordHash = await bcrypt.hash(parsed.password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: parsed.name ?? null,
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

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return internal(error);
  }
}
