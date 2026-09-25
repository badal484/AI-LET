import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchQueryAnalyzer } from '../src/modules/discovery/search/SearchQueryAnalyzer.js';
import { prisma } from '../src/infrastructure/database/prisma.js';

describe('SearchQueryAnalyzer — Intent, Typo Tolerance & Multilingual Hinglish Understanding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes whitespace, casing and strips punctuation', async () => {
    const result = await SearchQueryAnalyzer.analyze('   Elena Vance!!!   ');
    expect(result.normalizedQuery).toBe('elena vance');
    expect(result.tokens).toContain('elena');
    expect(result.tokens).toContain('vance');
  });

  it('detects and corrects common typos (e.g. girlfirend -> girlfriend, studdy -> study)', async () => {
    const result = await SearchQueryAnalyzer.analyze('girlfirend studdy budy');
    expect(result.tokens).toContain('girlfriend');
    expect(result.tokens).toContain('study');
    expect(result.tokens).toContain('buddy');
    expect(result.spellCorrection).toBe('girlfriend study buddy');
  });

  it('handles Hinglish code-switching queries (e.g. mujhe ek funny study buddy chahiye)', async () => {
    const result = await SearchQueryAnalyzer.analyze('mujhe ek funny study buddy chahiye');
    expect(result.language).toBe('hi');
    expect(result.extractedPersonality).toContain('funny');
    expect(result.extractedCategories).toContain('study');
  });

  it('classifies query intent accurately (e.g. role, relationship, personality)', async () => {
    const tutorResult = await SearchQueryAnalyzer.analyze('math tutor');
    expect(tutorResult.primaryIntent).toBe('ROLE');
    expect(tutorResult.extractedTags).toContain('tutor');

    const companionResult = await SearchQueryAnalyzer.analyze('kind funny friend');
    expect(companionResult.primaryIntent).toBe('ROLE_RELATIONSHIP');
    expect(companionResult.extractedPersonality).toContain('kind');
  });

  it('resolves configured admin synonyms dynamically from database', async () => {
    vi.spyOn(prisma.searchSynonym, 'findFirst').mockResolvedValueOnce({
      id: 'syn-1',
      term: 'coding',
      synonyms: ['programming', 'developer', 'python', 'javascript'],
      language: 'en',
      category: null,
      priority: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await SearchQueryAnalyzer.analyze('coding mentor');
    expect(result.synonymExpansions).toBeDefined();
    expect(result.synonymExpansions).toContain('programming');
    expect(result.synonymExpansions).toContain('developer');
  });
});

