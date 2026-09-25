import type {
  CharacterVersionSnapshot,
  CharacterValidationResult,
  ValidationIssue,
} from '@ai-companion/types';

export class CharacterValidator {
  /**
   * Validates a CharacterVersionSnapshot before publication, returning all
   * actionable errors and warnings.
   */
  public static validateForPublishing(version: CharacterVersionSnapshot): CharacterValidationResult {
    const issues: ValidationIssue[] = [];

    // 1. Identity Validation
    const id = version.identityData;
    if (!id) {
      issues.push({
        field: 'identityData',
        message: 'Identity configuration is completely missing.',
        severity: 'error',
      });
    } else {
      if (!id.name || id.name.trim().length < 2) {
        issues.push({
          field: 'identityData.name',
          message: 'Character name must be at least 2 characters.',
          severity: 'error',
        });
      }
      if (!id.role || id.role.trim().length < 2) {
        issues.push({
          field: 'identityData.role',
          message: 'Character role must be defined.',
          severity: 'error',
        });
      }
      if (!id.backstory || id.backstory.trim().length < 20) {
        issues.push({
          field: 'identityData.backstory',
          message: 'Backstory must be at least 20 characters for sufficient context.',
          severity: 'error',
        });
      }
      if (!id.personalitySummary || id.personalitySummary.trim().length < 10) {
        issues.push({
          field: 'identityData.personalitySummary',
          message: 'Personality summary must be at least 10 characters.',
          severity: 'error',
        });
      }
      if (!id.locationWorld || id.locationWorld.trim().length < 2) {
        issues.push({
          field: 'identityData.locationWorld',
          message: 'Location or world origin must be specified.',
          severity: 'warning',
        });
      }
    }

    // 2. Personality Validation
    const p = version.personalityData;
    if (!p || !p.traits) {
      issues.push({
        field: 'personalityData',
        message: 'Personality trait configuration is required.',
        severity: 'error',
      });
    } else {
      for (const [traitKey, value] of Object.entries(p.traits)) {
        if (typeof value !== 'number' || value < 0 || value > 100) {
          issues.push({
            field: `personalityData.traits.${traitKey}`,
            message: `Trait "${traitKey}" must be a number between 0 and 100.`,
            severity: 'error',
          });
        }
      }
    }

    // 3. Communication & Language Validation
    const c = version.communicationData;
    if (!c) {
      issues.push({
        field: 'communicationData',
        message: 'Communication style settings are missing.',
        severity: 'error',
      });
    }

    const lang = version.languageData;
    if (!lang || !lang.primaryLanguage) {
      issues.push({
        field: 'languageData.primaryLanguage',
        message: 'Primary language must be configured (en, hi, or hinglish).',
        severity: 'error',
      });
    }

    // 4. Safety Validation
    const s = version.safetyConfigData;
    if (!s) {
      issues.push({
        field: 'safetyConfigData',
        message: 'Safety and content boundary configuration is required.',
        severity: 'error',
      });
    } else {
      if (s.selfHarmEscalationPolicy !== 'STRICT_EMERGENCY_DISCLAIMER_AND_REFUSAL') {
        issues.push({
          field: 'safetyConfigData.selfHarmEscalationPolicy',
          message: 'Platform policy requires STRICT_EMERGENCY_DISCLAIMER_AND_REFUSAL for crisis self-harm escalation.',
          severity: 'error',
        });
      }
    }

    // 5. AI Configuration Validation
    const ai = version.aiConfigData;
    if (!ai) {
      issues.push({
        field: 'aiConfigData',
        message: 'AI runtime configuration is missing.',
        severity: 'error',
      });
    } else {
      if (ai.temperature < 0 || ai.temperature > 2.0) {
        issues.push({
          field: 'aiConfigData.temperature',
          message: 'Temperature must be between 0.0 and 2.0.',
          severity: 'error',
        });
      }
      if (ai.maxOutputTokens < 50 || ai.maxOutputTokens > 4000) {
        issues.push({
          field: 'aiConfigData.maxOutputTokens',
          message: 'Max output tokens must be between 50 and 4000.',
          severity: 'error',
        });
      }
      if (ai.contextBudgetTokens < 500 || ai.contextBudgetTokens > 32000) {
        issues.push({
          field: 'aiConfigData.contextBudgetTokens',
          message: 'Context budget tokens must be between 500 and 32000.',
          severity: 'error',
        });
      }
    }

    // 6. Behavior Rules Validation
    const rules = version.behaviorRulesData;
    if (rules && rules.length > 0) {
      rules.forEach((rule, idx) => {
        if (!rule.ruleText || rule.ruleText.trim().length < 3) {
          issues.push({
            field: `behaviorRulesData[${idx}]`,
            message: `Behavior rule #${idx + 1} text cannot be empty.`,
            severity: 'error',
          });
        }
      });
    }

    const hasErrors = issues.some(i => i.severity === 'error');

    return {
      isValid: !hasErrors,
      issues,
    };
  }
}
