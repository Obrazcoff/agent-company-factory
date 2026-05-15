import { describe, it, expect } from 'vitest';
import { aggregateOpenAiSseChatContent, shouldTreatAsSseStream } from '@/llm/openai-chat-stream';

function sseResponse(lines: string[]): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const l of lines) controller.enqueue(enc.encode(`${l}\n`));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('openai-chat-stream', () => {
  it('aggregates delta content from SSE', async () => {
    const res = sseResponse([
      'data: {"choices":[{"delta":{"content":"hello "}}]}',
      'data: {"choices":[{"delta":{"content":"world"}}]}',
      'data: [DONE]',
    ]);
    const text = await aggregateOpenAiSseChatContent(res);
    expect(text).toBe('hello world');
  });

  it('detects event-stream content-type', () => {
    const res = new Response(null, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
    expect(shouldTreatAsSseStream(res)).toBe(true);
  });
});
