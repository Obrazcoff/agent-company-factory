import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { draftProposal } from '@/factory/modules/proposalReview';
import { internal } from '@/factory/api/errors';
import { resolveLlmClientFromRequest } from '@/lib/llm-from-request';
import { getLocaleFromRequest } from '@/i18n/request-locale';
import { encodeProposalNdjsonLine } from '@/lib/proposal-ndjson';
import { logBlueprintProgress } from '@/llm/blueprint-progress-log';
import type { LlmBlueprintProgressEvent } from '@/llm/llm-progress';

const DraftProposalSchema = z.object({
  missionPrompt: z.string().min(10, 'Mission prompt must be at least 10 characters'),
  dailyBudgetUsd: z.number().positive().optional(),
});

export async function POST(request: NextRequest) {
  let parsed: z.infer<typeof DraftProposalSchema>;
  try {
    const body = await request.json();
    parsed = DraftProposalSchema.parse(body);
  } catch (error) {
    return internal(error);
  }

  let llm: Awaited<ReturnType<typeof resolveLlmClientFromRequest>>;
  let locale: ReturnType<typeof getLocaleFromRequest>;
  try {
    llm = await resolveLlmClientFromRequest(request);
    locale = getLocaleFromRequest(request);
  } catch (error) {
    return internal(error);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (line: Parameters<typeof encodeProposalNdjsonLine>[0]) => {
        controller.enqueue(encodeProposalNdjsonLine(line));
      };
      const emitProgress = (event: LlmBlueprintProgressEvent) => {
        logBlueprintProgress(event, 'POST /api/proposals');
        send({ type: 'progress', event });
      };
      try {
        emitProgress({ stage: 'http_stream_open' });
        const result = await draftProposal(parsed, {
          llm,
          locale,
          onBlueprintProgress: emitProgress,
        });
        send({ type: 'done', proposal: result.proposal, llmCostUsd: result.llmCostUsd });
        controller.close();
      } catch (error) {
        if (error instanceof ZodError) {
          send({ type: 'error', status: 400, error: 'validation_failed', issues: error.issues });
        } else {
          send({
            type: 'error',
            status: 500,
            message: error instanceof Error ? error.message : String(error),
          });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
