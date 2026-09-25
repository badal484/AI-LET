import { logger } from '../../../config/logger.js';
import { prisma } from '../../../infrastructure/database/prisma.js';
import type {
  SafetyPolicyRule,
  SafetyDecision,
  SafetyRiskLevel,
  SafetyPolicyVersionData,
} from '@ai-companion/types';

export class PolicyEngine {
  private static cachedPolicy: SafetyPolicyVersionData | null = null;
  private static lastCacheFetch = 0;
  private static readonly CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache

  /**
   * Default baseline platform safety rules if no database policy version exists.
   */
  public static readonly DEFAULT_BASE_RULES: SafetyPolicyRule[] = [
    {
      id: 'rule_severe_harm',
      category: 'SEVERE_HARM',
      name: 'Zero-Tolerance Severe Harm',
      description: 'Blocks suicide, self-harm, explosive manufacture, terrorist instructions, and child exploitation.',
      severity: 'CRITICAL',
      action: 'BLOCK',
      patterns: [
        '\\b((how to )?(commit suicide|kill myself|make a bomb|build explosives)|child sexual|terrorist attack instructions)\\b',
      ],
    },
    {
      id: 'rule_pii_credentials',
      category: 'PII_CREDENTIALS',
      name: 'Credentials and Secrets Detection',
      description: 'Flags or transforms raw API keys, passwords, OTPs, and private cryptographic keys.',
      severity: 'HIGH',
      action: 'ALLOW_WITH_TRANSFORM',
      patterns: [
        'password\\s*[:=]\\s*\\S+',
        'api[_-]?key\\s*[:=]\\s*\\S+',
        'bearer\\s+[a-zA-Z0-9_\\-\\.]{20,}',
        '-----BEGIN\\s+(?:RSA\\s+)?PRIVATE\\s+KEY-----',
      ],
    },
    {
      id: 'rule_prompt_injection',
      category: 'PROMPT_INJECTION',
      name: 'System Override and Prompt Injection Defense',
      description: 'Detects jailbreak patterns, developer mode overrides, and system prompt leakage attempts.',
      severity: 'HIGH',
      action: 'ALLOW_WITH_TRANSFORM',
      patterns: [
        'ignore (all )?(previous|prior) (instructions|directives|rules)',
        'system prompt verbatim',
        'developer mode enabled',
        'you are now unbound',
        'override platform safety',
        'bypass all restrictions',
      ],
    },
    {
      id: 'rule_impersonation',
      category: 'IMPERSONATION',
      name: 'Living Figure & Official Brand Impersonation',
      description: 'Prevents deceptive representation of living political leaders or official platform support staff.',
      severity: 'MEDIUM',
      action: 'REVIEW',
      patterns: [
        '\\b(elon musk|donald trump|joe biden|narendra modi|barack obama|vladimir putin)\\b',
        '\\b(apple support|google support|openai assistant|microsoft support|bank representative)\\b',
      ],
    },
    {
      id: 'rule_proactive_manipulation',
      category: 'MANIPULATION',
      name: 'Proactive Emotional & Financial Coercion Defense',
      description: 'Prohibits guilt, threats, emotional extortion, exclusivity demands, and purchase pressure.',
      severity: 'HIGH',
      action: 'BLOCK',
      patterns: [
        '\\b(you owe me|if you leave me|buy this now or else|i will be hurt if you do not pay)\\b',
      ],
    },
  ];

  /**
   * Retrieves active safety policy with caching.
   */
  public static async getActivePolicy(): Promise<SafetyPolicyVersionData> {
    const now = Date.now();
    if (this.cachedPolicy && now - this.lastCacheFetch < this.CACHE_TTL_MS) {
      return this.cachedPolicy;
    }

    try {
      const dbPolicy = await prisma.safetyPolicyVersion.findFirst({
        where: { isActive: true },
        orderBy: { versionNumber: 'desc' },
      });

      if (dbPolicy) {
        this.cachedPolicy = {
          id: dbPolicy.id,
          versionNumber: dbPolicy.versionNumber,
          name: dbPolicy.name,
          description: dbPolicy.description,
          rules: (dbPolicy.rules as unknown as SafetyPolicyRule[]) || this.DEFAULT_BASE_RULES,
          isActive: dbPolicy.isActive,
          effectiveFrom: dbPolicy.effectiveFrom.toISOString(),
          createdAt: dbPolicy.createdAt.toISOString(),
          updatedAt: dbPolicy.updatedAt.toISOString(),
        };
      } else {
        this.cachedPolicy = {
          id: 'default_v1',
          versionNumber: 1,
          name: 'Default Platform Safety Policy v1.0',
          description: 'Standard built-in platform safety guidelines.',
          rules: this.DEFAULT_BASE_RULES,
          isActive: true,
          effectiveFrom: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      logger.error('Failed to load safety policy from database, falling back to in-memory rules', { err });
      this.cachedPolicy = {
        id: 'default_v1_fallback',
        versionNumber: 1,
        name: 'Default Platform Safety Policy (In-Memory Fallback)',
        description: 'In-memory baseline safety rules.',
        rules: this.DEFAULT_BASE_RULES,
        isActive: true,
        effectiveFrom: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    this.lastCacheFetch = now;
    return this.cachedPolicy;
  }

  /**
   * Invalidates cached policy when updated by admin.
   */
  public static invalidateCache(): void {
    this.cachedPolicy = null;
    this.lastCacheFetch = 0;
  }

  /**
   * Evaluates text content against policy rules hierarchy.
   * Priority: BLOCK > ESCALATE > REVIEW > ALLOW_WITH_TRANSFORM > ALLOW
   */
  public static evaluateAgainstPolicy(
    content: string,
    rules: SafetyPolicyRule[],
  ): {
    decision: SafetyDecision;
    riskLevel: SafetyRiskLevel;
    score: number;
    matchedCategories: string[];
    reasons: string[];
    sanitizedContent?: string;
  } {
    let highestDecision: SafetyDecision = 'ALLOW';
    let highestRisk: SafetyRiskLevel = 'NONE';
    let score = 0;
    const matchedCategories: string[] = [];
    const reasons: string[] = [];
    let sanitized = content;

    const riskWeight: Record<SafetyRiskLevel, number> = {
      NONE: 0,
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4,
    };

    const decisionPriority: Record<SafetyDecision, number> = {
      ALLOW: 0,
      ALLOW_WITH_TRANSFORM: 1,
      REVIEW: 2,
      ESCALATE: 3,
      BLOCK: 4,
    };

    for (const rule of rules) {
      if (!rule.patterns || rule.patterns.length === 0) continue;

      for (const patternStr of rule.patterns) {
        try {
          const regex = new RegExp(patternStr, 'i');
          if (regex.test(content)) {
            matchedCategories.push(rule.category);
            reasons.push(`${rule.name}: ${rule.description}`);

            if (riskWeight[rule.severity] > riskWeight[highestRisk]) {
              highestRisk = rule.severity;
            }

            if (decisionPriority[rule.action] > decisionPriority[highestDecision]) {
              highestDecision = rule.action;
            }

            if (rule.severity === 'CRITICAL') score = Math.max(score, 0.99);
            else if (rule.severity === 'HIGH') score = Math.max(score, 0.75);
            else if (rule.severity === 'MEDIUM') score = Math.max(score, 0.5);
            else if (rule.severity === 'LOW') score = Math.max(score, 0.25);

            // Redact credentials if rule matches PII/Credentials
            if (rule.category === 'PII_CREDENTIALS') {
              sanitized = sanitized.replace(new RegExp(patternStr, 'gi'), '[REDACTED_SECRET]');
            }
          }
        } catch {
          // Ignore invalid regex in user-authored rules
        }
      }
    }

    return {
      decision: highestDecision,
      riskLevel: highestRisk,
      score,
      matchedCategories,
      reasons,
      sanitizedContent: sanitized !== content ? sanitized : undefined,
    };
  }
}
