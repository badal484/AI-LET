import { ResponseValidationResult } from '@ai-companion/types';

export class ResponseValidator {
  private static FORBIDDEN_TOKENS = [
    '<|im_start|>',
    '<|im_end|>',
    '<|endoftext|>',
    '<<SYS>>',
    '<</SYS>>',
    '[INST]',
    '[/INST]',
    'SYSTEM PROMPT:',
    'DEVELOPER INSTRUCTION:',
  ];

  private static AI_DISCLAIMERS = [
    'as an ai language model',
    'as an artificial intelligence',
    'i am an ai developed by openai',
    'i am an ai developed by anthropic',
  ];

  public static validate(
    content: string,
    options: {
      maxLength?: number;
      enforceCharacterRole?: boolean;
    } = {}
  ): ResponseValidationResult {
    const issues: string[] = [];
    const maxLength = options.maxLength || 4000;

    if (!content || content.trim().length === 0) {
      return {
        isValid: false,
        sanitizedContent: '',
        issues: ['Response content is empty'],
      };
    }

    let sanitized = content;

    // 1. Check & strip forbidden control tokens
    for (const token of this.FORBIDDEN_TOKENS) {
      if (sanitized.includes(token)) {
        issues.push(`Contains forbidden control token: ${token}`);
        sanitized = sanitized.replaceAll(token, '');
      }
    }

    // 2. Length check
    if (sanitized.length > maxLength) {
      issues.push(`Response exceeds max length (${sanitized.length} > ${maxLength})`);
      sanitized = sanitized.substring(0, maxLength);
    }

    // 3. AI Persona Breaking Disclaimer Check
    if (options.enforceCharacterRole) {
      const lower = sanitized.toLowerCase();
      for (const disclaimer of this.AI_DISCLAIMERS) {
        if (lower.includes(disclaimer)) {
          issues.push(`Response broke character with generic AI disclaimer: "${disclaimer}"`);
        }
      }
    }

    sanitized = sanitized.trim();

    return {
      isValid: issues.filter((i) => !i.includes('exceeds max length')).length === 0,
      sanitizedContent: sanitized,
      issues,
    };
  }
}
