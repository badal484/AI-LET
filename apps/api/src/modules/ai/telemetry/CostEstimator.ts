import { AIModelData } from '@ai-companion/types';
import { SYSTEM_CONSTANTS } from '@ai-companion/config';

export class CostEstimator {
  public static calculateCost(
    promptTokens: number,
    completionTokens: number,
    model?: AIModelData | null,
    modelName?: string
  ): number {
    let inputRatePer1k = 0.00015;
    let outputRatePer1k = 0.0006;

    if (model) {
      inputRatePer1k = model.inputCostPer1k;
      outputRatePer1k = model.outputCostPer1k;
    } else if (modelName) {
      const defaultPricing = SYSTEM_CONSTANTS.AI_QUALITY?.DEFAULT_PRICING as any;
      const upperName = modelName.toUpperCase().replace(/-/g, '_');
      if (defaultPricing && defaultPricing[upperName]) {
        inputRatePer1k = defaultPricing[upperName].inputPer1k || 0.00015;
        outputRatePer1k = defaultPricing[upperName].outputPer1k || 0.0006;
      }
    }

    const inputCost = (promptTokens / 1000) * inputRatePer1k;
    const outputCost = (completionTokens / 1000) * outputRatePer1k;

    return Math.round((inputCost + outputCost) * 1000000) / 1000000;
  }
}
