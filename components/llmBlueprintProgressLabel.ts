import type { LlmBlueprintProgressEvent } from '@/llm/llm-progress';
import type { TranslateFn } from '@/i18n/dictionaries';

export function llmBlueprintProgressLine(e: LlmBlueprintProgressEvent, t: TranslateFn): string {
  switch (e.stage) {
    case 'preflight_start':
      return t('factory.llmProgress.preflightStart');
    case 'preflight_ok':
      return t('factory.llmProgress.preflightOk', { ms: String(e.ms) });
    case 'llm_stream_attempt':
      return t('factory.llmProgress.streamAttempt');
    case 'llm_stream_chars':
      return t('factory.llmProgress.streamChars', { n: String(e.total) });
    case 'llm_json_attempt':
      return t('factory.llmProgress.jsonAttempt');
    default:
      return '';
  }
}
