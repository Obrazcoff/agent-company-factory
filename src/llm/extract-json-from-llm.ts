/**
 * Strip markdown fences and leading/trailing prose so JSON.parse succeeds.
 * Many OpenAI-compatible gateways return fenced JSON when `response_format` is omitted.
 */
export function extractJsonStringFromLlmOutput(raw: string): string {
  const t = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)```/im.exec(t);
  if (fenced?.[1]) return fenced[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) return t.slice(start, end + 1);
  return t;
}
