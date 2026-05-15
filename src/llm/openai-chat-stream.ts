/** Undici vs DOM `ReadableStream` types differ; we only need `getReader()` + headers. */
export type SseReadableResponse = {
  readonly body: { getReader(): ReadableStreamDefaultReader<Uint8Array> } | null;
  readonly headers: { get(name: string): string | null };
};

/**
 * Aggregate OpenAI-compatible streaming chat completions (SSE: lines `data: {...}`).
 */
export async function aggregateOpenAiSseChatContent(
  response: SseReadableResponse,
  onDelta?: (totalChars: number) => void,
): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buffer = '';
  let out = '';
  let lastEmit = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const json = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
        const piece = json.choices?.[0]?.delta?.content;
        if (typeof piece === 'string' && piece.length > 0) {
          out += piece;
          if (onDelta && (out.length - lastEmit >= 256 || out.length < 128)) {
            lastEmit = out.length;
            onDelta(out.length);
          }
        }
      } catch {
        /* ignore malformed SSE JSON */
      }
    }
  }
  if (onDelta && out.length > lastEmit) onDelta(out.length);
  return out;
}

export function shouldTreatAsSseStream(response: SseReadableResponse): boolean {
  const ct = (response.headers.get('content-type') ?? '').toLowerCase();
  return ct.includes('text/event-stream') || ct.includes('event-stream');
}
