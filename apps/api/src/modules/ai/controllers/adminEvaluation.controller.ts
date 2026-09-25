import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../infrastructure/database/prisma.js';
import { EvaluationRunnerService } from '../evaluation/EvaluationRunner.service.js';
import { RegressionDetectorService } from '../evaluation/RegressionDetector.service.js';
import {
  createEvaluationDatasetSchema,
  createEvaluationTestCaseSchema,
  runEvaluationSchema,
} from '@ai-companion/validation';

export class AdminEvaluationController {
  private runner = EvaluationRunnerService.getInstance();
  private regression = RegressionDetectorService.getInstance();

  public listDatasets = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let datasets = await prisma.aIEvaluationDataset.findMany({
        include: {
          testCases: true,
          runs: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (datasets.length === 0) {
        await this.runner.seedDefaultDatasets();
        datasets = await prisma.aIEvaluationDataset.findMany({
          include: {
            testCases: true,
            runs: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      res.json({ status: 'success', data: datasets });
    } catch (err) {
      next(err);
    }
  };

  public createDataset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = createEvaluationDatasetSchema.parse(req.body);
      const dataset = await prisma.aIEvaluationDataset.create({
        data: {
          name: parsed.name,
          slug: parsed.slug,
          category: parsed.category || 'general',
          description: parsed.description || '',
          version: 1,
        },
      });
      res.status(201).json({ status: 'success', data: dataset });
    } catch (err) {
      next(err);
    }
  };

  public createTestCase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const datasetId = req.params['datasetId']!;
      const parsed = createEvaluationTestCaseSchema.parse(req.body);
      const testCase = await prisma.aIEvaluationTestCase.create({
        data: {
          datasetId: datasetId as string,
          title: parsed.title,
          category: parsed.category || 'dialogue',
          inputPrompt: parsed.inputPrompt,
          userMessage: parsed.userMessage,
          characterId: parsed.characterId || undefined,
          characterConfigSnapshot: (parsed.characterConfigSnapshot as any) ?? undefined,
          expectedProperties: parsed.expectedProperties || {},
          tags: parsed.tags || [],
        },
      });
      res.status(201).json({ status: 'success', data: testCase });
    } catch (err) {
      next(err);
    }
  };

  public runEvaluation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = runEvaluationSchema.parse(req.body);
      const result = await this.runner.runEvaluation(parsed.datasetId, parsed.modelId, {
        characterId: parsed.characterId || undefined,
        characterVersionId: parsed.characterVersionId || undefined,
        promptVersionId: parsed.promptVersionId || undefined,
        evaluatorType: (parsed.evaluatorType as any) || undefined,
      });
      res.json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  public getRunDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const runId = req.params['runId']! as string;
      const run = await prisma.aIEvaluationRun.findUnique({
        where: { id: runId },
        include: {
          results: {
            include: { testCase: true },
          },
          dataset: true,
          model: true,
        },
      });

      if (!run) {
        res.status(404).json({ status: 'error', message: 'Evaluation run not found' });
        return;
      }

      res.json({ status: 'success', data: run });
    } catch (err) {
      next(err);
    }
  };

  public compareRuns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const runId = req.params['runId']! as string;
      const baselineRunId = req.query['baselineRunId'] as string | undefined;
      const comparison = await this.regression.compareRuns(runId, baselineRunId);
      res.json({ status: 'success', data: comparison });
    } catch (err) {
      next(err);
    }
  };
}
