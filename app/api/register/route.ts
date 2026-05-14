import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getPrisma } from '@/lib/prisma';
import { createUserWithDefaults } from '@/lib/provision-user';
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

    const result = await createUserWithDefaults(prisma, {
      email,
      passwordHash,
      name: parsed.name ?? null,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return internal(error);
  }
}
