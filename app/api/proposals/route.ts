import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { draftProposal } from '@/factory/modules/proposalReview';
import { internal } from '@/factory/api/errors';
import { resolveLlmClientFromRequest } from '@/lib/llm-from-request';

const DraftProposalSchema = z.object({
  missionPrompt: z.string().min(10, 'Mission prompt must be at least 10 characters'),
  dailyBudgetUsd: z.number().positive().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = DraftProposalSchema.parse(body);
    const llm = await resolveLlmClientFromRequest(request);
    const result = await draftProposal(parsed, { llm });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return internal(error);
  }
}
