import { afterEach, describe, expect, it, vi } from 'vitest';

describe('defaultEnvRuntime env priority', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('neurohub prefers NEUROHUB_API_KEY over OPENAI_API_KEY', async () => {
    vi.stubEnv('LLM_PROVIDER', 'neurohub');
    vi.stubEnv('NEUROHUB_API_KEY', 'nh-neurohub-key');
    vi.stubEnv('OPENAI_API_KEY', 'sk-openai-key-that-must-not-win');
    vi.stubEnv('NEUROHUB_BASE_URL', 'https://ai.example/neurohub/v1');
    const { defaultEnvRuntime } = await import('@/llm/provider');
    const cfg = defaultEnvRuntime();
    expect(cfg.provider).toBe('neurohub');
    expect(cfg.apiKey).toBe('nh-neurohub-key');
    expect(cfg.baseUrl).toContain('ai.example');
  });

  it('openai prefers OPENAI_API_KEY over NEUROHUB_API_KEY', async () => {
    vi.stubEnv('LLM_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'sk-openai-wins');
    vi.stubEnv('NEUROHUB_API_KEY', 'nh-should-not-win');
    const { defaultEnvRuntime } = await import('@/llm/provider');
    const cfg = defaultEnvRuntime();
    expect(cfg.provider).toBe('openai');
    expect(cfg.apiKey).toBe('sk-openai-wins');
  });
});
