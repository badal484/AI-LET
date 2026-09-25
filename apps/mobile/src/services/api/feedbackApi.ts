import { ApiClient } from './client.js';
import { HumanFeedbackData } from '@ai-companion/types';

export interface SubmitFeedbackParams {
  generationTraceId?: string;
  score: 1 | -1;
  reasonCategory?:
    | 'not_relevant'
    | 'incorrect'
    | 'too_verbose'
    | 'wrong_personality'
    | 'repetitive'
    | 'language_issue'
    | 'other';
  comment?: string;
}

export const feedbackApi = {
  submitFeedback: async (params: SubmitFeedbackParams): Promise<HumanFeedbackData> => {
    const response = await ApiClient.getInstance().post<{ data: HumanFeedbackData }>('/feedback', params);
    return response.data.data;
  },
  /**
   * Persisted, ownership-checked feedback on one assistant message
   * (POST /conversations/:conversationId/messages/:messageId/feedback).
   */
  submitMessageFeedback: async (
    conversationId: string,
    messageId: string,
    input: { rating: 'THUMBS_UP' | 'THUMBS_DOWN'; reasonCategory?: SubmitFeedbackParams['reasonCategory']; feedbackText?: string },
  ): Promise<void> => {
    await ApiClient.getInstance().post(`/conversations/${conversationId}/messages/${messageId}/feedback`, input);
  },
};
