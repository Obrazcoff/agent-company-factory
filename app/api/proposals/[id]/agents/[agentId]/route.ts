import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { excludeAgent } from '@/factory/modules/proposalReview';
import { internal } from '@/factory/api/errors';

const PatchAgentSchema = z.object({
  included: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agentId: string }> },
) {
  try {
    const { id, agentId } = await params;
    const body = await request.json();
    const { included } = PatchAgentSchema.parse(body);
    const updated = excludeAgent(id, agentId, included);
    return NextResponse.json({ proposal: updated });
  } catch (error) {
    return internal(error);
  }
}
