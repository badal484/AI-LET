import { z } from 'zod';
import { AppError } from '../../../shared/errors/AppError.js';
import { AI_ERROR_CODES } from '@ai-companion/config';

export class StructuredOutputValidator {
  public static extractJsonString(rawText: string): string {
    const trimmed = rawText.trim();

    // 1. If wrapped in markdown code blocks: ```json ... ``` or ``` ... ```
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      return codeBlockMatch[1].trim();
    }

    // 2. Look for outer JSON object or array: { ... } or [ ... ]
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return trimmed.substring(firstBrace, lastBrace + 1).trim();
    }

    const firstBracket = trimmed.indexOf('[');
    const lastBracket = trimmed.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return trimmed.substring(firstBracket, lastBracket + 1).trim();
    }

    return trimmed;
  }

  public static parseAndValidate<T>(rawText: string, schema: z.ZodSchema<T>): T {
    const jsonStr = this.extractJsonString(rawText);

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr: any) {
      // Try bounded repair: strip trailing commas before closing braces/brackets
      const repaired = jsonStr.replace(/,\s*([}\]])/g, '$1');
      try {
        parsed = JSON.parse(repaired);
      } catch {
        throw new AppError(
          `Failed to parse structured AI output as JSON: ${parseErr.message}`,
          422,
          AI_ERROR_CODES.INVALID_RESPONSE
        );
      }
    }

    const result = schema.safeParse(parsed);
    if (!result.success) {
      throw new AppError(
        `AI structured output failed schema validation: ${result.error.issues.map((i) => i.message).join(', ')}`,
        422,
        AI_ERROR_CODES.INVALID_RESPONSE
      );
    }

    return result.data;
  }
}
