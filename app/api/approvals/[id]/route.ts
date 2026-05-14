import { NextRequest, NextResponse } from 'next/server';
import { DecideApprovalRequestSchema } from '@/factory/domain/schemas';
import { decideApproval } from '@/factory/policy/approvals';
import { internal, notFound, conflict } from '@/factory/api/errors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = DecideApprovalRequestSchema.parse(body);
    const result = decideApproval(id, parsed.decision, parsed.decidedBy ?? 'human', parsed.reason);
    if (!result.ok) {
      if (result.reason === 'not_found') return notFound('approval_not_found');
      return conflict('already_decided', { current: result.current });
    }
    return NextResponse.json({ approval: result.approval });
  } catch (error) {
    return internal(error);
  }
}
