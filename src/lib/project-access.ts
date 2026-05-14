import { getPrisma } from '@/lib/prisma';

export async function userOwnsProject(userId: string, projectId: string): Promise<boolean> {
  const prisma = getPrisma();
  if (!prisma) return false;
  const n = await prisma.project.count({
    where: { id: projectId, workspace: { ownerId: userId } },
  });
  return n > 0;
}

export async function saveProjectCompanyBinding(
  projectId: string,
  companyId: string,
  storageEpoch: string,
): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;
  await prisma.projectCompanyBinding.upsert({
    where: {
      projectId_companyId: { projectId, companyId },
    },
    create: { projectId, companyId, storageEpoch },
    update: { storageEpoch },
  });
}
