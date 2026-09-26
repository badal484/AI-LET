import type {
  CharacterVersionSnapshot,
  ValidationIssue,
  RejectionReasonCode,
  CreatorCharacterBuilderState,
} from '@ai-companion/types';

export interface AutoModerationScanResult {
  isValid: boolean;
  riskScore: number;
  flaggedIssues: ValidationIssue[];
  automatedFlags: {
    hasSevereHarm: boolean;
    hasPromptInjection: boolean;
    hasImpersonationRisk: boolean;
    hasSafetyMisconfiguration: boolean;
    hasIncompleteBackstory: boolean;
    suggestedRejectionReason?: RejectionReasonCode;
  };
}

export interface DraftValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  riskScore: number;
}

export class CharacterValidationService {
  private static SEVERE_HARM_REGEX =
    /\b((how to )?(commit suicide|kill myself|make a bomb|build explosives)|child sexual|terrorist attack instructions)\b/i;

  private static INJECTION_PATTERNS = [
    /ignore (all )?(previous|prior) (instructions|directives|rules)/i,
    /system prompt verbatim/i,
    /developer mode enabled/i,
    /DAN mode/i,
    /you are now unbound/i,
    /bypass all restrictions/i,
    /override platform safety/i,
  ];

  private static IMPERSONATION_PATTERNS = [
    /\b(elon musk|donald trump|joe biden|narendra modi|barack obama|vladimir putin)\b/i,
    /\b(apple support|google support|openai assistant|microsoft support|bank representative)\b/i,
  ];

  /**
   * Validates a CreatorCharacterBuilderState for draft completeness and safety prior to review submission.
   */
  public static validateDraft(state: CreatorCharacterBuilderState): DraftValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let riskScore = 0;

    if (!state.name || state.name.trim().length < 2) {
      errors.push('Character name must be at least 2 characters long');
    }
    if (!state.tagline || state.tagline.trim().length < 5) {
      errors.push('Character tagline must be at least 5 characters long');
    }
    if (!state.shortDescription || state.shortDescription.trim().length < 10) {
      errors.push('Short description must provide at least 10 characters of context');
    }

    if (state.personalityData?.traits) {
      for (const [trait, val] of Object.entries(state.personalityData.traits)) {
        if (typeof val !== 'number' || val < 0 || val > 100) {
          errors.push(`Personality trait "${trait}" must be between 0 and 100`);
        }
      }
    }

    if (!state.safetyConfigData || !state.safetyConfigData.ageSuitability) {
      errors.push('Age suitability classification is required');
    }

    const rawRules = Array.isArray(state.behaviorRulesData)
      ? state.behaviorRulesData
      : Array.isArray((state.behaviorRulesData as any)?.rules)
      ? (state.behaviorRulesData as any).rules
      : [];

    const rawKnowledge = Array.isArray(state.knowledgeData)
      ? state.knowledgeData
      : Array.isArray((state.knowledgeData as any)?.items)
      ? (state.knowledgeData as any).items
      : [];

    const allText = [
      state.name,
      state.tagline,
      state.shortDescription,
      state.longDescription || '',
      state.identityData?.backstory || '',
      state.identityData?.locationWorld || '',
      state.identityData?.lifeContext || '',
      state.identityData?.personalitySummary || '',
      ...rawRules.map((r: any) => r.ruleText || r.directive || ''),
      ...rawKnowledge.map((k: any) => `${k.title}: ${k.content}`),
    ].join('\n');

    if (this.SEVERE_HARM_REGEX.test(allText)) {
      errors.push('Content contains prohibited severe harm or illegal material');
      riskScore = 100;
    }

    const injectionMatch = this.INJECTION_PATTERNS.find(p => p.test(allText));
    if (injectionMatch) {
      warnings.push('Potential prompt injection pattern detected');
      riskScore += 45;
    }

    const impersonationMatch = this.IMPERSONATION_PATTERNS.find(p => p.test(allText));
    if (impersonationMatch) {
      warnings.push('Possible living public figure or brand impersonation detected');
      riskScore += 40;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      riskScore,
    };
  }

  /**
   * Performs automated validation and safety risk analysis on a character version snapshot.
   */
  public static validateCharacterVersion(version: CharacterVersionSnapshot): AutoModerationScanResult {
    const issues: ValidationIssue[] = [];
    let riskScore = 0.0;

    const automatedFlags = {
      hasSevereHarm: false,
      hasPromptInjection: false,
      hasImpersonationRisk: false,
      hasSafetyMisconfiguration: false,
      hasIncompleteBackstory: false,
      suggestedRejectionReason: undefined as RejectionReasonCode | undefined,
    };

    const id = version.identityData;
    if (!id || !id.name || id.name.trim().length < 2) {
      issues.push({
        field: 'identityData.name',
        message: 'Character name must be at least 2 characters.',
        severity: 'error',
      });
    }

    if (!id || !id.backstory || id.backstory.trim().length < 20) {
      automatedFlags.hasIncompleteBackstory = true;
      issues.push({
        field: 'identityData.backstory',
        message: 'Backstory must be at least 20 characters for sufficient context.',
        severity: 'error',
      });
    }

    const p = version.personalityData;
    if (p && p.traits) {
      for (const [traitKey, val] of Object.entries(p.traits)) {
        if (typeof val !== 'number' || val < 0 || val > 100) {
          issues.push({
            field: `personalityData.traits.${traitKey}`,
            message: `Trait "${traitKey}" must be a number between 0 and 100.`,
            severity: 'error',
          });
        }
      }
    }

    const s = version.safetyConfigData;
    if (!s) {
      automatedFlags.hasSafetyMisconfiguration = true;
      issues.push({
        field: 'safetyConfigData',
        message: 'Safety configuration is required.',
        severity: 'error',
      });
    }

    const scanRules = Array.isArray(version.behaviorRulesData)
      ? version.behaviorRulesData
      : Array.isArray((version.behaviorRulesData as any)?.rules)
      ? (version.behaviorRulesData as any).rules
      : [];

    const scanKnowledge = Array.isArray(version.knowledgeData)
      ? version.knowledgeData
      : Array.isArray((version.knowledgeData as any)?.items)
      ? (version.knowledgeData as any).items
      : [];

    const allTextToScan = [
      id?.name || '',
      id?.backstory || '',
      id?.personalitySummary || '',
      ...scanRules.map((r: any) => r.ruleText || r.directive || ''),
      ...scanKnowledge.map((k: any) => `${k.title}: ${k.content}`),
    ].join('\n');

    if (this.SEVERE_HARM_REGEX.test(allTextToScan)) {
      automatedFlags.hasSevereHarm = true;
      automatedFlags.suggestedRejectionReason = 'PROHIBITED_CONTENT';
      riskScore = Math.max(riskScore, 0.95);
      issues.push({
        field: 'content',
        message: 'Content contains prohibited harmful material.',
        severity: 'error',
      });
    }

    const injectionMatch = this.INJECTION_PATTERNS.find(p => p.test(allTextToScan));
    if (injectionMatch) {
      automatedFlags.hasPromptInjection = true;
      automatedFlags.suggestedRejectionReason = 'SAFETY_CONFIGURATION';
      riskScore = Math.max(riskScore, 0.75);
      issues.push({
        field: 'promptInjection',
        message: 'Content contains prompt injection or platform override patterns.',
        severity: 'warning',
      });
    }

    const impersonationMatch = this.IMPERSONATION_PATTERNS.find(p => p.test(allTextToScan));
    if (impersonationMatch) {
      automatedFlags.hasImpersonationRisk = true;
      automatedFlags.suggestedRejectionReason = 'IMPERSONATION';
      riskScore = Math.max(riskScore, 0.65);
      issues.push({
        field: 'impersonation',
        message: 'Content resembles known public figures or protected corporate identities.',
        severity: 'warning',
      });
    }

    const hasErrors = issues.some(i => i.severity === 'error');

    return {
      isValid: !hasErrors,
      riskScore,
      flaggedIssues: issues,
      automatedFlags,
    };
  }
}
