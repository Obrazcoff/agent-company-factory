import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

export async function GET() {
  const prisma = getPrisma();
  const session = await auth();
  if (!prisma || !session?.user) {
    return NextResponse.json({ authenticated: false, projects: [], defaultProjectId: null });
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ authenticated: false, projects: [], defaultProjectId: null });
  }

  const projects = await prisma.project.findMany({
    where: { workspace: { ownerId: userId } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, slug: true, workspaceId: true },
  });

  return NextResponse.json({
    authenticated: true,
    user: { id: userId, email: session.user.email, name: session.user.name },
    projects,
    defaultProjectId: projects[0]?.id ?? null,
  });
}
