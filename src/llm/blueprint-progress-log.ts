import type { LlmBlueprintProgressEvent } from '@/llm/llm-progress';

/** Visible in `journalctl -u c-fab-app -f` while blueprint runs. Disable: LLM_PROGRESS_LOG=0 */
export function logBlueprintProgress(event: LlmBlueprintProgressEvent, context: string) {
  if (process.env.LLM_PROGRESS_LOG === '0') return;
  // eslint-disable-next-line no-console -- ops: see LLM pipeline on server
  console.info(`[c-fab blueprint] ${context}`, event);
}
