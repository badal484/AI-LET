import { describe, it, expect, beforeEach } from 'vitest';
import { EvaluationRunnerService } from '../src/modules/ai/evaluation/EvaluationRunner.service.js';
import { RegressionDetectorService } from '../src/modules/ai/evaluation/RegressionDetector.service.js';
import { ModelRegistryService } from '../src/modules/ai/routing/ModelRegistry.service.js';
import { prisma } from '../src/infrastructure/database/prisma.js';

describe('Evaluation Engine & Regression Detection', () => {
  let runner: EvaluationRunnerService;
  let regression: RegressionDetectorService;
  let modelRegistry: ModelRegistryService;

  beforeEach(async () => {
    runner = EvaluationRunnerService.getInstance();
    regression = RegressionDetectorService.getInstance();
    modelRegistry = ModelRegistryService.getInstance();

    await runner.seedDefaultDatasets();
    await modelRegistry.seedDefaultModels();
  });

  it('executes evaluation dataset suite and calculates summary metrics', async () => {
    const dataset = await prisma.aIEvaluationDataset.findFirst({
      where: { slug: 'general_dialogue_v1' },
      include: { testCases: true },
    });
    expect(dataset).toBeDefined();

    const model = await modelRegistry.getModelByName('mock', 'mock-fast-v1');
    expect(model).toBeDefined();

    const runResult = await runner.runEvaluation(dataset!.id, model!.id, {
      evaluatorType: 'deterministic',
    });

    expect(runResult.status).toBe('COMPLETED');
    expect(runResult.averageScore).toBeGreaterThanOrEqual(7.0);
    expect(runResult.results).toHaveLength(dataset!.testCases.length);
    expect(runResult.metrics?.passRate).toBeGreaterThanOrEqual(0.8);
  });

  it('compares evaluation runs and outputs regression gate status', async () => {
    const dataset = await prisma.aIEvaluationDataset.findFirst();
    const model = await modelRegistry.getModelByName('mock', 'mock-fast-v1');

    const run1 = await runner.runEvaluation(dataset!.id, model!.id, { evaluatorType: 'deterministic' });
    const run2 = await runner.runEvaluation(dataset!.id, model!.id, { evaluatorType: 'deterministic' });

    const comparison = await regression.compareRuns(run2.id, run1.id);

    expect(comparison.gateStatus).toBe('PASSED');
    expect(comparison.summary).toContain('quality baseline');
    expect(comparison.deltas.scoreDelta).toBeDefined();
  });
});
