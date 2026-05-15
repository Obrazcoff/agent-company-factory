/** Progress while generating a blueprint (preflight, streaming, JSON fallback). */

export type LlmBlueprintProgressEvent =
  | { stage: 'http_stream_open' }
  | { stage: 'preflight_start' }
  | { stage: 'preflight_ok'; ms: number }
  | { stage: 'llm_stream_attempt' }
  | { stage: 'llm_stream_chars'; total: number }
  | { stage: 'llm_json_attempt' };

export type LlmBlueprintGenerateOptions = {
  onProgress?: (e: LlmBlueprintProgressEvent) => void;
};
