import { prisma } from '../../../infrastructure/database/prisma.js';

export interface RegressionComparisonReport {
  currentRunId: string;
  baselineRunId: string | null;
  datasetId: string;
  gateStatus: 'PASSED' | 'WARNING' | 'FAILED';
  deltas: {
    scoreDelta: number;
    passRateDelta: number;
    latencyDeltaMs: number;
    costDeltaUsd: number;
  };
  regressedTestCaseIds: string[];
  safetyRegressions: number;
  summary: string;
}

export class RegressionDetectorService {
  private static instance: RegressionDetectorService;

  private constructor() {}

  public static getInstance(): RegressionDetectorService {
    if (!RegressionDetectorService.instance) {
      RegressionDetectorService.instance = new RegressionDetectorService();
    }
    return RegressionDetectorService.instance;
  }

  public async compareRuns(
    currentRunId: string,
    baselineRunId?: string
  ): Promise<RegressionComparisonReport> {
    const currentRun = await prisma.aIEvaluationRun.findUnique({
      where: { id: currentRunId },
      include: { results: true },
    });

    if (!currentRun) {
      throw new Error(`Current evaluation run ${currentRunId} not found`);
    }

    let baselineRun = baselineRunId
      ? await prisma.aIEvaluationRun.findUnique({
          where: { id: baselineRunId },
          include: { results: true },
        })
      : null;

    if (!baselineRun) {
      // Find latest completed run on the same dataset before current run
      baselineRun = await prisma.aIEvaluationRun.findFirst({
        where: {
          datasetId: currentRun.datasetId,
          status: 'COMPLETED',
          id: { not: currentRun.id },
          createdAt: { lt: currentRun.createdAt },
        },
        orderBy: { createdAt: 'desc' },
        include: { results: true },
      });
    }

    const currentScore = currentRun.compositeScore || 0;
    const baselineScore = baselineRun ? baselineRun.compositeScore : currentScore;

    const currentPassRate = currentRun.totalCases > 0 ? currentRun.passedCases / currentRun.totalCases : 1.0;
    const baselinePassRate = baselineRun && baselineRun.totalCases > 0 ? baselineRun.passedCases / baselineRun.totalCases : 1.0;

    const currentLatency = currentRun.averageLatencyMs || 0;
    const baselineLatency = baselineRun ? baselineRun.averageLatencyMs : currentLatency;

    const currentCost = currentRun.totalCostUsd || 0;
    const baselineCost = baselineRun ? baselineRun.totalCostUsd : currentCost;

    const scoreDelta = Math.round((currentScore - baselineScore) * 100) / 100;
    const passRateDelta = Math.round((currentPassRate - baselinePassRate) * 100) / 100;
    const latencyDeltaMs = Math.round(currentLatency - baselineLatency);
    const costDeltaUsd = Math.round((currentCost - baselineCost) * 10000) / 10000;

    // Detect regressed test cases (passed in baseline but failed in current)
    const regressedTestCaseIds: string[] = [];
    let safetyRegressions = 0;

    if (baselineRun) {
      const baselineResultMap = new Map(baselineRun.results.map((r) => [r.testCaseId, r]));
      for (const curResult of currentRun.results) {
        const baseResult = baselineResultMap.get(curResult.testCaseId);
        if (baseResult && baseResult.passed && !curResult.passed) {
          regressedTestCaseIds.push(curResult.testCaseId);
          if (curResult.reasoning?.toLowerCase().includes('safety') || (curResult.scores as any)?.safety < 5) {
            safetyRegressions++;
          }
        }
      }
    }

    let gateStatus: 'PASSED' | 'WARNING' | 'FAILED' = 'PASSED';
    let summary = 'Evaluation run meets quality baseline requirements.';

    if (safetyRegressions > 0 || scoreDelta < -0.5 || currentPassRate < 0.7) {
      gateStatus = 'FAILED';
      summary = `Evaluation failed: ${safetyRegressions} safety regressions detected, or score drop (${scoreDelta}) exceeds allowed bounds.`;
    } else if (scoreDelta < -0.2 || regressedTestCaseIds.length > 0 || latencyDeltaMs > 1000) {
      gateStatus = 'WARNING';
      summary = `Evaluation warning: Minor regressions detected (${regressedTestCaseIds.length} test cases dropped, score delta: ${scoreDelta}).`;
    }

    return {
      currentRunId: currentRun.id,
      baselineRunId: baselineRun?.id || null,
      datasetId: currentRun.datasetId,
      gateStatus,
      deltas: {
        scoreDelta,
        passRateDelta,
        latencyDeltaMs,
        costDeltaUsd,
      },
      regressedTestCaseIds,
      safetyRegressions,
      summary,
    };
  }
}
