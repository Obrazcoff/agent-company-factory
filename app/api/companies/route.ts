import { NextRequest, NextResponse } from 'next/server';
import { CreateCompanyRequestSchema } from '@/factory/domain/schemas';
import { intakeAndCreateCompany } from '@/factory/modules/goalIntake';
import { listCompanies } from '@/factory/modules/controlPlane';
import { internal } from '@/factory/api/errors';
import { getStorageEpoch } from '@/factory/store/db';
import { auth } from '@/auth';
import { resolveLlmClientFromRequest } from '@/lib/llm-from-request';
import { saveProjectCompanyBinding, userOwnsProject } from '@/lib/project-access';
import { getLocaleFromRequest } from '@/i18n/request-locale';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateCompanyRequestSchema.parse(body);
    const llm = await resolveLlmClientFromRequest(request);
    const locale = getLocaleFromRequest(request);
    const result = await intakeAndCreateCompany(
      {
        missionPrompt: parsed.missionPrompt,
        dailyBudgetUsd: parsed.dailyBudgetUsd,
      },
      undefined,
      undefined,
      { llm, locale },
    );
    const status = result.partial ? 207 : 201;
    const projectId = request.headers.get('x-project-id');
    if (projectId) {
      const session = await auth();
      const userId = (session?.user as { id?: string } | undefined)?.id;
      if (userId && (await userOwnsProject(userId, projectId))) {
        await saveProjectCompanyBinding(projectId, result.company.id, getStorageEpoch());
      }
    }
    return NextResponse.json({ ...result, serverBootId: getStorageEpoch() }, { status });
  } catch (error) {
    return internal(error);
  }
}

export async function GET() {
  return NextResponse.json({ companies: listCompanies() });
}
