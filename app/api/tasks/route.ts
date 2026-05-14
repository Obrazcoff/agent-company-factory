import { NextRequest, NextResponse } from 'next/server';
import { EnqueueTaskRequestSchema } from '@/factory/domain/schemas';
import { enqueueTask } from '@/factory/modules/enqueue';
import { badRequest, conflict, internal } from '@/factory/api/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = EnqueueTaskRequestSchema.parse(body);
    const result = enqueueTask({
      companyId: parsed.companyId,
      agentId: parsed.agentId,
      kind: parsed.kind,
      input: parsed.input,
      dependsOn: parsed.dependsOn,
      depth: 0,
    });
    if (!result.ok) {
      const status =
        result.reason === 'cyclic_dependency' ||
        result.reason === 'company_paused' ||
        result.reason === 'backlog_full'
          ? 409
          : 400;
      return status === 409 ? conflict(result.reason) : badRequest(result.reason);
    }
    return NextResponse.json(
      { task: result.task, reused: result.reused ?? false },
      { status: result.reused ? 200 : 201 },
    );
  } catch (error) {
    return internal(error);
  }
}
