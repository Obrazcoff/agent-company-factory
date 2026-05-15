import { NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { rebuildProposal } from '@/factory/modules/proposalReview';
import { internal } from '@/factory/api/errors';
import { resolveLlmClientFromRequest } from '@/lib/llm-from-request';
import { getLocaleFromRequest } from '@/i18n/request-locale';
import { encodeProposalNdjsonLine } from '@/lib/proposal-ndjson';
import { logBlueprintProgress } from '@/llm/blueprint-progress-log';
import type { LlmBlueprintProgressEvent } from '@/llm/llm-progress';

const RebuildSchema = z.object({
  feedback: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let proposalId: string;
  let parsed: z.infer<typeof RebuildSchema>;
  try {
    const p = await params;
    proposalId = p.id;
    const body = await request.json().catch(() => ({}));
    parsed = RebuildSchema.parse(body);
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
        logBlueprintProgress(event, `POST /api/proposals/${proposalId}/rebuild`);
        send({ type: 'progress', event });
      };
      try {
        emitProgress({ stage: 'http_stream_open' });
        const result = await rebuildProposal(proposalId, parsed, {
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
