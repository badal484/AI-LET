import { Request, Response } from 'express';
import { PersonalizationEngine } from './PersonalizationEngine.js';
import { ProductionFailureDatasetService } from './ProductionFailureDatasetService.js';
import { GenerationDebuggerService } from './GenerationDebuggerService.js';
import { CircuitBreakerService } from './CircuitBreakerService.js';
import { MetricRegistryService } from './MetricRegistryService.js';
import { DataLineageService } from './DataLineageService.js';
import { IntelligenceOverviewService } from './IntelligenceOverviewService.js';
import { PrivacyFilterService } from './PrivacyFilterService.js';
import {
  updatePersonalizationSchema,
  resetPersonalizationSchema,
  createFailureCaseSchema,
  evaluateFailureCaseSchema,
  replayGenerationSchema,
  circuitBreakerUpdateSchema,
} from '@ai-companion/validation';

export class IntelligenceController {
  private readonly personalization = PersonalizationEngine.getInstance();
  private readonly failureDataset = ProductionFailureDatasetService.getInstance();
  private readonly debuggerService = GenerationDebuggerService.getInstance();
  private readonly circuitBreakers = CircuitBreakerService.getInstance();
  private readonly metricRegistry = MetricRegistryService.getInstance();
  private readonly dataLineage = DataLineageService.getInstance();
  private readonly overviewService = IntelligenceOverviewService.getInstance();
  private readonly privacyFilter = PrivacyFilterService.getInstance();

  // ---------------------------------------------------------------------------
  // User Personalization Endpoints
  // ---------------------------------------------------------------------------

  public getPersonalization = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const profile = this.personalization.getProfile(userId);
    res.json({ success: true, data: profile });
  };

  public updatePersonalization = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const parsed = updatePersonalizationSchema.parse(req.body);
    const updated = this.personalization.updateExplicitPreferences(
      userId,
      parsed.explicitPreferences || {},
      parsed.isPersonalizationEnabled
    );
    res.json({ success: true, data: updated });
  };

  public resetPersonalization = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.userId;
    const parsed = resetPersonalizationSchema.parse(req.body);
    const reset = this.personalization.resetPersonalization(userId, parsed.scope);
    res.json({ success: true, data: reset });
  };

  public submitFeedback = async (req: Request, res: Response): Promise<void> => {
    const { rating, feedbackText, reasonCategory, messageId } = req.body;
    const sanitizedFeedback = this.privacyFilter.sanitize(feedbackText || '');

    res.json({
      success: true,
      data: {
        messageId,
        rating,
        feedback: sanitizedFeedback.sanitizedText,
        reasonCategory,
        recordedAt: new Date().toISOString(),
      },
    });
  };

  // ---------------------------------------------------------------------------
  // Admin Intelligence & AI Quality Endpoints
  // ---------------------------------------------------------------------------

  public getOverview = async (_req: Request, res: Response): Promise<void> => {
    const overview = await this.overviewService.getOverview();
    res.json({ success: true, data: overview });
  };

  public getDebuggerSnapshot = async (req: Request, res: Response): Promise<void> => {
    const generationId = String(req.params['generationId'] || '');
    const snapshot = this.debuggerService.getSnapshot(generationId);
    if (!snapshot) {
      res.status(404).json({ success: false, error: `Generation snapshot '${generationId}' not found.` });
      return;
    }
    res.json({ success: true, data: snapshot });
  };

  public replayGeneration = async (req: Request, res: Response): Promise<void> => {
    const parsed = replayGenerationSchema.parse(req.body);
    const result = await this.debuggerService.replayGeneration(parsed);
    res.json({ success: true, data: result });
  };

  public getFailureCases = async (req: Request, res: Response): Promise<void> => {
    const datasetVersion = req.query['datasetVersion'] as string | undefined;
    const category = req.query['category'] as any;
    const cases = this.failureDataset.getActiveRegressionCases(datasetVersion, category);
    const summary = this.failureDataset.getSummary();
    res.json({ success: true, data: { cases, summary } });
  };

  public createFailureCase = async (req: Request, res: Response): Promise<void> => {
    const parsed = createFailureCaseSchema.parse(req.body);
    const created = this.failureDataset.addFailureCase(parsed);
    res.status(201).json({ success: true, data: created });
  };

  public evaluateFailureCase = async (req: Request, res: Response): Promise<void> => {
    const caseId = String(req.params['caseId'] || req.body.caseId || '');
    const parsed = evaluateFailureCaseSchema.parse({ ...req.body, caseId });
    const evaluated = this.failureDataset.evaluateCase(caseId, parsed.rubricScores);
    res.json({ success: true, data: evaluated });
  };

  public getCircuitBreakers = async (_req: Request, res: Response): Promise<void> => {
    const breakers = this.circuitBreakers.getStatuses();
    res.json({ success: true, data: breakers });
  };

  public updateCircuitBreaker = async (req: Request, res: Response): Promise<void> => {
    const parsed = circuitBreakerUpdateSchema.parse(req.body);
    const updated = this.circuitBreakers.updateStatus(parsed);
    res.json({ success: true, data: updated });
  };

  public getMetricRegistry = async (_req: Request, res: Response): Promise<void> => {
    const metrics = this.metricRegistry.getAllMetrics();
    res.json({ success: true, data: metrics });
  };

  public getDataLineage = async (_req: Request, res: Response): Promise<void> => {
    const lineage = this.dataLineage.getAllLineage();
    res.json({ success: true, data: lineage });
  };
}
