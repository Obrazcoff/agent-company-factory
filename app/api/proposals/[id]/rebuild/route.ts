import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rebuildProposal } from '@/factory/modules/proposalReview';
import { internal } from '@/factory/api/errors';
import { resolveLlmClientFromRequest } from '@/lib/llm-from-request';
import { getLocaleFromRequest } from '@/i18n/request-locale';

const RebuildSchema = z.object({
  feedback: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = RebuildSchema.parse(body);
    const llm = await resolveLlmClientFromRequest(request);
    const locale = getLocaleFromRequest(request);
    const result = await rebuildProposal(id, parsed, { llm, locale });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return internal(error);
  }
}
