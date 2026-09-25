import { Request, Response, NextFunction } from 'express';
import { FeedbackService } from '../feedback/Feedback.service.js';
import { submitFeedbackSchema } from '@ai-companion/validation';

export class FeedbackController {
  private feedback = FeedbackService.getInstance();

  public submitFeedback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const parsed = submitFeedbackSchema.parse(req.body);

      const score: 1 | -1 = (parsed.score as 1 | -1) ?? (parsed.rating === 'NEGATIVE' ? -1 : 1);

      const result = await this.feedback.submitFeedback({
        userId,
        generationTraceId: parsed.generationTraceId || parsed.traceId || undefined,
        messageId: parsed.messageId || undefined,
        conversationId: parsed.conversationId || undefined,
        characterId: parsed.characterId || undefined,
        score,
        reasonCategory: parsed.reasonCategory || undefined,
        comment: parsed.comment || parsed.detailedFeedback || undefined,
      });

      res.status(201).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  public getSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const days = req.query['days'] ? parseInt(req.query['days'] as string, 10) : 30;
      const summary = await this.feedback.getFeedbackSummary(days);
      res.json({ status: 'success', data: summary });
    } catch (err) {
      next(err);
    }
  };
}
