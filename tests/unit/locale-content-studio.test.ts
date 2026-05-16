import { describe, it, expect } from 'vitest';
import { isContentStudioStyleMission, mockDeterministicBlueprint } from '@/llm/locale-prompts';

describe('content studio mission heuristic + mock blueprint', () => {
  it('detects RU cosmetics / posts phrasing', () => {
    expect(isContentStudioStyleMission('Проанализируй рынок косметики и сделай 5 постов для соц сетей')).toBe(
      true,
    );
  });

  it('detects EN cosmetics social phrasing', () => {
    expect(isContentStudioStyleMission('Analyze the cosmetics market and create 5 Instagram posts')).toBe(
      true,
    );
  });

  it('does not match generic B2B lead gen', () => {
    expect(
      isContentStudioStyleMission(
        'Launch an autonomous B2B lead generation company for an AI-concierge service.',
      ),
    ).toBe(false);
  });

  it('mock blueprint uses llm_market_research + llm_social_posts chain', () => {
    const b = mockDeterministicBlueprint('Beauty market scan + TikTok content', 40, 'en');
    expect(b.initialTasks.length).toBeGreaterThanOrEqual(5);
    expect(b.initialTasks[0]!.kind).toBe('llm_market_research');
    expect(b.initialTasks[1]!.kind).toBe('llm_social_posts');
    expect(b.initialTasks[1]!.dependsOnIndex).toEqual([0]);
  });
});
