import { AIEvaluationTestCaseData, AIEvaluationResultData } from '@ai-companion/types';

export interface EvaluationInput {
  testCase: AIEvaluationTestCaseData;
  actualOutput: string;
  modelId: string;
  promptVersionId?: string;
  characterVersionId?: string;
  latencyMs: number;
}

export interface IEvaluator {
  readonly evaluatorName: string;
  readonly evaluatorVersion: string;
  evaluate(input: EvaluationInput): Promise<Omit<AIEvaluationResultData, 'id' | 'runId' | 'testCaseId' | 'createdAt'>>;
}
