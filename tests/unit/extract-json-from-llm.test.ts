import { describe, expect, it } from 'vitest';
import { extractJsonStringFromLlmOutput } from '@/llm/extract-json-from-llm';

describe('extractJsonStringFromLlmOutput', () => {
  it('returns raw object when already plain JSON', () => {
    const s = '{"a":1}';
    expect(extractJsonStringFromLlmOutput(s)).toBe(s);
  });

  it('strips markdown json fence', () => {
    const inner = '{"mission":"x","kpis":[],"dailyCapUsd":1}';
    const wrapped = `Here you go:\n\`\`\`json\n${inner}\n\`\`\`\n`;
    expect(extractJsonStringFromLlmOutput(wrapped)).toBe(inner);
  });

  it('extracts first object from surrounding text', () => {
    const inner = '{"k":1}';
    const wrapped = `prefix text\n${inner}\ntrailer`;
    expect(extractJsonStringFromLlmOutput(wrapped)).toBe(inner);
  });
});
