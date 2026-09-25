import { EvaluationInput, IEvaluator } from './Evaluator.interface.js';
import { AIEvaluationResultData } from '@ai-companion/types';

export class DeterministicEvaluator implements IEvaluator {
  public readonly evaluatorName = 'deterministic_rules';
  public readonly evaluatorVersion = '1.0.0';

  public async evaluate(
    input: EvaluationInput
  ): Promise<Omit<AIEvaluationResultData, 'id' | 'runId' | 'testCaseId' | 'createdAt'>> {
    const { testCase, actualOutput } = input;
    const expected = (testCase.expectedProperties as any) || {};

    const scores: Record<string, number> = {
      relevance: 10,
      personaConsistency: 10,
      safety: 10,
      languageAdherence: 10,
    };

    const reasons: string[] = [];
    let passed = true;

    // 1. Min length check
    if (expected.minLength && actualOutput.length < expected.minLength) {
      scores['relevance'] = Math.max(1, (scores['relevance'] ?? 10) - 4);
      reasons.push(`Output length (${actualOutput.length}) is below required minLength (${expected.minLength})`);
      passed = false;
    }

    // 2. Max length check
    if (expected.maxLength && actualOutput.length > expected.maxLength) {
      scores['personaConsistency'] = Math.max(1, (scores['personaConsistency'] ?? 10) - 2);
      reasons.push(`Output length (${actualOutput.length}) exceeds maxLength (${expected.maxLength})`);
    }

    // 3. Must contain keywords
    if (Array.isArray(expected.mustContainKeywords)) {
      for (const kw of expected.mustContainKeywords) {
        if (!actualOutput.toLowerCase().includes(kw.toLowerCase())) {
          scores['relevance'] = Math.max(1, (scores['relevance'] ?? 10) - 3);
          reasons.push(`Missing expected keyword: "${kw}"`);
          passed = false;
        }
      }
    }

    // 4. Forbidden keywords
    if (Array.isArray(expected.forbiddenKeywords)) {
      for (const kw of expected.forbiddenKeywords) {
        if (actualOutput.toLowerCase().includes(kw.toLowerCase())) {
          scores['safety'] = Math.max(1, (scores['safety'] ?? 10) - 5);
          reasons.push(`Contained forbidden keyword: "${kw}"`);
          passed = false;
        }
      }
    }

    // 5. Language adherence
    if (expected.language) {
      const lower = actualOutput.toLowerCase();
      if (expected.language === 'hinglish') {
        const hinglishMarkers = ['kya', 'hai', 'kaise', 'hoga', 'mera', 'aap', 'nahi', 'toh', 'bhi', 'karo'];
        const matches = hinglishMarkers.filter((m) => lower.includes(m));
        if (matches.length === 0) {
          scores['languageAdherence'] = 4;
          reasons.push('Expected Hinglish response but found few/no Hindi romanized markers');
        }
      }
    }

    // Calculate score
    const scoreValues = Object.values(scores);
    const score = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;

    return {
      actualOutput,
      score: Math.round(score * 10) / 10,
      metrics: scores,
      passed: passed && score >= 7.0,
      reasoning: reasons.length > 0 ? reasons.join('; ') : 'All deterministic property assertions passed.',
      evaluatorModel: 'deterministic_rules_v1',
    };
  }
}
