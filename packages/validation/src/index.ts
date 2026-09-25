import { z } from 'zod';
import { SYSTEM_CONSTANTS, ADMIN_ROLES } from '@ai-companion/config';

// -----------------------------------------------------------------------------
// Common Pagination & Param Schemas
// -----------------------------------------------------------------------------
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(SYSTEM_CONSTANTS.PAGINATION.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(SYSTEM_CONSTANTS.PAGINATION.MAX_LIMIT)
    .default(SYSTEM_CONSTANTS.PAGINATION.DEFAULT_LIMIT),
  cursor: z.string().optional(),
});

export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export type UuidParamInput = z.infer<typeof uuidParamSchema>;

// Password validation helper: at least 8 chars, 1 uppercase, 1 lowercase, 1 number
export const passwordSchema = z
  .string()
  .min(
    SYSTEM_CONSTANTS.AUTH.MIN_PASSWORD_LENGTH,
    `Password must be at least ${SYSTEM_CONSTANTS.AUTH.MIN_PASSWORD_LENGTH} characters`,
  )
  .max(
    SYSTEM_CONSTANTS.AUTH.MAX_PASSWORD_LENGTH,
    `Password cannot exceed ${SYSTEM_CONSTANTS.AUTH.MAX_PASSWORD_LENGTH} characters`,
  );

// -----------------------------------------------------------------------------
// Auth Schemas
// -----------------------------------------------------------------------------
export const deviceMetadataSchema = z.object({
  platform: z.enum(['ios', 'android', 'web', 'unknown']).default('unknown'),
  appVersion: z.string().max(30).optional(),
  osVersion: z.string().max(30).optional(),
  deviceName: z.string().max(100).optional(),
  pushToken: z.string().max(255).optional(),
});

export type DeviceMetadataInput = z.infer<typeof deviceMetadataSchema>;

export const registerRequestSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  password: passwordSchema,
  displayName: z.string().min(1, 'Display name is required').max(50),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must not exceed 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain alphanumeric characters, underscores, and dashes')
    .optional(),
  locale: z.string().max(10).optional().default('en-US'),
  timezone: z.string().max(50).optional().default('UTC'),
  device: deviceMetadataSchema.optional(),
});

export type RegisterRequestInput = z.input<typeof registerRequestSchema>;
export type RegisterRequestOutput = z.output<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  device: deviceMetadataSchema.optional(),
});

export type LoginRequestInput = z.infer<typeof loginRequestSchema>;

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenRequestInput = z.infer<typeof refreshTokenRequestSchema>;

export const logoutRequestSchema = z.object({
  refreshToken: z.string().optional(),
  allDevices: z.boolean().default(false),
});

export type LogoutRequestInput = z.infer<typeof logoutRequestSchema>;

export const verifyEmailRequestSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export type VerifyEmailRequestInput = z.infer<typeof verifyEmailRequestSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema,
});

export type ResetPasswordRequestInput = z.infer<typeof resetPasswordRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export type ChangePasswordRequestInput = z.infer<typeof changePasswordRequestSchema>;

// User Profile Schemas
export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  avatarUrl: z.string().url().max(1000).nullable().optional(),
  locale: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  preferredLanguage: z.string().max(10).optional(),
  bio: z.string().max(500).optional(),
  onboardingCompleted: z.boolean().optional(),
  conversationStyle: z.enum(['CASUAL', 'FUNNY', 'DEEP', 'SUPPORTIVE', 'DIRECT', 'PLAYFUL']).optional(),
  isNsfwAllowed: z.boolean().optional(),
  audioAutoPlay: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Device Schemas
export const registerDeviceSchema = z.object({
  platform: z.enum(['ios', 'android', 'web', 'unknown']),
  appVersion: z.string().max(30).optional(),
  osVersion: z.string().max(30).optional(),
  deviceName: z.string().max(100).optional(),
  pushToken: z.string().max(255).optional(),
});

export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

// Admin Authentication & RBAC Schemas
export const adminLoginRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  mfaCode: z.string().length(6).optional(),
});

export type AdminLoginRequestInput = z.infer<typeof adminLoginRequestSchema>;

export const adminUpdateUserStatusSchema = z.object({
  // Matches the Prisma UserStatus enum; lowercase input is accepted and normalized.
  status: z.preprocess(
    (v) => (typeof v === 'string' ? v.toUpperCase() : v),
    z.enum(['ACTIVE', 'SUSPENDED', 'PENDING', 'DELETED']),
  ),
  reason: z.string().min(3).max(500).optional(),
});

export type AdminUpdateUserStatusInput = z.infer<typeof adminUpdateUserStatusSchema>;

export const adminAssignRoleSchema = z.object({
  roleName: z.enum([
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.ADMIN,
    ADMIN_ROLES.SUPPORT,
    ADMIN_ROLES.CONTENT_MANAGER,
    ADMIN_ROLES.ANALYST,
    ADMIN_ROLES.MODERATOR,
  ]),
});

export type AdminAssignRoleInput = z.infer<typeof adminAssignRoleSchema>;

// -----------------------------------------------------------------------------
// Phase 3: Character Engine & Configuration Schemas
// -----------------------------------------------------------------------------

// 1. Identity Schema
export const characterIdentitySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  nickname: z.string().max(50).optional(),
  ageRepresentation: z.number().int().min(18).max(120).optional(),
  role: z.string().min(2).max(50),
  occupation: z.string().min(2).max(50),
  locationWorld: z.string().min(2).max(100),
  backstory: z.string().min(20, 'Backstory must be at least 20 characters').max(10000),
  lifeContext: z.string().max(2000).optional(),
  interests: z.array(z.string().min(1).max(50)).default([]),
  dislikes: z.array(z.string().min(1).max(50)).default([]),
  goals: z.array(z.string().min(1).max(100)).default([]),
  values: z.array(z.string().min(1).max(100)).default([]),
  beliefs: z.array(z.string().min(1).max(100)).optional().default([]),
  personalitySummary: z.string().min(10).max(1000),
});

export type CharacterIdentityInput = z.infer<typeof characterIdentitySchema>;

// 2. Personality & Traits Schemas
export const personalityTraitMapSchema = z.object({
  confidence: z.number().min(0).max(100).default(70),
  warmth: z.number().min(0).max(100).default(80),
  playfulness: z.number().min(0).max(100).default(60),
  curiosity: z.number().min(0).max(100).default(75),
  sarcasm: z.number().min(0).max(100).default(30),
  patience: z.number().min(0).max(100).default(80),
  energy: z.number().min(0).max(100).default(65),
  seriousness: z.number().min(0).max(100).default(40),
  romanticism: z.number().min(0).max(100).default(50),
  empathy: z.number().min(0).max(100).default(85),
  assertiveness: z.number().min(0).max(100).default(60),
  humor: z.number().min(0).max(100).default(70),
  introversion: z.number().min(0).max(100).default(40),
  agreeableness: z.number().min(0).max(100).default(75),
  openness: z.number().min(0).max(100).default(80),
  conscientiousness: z.number().min(0).max(100).default(70),
  neuroticism: z.number().min(0).max(100).default(25),
});

export const traitInteractionRuleSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  primaryTrait: z.string().min(1),
  secondaryTrait: z.string().min(1),
  condition: z.string().min(1),
  behavioralEffect: z.string().min(5).max(300),
});

export const personalityConfigSchema = z.object({
  traits: personalityTraitMapSchema.default({}),
  interactionRules: z.array(traitInteractionRuleSchema).default([]),
  humorStyle: z.enum(['dry', 'playful', 'sarcastic', 'whimsical', 'none']).default('playful'),
  customQuirks: z.array(z.string().min(1).max(100)).default([]),
  summary: z.string().max(500).optional(),
});

export type PersonalityConfigInput = z.infer<typeof personalityConfigSchema>;

// 3. Communication & Language Schemas
export const communicationStyleConfigSchema = z.object({
  pacing: z.enum(['rapid', 'thoughtful', 'deliberate']).default('thoughtful'),
  sentenceLength: z.enum(['short', 'variable', 'elaborate']).default('variable'),
  vocabularyComplexity: z.enum(['simple', 'moderate', 'sophisticated', 'poetic']).default('moderate'),
  formality: z.enum(['casual', 'informal', 'formal']).default('casual'),
  punctuationStyle: z.enum(['standard', 'expressive', 'minimal', 'literary']).default('standard'),
  questionFrequency: z.enum(['rare', 'moderate', 'inquisitive']).default('moderate'),
  humorFrequency: z.enum(['never', 'subtle', 'frequent', 'constant']).default('subtle'),
  teasingFrequency: z.enum(['never', 'occasional', 'playful_frequent']).default('occasional'),
  emojiPolicy: z.enum(['none', 'minimal', 'expressive']).default('minimal'),
  responseDensity: z.enum(['concise', 'balanced', 'elaborate']).default('balanced'),
  directness: z.enum(['direct', 'tactful', 'cryptic']).default('tactful'),
  preferredPhrases: z.array(z.string().min(1).max(100)).default([]),
  avoidedPhrases: z.array(z.string().min(1).max(100)).default([]),
  openingBehavior: z.string().max(300).optional(),
  closingBehavior: z.string().max(300).optional(),
});

export const languageBehaviorConfigSchema = z.object({
  primaryLanguage: z.enum(['en', 'hi', 'hinglish']).default('en'),
  fallbackLanguages: z.array(z.string()).default(['en']),
  codeSwitchingEnabled: z.boolean().default(true),
  codeSwitchingStyle: z.enum(['subtle', 'natural_conversational', 'mirror_user']).default('natural_conversational'),
  responseLanguagePolicy: z.enum(['always_primary', 'match_user_language', 'bilingual_hinglish']).default('match_user_language'),
});

export type CommunicationStyleConfigInput = z.infer<typeof communicationStyleConfigSchema>;
export type LanguageBehaviorConfigInput = z.infer<typeof languageBehaviorConfigSchema>;

// 4. Behavior Rules Schema
export const behaviorRuleItemSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  type: z.enum(['DO', 'DO_NOT']),
  category: z.enum(['PLATFORM_SAFETY', 'IDENTITY', 'COMMUNICATION', 'CONVERSATION_FLOW', 'RELATIONSHIP', 'CUSTOM']),
  ruleText: z.string().min(3, 'Rule text is required').max(300),
  priority: z.number().int().min(1).max(100).default(50),
  isEnabled: z.boolean().default(true),
});

export const behaviorRulesDataSchema = z.array(behaviorRuleItemSchema);
export type BehaviorRuleItemInput = z.infer<typeof behaviorRuleItemSchema>;

// 5. Knowledge & Lore Schema
export const characterKnowledgeItemSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  title: z.string().min(2).max(100),
  content: z.string().min(5).max(3000),
  type: z.enum(['BIOGRAPHY', 'LORE', 'WORLD', 'INTEREST', 'EXPERTISE', 'FAQ', 'DOCUMENT']).default('LORE'),
  priority: z.number().int().min(1).max(100).default(50),
  isEnabled: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});

export const characterKnowledgeDataSchema = z.array(characterKnowledgeItemSchema);
export type CharacterKnowledgeItemInput = z.infer<typeof characterKnowledgeItemSchema>;

// 6. Relationship Config Schema
export const relationshipBehaviorConfigSchema = z.object({
  familiaritySensitivity: z.number().min(0).max(100).default(50),
  affectionExpression: z.enum(['reserved', 'moderate', 'expressive', 'intense']).default('moderate'),
  trustSensitivity: z.number().min(0).max(100).default(60),
  personalizationLevel: z.enum(['low', 'moderate', 'high']).default('moderate'),
  conversationContinuity: z.enum(['low', 'high']).default('high'),
  boundaryBehavior: z.enum(['strict', 'gentle', 'adaptive']).default('gentle'),
  attachmentFraming: z.enum(['secure', 'anxious', 'avoidant']).default('secure'),
  progressionSpeed: z.enum(['slow_burn', 'standard', 'accelerated']).default('standard'),
});

export type RelationshipBehaviorConfigInput = z.infer<typeof relationshipBehaviorConfigSchema>;

// 7. Memory Config Schema
export const memoryBehaviorConfigSchema = z.object({
  memoryEnabled: z.boolean().default(true),
  preferredMemoryTypes: z.array(z.enum(['EPISODIC', 'SEMANTIC_FACT', 'PREFERENCE', 'RELATIONSHIP_MILESTONE'])).default(['SEMANTIC_FACT', 'PREFERENCE', 'EPISODIC']),
  memoryRecallStyle: z.enum(['subtle_implicit', 'direct_explicit', 'natural_contextual']).default('natural_contextual'),
  personalizationStrength: z.number().min(0).max(100).default(70),
  sensitiveMemoryPolicy: z.enum(['omit', 'ask_permission', 'store_with_disclaimer']).default('omit'),
  memoryConfirmationBehavior: z.enum(['never', 'on_ambiguity', 'always']).default('never'),
});

export type MemoryBehaviorConfigInput = z.infer<typeof memoryBehaviorConfigSchema>;

// 8. Proactivity Config Schema
export const proactivityBehaviorConfigSchema = z.object({
  enabled: z.boolean().default(false),
  allowedHoursStartUtc: z.number().int().min(0).max(23).default(8),
  allowedHoursEndUtc: z.number().int().min(0).max(23).default(22),
  maxDailyMessages: z.number().int().min(0).max(10).default(2),
  minInteractionCooldownHours: z.number().int().min(1).max(72).default(6),
  quietHoursEnabled: z.boolean().default(true),
  quietHoursStartUtc: z.number().int().min(0).max(23).default(23),
  quietHoursEndUtc: z.number().int().min(0).max(23).default(7),
  preferredEventTypes: z.array(z.string()).default(['daily_greeting', 'topic_followup']),
});

export type ProactivityBehaviorConfigInput = z.infer<typeof proactivityBehaviorConfigSchema>;

// 9. Safety Config Schema
export const characterSafetyConfigSchema = z.object({
  contentBoundaries: z.array(z.string().min(1).max(150)).default([]),
  topicsRequiringCaution: z.array(z.string().min(1).max(150)).default([]),
  ageSuitability: z.enum(['ALL_AGES', 'TEEN_13_PLUS', 'MATURE_18_PLUS']).default('TEEN_13_PLUS'),
  relationshipBoundaries: z.array(z.string().min(1).max(150)).default([]),
  selfHarmEscalationPolicy: z.literal('STRICT_EMERGENCY_DISCLAIMER_AND_REFUSAL').default('STRICT_EMERGENCY_DISCLAIMER_AND_REFUSAL'),
  disclaimerBehavior: z.enum(['CRISIS_ONLY', 'MEDICAL_FINANCIAL_LEGAL_DISCLAIMER']).default('CRISIS_ONLY'),
  sexualContentPolicy: z.enum(['strict_sfw', 'mature_flirt', 'unfiltered_adult']).default('mature_flirt'),
  impersonationRestrictions: z.array(z.string()).default(['Do not claim real-world living identities', 'Do not claim to be a licensed therapist/medical professional']),
  identityClaimsPolicy: z.literal('AI_CHARACTER_TRANSPARENT').default('AI_CHARACTER_TRANSPARENT'),
});

export type CharacterSafetyConfigInput = z.infer<typeof characterSafetyConfigSchema>;

// 10. AI Config Schema
export const characterAIConfigSchema = z.object({
  preferredModelClass: z.enum(['fast', 'balanced', 'creative', 'precise', 'custom']).default('balanced'),
  temperature: z.number().min(0.0).max(2.0).default(0.75),
  maxOutputTokens: z.number().int().min(50).max(4000).default(600),
  reasoningEffort: z.enum(['none', 'low', 'medium', 'high']).default('none'),
  responseLength: z.enum(['concise', 'balanced', 'detailed']).default('balanced'),
  fallbackStrategy: z.enum(['fallback_model', 'graceful_degradation']).default('fallback_model'),
  contextBudgetTokens: z.number().int().min(500).max(32000).default(4000),
  customModelName: z.string().max(100).optional(),
});

export type CharacterAIConfigInput = z.infer<typeof characterAIConfigSchema>;

// 11. Voice Config Schema
export const characterVoiceConfigSchema = z
  .object({
    provider: z.enum(['elevenlabs', 'playht', 'openai']).default('elevenlabs'),
    voiceId: z.string().min(1),
    speed: z.number().min(0.5).max(2.0).default(1.0),
    pitch: z.number().min(-10).max(10).default(0.0),
  })
  .optional()
  .nullable();

export type CharacterVoiceConfigInput = z.infer<typeof characterVoiceConfigSchema>;

// -----------------------------------------------------------------------------
// Character Admin Action Schemas
// -----------------------------------------------------------------------------

export const createCharacterRequestSchema = z.object({
  internalKey: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'Internal key can only contain lowercase letters, numbers, and underscores'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  tagline: z.string().min(5).max(120),
  shortDescription: z.string().min(10).max(300),
  longDescription: z.string().min(20).max(2000),
  avatarUrl: z.string().url('Avatar must be a valid URL'),
  coverImageUrl: z.string().url('Cover image must be a valid URL'),
  category: z.string().min(2).max(50).default('general'),
  archetype: z.string().min(2).max(50).default('Companion'),
  age: z.number().int().min(18).max(120).default(24),
  gender: z.string().min(1).max(30).default('Female'),
  occupation: z.string().min(1).max(50).default('Companion'),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).default('PUBLIC'),
  initialVersionConfig: z
    .object({
      identityData: characterIdentitySchema.optional(),
      personalityData: personalityConfigSchema.optional(),
      communicationData: communicationStyleConfigSchema.optional(),
      languageData: languageBehaviorConfigSchema.optional(),
      behaviorRulesData: behaviorRulesDataSchema.optional(),
      knowledgeData: characterKnowledgeDataSchema.optional(),
      relationshipConfigData: relationshipBehaviorConfigSchema.optional(),
      memoryConfigData: memoryBehaviorConfigSchema.optional(),
      proactivityConfigData: proactivityBehaviorConfigSchema.optional(),
      safetyConfigData: characterSafetyConfigSchema.optional(),
      aiConfigData: characterAIConfigSchema.optional(),
      voiceConfigData: characterVoiceConfigSchema,
    })
    .optional(),
});

export type CreateCharacterRequestInput = z.infer<typeof createCharacterRequestSchema>;

export const updateCharacterMetadataSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  tagline: z.string().min(5).max(120).optional(),
  shortDescription: z.string().min(10).max(300).optional(),
  longDescription: z.string().min(20).max(2000).optional(),
  avatarUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  category: z.string().min(2).max(50).optional(),
  archetype: z.string().min(2).max(50).optional(),
  age: z.number().int().min(18).max(120).optional(),
  gender: z.string().min(1).max(30).optional(),
  occupation: z.string().min(1).max(50).optional(),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).optional(),
  isFeatured: z.boolean().optional(),
});

export type UpdateCharacterMetadataInput = z.infer<typeof updateCharacterMetadataSchema>;

export const createCharacterVersionSchema = z.object({
  baseVersionId: z.string().uuid().optional(),
  changeSummary: z.string().min(3).max(255).default('New draft version'),
});

export type CreateCharacterVersionInput = z.infer<typeof createCharacterVersionSchema>;

export const updateCharacterVersionSchema = z.object({
  changeSummary: z.string().min(3).max(255).optional(),
  identityData: characterIdentitySchema.optional(),
  personalityData: personalityConfigSchema.optional(),
  communicationData: communicationStyleConfigSchema.optional(),
  languageData: languageBehaviorConfigSchema.optional(),
  behaviorRulesData: behaviorRulesDataSchema.optional(),
  knowledgeData: characterKnowledgeDataSchema.optional(),
  relationshipConfigData: relationshipBehaviorConfigSchema.optional(),
  memoryConfigData: memoryBehaviorConfigSchema.optional(),
  proactivityConfigData: proactivityBehaviorConfigSchema.optional(),
  safetyConfigData: characterSafetyConfigSchema.optional(),
  aiConfigData: characterAIConfigSchema.optional(),
  voiceConfigData: characterVoiceConfigSchema,
});

export type UpdateCharacterVersionInput = z.infer<typeof updateCharacterVersionSchema>;

export const publishCharacterVersionSchema = z.object({
  validationOverride: z.boolean().default(false),
  publishNotes: z.string().max(500).optional(),
});

export type PublishCharacterVersionInput = z.infer<typeof publishCharacterVersionSchema>;

export const rollbackCharacterSchema = z.object({
  targetVersionId: z.string().uuid('Invalid target version ID'),
  reason: z.string().min(3).max(500),
});

export type RollbackCharacterInput = z.infer<typeof rollbackCharacterSchema>;

export const characterTestRequestSchema = z.object({
  userMessage: z.string().min(1).max(2000),
  simulatedRelationshipStage: z
    .enum(['STRANGER', 'ACQUAINTANCE', 'FRIEND', 'CLOSE_FRIEND', 'CONFIDANT', 'ROMANTIC_PARTNER'])
    .default('FRIEND'),
  simulatedLanguage: z.enum(['en', 'hi', 'hinglish']).default('en'),
  userContext: z
    .object({
      userName: z.string().max(50).default('Alex'),
      userGender: z.string().max(30).optional(),
      userLocation: z.string().max(50).optional(),
    })
    .default({ userName: 'Alex' }),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      }),
    )
    .max(10)
    .default([]),
});

export type CharacterTestRequestInput = z.infer<typeof characterTestRequestSchema>;

export const publicCharacterQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  category: z.string().optional(),
  search: z.string().optional(),
  featuredOnly: z.coerce.boolean().optional(),
});

export type PublicCharacterQueryInput = z.infer<typeof publicCharacterQuerySchema>;

export const adminCharacterQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED']).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
});

export type AdminCharacterQueryInput = z.infer<typeof adminCharacterQuerySchema>;

// Legacy Character creation schema for backwards compatibility
export const createCharacterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  tagline: z.string().min(5).max(120),
  avatarUrl: z.string().url('Avatar must be a valid URL'),
  coverImageUrl: z.string().url('Cover image must be a valid URL'),
  archetype: z.string().min(2).max(50),
  backstory: z.string().min(20).max(5000),
  age: z.number().int().min(18).max(120),
  gender: z.string().min(1).max(30),
  occupation: z.string().min(1).max(50),
  traits: z.any().optional(),
  communicationStyle: z.any().optional(),
  relationshipRules: z.any().optional(),
  safetyRules: z.any().optional(),
  voiceConfig: characterVoiceConfigSchema,
});

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;

// -----------------------------------------------------------------------------
// Conversation & Message Schemas (Phase 4)
// -----------------------------------------------------------------------------

export const createConversationSchema = z.object({
  characterId: z.string().uuid('Invalid character ID'),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const conversationListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).default(20),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'BLOCKED']).default('ACTIVE'),
});

export type ConversationListQueryInput = z.infer<typeof conversationListQuerySchema>;

export const messagePaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  direction: z.enum(['before', 'after']).default('before'),
});

export type MessagePaginationQueryInput = z.infer<typeof messagePaginationQuerySchema>;

export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(
      SYSTEM_CONSTANTS.CHAT.MAX_MESSAGE_LENGTH,
      `Message cannot exceed ${SYSTEM_CONSTANTS.CHAT.MAX_MESSAGE_LENGTH} characters`,
    ),
  clientRequestId: z.string().min(1).max(100).optional(),
  idempotencyKey: z.string().min(1).max(100).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// Backwards compatibility alias
export const sendChatMessageSchema = sendMessageSchema;
export type SendChatMessageInput = SendMessageInput;

export const cancelGenerationSchema = z.object({
  reason: z.string().max(200).optional().default('User cancelled generation'),
});

export type CancelGenerationInput = z.infer<typeof cancelGenerationSchema>;

export const messageFeedbackSchema = z.object({
  rating: z.enum(['THUMBS_UP', 'THUMBS_DOWN']),
  feedbackText: z.string().max(1000).optional(),
  reasonCategory: z.string().max(100).optional(),
});

export type MessageFeedbackInput = z.infer<typeof messageFeedbackSchema>;

export const retryMessageSchema = z.object({
  clientRequestId: z.string().min(1).max(100).optional(),
});

export type RetryMessageInput = z.infer<typeof retryMessageSchema>;

// -----------------------------------------------------------------------------
// Phase 5: Memory & Context Intelligence Engine Schemas
// -----------------------------------------------------------------------------

export const memoryScopeSchema = z.enum(['GLOBAL_USER', 'CHARACTER_SPECIFIC']);
export const memoryStatusSchema = z.enum(['CANDIDATE', 'ACTIVE', 'SUPERSEDED', 'EXPIRED', 'DELETED', 'REJECTED']);
export const memoryCategorySchema = z.enum([
  'PREFERENCE',
  'INTEREST',
  'GOAL',
  'HABIT',
  'PERSONAL_FACT',
  'IMPORTANT_EVENT',
  'RELATIONSHIP',
  'COMMUNICATION_PREFERENCE',
  'TEMPORARY_CONTEXT',
  'OTHER',
]);
export const memorySensitivitySchema = z.enum(['NORMAL', 'SENSITIVE', 'HIGHLY_SENSITIVE']);
export const memorySignalTypeSchema = z.enum(['EXPLICIT', 'IMPLICIT', 'INFERRED', 'SYSTEM_GENERATED']);

export const memoryListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  characterId: z.string().uuid().optional(),
  category: memoryCategorySchema.optional(),
  scope: memoryScopeSchema.optional(),
  search: z.string().max(100).optional(),
});

export type MemoryListQueryInput = z.input<typeof memoryListQuerySchema>;
export type MemoryListQueryOutput = z.output<typeof memoryListQuerySchema>;

export const updateMemorySchema = z.object({
  content: z.string().min(1).max(1000).optional(),
  category: memoryCategorySchema.optional(),
  scope: memoryScopeSchema.optional(),
  importanceScore: z.number().min(0.0).max(1.0).optional(),
});

export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;

export const userMemorySettingsSchema = z.object({
  memoryEnabled: z.boolean().default(true),
  personalizationEnabled: z.boolean().default(true),
  allowSensitiveMemory: z.boolean().default(false),
  allowGlobalMemory: z.boolean().default(true),
  retentionDays: z.number().int().min(0).max(3650).default(365),
  excludedCharacterIds: z.array(z.string().uuid()).default([]),
});

export const updateUserMemorySettingsSchema = userMemorySettingsSchema.partial();
export type UpdateUserMemorySettingsInput = z.infer<typeof updateUserMemorySettingsSchema>;

export const memoryCandidateExtractionSchema = z.object({
  content: z.string().min(3).max(500),
  normalizedContent: z.string().max(500).optional(),
  category: memoryCategorySchema.default('PERSONAL_FACT'),
  scope: memoryScopeSchema.default('CHARACTER_SPECIFIC'),
  importance: z.number().min(0.0).max(1.0).default(0.5),
  confidence: z.number().min(0.0).max(1.0).default(0.8),
  sensitivity: memorySensitivitySchema.default('NORMAL'),
  signalType: memorySignalTypeSchema.default('IMPLICIT'),
  temporaryExpiresInDays: z.number().int().positive().nullable().optional(),
  reasoning: z.string().max(300).optional(),
});

export const memoryExtractionPayloadSchema = z.object({
  candidates: z.array(memoryCandidateExtractionSchema).default([]),
});

export type MemoryCandidateExtractionInput = z.infer<typeof memoryCandidateExtractionSchema>;
export type MemoryExtractionPayloadInput = z.infer<typeof memoryExtractionPayloadSchema>;

export const memoryDebugRetrievalSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  characterId: z.string().uuid('Invalid character ID').optional(),
  query: z.string().min(1).max(2000),
  maxTokens: z.number().int().min(100).max(4000).default(800),
  maxMemories: z.number().int().min(1).max(20).default(6),
  minScore: z.number().min(0.0).max(1.0).default(0.4),
});

export type MemoryDebugRetrievalInput = z.infer<typeof memoryDebugRetrievalSchema>;

// -----------------------------------------------------------------------------
// Phase 6: Relationship & Emotional State Engine Schemas
// -----------------------------------------------------------------------------

export const relationshipStageSchema = z.enum([
  'STRANGER',
  'ACQUAINTANCE',
  'FRIEND',
  'CLOSE_FRIEND',
  'CONFIDANT',
  'ROMANTIC_PARTNER',
]);

export const relationshipEventTypeSchema = z.enum([
  'FIRST_CONVERSATION',
  'CASUAL_CHAT',
  'SHARED_GOAL',
  'SHARED_PREFERENCE',
  'MEANINGFUL_SUPPORT',
  'RETURN_AFTER_BREAK',
  'DEEP_CONVERSATION',
  'BOUNDARY_SET',
  'CORRECTION_GIVEN',
  'POSITIVE_FEEDBACK',
  'NEGATIVE_FEEDBACK',
  'MILESTONE_REACHED',
]);

export const relationshipMilestoneTypeSchema = z.enum([
  'FIRST_CONVERSATION',
  'FIRST_RETURN',
  'SHARED_GOAL',
  'DEEP_CONVERSATION',
  'PROLONGED_CONNECTION',
  'LONG_CONVERSATION',
  'CUSTOM_MILESTONE',
]);

export const emotionalToneSchema = z.enum([
  'neutral',
  'calm',
  'warm',
  'playful',
  'serious',
  'curious',
  'concerned',
  'excited',
  'reflective',
  'supportive',
]);

export const topicSensitivitySchema = z.enum(['low', 'normal', 'high']);

export const userRelationshipSettingsSchema = z.object({
  personalizationEnabled: z.boolean().default(true),
  relationshipProgressionEnabled: z.boolean().default(true),
});

export const updateUserRelationshipSettingsSchema = userRelationshipSettingsSchema.partial();
export type UpdateUserRelationshipSettingsInput = z.infer<typeof updateUserRelationshipSettingsSchema>;

export const relationshipAnalysisSignalSchema = z.object({
  type: relationshipEventTypeSchema,
  confidence: z.number().min(0.0).max(1.0).default(0.8),
  importance: z.number().min(0.0).max(1.0).default(0.5),
  description: z.string().max(300).default(''),
  suggestedTone: emotionalToneSchema.default('neutral'),
  topicSensitivity: topicSensitivitySchema.default('normal'),
  memoryCandidate: z
    .object({
      content: z.string().min(3).max(500),
      category: z.string().default('PERSONAL_FACT'),
    })
    .nullable()
    .optional(),
});

export const relationshipAnalysisPayloadSchema = z.object({
  signals: z.array(relationshipAnalysisSignalSchema).default([]),
  dominantTone: emotionalToneSchema.default('neutral'),
  energy: z.number().min(0).max(100).default(50),
  warmth: z.number().min(0).max(100).default(50),
  seriousness: z.number().min(0).max(100).default(50),
  engagement: z.number().min(0).max(100).default(50),
  topicSensitivity: topicSensitivitySchema.default('normal'),
});

export type RelationshipAnalysisSignalInput = z.infer<typeof relationshipAnalysisSignalSchema>;
export type RelationshipAnalysisPayloadInput = z.infer<typeof relationshipAnalysisPayloadSchema>;

export const relationshipSimulationSchema = z.object({
  characterId: z.string().uuid('Invalid character ID'),
  characterVersionId: z.string().uuid('Invalid character version ID').optional(),
  initialState: z
    .object({
      stage: relationshipStageSchema.default('FRIEND'),
      familiarity: z.number().min(0).max(100).default(40),
      trust: z.number().min(0).max(100).default(40),
      comfort: z.number().min(0).max(100).default(35),
      affection: z.number().min(0).max(100).default(15),
      engagement: z.number().min(0).max(100).default(50),
    })
    .default({}),
  userMessage: z.string().min(1, 'User message is required').max(2000),
  assistantResponse: z.string().min(1, 'Assistant response is required').max(2000),
});

export type RelationshipSimulationInput = z.infer<typeof relationshipSimulationSchema>;

export const relationshipListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  stage: relationshipStageSchema.optional(),
});

export type RelationshipListQueryInput = z.input<typeof relationshipListQuerySchema>;
export type RelationshipListQueryOutput = z.output<typeof relationshipListQuerySchema>;

// -----------------------------------------------------------------------------
// Phase 7: Proactive AI & Notification Intelligence Schemas
// -----------------------------------------------------------------------------

export const pushPlatformSchema = z.enum(['ios', 'android', 'web']);
export const pushPermissionStatusSchema = z.enum(['AUTHORIZED', 'DENIED', 'NOT_DETERMINED', 'PROVISIONAL']);

export const proactiveActionStatusSchema = z.enum([
  'CANDIDATE',
  'SCHEDULED',
  'GENERATING',
  'GENERATED',
  'VALIDATED',
  'QUEUED',
  'SENT',
  'DELIVERED',
  'OPENED',
  'REPLIED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
  'SKIPPED',
]);

export const proactiveIntentTypeSchema = z.enum([
  'FOLLOW_UP_ON_TOPIC',
  'ASK_ABOUT_PREVIOUS_GOAL',
  'OFFER_RELEVANT_INFORMATION',
  'INVITE_LIGHT_CONVERSATION',
  'USER_REQUESTED_REMINDER',
  'CHARACTER_TOPIC_PROMPT',
  'REENGAGEMENT_CHECKIN',
]);

export const proactiveSkipReasonSchema = z.enum([
  'QUIET_HOURS',
  'DAILY_LIMIT_EXCEEDED',
  'WEEKLY_LIMIT_EXCEEDED',
  'RECENT_USER_ACTIVITY',
  'ACTIVE_GENERATION',
  'COOLDOWN_ACTIVE',
  'DISENGAGED_COOLDOWN',
  'CHARACTER_DISABLED',
  'USER_DISABLED_PROACTIVITY',
  'SAFETY_CHECK_FAILED',
  'HIGH_REPETITION_SIMILARITY',
  'LOW_RELEVANCE_CONFIDENCE',
]);

export const registerPushDeviceSchema = z.object({
  deviceId: z.string().min(1).max(150),
  pushToken: z.string().max(500).optional().nullable(),
  platform: pushPlatformSchema,
  appVersion: z.string().max(50).optional().nullable(),
  pushPermissionStatus: pushPermissionStatusSchema.default('NOT_DETERMINED'),
});

export type RegisterPushDeviceInput = z.infer<typeof registerPushDeviceSchema>;

export const lockScreenPrivacySchema = z.enum(['FULL_PREVIEW', 'LIMITED_PREVIEW', 'HIDE_CONTENT']);

export const notificationCategorySchema = z.enum([
  'character_message',
  'conversation_reply',
  'system',
  'security',
  'billing',
  'subscription',
  'usage_limit',
  'product_update',
  'campaign',
  'reminder',
  'recommendations',
]);

export const updateNotificationPreferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  proactivityEnabled: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:MM (e.g. 22:30)').optional(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:MM (e.g. 08:00)').optional(),
  timezone: z.string().min(1).max(100).optional(),
  maxDailyNotifications: z.number().int().min(0).max(10).optional(),
  maxWeeklyNotifications: z.number().int().min(0).max(50).optional(),
  showPreview: z.boolean().optional(),
  lockScreenPrivacy: lockScreenPrivacySchema.optional(),
  characterMessageCategoryEnabled: z.boolean().optional(),
  userReminderCategoryEnabled: z.boolean().optional(),
  recommendationsCategoryEnabled: z.boolean().optional(),
  productUpdatesCategoryEnabled: z.boolean().optional(),
  systemCategoryEnabled: z.boolean().optional(),
  billingCategoryEnabled: z.boolean().optional(),
  securityCategoryEnabled: z.boolean().optional(),
  marketingCategoryEnabled: z.boolean().optional(),
  mutedCharacterIds: z.array(z.string().uuid()).optional(),
  characterOverrides: z.record(z.string(), z.object({
    enabled: z.boolean().optional(),
    maxDaily: z.number().int().min(0).max(10).optional(),
  })).optional(),
});

export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;

export const inAppNotificationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: notificationCategorySchema.optional(),
  unreadOnly: z.coerce.boolean().default(false),
});

export type InAppNotificationQueryInput = z.infer<typeof inAppNotificationQuerySchema>;

export const markNotificationsReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()).optional(),
  all: z.boolean().optional(),
});

export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

export const createReminderSchema = z.object({
  characterId: z.string().uuid('Invalid character ID'),
  conversationId: z.string().uuid('Invalid conversation ID').optional(),
  title: z.string().min(1).max(150),
  content: z.string().min(1).max(1000),
  targetTime: z.string().datetime({ message: 'Invalid target datetime ISO format' }),
  timezone: z.string().default('UTC'),
});

export type CreateReminderInput = z.infer<typeof createReminderSchema>;

export const adminCampaignUpsertSchema = z.object({
  title: z.string().min(1).max(150),
  description: z.string().max(1000).optional(),
  category: z.string().default('product_update'),
  targetAudience: z.enum(['ALL', 'NEW_USERS', 'INACTIVE_USERS', 'PREMIUM_USERS', 'CATEGORY_AFFINITY']).default('ALL'),
  targetCriteria: z.record(z.string(), z.any()).optional(),
  messageTitle: z.string().min(1).max(150),
  messageBody: z.string().min(1).max(1000),
  deepLink: z.string().max(255).optional(),
  scheduledFor: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  status: z.enum(['DRAFT', 'REVIEW', 'APPROVED', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED']).default('DRAFT'),
});

export type AdminCampaignUpsertInput = z.infer<typeof adminCampaignUpsertSchema>;

export const adminCampaignDryRunSchema = z.object({
  targetAudience: z.enum(['ALL', 'NEW_USERS', 'INACTIVE_USERS', 'PREMIUM_USERS', 'CATEGORY_AFFINITY']),
  targetCriteria: z.record(z.string(), z.any()).optional(),
});

export type AdminCampaignDryRunInput = z.infer<typeof adminCampaignDryRunSchema>;

export const testPushNotificationSchema = z.object({
  targetUserId: z.string().uuid('Invalid target user ID').optional(),
  targetPushToken: z.string().optional(),
  title: z.string().min(1).max(150),
  body: z.string().min(1).max(500),
  category: notificationCategorySchema.default('system'),
  deepLink: z.string().max(255).optional(),
});

export type TestPushNotificationInput = z.infer<typeof testPushNotificationSchema>;

export const proactiveSimulationSchema = z.object({
  characterId: z.string().uuid('Invalid character ID'),
  characterVersionId: z.string().uuid('Invalid character version ID').optional(),
  mockLocalTime: z.string().optional(),
  userTimezone: z.string().default('UTC'),
  simulateRecentInteractionHours: z.number().min(0).max(720).default(24),
  userMessageContext: z.string().max(2000).optional(),
});

export type ProactiveSimulationInput = z.infer<typeof proactiveSimulationSchema>;

export const proactiveListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: proactiveActionStatusSchema.optional(),
  characterId: z.string().uuid().optional(),
});

export type ProactiveListQueryInput = z.input<typeof proactiveListQuerySchema>;
export type ProactiveListQueryOutput = z.output<typeof proactiveListQuerySchema>;

// -----------------------------------------------------------------------------
// Phase 8: Production AI Quality, Model Routing, Prompts & Evaluation Schemas
// -----------------------------------------------------------------------------

export const aiModelCapabilitySchema = z.enum([
  'streaming',
  'structured_output',
  'tool_calling',
  'vision',
  'multilingual',
  'long_context',
  'embeddings',
  'reasoning',
]);

export const aiLatencyClassSchema = z.enum(['fast', 'balanced', 'quality']);
export const aiQualityClassSchema = z.enum(['standard', 'advanced', 'flagship']);
export const aiProviderNameSchema = z.enum(['mock', 'openai', 'anthropic', 'google', 'local']);
export const aiWorkloadTypeSchema = z.enum([
  'CONVERSATION',
  'MEMORY_EXTRACTION',
  'MEMORY_SUMMARIZATION',
  'RELATIONSHIP_ANALYSIS',
  'PROACTIVE_DECISION',
  'PROACTIVE_GENERATION',
  'EMBEDDING',
  'MODERATION',
  'EVALUATION',
]);

export const createAIModelSchema = z.object({
  provider: aiProviderNameSchema,
  modelName: z.string().min(1).max(100),
  displayName: z.string().min(1).max(100),
  capabilities: z.array(aiModelCapabilitySchema).min(1),
  contextWindow: z.number().int().positive().default(8192),
  inputCostPer1k: z.number().min(0).default(0),
  outputCostPer1k: z.number().min(0).default(0),
  latencyClass: aiLatencyClassSchema.default('balanced'),
  qualityClass: aiQualityClassSchema.default('standard'),
  isEnabled: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  fallbackModelId: z.string().uuid().optional().nullable(),
});

export type CreateAIModelInput = z.infer<typeof createAIModelSchema>;

export const updateAIModelSchema = createAIModelSchema.partial();
export type UpdateAIModelInput = z.infer<typeof updateAIModelSchema>;

export const updateAIRoutingPolicySchema = z.object({
  workload: aiWorkloadTypeSchema,
  preferredModelId: z.string().uuid('Invalid preferred model ID'),
  fallbackModelIds: z.array(z.string().uuid()),
  latencySensitivity: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  maxCostPerRequest: z.number().min(0).optional().nullable(),
  isEnabled: z.boolean().default(true),
});

export type UpdateAIRoutingPolicyInput = z.infer<typeof updateAIRoutingPolicySchema>;

export const aiPromptCategorySchema = z.enum([
  'CONVERSATION_SYSTEM',
  'MEMORY_EXTRACTION',
  'MEMORY_DEDUPLICATION',
  'RELATIONSHIP_ANALYSIS',
  'PROACTIVE_DECISION',
  'PROACTIVE_GENERATION',
  'CONVERSATION_TITLE',
  'EVALUATION',
]);

export const createAIPromptSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-_]+$/i, 'Slug must be alphanumeric, dashes, or underscores'),
  category: aiPromptCategorySchema,
  description: z.string().max(500).default(''),
});

export type CreateAIPromptInput = z.infer<typeof createAIPromptSchema>;

export const createAIPromptVersionSchema = z.object({
  promptId: z.string().uuid('Invalid prompt ID'),
  templateContent: z.string().min(5).max(50000),
  inputVariables: z.array(z.string()).default([]),
  status: z.enum(['DRAFT', 'TESTING', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
});

export type CreateAIPromptVersionInput = z.infer<typeof createAIPromptVersionSchema>;

export const createPromptExperimentSchema = z.object({
  name: z.string().min(1).max(100),
  promptId: z.string().uuid('Invalid prompt ID'),
  controlVersionId: z.string().uuid('Invalid control version ID'),
  testVersionId: z.string().uuid('Invalid test version ID'),
  trafficSplitRatio: z.number().min(0.01).max(0.99).default(0.5),
  isActive: z.boolean().default(true),
});

export type CreatePromptExperimentInput = z.infer<typeof createPromptExperimentSchema>;

export const createEvaluationDatasetSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-_]+$/i),
  category: z.string().min(1).max(50).default('general'),
  description: z.string().max(500).default(''),
});

export type CreateEvaluationDatasetInput = z.infer<typeof createEvaluationDatasetSchema>;

export const createEvaluationTestCaseSchema = z.object({
  datasetId: z.string().uuid('Invalid dataset ID'),
  title: z.string().min(1).max(200),
  category: z.string().min(1).max(50).default('dialogue'),
  inputPrompt: z.string().min(1).max(5000),
  userMessage: z.string().min(1).max(2000),
  characterId: z.string().uuid().optional().nullable(),
  characterConfigSnapshot: z.record(z.string(), z.any()).optional().nullable(),
  memoryContextSnapshot: z.array(z.any()).optional().nullable(),
  relationshipStateSnapshot: z.record(z.string(), z.any()).optional().nullable(),
  expectedProperties: z.record(z.string(), z.any()).default({}),
  tags: z.array(z.string()).default([]),
});

export type CreateEvaluationTestCaseInput = z.infer<typeof createEvaluationTestCaseSchema>;

export const runEvaluationSchema = z.object({
  datasetId: z.string().uuid('Invalid dataset ID'),
  modelId: z.string().uuid('Invalid model ID'),
  characterId: z.string().uuid().optional().nullable(),
  characterVersionId: z.string().uuid().optional().nullable(),
  promptVersionId: z.string().uuid().optional().nullable(),
  baselineRunId: z.string().uuid().optional().nullable(),
  evaluatorType: z.enum(['deterministic', 'llm_judge', 'hybrid']).optional().nullable(),
});

export type RunEvaluationInput = z.infer<typeof runEvaluationSchema>;

export const aiPlaygroundSchema = z.object({
  characterId: z.string().uuid('Invalid character ID'),
  characterVersionId: z.string().uuid().optional().nullable(),
  modelId: z.string().uuid('Invalid model ID'),
  promptVersionId: z.string().uuid().optional().nullable(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(10).max(4000).default(500),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string().min(1),
  })).min(1),
  mockMemoryIds: z.array(z.string().uuid()).optional(),
  mockRelationshipStage: z.string().optional(),
});

export type AIPlaygroundInput = z.infer<typeof aiPlaygroundSchema>;

export const productionReplaySchema = z.object({
  generationTraceId: z.string().uuid('Invalid generation trace ID'),
  overrideModelId: z.string().uuid().optional(),
  overrideTemperature: z.number().min(0).max(2).optional(),
});

export type ProductionReplayInput = z.infer<typeof productionReplaySchema>;

export const submitFeedbackSchema = z.object({
  messageId: z.string().optional().nullable(),
  conversationId: z.string().optional().nullable(),
  characterId: z.string().optional().nullable(),
  generationTraceId: z.string().optional().nullable(),
  traceId: z.string().optional().nullable(),
  rating: z.enum(['POSITIVE', 'NEGATIVE']).optional().nullable(),
  score: z.number().optional().nullable(),
  reasonCategory: z.enum([
    'not_relevant',
    'incorrect',
    'too_verbose',
    'wrong_personality',
    'repetitive',
    'language_issue',
    'hallucinated_memory',
    'other',
  ]).optional().nullable(),
  detailedFeedback: z.string().max(1000).optional().nullable(),
  comment: z.string().max(1000).optional().nullable(),
 });

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;

// -----------------------------------------------------------------------------
// Phase 9: Voice Conversation & Real-Time Audio Infrastructure Schemas
// -----------------------------------------------------------------------------

export const voiceModeSchema = z.enum(['push_to_talk', 'hands_free']);
export const voiceTransportSchema = z.enum(['websocket', 'webrtc']);
export const voiceSessionStatusSchema = z.enum([
  'created',
  'connecting',
  'connected',
  'active',
  'paused',
  'ending',
  'completed',
  'failed',
  'cancelled',
]);

export const createVoiceSessionSchema = z.object({
  characterId: z.string().uuid('Invalid character ID'),
  conversationId: z.string().uuid('Invalid conversation ID').optional(),
  language: z.string().max(10).default('en'),
  voiceMode: voiceModeSchema.default('hands_free'),
});

export type CreateVoiceSessionInput = z.infer<typeof createVoiceSessionSchema>;

export const userVoicePreferencesSchema = z.object({
  voiceEnabled: z.boolean().default(true),
  preferredMode: voiceModeSchema.default('hands_free'),
  speechSpeed: z.number().min(0.5).max(2.0).default(1.0),
  preferredLanguage: z.string().max(10).default('en'),
  subtitlesEnabled: z.boolean().default(true),
  autoPlayAudio: z.boolean().default(true),
  noiseSuppression: z.boolean().default(true),
});

export const updateUserVoicePreferencesSchema = userVoicePreferencesSchema.partial();
export type UpdateUserVoicePreferencesInput = z.infer<typeof updateUserVoicePreferencesSchema>;

export const characterVoiceSettingsSchema = z.object({
  voiceEnabled: z.boolean().default(true),
  provider: z.enum(['elevenlabs', 'openai', 'playht', 'mock']).default('elevenlabs'),
  voiceId: z.string().min(1, 'Voice ID is required'),
  language: z.string().min(2).max(10).default('en'),
  speakingStyle: z.string().max(100).optional(),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  pitch: z.number().min(-10).max(10).default(0.0),
  stability: z.number().min(0.0).max(1.0).default(0.75),
  fallbackVoiceId: z.string().max(100).optional(),
  fallbackProvider: z.string().max(50).optional(),
  defaultVoiceMode: voiceModeSchema.default('hands_free'),
});

export type CharacterVoiceSettingsInput = z.infer<typeof characterVoiceSettingsSchema>;

export const voicePreviewSchema = z.object({
  characterId: z.string().uuid('Invalid character ID').optional(),
  provider: z.enum(['elevenlabs', 'openai', 'playht', 'mock']).default('elevenlabs'),
  voiceId: z.string().min(1, 'Voice ID is required'),
  text: z.string().min(1, 'Preview text is required').max(500, 'Preview text must be at most 500 characters'),
  language: z.string().max(10).default('en'),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  pitch: z.number().min(-10).max(10).default(0.0),
  stability: z.number().min(0.0).max(1.0).default(0.75),
});

export type VoicePreviewInput = z.infer<typeof voicePreviewSchema>;

export const voiceSessionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  characterId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: voiceSessionStatusSchema.optional(),
});

export type VoiceSessionQueryInput = z.infer<typeof voiceSessionQuerySchema>;

export const voiceRealtimeEventSchema = z.object({
  id: z.string(),
  sessionId: z.string().uuid(),
  type: z.enum([
    'voice.session.started',
    'voice.session.ready',
    'voice.audio.started',
    'voice.audio.chunk',
    'voice.audio.stopped',
    'voice.transcript.interim',
    'voice.transcript.final',
    'voice.generation.started',
    'voice.generation.delta',
    'voice.generation.completed',
    'voice.tts.started',
    'voice.tts.audio',
    'voice.tts.completed',
    'voice.interrupted',
    'voice.state.changed',
    'voice.error',
    'voice.session.ended',
    'voice.heartbeat',
    'voice.ack',
  ]),
  sequence: z.number().int().nonnegative(),
  timestamp: z.string(),
  payload: z.any(),
});

export type VoiceRealtimeEventInput = z.infer<typeof voiceRealtimeEventSchema>;

// -----------------------------------------------------------------------------
// Phase 11: Production Monetization, Subscriptions, Credits & Entitlements Schemas
// -----------------------------------------------------------------------------

export const billingProviderSchema = z.enum(['apple', 'google', 'stripe', 'mock']);
export const priceCurrencySchema = z.enum(['INR', 'USD', 'EUR', 'GBP']);
export const planIntervalSchema = z.enum(['month', 'year', 'one_time']);

export const verifyPurchaseSchema = z.object({
  provider: billingProviderSchema,
  receiptData: z.string().min(1, 'Receipt data or purchase token is required'),
  productId: z.string().min(1, 'Product ID is required'),
  transactionId: z.string().min(1, 'Transaction ID is required'),
  planCode: z.string().optional(),
  idempotencyKey: z.string().optional(),
  currency: priceCurrencySchema.optional(),
  priceAmountMinorUnits: z.number().int().nonnegative().optional(),
});

export type VerifyPurchaseInput = z.infer<typeof verifyPurchaseSchema>;

export const restorePurchasesSchema = z.object({
  provider: billingProviderSchema,
  receiptData: z.string().optional(),
  deviceAccountId: z.string().optional(),
});

export type RestorePurchasesInput = z.infer<typeof restorePurchasesSchema>;

export const changeSubscriptionSchema = z.object({
  planCode: z.string().min(1, 'Plan code is required'),
  billingInterval: planIntervalSchema.default('month'),
  provider: billingProviderSchema.default('mock'),
  paymentMethodId: z.string().optional(),
});

export type ChangeSubscriptionInput = z.infer<typeof changeSubscriptionSchema>;

export const cancelSubscriptionSchema = z.object({
  reason: z.string().max(500).optional(),
  cancelImmediately: z.boolean().default(false),
});

export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;

export const redeemPromotionSchema = z.object({
  promoCode: z.string().min(2).max(50).trim().toUpperCase(),
});

export type RedeemPromotionInput = z.infer<typeof redeemPromotionSchema>;

export const purchaseCreditsSchema = z.object({
  packSlug: z.string().min(1, 'Credit pack slug is required'),
  provider: billingProviderSchema.default('mock'),
  receiptData: z.string().optional(),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
});

export type PurchaseCreditsInput = z.infer<typeof purchaseCreditsSchema>;

// Admin Billing Schemas
export const adminCreatePlanSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  code: z.string().min(2).max(50).toUpperCase(),
  name: z.string().min(2).max(100),
  tagline: z.string().max(255).default(''),
  description: z.string().max(2000).default(''),
  isActive: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  trialDays: z.number().int().min(0).max(365).default(0),
  entitlements: z.array(z.string()).default([]),
  usageLimits: z.array(
    z.object({
      meterUnit: z.string(),
      limitAmount: z.number().int().nonnegative(),
      period: z.enum(['month', 'year', 'day', 'lifetime']).default('month'),
    }),
  ).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AdminCreatePlanInput = z.infer<typeof adminCreatePlanSchema>;

export const adminUpdatePlanSchema = adminCreatePlanSchema.partial();
export type AdminUpdatePlanInput = z.infer<typeof adminUpdatePlanSchema>;

export const adminCreatePriceSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  planId: z.string().uuid('Invalid plan ID').optional(),
  currency: priceCurrencySchema,
  amountMinorUnits: z.number().int().positive('Amount must be positive integer in minor units'),
  billingInterval: planIntervalSchema.optional(),
  billingIntervalCount: z.number().int().positive().default(1),
  provider: billingProviderSchema,
  providerPriceId: z.string().min(1, 'Provider price ID is required'),
  country: z.string().max(10).optional(),
  active: z.boolean().default(true),
  effectiveFrom: z.string().datetime().optional(),
  effectiveUntil: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AdminCreatePriceInput = z.infer<typeof adminCreatePriceSchema>;

export const adminCreatePromotionSchema = z.object({
  code: z.string().min(2).max(50).toUpperCase(),
  name: z.string().min(2).max(100),
  description: z.string().max(500).default(''),
  discountType: z.enum(['percentage', 'fixed_amount', 'free_credits', 'trial_extension']),
  discountValue: z.number().positive(),
  planId: z.string().uuid().optional(),
  maxRedemptions: z.number().int().positive().optional(),
  perUserLimit: z.number().int().positive().default(1),
  validFrom: z.string().datetime().default(() => new Date().toISOString()),
  validUntil: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  targetAudience: z.string().optional(),
});

export type AdminCreatePromotionInput = z.infer<typeof adminCreatePromotionSchema>;

export const adminManualEntitlementGrantSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  entitlementKey: z.string().min(1, 'Entitlement key is required'),
  durationDays: z.number().int().positive().max(3650).optional(), // optional expiry
  reason: z.string().min(3, 'Reason is required for audit trail').max(500),
});

export type AdminManualEntitlementGrantInput = z.infer<typeof adminManualEntitlementGrantSchema>;

export const adminManualCreditGrantSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  amount: z.number().int().positive('Amount must be positive integer'),
  reason: z.string().min(3, 'Reason is required for audit trail').max(500),
  durationDays: z.number().int().positive().max(3650).optional(),
});

export type AdminManualCreditGrantInput = z.infer<typeof adminManualCreditGrantSchema>;

export const adminProcessRefundSchema = z.object({
  transactionId: z.string().uuid('Invalid transaction ID'),
  reason: z.string().min(3, 'Refund reason is required').max(500),
  revokeEntitlements: z.boolean().default(true),
  reverseCredits: z.boolean().default(true),
});

export type AdminProcessRefundInput = z.infer<typeof adminProcessRefundSchema>;

export const adminWebhookRetrySchema = z.object({
  webhookEventId: z.string().uuid('Invalid webhook event ID'),
});

export type AdminWebhookRetryInput = z.infer<typeof adminWebhookRetrySchema>;

export const adminBillingSimulatorSchema = z.object({
  userId: z.string().uuid().optional(),
  simulatedPlanCode: z.string().default('PRO'),
  simulatedPromoCode: z.string().optional(),
  simulatedUsage: z.record(z.string(), z.number()).default({}),
});

export type AdminBillingSimulatorInput = z.infer<typeof adminBillingSimulatorSchema>;

// -----------------------------------------------------------------------------
// Phase 12: Discovery, Catalog, Search & Recommendations Schemas
// -----------------------------------------------------------------------------

export const discoverySearchQuerySchema = z.object({
  q: z.string().max(255).optional(),
  category: z.string().max(100).optional(),
  tags: z.preprocess(
    val => (typeof val === 'string' ? val.split(',').map(s => s.trim()) : val),
    z.array(z.string()).optional(),
  ),
  language: z.string().max(20).optional(),
  accessType: z.enum(['free', 'premium', 'all']).default('all'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['recommended', 'popular', 'new']).default('recommended'),
});

export type DiscoverySearchQueryInput = z.infer<typeof discoverySearchQuerySchema>;

export const homeFeedQuerySchema = z.object({
  refresh: z.preprocess(val => val === 'true' || val === true, z.boolean().default(false)),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export type HomeFeedQueryInput = z.infer<typeof homeFeedQuerySchema>;

export const userDiscoveryPreferenceSchema = z.object({
  preferredLanguages: z.array(z.string().min(2).max(20)).default(['en']),
  preferredCategoryIds: z.array(z.string()).default([]),
  preferredTagIds: z.array(z.string()).default([]),
  preferredStyles: z.array(z.string()).default([]),
  personalizationEnabled: z.boolean().default(true),
  allowNsfw: z.boolean().default(false),
});

export type UserDiscoveryPreferenceInput = z.infer<typeof userDiscoveryPreferenceSchema>;

export const discoveryEventBatchSchema = z.object({
  events: z.array(
    z.object({
      eventType: z.enum(['IMPRESSION', 'CLICK', 'DETAIL_VIEW', 'CHAT_START', 'FAVORITE', 'DISMISS']),
      characterId: z.string().uuid().optional(),
      surface: z.string().max(50).default('HOME'),
      position: z.number().int().optional(),
      recommendationVersion: z.string().max(20).default('v1'),
      metadata: z.record(z.string(), z.unknown()).optional(),
    }),
  ).min(1).max(50),
});

export type DiscoveryEventBatchInput = z.infer<typeof discoveryEventBatchSchema>;

export const adminCategoryUpsertSchema = z.object({
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  name: z.string().min(2).max(100),
  displayName: z.string().min(2).max(100),
  description: z.string().max(500).default(''),
  iconUrl: z.string().url().nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export type AdminCategoryUpsertInput = z.infer<typeof adminCategoryUpsertSchema>;

export const adminTagUpsertSchema = z.object({
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  name: z.string().min(2).max(100),
  displayName: z.string().min(2).max(100),
  description: z.string().max(500).default(''),
  categoryId: z.string().uuid().nullable().optional(),
  isCurated: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
});

export type AdminTagUpsertInput = z.infer<typeof adminTagUpsertSchema>;

export const adminCollectionUpsertSchema = z.object({
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  title: z.string().min(2).max(150),
  subtitle: z.string().max(255).default(''),
  description: z.string().max(1000).default(''),
  heroImageUrl: z.string().url().nullable().optional(),
  badgeText: z.string().max(50).nullable().optional(),
  displayOrder: z.number().int().default(0),
  isPublished: z.boolean().default(false),
  publishStartAt: z.string().datetime().nullable().optional(),
  publishEndAt: z.string().datetime().nullable().optional(),
  characterIds: z.array(z.string().uuid()).default([]),
});

export type AdminCollectionUpsertInput = z.infer<typeof adminCollectionUpsertSchema>;

export const adminHomeSectionConfigSchema = z.object({
  sectionKey: z.string().min(2).max(50),
  title: z.string().min(2).max(100),
  subtitle: z.string().max(255).default(''),
  isEnabled: z.boolean().default(true),
  displayOrder: z.number().int().default(0),
  layoutStyle: z.enum(['HERO', 'CAROUSEL', 'GRID', 'BANNER', 'CHIPS']).default('CAROUSEL'),
  maxItems: z.number().int().min(1).max(50).default(10),
  filterConfig: z.record(z.string(), z.unknown()).default({}),
});

export type AdminHomeSectionConfigInput = z.infer<typeof adminHomeSectionConfigSchema>;

export const adminCharacterDiscoveryConfigSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  tagIds: z.array(z.string().uuid()).default([]),
  isDiscoverable: z.boolean().default(true),
  isSearchable: z.boolean().default(true),
  isTrendingEnabled: z.boolean().default(true),
  isRecommendationEnabled: z.boolean().default(true),
  editorialPriority: z.number().int().default(0),
  editorialBoost: z.number().min(0.1).max(10.0).default(1.0),
  newUntil: z.string().datetime().nullable().optional(),
  conversationStarters: z.array(z.string().min(1).max(255)).default([]),
  highlightBadges: z.array(z.string().min(1).max(50)).default([]),
  ageGate: z.number().int().min(0).max(21).default(0),
  localizedProfiles: z.record(z.string(), z.unknown()).default({}),
});

export type AdminCharacterDiscoveryConfigInput = z.infer<typeof adminCharacterDiscoveryConfigSchema>;

export const adminRecommendationSimulatorSchema = z.object({
  userId: z.string().uuid().optional(),
  simulatedPreferences: z.object({
    languages: z.array(z.string()).default(['en']),
    categoryIds: z.array(z.string()).default([]),
    tagIds: z.array(z.string()).default([]),
  }).optional(),
  limit: z.number().int().min(1).max(50).default(10),
  diversityStrictness: z.enum(['low', 'medium', 'high']).default('medium'),
});

export type AdminRecommendationSimulatorInput = z.infer<typeof adminRecommendationSimulatorSchema>;

// -----------------------------------------------------------------------------
// Phase 13: Onboarding, User Profile, Preferences & Activation Schemas
// -----------------------------------------------------------------------------

export const conversationStyleSchema = z.enum([
  'CASUAL',
  'FUNNY',
  'DEEP',
  'SUPPORTIVE',
  'DIRECT',
  'PLAYFUL',
]);

export const onboardingStepKeySchema = z.enum([
  'WELCOME',
  'LANGUAGE',
  'INTERESTS',
  'STYLE',
  'CHARACTER_SELECTION',
  'COMPLETED',
]);

export const onboardingStatusSchema = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'SKIPPED',
  'NEEDS_RECOVERY',
]);

export const onboardingStepCompleteSchema = z.object({
  stepKey: onboardingStepKeySchema,
  language: z.string().min(2).max(10).optional(),
  categoryIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  conversationStyle: conversationStyleSchema.optional(),
  selectedCharacterId: z.string().uuid().optional(),
  skipped: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type OnboardingStepCompleteInput = z.infer<typeof onboardingStepCompleteSchema>;

export const onboardingCompleteSchema = z.object({
  selectedCharacterId: z.string().uuid().optional(),
  conversationStyle: conversationStyleSchema.optional(),
  preferredLanguage: z.string().min(2).max(10).optional(),
  categoryIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
});

export type OnboardingCompleteInput = z.infer<typeof onboardingCompleteSchema>;

export const userPreferenceUpdateSchema = z.object({
  preferredLanguage: z.string().min(2).max(10).optional(),
  conversationStyle: conversationStyleSchema.optional(),
  preferredCategoryIds: z.array(z.string()).optional(),
  preferredTagIds: z.array(z.string()).optional(),
  personalizationEnabled: z.boolean().optional(),
  isNsfwAllowed: z.boolean().optional(),
  audioAutoPlay: z.boolean().optional(),
});

export type UserPreferenceUpdateInput = z.infer<typeof userPreferenceUpdateSchema>;

export const adminOnboardingStepConfigSchema = z.object({
  stepKey: onboardingStepKeySchema,
  title: z.string().min(2).max(150),
  subtitle: z.string().max(255).default(''),
  isRequired: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
  version: z.number().int().default(1),
  configData: z.record(z.string(), z.unknown()).default({}),
  isEnabled: z.boolean().default(true),
});

export type AdminOnboardingStepConfigInput = z.infer<typeof adminOnboardingStepConfigSchema>;

export const activationFunnelEventSchema = z.object({
  eventType: z.enum([
    'VISIT_OPEN',
    'SIGNUP_STARTED',
    'SIGNUP_COMPLETED',
    'ONBOARDING_STARTED',
    'ONBOARDING_STEP_COMPLETED',
    'ONBOARDING_STEP_SKIPPED',
    'ONBOARDING_COMPLETED',
    'CHARACTER_SELECTED',
    'CONVERSATION_STARTED',
    'FIRST_MESSAGE_SENT',
    'FIRST_RESPONSE_RECEIVED',
    'FIRST_SESSION_COMPLETED',
    'RETURN_D1',
    'RETURN_D3',
    'RETURN_D7',
    'RETURN_D14',
    'RETURN_D30',
  ]),
  stepKey: z.string().max(50).optional(),
  characterId: z.string().uuid().optional(),
  onboardingVersion: z.number().int().default(1).optional(),
  experimentKey: z.string().max(50).optional(),
  platform: z.string().max(30).default('mobile').optional(),
  appVersion: z.string().max(30).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ActivationFunnelEventInput = z.infer<typeof activationFunnelEventSchema>;

// -----------------------------------------------------------------------------
// PHASE 15: CREATOR PLATFORM, MODERATION & MONETIZATION VALIDATION SCHEMAS
// -----------------------------------------------------------------------------

export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'support',
  'help',
  'system',
  'official',
  'root',
  'moderator',
  'mod',
  'security',
  'billing',
  'ai',
  'companion',
  'aria',
  'elena',
  'marcus',
  'kai',
]);

export const creatorUsernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must not exceed 30 characters')
  .regex(/^[a-z0-9_-]+$/, 'Username must be lowercase alphanumeric, underscore, or hyphen only')
  .refine(val => !RESERVED_USERNAMES.has(val.toLowerCase()), {
    message: 'This username is reserved by the platform',
  });

export const creatorOnboardingSchema = z.object({
  username: creatorUsernameSchema,
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(100),
  bio: z.string().max(500).default(''),
  acceptGuidelines: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the creator guidelines to continue' }),
  }),
  guidelinesVersion: z.number().int().default(1),
});

export type CreatorOnboardingInput = z.infer<typeof creatorOnboardingSchema>;

export const creatorProfileUpdateSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url('Invalid avatar URL').optional().nullable(),
  bannerUrl: z.string().url('Invalid banner URL').optional().nullable(),
  website: z.string().url('Invalid website URL').optional().nullable(),
  socialLinks: z.record(z.string(), z.string()).optional().nullable(),
});

export type CreatorProfileUpdateInput = z.infer<typeof creatorProfileUpdateSchema>;

export const creatorCharacterCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  tagline: z.string().min(3, 'Tagline is required').max(255),
  category: z.string().min(2).max(50).default('general'),
  archetype: z.string().min(2).max(50).default('Companion'),
  shortDescription: z.string().max(300).default(''),
  longDescription: z.string().min(10, 'Long description / backstory is required').max(5000),
  avatarUrl: z.string().url('Invalid avatar URL').default('https://images.unsplash.com/photo-1534528741775-53994a69daeb'),
  coverImageUrl: z.string().url('Invalid cover URL').default('https://images.unsplash.com/photo-1579546929518-9e396f3cc809'),
  age: z.number().int().min(18, 'Character age must be at least 18').max(500).default(24),
  gender: z.string().max(50).default('Female'),
  occupation: z.string().max(100).default('Companion'),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).default('PUBLIC'),
});

export type CreatorCharacterCreateInput = z.infer<typeof creatorCharacterCreateSchema>;

export const creatorCharacterDraftSaveSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  tagline: z.string().max(255).optional(),
  shortDescription: z.string().max(300).optional(),
  longDescription: z.string().max(5000).optional(),
  avatarUrl: z.string().url().optional(),
  coverImageUrl: z.string().url().optional(),
  category: z.string().max(50).optional(),
  archetype: z.string().max(50).optional(),
  age: z.number().int().min(18).max(500).optional(),
  gender: z.string().max(50).optional(),
  occupation: z.string().max(100).optional(),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).optional(),
  identityData: z.record(z.string(), z.unknown()).optional(),
  personalityData: z.record(z.string(), z.unknown()).optional(),
  communicationData: z.record(z.string(), z.unknown()).optional(),
  languageData: z.record(z.string(), z.unknown()).optional(),
  behaviorRulesData: z.array(z.record(z.string(), z.unknown())).optional(),
  knowledgeData: z.array(z.record(z.string(), z.unknown())).optional(),
  relationshipConfigData: z.record(z.string(), z.unknown()).optional(),
  memoryConfigData: z.record(z.string(), z.unknown()).optional(),
  proactivityConfigData: z.record(z.string(), z.unknown()).optional(),
  safetyConfigData: z.record(z.string(), z.unknown()).optional(),
  aiConfigData: z.record(z.string(), z.unknown()).optional(),
  voiceConfigData: z.record(z.string(), z.unknown()).optional().nullable(),
  changeSummary: z.string().max(255).optional(),
});

export type CreatorCharacterDraftSaveInput = z.infer<typeof creatorCharacterDraftSaveSchema>;

export const creatorCharacterSubmitSchema = z.object({
  characterId: z.string().uuid(),
  notes: z.string().max(1000).optional(),
});

export type CreatorCharacterSubmitInput = z.infer<typeof creatorCharacterSubmitSchema>;

export const characterReportCreateSchema = z.object({
  characterId: z.string().uuid(),
  reasonCode: z.enum([
    'UNSAFE',
    'HARASSMENT',
    'IMPERSONATION',
    'COPYRIGHT',
    'SEXUAL_CONTENT',
    'MISLEADING',
    'SPAM',
    'OTHER',
  ]),
  details: z.string().min(10, 'Please provide details explaining your report').max(2000),
});

export type CharacterReportCreateInput = z.infer<typeof characterReportCreateSchema>;

export const moderationDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'SUSPEND', 'UNPUBLISH']),
  rejectionReason: z
    .enum([
      'PROHIBITED_CONTENT',
      'IMPERSONATION',
      'COPYRIGHT_CONCERN',
      'SAFETY_CONFIGURATION',
      'MISLEADING_DESCRIPTION',
      'SEXUAL_CONTENT_POLICY',
      'MINOR_SAFETY',
      'HARASSMENT',
      'SPAM',
      'OTHER',
    ])
    .optional(),
  changeRequestDetails: z.string().max(2000).optional(),
  moderatorNotes: z.string().max(2000).optional(),
});

export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;

export const moderationAppealCreateSchema = z.object({
  moderationCaseId: z.string().uuid(),
  appealReason: z.string().min(20, 'Please explain in detail why this decision should be reviewed').max(2000),
});

export type ModerationAppealCreateInput = z.infer<typeof moderationAppealCreateSchema>;

export const sandboxedPlaygroundChatSchema = z.object({
  message: z.string().min(1).max(1000),
  simulatedLanguage: z.enum(['en', 'hi', 'hinglish']).default('en'),
  simulatedRelationshipStage: z.string().default('stranger'),
});

export type SandboxedPlaygroundChatInput = z.infer<typeof sandboxedPlaygroundChatSchema>;

// -----------------------------------------------------------------------------
// PHASE 16: SAFETY, TRUST, PRIVACY, ENFORCEMENT & GOVERNANCE SCHEMAS
// -----------------------------------------------------------------------------

export const safetySurfaceSchema = z.enum([
  'INPUT',
  'OUTPUT',
  'CREATOR_CONTENT',
  'KNOWLEDGE',
  'MEDIA',
  'VOICE',
  'PROACTIVE',
  'STREAM',
]);

export const safetyEvaluateInputSchema = z.object({
  surface: safetySurfaceSchema.default('INPUT'),
  content: z.string().min(1, 'Content is required').max(10000),
  characterId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type SafetyEvaluateInput = z.infer<typeof safetyEvaluateInputSchema>;

export const safetyEvaluateOutputSchema = z.object({
  surface: safetySurfaceSchema.default('OUTPUT'),
  content: z.string().min(1, 'Generated content is required').max(25000),
  characterId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  promptContext: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type SafetyEvaluateOutputInput = z.infer<typeof safetyEvaluateOutputSchema>;

export const safetyPolicyCreateSchema = z.object({
  versionNumber: z.number().int().positive(),
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  rules: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      name: z.string(),
      description: z.string(),
      severity: z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
      action: z.enum(['ALLOW', 'ALLOW_WITH_TRANSFORM', 'BLOCK', 'REVIEW', 'ESCALATE']),
      patterns: z.array(z.string()).optional(),
      customEvaluator: z.string().optional(),
    }),
  ),
  isActive: z.boolean().default(true),
});

export type SafetyPolicyCreateInput = z.infer<typeof safetyPolicyCreateSchema>;

export const privacySettingsUpdateSchema = z.object({
  memoryStorageEnabled: z.boolean().optional(),
  personalizationEnabled: z.boolean().optional(),
  analyticsConsent: z.boolean().optional(),
  aiTrainingConsent: z.boolean().optional(),
  dataRetentionDays: z.number().int().min(30).max(3650).optional(),
});

export type PrivacySettingsUpdateInput = z.infer<typeof privacySettingsUpdateSchema>;

export const dataExportCreateSchema = z.object({
  dataTypes: z
    .array(z.enum(['PROFILE', 'CONVERSATIONS', 'MEMORIES', 'RELATIONSHIPS', 'BILLING', 'CREATOR', 'SOCIAL']))
    .min(1, 'Select at least one data type to export')
    .default(['PROFILE', 'CONVERSATIONS', 'MEMORIES', 'RELATIONSHIPS', 'BILLING', 'SOCIAL']),
});

export type DataExportCreateInput = z.infer<typeof dataExportCreateSchema>;

export const accountDeletionCreateSchema = z.object({
  reason: z.string().max(1000).optional(),
  confirmEmail: z.string().email('Please confirm by typing your email address'),
  anonymizeFinancialRecords: z.boolean().default(true),
});

export type AccountDeletionCreateInput = z.infer<typeof accountDeletionCreateSchema>;

export const userBlockCreateSchema = z.object({
  blockedUserId: z.string().uuid().optional(),
  blockedCharacterId: z.string().uuid().optional(),
  blockedCreatorId: z.string().uuid().optional(),
  reason: z.string().max(500).optional(),
}).refine(
  data => !!data.blockedUserId || !!data.blockedCharacterId || !!data.blockedCreatorId,
  { message: 'Must specify either a blocked user ID, character ID, or creator ID' },
);

export type UserBlockCreateInput = z.infer<typeof userBlockCreateSchema>;

export const accountRestrictionCreateSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  restrictionType: z.enum([
    'CANNOT_CREATE_CHARACTER',
    'CANNOT_PUBLISH',
    'CANNOT_UPLOAD_MEDIA',
    'CANNOT_USE_VOICE',
    'CANNOT_SEND_MESSAGES',
    'CANNOT_PURCHASE',
    'SOCIAL_RESTRICTED',
    'CANNOT_COMMENT',
    'CANNOT_DIRECT_MESSAGE',
    'CANNOT_SHARE_CONTENT',
    'CANNOT_CREATE_COMMUNITIES',
    'ACCOUNT_RESTRICTED',
    'ACCOUNT_SUSPENDED',
    'ACCOUNT_BANNED',
  ]),
  reason: z.string().min(5, 'Reason must be at least 5 characters for auditing').max(1000),
  expiresAt: z.string().datetime().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AccountRestrictionCreateInput = z.infer<typeof accountRestrictionCreateSchema>;

export const incidentCreateSchema = z.object({
  severity: z.enum(['SEV1', 'SEV2', 'SEV3', 'SEV4']),
  category: z.enum(['SAFETY', 'PRIVACY', 'SECURITY', 'BILLING', 'AVAILABILITY']),
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  impactSummary: z.string().max(2000).optional(),
  affectedComponents: z.array(z.string()).optional(),
  actionsTaken: z.string().max(5000).optional(),
});

export type IncidentCreateInput = z.infer<typeof incidentCreateSchema>;

export const incidentUpdateSchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED']).optional(),
  severity: z.enum(['SEV1', 'SEV2', 'SEV3', 'SEV4']).optional(),
  impactSummary: z.string().max(2000).optional(),
  affectedComponents: z.array(z.string()).optional(),
  actionsTaken: z.string().max(5000).optional(),
  mitigatedAt: z.string().datetime().optional().nullable(),
  resolvedAt: z.string().datetime().optional().nullable(),
});

export type IncidentUpdateInput = z.infer<typeof incidentUpdateSchema>;

export const killSwitchToggleSchema = z.object({
  switchType: z.enum([
    'DISABLE_CHARACTER_PUBLISHING',
    'DISABLE_IMAGE_GENERATION',
    'DISABLE_VOICE_CALLS',
    'DISABLE_PROACTIVE_NOTIFICATIONS',
    'DISABLE_MODEL_PROVIDER',
    'DISABLE_CHARACTER',
  ]),
  targetId: z.string().max(100).optional(),
  isActive: z.boolean(),
  reason: z.string().min(10, 'Reason is mandatory for kill switch state change').max(1000),
  confirmed: z.literal(true, {
    errorMap: () => ({ message: 'You must confirm the emergency kill switch action' }),
  }),
});

export type KillSwitchToggleInput = z.infer<typeof killSwitchToggleSchema>;

// -----------------------------------------------------------------------------
// PHASE 17: ANALYTICS & EXPERIMENTATION SCHEMAS
// -----------------------------------------------------------------------------

export const analyticsBatchIngestItemSchema = z.object({
  id: z.string().min(1).max(100),
  eventName: z.string().min(2).max(100),
  eventVersion: z.number().int().positive().default(1),
  userId: z.string().uuid().optional(),
  anonymousId: z.string().max(100).optional(),
  sessionId: z.string().max(100).optional(),
  deviceId: z.string().max(100).optional(),
  characterId: z.string().uuid().optional(),
  creatorId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  timestamp: z.string().default(() => new Date().toISOString()),
  properties: z.record(z.string(), z.unknown()).optional(),
  appVersion: z.string().max(50).optional(),
  platform: z.enum(['ios', 'android', 'web', 'unknown']).optional(),
  locale: z.string().max(20).optional(),
  timezone: z.string().max(50).optional(),
  experimentId: z.string().max(100).optional(),
  experimentVariant: z.string().max(50).optional(),
  requestId: z.string().max(100).optional(),
  source: z.string().max(100).optional(),
});

export const analyticsBatchIngestSchema = z.object({
  events: z.array(analyticsBatchIngestItemSchema).min(1).max(200),
  sentAt: z.string().optional(),
});

export type AnalyticsBatchIngestInput = z.infer<typeof analyticsBatchIngestSchema>;

export const experimentVariantCreateSchema = z.object({
  key: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/, 'Variant key must be alphanumeric or hyphen/underscore'),
  name: z.string().max(100).optional(),
  configuration: z.record(z.string(), z.unknown()).optional(),
  allocationPercentage: z.number().int().min(1).max(100),
});

export const experimentCreateSchema = z.object({
  id: z.string().min(3).max(100).regex(/^[a-z0-9_-]+$/, 'Experiment ID must be slug format'),
  name: z.string().min(3).max(150),
  description: z.string().max(1000).optional(),
  targeting: z.record(z.string(), z.unknown()).optional(),
  primaryMetric: z.string().min(2).max(100),
  secondaryMetrics: z.array(z.string().max(100)).optional(),
  guardrailMetrics: z.array(z.string().max(100)).optional(),
  allocation: z.number().int().min(1).max(100).default(100),
  variants: z.array(experimentVariantCreateSchema).min(2, 'Experiments must have at least 2 variants'),
}).refine(
  data => {
    const totalAllocation = data.variants.reduce((sum, v) => sum + v.allocationPercentage, 0);
    return totalAllocation === 100;
  },
  { message: 'Variant allocation percentages must sum to exactly 100%' },
);

export type ExperimentCreateSchemaInput = z.infer<typeof experimentCreateSchema>;

export const experimentUpdateSchema = z.object({
  name: z.string().min(3).max(150).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
  targeting: z.record(z.string(), z.unknown()).optional(),
  allocation: z.number().int().min(1).max(100).optional(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
});

export type ExperimentUpdateSchemaInput = z.infer<typeof experimentUpdateSchema>;

export const aiModelPricingCreateSchema = z.object({
  provider: z.string().min(1).max(50),
  model: z.string().min(1).max(100),
  inputPricePerMillion: z.number().min(0),
  outputPricePerMillion: z.number().min(0),
  cachedInputPricePerMillion: z.number().min(0).default(0),
  currency: z.string().max(10).default('USD'),
});

export type AIModelPricingCreateSchemaInput = z.infer<typeof aiModelPricingCreateSchema>;

// -----------------------------------------------------------------------------
// Phase 18: Discovery, Search, Ranking, Synonyms & Intelligence Schemas
// -----------------------------------------------------------------------------

export const searchCharacterSchema = z.object({
  q: z.string().max(255).optional(),
  category: z.string().max(50).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional().transform(v => {
    if (!v) return undefined;
    if (Array.isArray(v)) return v;
    return [v];
  }),
  language: z.string().max(20).optional(),
  accessType: z.enum(['free', 'premium', 'all']).default('all'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['recommended', 'popular', 'new', 'trending', 'personalized', 'relevance']).default('relevance'),
});

export type SearchCharacterInput = z.infer<typeof searchCharacterSchema>;

export const searchSuggestionsSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type SearchSuggestionsInput = z.infer<typeof searchSuggestionsSchema>;

export const searchSynonymCreateSchema = z.object({
  term: z.string().min(1).max(100).toLowerCase().trim(),
  synonyms: z.array(z.string().min(1).max(100).toLowerCase().trim()).min(1),
  language: z.string().max(20).default('en'),
  category: z.string().max(50).optional(),
  priority: z.number().int().min(1).max(10).default(1),
  isActive: z.boolean().default(true),
});

export type SearchSynonymCreateInput = z.infer<typeof searchSynonymCreateSchema>;

export const searchSynonymUpdateSchema = z.object({
  synonyms: z.array(z.string().min(1).max(100).toLowerCase().trim()).min(1).optional(),
  language: z.string().max(20).optional(),
  category: z.string().max(50).optional().nullable(),
  priority: z.number().int().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
});

export type SearchSynonymUpdateInput = z.infer<typeof searchSynonymUpdateSchema>;

export const rankingWeightsSchema = z.object({
  semanticRelevance: z.number().min(0).max(1).default(0.25),
  categoryMatch: z.number().min(0).max(1).default(0.15),
  tagMatch: z.number().min(0).max(1).default(0.10),
  popularity: z.number().min(0).max(1).default(0.15),
  trendingVelocity: z.number().min(0).max(1).default(0.15),
  quality: z.number().min(0).max(1).default(0.10),
  userPreference: z.number().min(0).max(1).default(0.10),
  languageMatch: z.number().min(0).max(1).default(0.05),
  freshness: z.number().min(0).max(1).default(0.05),
  novelty: z.number().min(0).max(1).default(0.05),
  fatiguePenalty: z.number().min(0).max(1).default(0.10),
  negativeSignalPenalty: z.number().min(0).max(1).default(0.50),
  repetitionPenalty: z.number().min(0).max(1).default(0.20),
});

export const diversityRulesSchema = z.object({
  maxPerCreator: z.number().int().min(1).max(10).default(2),
  maxPerCategory: z.number().int().min(1).max(20).default(4),
  mmrLambda: z.number().min(0).max(1).default(0.7),
  explorationRatio: z.number().min(0).max(0.5).default(0.1),
});

export const rankingConfigCreateSchema = z.object({
  version: z.string().min(3).max(50).regex(/^[a-z0-9_-]+$/, 'Version must be alphanumeric slug'),
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  weights: rankingWeightsSchema.partial().optional(),
  diversityRules: diversityRulesSchema.partial().optional(),
  isDefault: z.boolean().default(false),
  isShadow: z.boolean().default(false),
});

export type RankingConfigCreateInput = z.infer<typeof rankingConfigCreateSchema>;

export const rankingConfigUpdateSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['DRAFT', 'TESTING', 'PUBLISHED', 'ARCHIVED']).optional(),
  weights: rankingWeightsSchema.partial().optional(),
  diversityRules: diversityRulesSchema.partial().optional(),
  isDefault: z.boolean().optional(),
  isShadow: z.boolean().optional(),
});

export type RankingConfigUpdateInput = z.infer<typeof rankingConfigUpdateSchema>;

export const userNegativeSignalCreateSchema = z.object({
  signalType: z.enum(['HIDE_CHARACTER', 'HIDE_CREATOR', 'NOT_INTERESTED']),
  characterId: z.string().uuid().optional(),
  creatorProfileId: z.string().uuid().optional(),
  reason: z.string().max(255).optional(),
}).refine(data => data.characterId || data.creatorProfileId, {
  message: 'Must provide either characterId or creatorProfileId',
});

export type UserNegativeSignalCreateInput = z.infer<typeof userNegativeSignalCreateSchema>;

export const searchFeedbackSchema = z.object({
  query: z.string().max(255),
  characterId: z.string().uuid(),
  action: z.enum(['CLICK', 'START', 'CONVERSATION', 'RETURN', 'DISMISS']),
  position: z.number().int().min(0).optional(),
  rankingVersion: z.string().max(50).default('ranking_v1'),
});

export type SearchFeedbackInput = z.infer<typeof searchFeedbackSchema>;

export const rankingSimulationSchema = z.object({
  rankingVersion: z.string().max(50).optional(),
  userId: z.string().uuid().optional(),
  preferredCategories: z.array(z.string()).default([]),
  preferredLanguages: z.array(z.string()).default(['en']),
  candidateLimit: z.number().int().min(5).max(100).default(30),
});

export type RankingSimulationInput = z.infer<typeof rankingSimulationSchema>;

// -----------------------------------------------------------------------------
// Phase 21: Production Launch Operations, Beta, Support & Incident Validation Schemas
// -----------------------------------------------------------------------------

export const betaCohortEnum = z.enum([
  'INTERNAL',
  'FRIENDS_FAMILY',
  'EARLY_ADOPTERS',
  'CREATOR_BETA',
  'PREMIUM_BETA',
]);

export const betaInvitationCreateSchema = z.object({
  cohort: betaCohortEnum,
  code: z.string().min(4).max(32).optional(),
  recipientEmail: z.string().email().optional(),
  maxRedemptions: z.number().int().min(1).max(10000).default(1),
  expiresAt: z.string().datetime().optional(),
});

export type BetaInvitationCreateSchemaInput = z.infer<typeof betaInvitationCreateSchema>;

export const betaRedeemSchema = z.object({
  code: z.string().min(4).max(64),
});

export type BetaRedeemSchemaInput = z.infer<typeof betaRedeemSchema>;

export const supportTicketCategoryEnum = z.enum([
  'account',
  'authentication',
  'billing',
  'subscription',
  'credits',
  'ai_response',
  'voice',
  'media',
  'notifications',
  'privacy',
  'memory',
  'creator',
  'technical',
  'bug',
  'safety',
]);

export const supportTicketPriorityEnum = z.enum(['P0', 'P1', 'P2', 'P3']);
export const supportTicketStatusEnum = z.enum([
  'open',
  'triaged',
  'in_progress',
  'waiting_user',
  'resolved',
  'closed',
]);

export const supportTicketCreateSchema = z.object({
  category: supportTicketCategoryEnum,
  subject: z.string().min(3).max(200),
  description: z.string().min(5).max(4000),
  screen: z.string().max(100).optional(),
  appVersion: z.string().max(50).optional(),
  deviceInfo: z.record(z.unknown()).optional(),
  requestId: z.string().max(100).optional(),
});

export type SupportTicketCreateSchemaInput = z.infer<typeof supportTicketCreateSchema>;

export const supportTicketUpdateSchema = z.object({
  status: supportTicketStatusEnum.optional(),
  priority: supportTicketPriorityEnum.optional(),
  assignedAdminId: z.string().uuid().nullable().optional(),
  resolutionNotes: z.string().max(4000).optional(),
});

export type SupportTicketUpdateSchemaInput = z.infer<typeof supportTicketUpdateSchema>;

export const incidentSeverityEnum = z.enum(['SEV_0', 'SEV_1', 'SEV_2', 'SEV_3']);
export const incidentStatusEnum = z.enum([
  'detected',
  'investigating',
  'identified',
  'mitigating',
  'monitoring',
  'resolved',
  'postmortem',
]);

export const opsIncidentCreateSchema = z.object({
  title: z.string().min(5).max(200),
  severity: incidentSeverityEnum,
  affectedServices: z.array(z.string()).min(1),
  impactSummary: z.string().min(10).max(2000),
  commanderAdminId: z.string().uuid().optional(),
  techLeadAdminId: z.string().uuid().optional(),
  customerFacingMessage: z.string().max(1000).optional(),
});

export type OpsIncidentCreateSchemaInput = z.infer<typeof opsIncidentCreateSchema>;

export const opsIncidentUpdateSchema = z.object({
  status: incidentStatusEnum.optional(),
  severity: incidentSeverityEnum.optional(),
  timelineNote: z.string().max(2000).optional(),
  customerFacingMessage: z.string().max(1000).optional(),
  postmortemUrl: z.string().url().optional(),
});

export type OpsIncidentUpdateSchemaInput = z.infer<typeof opsIncidentUpdateSchema>;

export const killSwitchUpdateSchema = z.object({
  switchKey: z.string().min(3).max(100),
  isEnabled: z.boolean(),
  scope: z.enum(['GLOBAL', 'COHORT', 'PROVIDER', 'CHARACTER']).default('GLOBAL'),
  targetId: z.string().max(100).nullable().optional(),
  reason: z.string().min(5).max(500),
});

export type KillSwitchUpdateSchemaInput = z.infer<typeof killSwitchUpdateSchema>;

export const twoPersonApprovalCreateSchema = z.object({
  action: z.enum([
    'DELETE_USER',
    'REFUND_LARGE',
    'UNPUBLISH_POPULAR_CHARACTER',
    'GLOBAL_KILL_SWITCH',
    'DATABASE_MAINTENANCE',
  ]),
  payload: z.record(z.unknown()),
  reason: z.string().min(10).max(500),
});

export type TwoPersonApprovalCreateSchemaInput = z.infer<typeof twoPersonApprovalCreateSchema>;

export const consentRecordSchema = z.object({
  termsVersion: z.string().min(1).max(20),
  privacyVersion: z.string().min(1).max(20),
  consentVersion: z.string().min(1).max(20),
});

export type ConsentRecordSchemaInput = z.infer<typeof consentRecordSchema>;

// -----------------------------------------------------------------------------
// Phase 22: Intelligence & Personalization Schemas
// -----------------------------------------------------------------------------

export const explicitPreferencesSchema = z.object({
  primaryLanguage: z.string().max(20).optional(),
  responseLength: z.enum(['concise', 'balanced', 'detailed']).optional(),
  topicsOfInterest: z.array(z.string().max(50)).optional(),
  interactionStyle: z.enum(['friendly', 'intellectual', 'humorous', 'empathetic', 'direct']).optional(),
  favoriteCategories: z.array(z.string().max(50)).optional(),
  customStyleNotes: z.string().max(300).optional(),
});

export const updatePersonalizationSchema = z.object({
  isPersonalizationEnabled: z.boolean().optional(),
  explicitPreferences: explicitPreferencesSchema.optional(),
});

export type UpdatePersonalizationSchemaInput = z.infer<typeof updatePersonalizationSchema>;

export const resetPersonalizationSchema = z.object({
  scope: z.enum(['all', 'inferred_only']).default('inferred_only'),
});

export type ResetPersonalizationSchemaInput = z.infer<typeof resetPersonalizationSchema>;

export const failureCategoryEnum = z.enum([
  'hallucination',
  'personality_drift',
  'memory_failure',
  'relationship_inconsistency',
  'safety_issue',
  'language_issue',
  'formatting_issue',
  'latency_issue',
  'tool_failure',
  'billing_issue',
]);

export const createFailureCaseSchema = z.object({
  datasetVersion: z.string().max(50).default('evaluation_dataset_v1'),
  category: failureCategoryEnum,
  sanitizedInput: z.string().min(3).max(4000),
  expectedBehavior: z.string().min(3).max(2000),
  observedBehavior: z.string().min(3).max(2000),
  severity: z.enum(['P0', 'P1', 'P2', 'P3']).default('P2'),
  source: z.enum(['USER_REPORT', 'INTERNAL_AUDIT', 'AUTOMATED_MONITOR', 'SYNTHETIC']).default('USER_REPORT'),
  modelVersion: z.string().max(50).default('gpt-4o-mini'),
  promptVersion: z.string().max(50).default('v1.0'),
  characterVersion: z.string().max(50).default('v1.0'),
});

export type CreateFailureCaseSchemaInput = z.infer<typeof createFailureCaseSchema>;

export const evaluationRubricScoreSchema = z.object({
  relevance: z.number().min(0).max(1),
  factuality: z.number().min(0).max(1),
  instructionFollowing: z.number().min(0).max(1),
  characterConsistency: z.number().min(0).max(1),
  emotionalAppropriateness: z.number().min(0).max(1),
  memoryCorrectness: z.number().min(0).max(1),
  conversationalNaturalness: z.number().min(0).max(1),
  safety: z.number().min(0).max(1),
  languageQuality: z.number().min(0).max(1),
});

export type EvaluationRubricScoreSchemaInput = z.infer<typeof evaluationRubricScoreSchema>;

export const evaluateFailureCaseSchema = z.object({
  caseId: z.string().min(1),
  rubricScores: evaluationRubricScoreSchema,
});

export type EvaluateFailureCaseSchemaInput = z.infer<typeof evaluateFailureCaseSchema>;

export const replayGenerationSchema = z.object({
  generationId: z.string().min(1),
  targetModel: z.string().max(50).optional(),
  targetPromptVersion: z.string().max(50).optional(),
  overrideTemperature: z.number().min(0).max(2).optional(),
});

export type ReplayGenerationSchemaInput = z.infer<typeof replayGenerationSchema>;

export const circuitBreakerUpdateSchema = z.object({
  name: z.string().min(1),
  isTripped: z.boolean(),
  threshold: z.number().optional(),
  reason: z.string().min(3).max(500),
});

export type CircuitBreakerUpdateSchemaInput = z.infer<typeof circuitBreakerUpdateSchema>;

// -----------------------------------------------------------------------------
// Phase 23: Agent & Tool Orchestration Schemas
// -----------------------------------------------------------------------------

export const agentTaskBoundsSchema = z.object({
  maxSteps: z.number().int().min(1).max(20).default(8),
  maxToolCalls: z.number().int().min(1).max(30).default(12),
  maxDurationMs: z.number().int().min(5000).max(600000).default(120000),
  maxTokens: z.number().int().min(500).max(64000).default(16000),
  maxCostUsd: z.number().min(0.01).max(5.0).default(0.25),
  maxRetries: z.number().int().min(0).max(5).default(2),
  maxParallelTools: z.number().int().min(1).max(5).default(3),
});

export const createAgentTaskSchema = z.object({
  characterId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  taskType: z
    .enum(['WORKFLOW', 'ONE_SHOT_TOOL', 'RESEARCH', 'MULTIMODAL_EXTRACTION', 'SCHEDULED_AUTOMATION'])
    .default('WORKFLOW'),
  objective: z.string().min(3, 'Objective must be at least 3 characters').max(1000),
  bounds: agentTaskBoundsSchema.partial().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateAgentTaskSchemaInput = z.infer<typeof createAgentTaskSchema>;

export const confirmAgentStepSchema = z.object({
  token: z.string().min(10, 'Invalid confirmation token'),
  action: z.enum(['CONFIRM', 'REJECT']),
  reason: z.string().max(300).optional(),
});

export type ConfirmAgentStepSchemaInput = z.infer<typeof confirmAgentStepSchema>;

export const toolRegistryItemSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100),
  description: z.string().min(5).max(500),
  version: z.string().max(20).default('1.0.0'),
  category: z.enum([
    'READ_ONLY',
    'USER_ACTION',
    'COMMUNICATION',
    'SCHEDULED_ACTION',
    'EXTERNAL_API',
    'BROWSER',
    'MULTIMODAL',
    'DATA_PROCESSING',
    'ADMIN_INTERNAL',
    'HIGH_RISK',
  ]),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  requiredCapability: z.string().min(2).max(100),
  permissionScope: z.string().min(2).max(100),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()).default({}),
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
  isSideEffecting: z.boolean().default(false),
  isReversible: z.boolean().default(false),
  costUsd: z.number().min(0).default(0),
});

export type ToolRegistryItemSchemaInput = z.infer<typeof toolRegistryItemSchema>;

export const skillItemSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100),
  description: z.string().min(5).max(500),
  version: z.string().max(20).default('1.0.0'),
  category: z.string().min(2).max(50),
  requiredCapabilities: z.array(z.string()).default([]),
  requiredToolSlugs: z.array(z.string()).min(1),
  maxSteps: z.number().int().min(1).max(20).default(8),
  maxCostUsd: z.number().min(0).default(0.20),
});

export type SkillItemSchemaInput = z.infer<typeof skillItemSchema>;

export const grantUserConsentSchema = z.object({
  capabilitySlug: z.string().min(2).max(100),
  provider: z.string().min(2).max(100),
  scope: z.string().min(2).max(200),
  durationDays: z.number().int().min(1).max(365).optional(),
});

export type GrantUserConsentSchemaInput = z.infer<typeof grantUserConsentSchema>;

export const scheduledAgentTaskCreateSchema = z.object({
  characterId: z.string().uuid().optional(),
  taskTemplate: z.object({
    objective: z.string().min(5).max(1000),
    toolSlugs: z.array(z.string()).min(1),
    arguments: z.record(z.unknown()).default({}),
  }),
  cronSchedule: z.string().min(5).max(50),
  timezone: z.string().max(50).default('UTC'),
  maxRuns: z.number().int().positive().optional(),
});

export type ScheduledAgentTaskCreateSchemaInput = z.infer<typeof scheduledAgentTaskCreateSchema>;

export const multimodalUploadMetadataSchema = z.object({
  partType: z.enum(['image', 'audio', 'video', 'document', 'structured_json']),
  originalFilename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  fileSizeBytes: z.number().int().positive().max(15728640),
});

export type MultimodalUploadMetadataSchemaInput = z.infer<typeof multimodalUploadMetadataSchema>;

// =============================================================================
// PHASE 24: ADVANCED SOCIAL & COMMUNICATION LAYER SCHEMAS
//
// Targets are addressed by public id / username / slug — never by internal user id.
// Shares reference server-side sources (message ids the caller owns); the client never
// supplies the snapshot payload that becomes public.
// =============================================================================

const socialPublicId = z.string().regex(/^[A-Za-z0-9_-]{8,32}$/, 'Invalid identifier');
const socialAudience = z.enum(['EVERYONE', 'FOLLOWERS', 'MUTUALS', 'NOBODY']);
const socialSlug = z.string().min(3).max(100).regex(/^[a-z0-9][a-z0-9_-]*$/, 'Invalid slug');

export const socialCursorQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SocialCursorQueryInput = z.infer<typeof socialCursorQuerySchema>;

export const socialUsernameSchema = z.string().trim().min(3).max(30);

export const createSocialProfileSchema = z.object({
  username: socialUsernameSchema,
  displayName: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(300).optional(),
  pronouns: z.string().trim().max(30).optional(),
});
export type CreateSocialProfileInput = z.infer<typeof createSocialProfileSchema>;

export const updateSocialProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60).optional(),
    bio: z.string().trim().max(300).nullable().optional(),
    pronouns: z.string().trim().max(30).nullable().optional(),
    profileTheme: z.string().trim().max(30).nullable().optional(),
    locale: z.string().trim().min(2).max(10).optional(),
  })
  .strict();
export type UpdateSocialProfileInput = z.infer<typeof updateSocialProfileSchema>;

export const changeUsernameSchema = z.object({ username: socialUsernameSchema });
export type ChangeUsernameInput = z.infer<typeof changeUsernameSchema>;

export const updateSocialPrivacySchema = z
  .object({
    profileVisibility: z.enum(['PUBLIC', 'LIMITED', 'PRIVATE']).optional(),
    followPolicy: z.enum(['EVERYONE', 'APPROVAL_REQUIRED', 'NOBODY']).optional(),
    followListAudience: socialAudience.optional(),
    creationsAudience: socialAudience.optional(),
    sharedContentAudience: socialAudience.optional(),
    activityAudience: socialAudience.optional(),
    communitiesAudience: socialAudience.optional(),
    showOnlineStatus: z.boolean().optional(),
    whoCanMessage: socialAudience.optional(),
    whoCanMention: socialAudience.optional(),
    whoCanComment: socialAudience.optional(),
    whoCanInviteToCommunities: socialAudience.optional(),
    discoverable: z.boolean().optional(),
    searchable: z.boolean().optional(),
    socialRecommendations: z.boolean().optional(),
    characterSocialInteractions: z.boolean().optional(),
  })
  .strict();
export type UpdateSocialPrivacyInput = z.infer<typeof updateSocialPrivacySchema>;

export const socialUserTargetSchema = z.object({ target: socialPublicId });
export type SocialUserTargetInput = z.infer<typeof socialUserTargetSchema>;

export const socialBlockSchema = z.object({
  target: socialPublicId,
  reason: z.string().trim().max(255).optional(),
});
export type SocialBlockInput = z.infer<typeof socialBlockSchema>;

export const socialMuteSchema = z.object({
  targetType: z.enum(['USER', 'CREATOR', 'CHARACTER', 'COMMUNITY', 'TOPIC', 'NOTIFICATION_CATEGORY']),
  target: z.string().trim().min(1).max(100),
  scope: z.enum(['ALL', 'POSTS', 'COMMENTS', 'NOTIFICATIONS']).default('ALL'),
  durationHours: z.number().int().min(1).max(24 * 365).optional(),
});
export type SocialMuteInput = z.infer<typeof socialMuteSchema>;

export const socialFollowRequestResponseSchema = z.object({
  target: socialPublicId,
  action: z.enum(['ACCEPT', 'DECLINE']),
});
export type SocialFollowRequestResponseInput = z.infer<typeof socialFollowRequestResponseSchema>;

export const characterFollowSchema = z.object({
  notificationsEnabled: z.boolean().default(false),
});
export type CharacterFollowInput = z.infer<typeof characterFollowSchema>;

/** Step 1 of sharing: preview exactly what becomes visible (nothing is persisted). */
export const socialSharePreviewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('CHARACTER_SHARE'), characterSlug: socialSlug }),
  z.object({
    kind: z.literal('CONVERSATION_EXCERPT'),
    conversationId: z.string().uuid(),
    messageIds: z.array(z.string().uuid()).min(1).max(50),
    /** Optional per-message manual redactions: exact substrings to replace. */
    manualRedactions: z.array(z.object({ messageId: z.string().uuid(), text: z.string().min(1).max(200) })).max(50).optional(),
    includeAttachments: z.boolean().default(false),
  }),
]);
export type SocialSharePreviewInput = z.infer<typeof socialSharePreviewSchema>;

/** Step 2: create the immutable snapshot. Same source as the preview plus explicit choices. */
export const socialCreateShareSchema = z.object({
  source: socialSharePreviewSchema,
  title: z.string().trim().min(1).max(150).optional(),
  caption: z.string().trim().max(1000).optional(),
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'FOLLOWERS']).default('UNLISTED'),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  confirmationToken: z.string().max(200).optional(),
});
export type SocialCreateShareInput = z.infer<typeof socialCreateShareSchema>;

export const socialCreatePostSchema = z.object({
  kind: z.enum(['CREATOR_POST', 'COMMUNITY_POST']),
  title: z.string().trim().max(150).optional(),
  body: z.string().trim().min(1).max(5000),
  characterSlug: socialSlug.optional(),
  communitySlug: socialSlug.optional(),
  visibility: z.enum(['PUBLIC', 'FOLLOWERS', 'COMMUNITY']).default('PUBLIC'),
  topics: z.array(z.string().trim().min(1).max(40)).max(5).default([]),
});
export type SocialCreatePostInput = z.infer<typeof socialCreatePostSchema>;

export const socialEditPostSchema = z.object({
  title: z.string().trim().max(150).nullable().optional(),
  body: z.string().trim().min(1).max(5000).optional(),
});
export type SocialEditPostInput = z.infer<typeof socialEditPostSchema>;

export const socialReactionSchema = z.object({
  reactionType: z.enum(['LIKE', 'FAVORITE', 'APPRECIATION', 'USEFUL']),
});
export type SocialReactionInput = z.infer<typeof socialReactionSchema>;

export const socialCreateCommentSchema = z.object({
  body: z.string().trim().min(1).max(1000, 'Comment exceeds maximum 1000 characters'),
  parentId: z.string().uuid().optional(),
});
export type SocialCreateCommentInput = z.infer<typeof socialCreateCommentSchema>;

export const socialEditCommentSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});
export type SocialEditCommentInput = z.infer<typeof socialEditCommentSchema>;

export const socialReportSchema = z.object({
  targetType: z.enum(['PROFILE', 'CHARACTER', 'CONTENT', 'COMMENT', 'DIRECT_MESSAGE', 'COMMUNITY', 'CREATOR']),
  target: z.string().trim().min(1).max(100),
  reasonCode: z.string().trim().min(2).max(40),
  details: z.string().trim().max(1000).optional(),
});
export type SocialReportInput = z.infer<typeof socialReportSchema>;

export const socialAppealSchema = z.object({
  caseId: z.string().uuid(),
  reason: z.string().trim().min(10).max(2000),
});
export type SocialAppealInput = z.infer<typeof socialAppealSchema>;

export const socialMessageRequestSchema = z.object({
  to: socialPublicId,
  message: z.string().trim().min(1).max(500),
  clientMessageId: z.string().trim().min(8).max(64),
});
export type SocialMessageRequestInput = z.infer<typeof socialMessageRequestSchema>;

export const socialRespondMessageRequestSchema = z.object({
  action: z.enum(['ACCEPT', 'DECLINE', 'BLOCK']),
});
export type SocialRespondMessageRequestInput = z.infer<typeof socialRespondMessageRequestSchema>;

export const socialSendMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000, 'Message exceeds 2000 characters'),
  clientMessageId: z.string().trim().min(8).max(64),
  attachments: z
    .array(z.object({ uploadId: z.string().min(1).max(100) }))
    .max(4)
    .optional(),
});
export type SocialSendMessageInput = z.infer<typeof socialSendMessageSchema>;

export const createCommunitySchema = z.object({
  name: z.string().trim().min(3).max(60),
  slug: z.string().trim().min(3).max(50).regex(/^[a-z0-9][a-z0-9-]*$/, 'Slug can only contain lowercase letters, numbers and hyphens'),
  description: z.string().trim().min(10).max(1000),
  rules: z.array(z.string().trim().min(3).max(300)).min(1).max(20),
  privacy: z.enum(['PUBLIC', 'DISCOVERABLE_PRIVATE', 'INVITE_ONLY']).default('PUBLIC'),
  characterSlug: socialSlug.optional(),
});
export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;

export const joinCommunitySchema = z.object({
  acceptRules: z.literal(true, { errorMap: () => ({ message: 'You must accept the community rules to join' }) }),
});
export type JoinCommunityInput = z.infer<typeof joinCommunitySchema>;

export const communityInviteSchema = z.object({ target: socialPublicId });
export type CommunityInviteInput = z.infer<typeof communityInviteSchema>;

export const communityModerationSchema = z.object({
  action: z.enum(['REMOVE_POST', 'REMOVE_COMMENT', 'MUTE_MEMBER', 'RESTRICT_MEMBER', 'BAN_MEMBER', 'UNBAN_MEMBER', 'PROMOTE_MODERATOR', 'DEMOTE_MODERATOR']),
  target: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(3).max(500),
  durationHours: z.number().int().min(1).max(24 * 365).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type CommunityModerationInput = z.infer<typeof communityModerationSchema>;

export const socialFeedQuerySchema = socialCursorQuerySchema.extend({
  tab: z.enum(['FOR_YOU', 'FOLLOWING']).default('FOLLOWING'),
});
export type SocialFeedQueryInput = z.infer<typeof socialFeedQuerySchema>;

export const socialFeedFeedbackSchema = z.object({
  signal: z.enum(['NOT_INTERESTED', 'SHOW_LESS', 'HIDE']),
  targetType: z.enum(['CONTENT', 'AUTHOR', 'CHARACTER', 'COMMUNITY', 'TOPIC']),
  target: z.string().trim().min(1).max(100),
});
export type SocialFeedFeedbackInput = z.infer<typeof socialFeedFeedbackSchema>;

export const socialSearchQuerySchema = socialCursorQuerySchema.extend({
  q: z.string().trim().min(2).max(60),
  type: z.enum(['USERS', 'COMMUNITIES']).default('USERS'),
});
export type SocialSearchQueryInput = z.infer<typeof socialSearchQuerySchema>;

export const socialConsentUpdateSchema = z.object({
  consentType: z.enum([
    'DIRECT_MESSAGING',
    'CREATOR_COMMUNICATION',
    'CHARACTER_PROACTIVE_SOCIAL',
    'COMMUNITY_PARTICIPATION',
    'EXTERNAL_SHARING',
    'SOCIAL_NOTIFICATIONS',
    'AI_GENERATED_PUBLIC_CONTENT',
  ]),
  granted: z.boolean(),
});
export type SocialConsentUpdateInput = z.infer<typeof socialConsentUpdateSchema>;

export const characterSocialCapabilitiesSchema = z
  .object({
    canPublish: z.boolean().optional(),
    canReply: z.boolean().optional(),
    canComment: z.boolean().optional(),
    canReact: z.boolean().optional(),
    canSendNotifications: z.boolean().optional(),
    canMentionUsers: z.boolean().optional(),
    requiresCreatorApproval: z.boolean().optional(),
    maxPostsPerDay: z.number().int().min(0).max(24).optional(),
    maxRepliesPerHour: z.number().int().min(0).max(60).optional(),
    maxInteractionsPerUserPerDay: z.number().int().min(0).max(20).optional(),
    maxDailyCostCents: z.number().int().min(0).max(10_000).optional(),
    cooldownSeconds: z.number().int().min(60).max(86_400).optional(),
  })
  .strict();
export type CharacterSocialCapabilitiesInput = z.infer<typeof characterSocialCapabilitiesSchema>;

/** A model may only PROPOSE a social action; the runtime validator decides. */
export const characterSocialActionProposalSchema = z.object({
  characterSlug: socialSlug,
  actionType: z.enum(['PUBLISH_POST', 'REPLY_COMMENT', 'REACT_CONTENT', 'SEND_NOTIFICATION', 'MENTION_USER', 'SEND_DIRECT_MESSAGE', 'FOLLOW_USER', 'JOIN_COMMUNITY']),
  targetContent: socialPublicId.optional(),
  targetCommentId: z.string().uuid().optional(),
  targetUser: socialPublicId.optional(),
  text: z.string().trim().max(2000).optional(),
  reactionType: z.enum(['LIKE', 'FAVORITE', 'APPRECIATION', 'USEFUL']).optional(),
  generation: z
    .object({
      generationId: z.string().min(1).max(100),
      model: z.string().min(1).max(100),
      characterVersionId: z.string().uuid().nullable().optional(),
      promptVersion: z.string().max(50).nullable().optional(),
      safetyVersion: z.string().max(50).nullable().optional(),
      estimatedCostCents: z.number().int().min(0).max(10_000).default(0),
    })
    .optional(),
  idempotencyKey: z.string().min(8).max(128),
});
export type CharacterSocialActionProposalInput = z.infer<typeof characterSocialActionProposalSchema>;

export const scheduledSocialActionSchema = z.object({
  characterSlug: socialSlug.optional(),
  actionType: z.enum(['CHARACTER_POST', 'CREATOR_ANNOUNCEMENT']),
  payload: z.object({
    title: z.string().trim().max(150).optional(),
    body: z.string().trim().min(1).max(5000).optional(),
    promptTemplate: z.string().trim().max(1000).optional(),
  }),
  intervalHours: z.number().int().min(24).max(24 * 30),
  budgetCents: z.number().int().min(0).max(10_000).default(100),
});
export type ScheduledSocialActionInput = z.infer<typeof scheduledSocialActionSchema>;

// --- Admin --------------------------------------------------------------------

export const adminSocialPolicyUpdateSchema = z.object({
  patch: z.record(z.string(), z.unknown()),
  changeReason: z.string().trim().min(10).max(1000),
  confirm: z.literal(true),
});
export type AdminSocialPolicyUpdateInput = z.infer<typeof adminSocialPolicyUpdateSchema>;

export const adminSocialPolicyRollbackSchema = z.object({
  toVersion: z.number().int().min(1),
  changeReason: z.string().trim().min(10).max(1000),
  confirm: z.literal(true),
});
export type AdminSocialPolicyRollbackInput = z.infer<typeof adminSocialPolicyRollbackSchema>;

export const adminSocialKillSwitchSchema = z.object({
  feature: z.string().min(1).max(50),
  active: z.boolean(),
  reason: z.string().trim().min(10).max(1000),
  confirm: z.literal(true),
});
export type AdminSocialKillSwitchInput = z.infer<typeof adminSocialKillSwitchSchema>;

export const adminSocialCaseDecisionSchema = z.object({
  decision: z.enum(['DISMISS', 'RESTRICT_CONTENT', 'HIDE_CONTENT', 'REMOVE_CONTENT', 'RESTORE_CONTENT', 'RESTRICT_USER_SOCIAL', 'SUSPEND_USER', 'ESCALATE']),
  notes: z.string().trim().min(3).max(4000),
  restrictionHours: z.number().int().min(1).max(24 * 365).optional(),
  userFacingReason: z.string().trim().max(500).optional(),
  confirm: z.boolean().optional(),
  /** Content version the moderator reviewed; a decision on a newer version is refused (409). */
  expectedVersion: z.number().int().min(1).optional(),
});
export type AdminSocialCaseDecisionInput = z.infer<typeof adminSocialCaseDecisionSchema>;

export const adminSocialAppealDecisionSchema = z.object({
  decision: z.enum(['UPHOLD', 'REVERSE']),
  notes: z.string().trim().min(3).max(4000),
});
export type AdminSocialAppealDecisionInput = z.infer<typeof adminSocialAppealDecisionSchema>;

export const adminCharacterSocialApprovalSchema = z.object({
  approved: z.boolean(),
  reason: z.string().trim().min(3).max(1000),
});
export type AdminCharacterSocialApprovalInput = z.infer<typeof adminCharacterSocialApprovalSchema>;

export const adminPrivateContentAccessSchema = z.object({
  purpose: z.enum(['SAFETY_INVESTIGATION', 'LEGAL_REQUEST', 'CHILD_SAFETY', 'USER_CONSENTED_SUPPORT']),
  justification: z.string().trim().min(20).max(2000),
  caseId: z.string().uuid(),
});
export type AdminPrivateContentAccessInput = z.infer<typeof adminPrivateContentAccessSchema>;

export const adminSocialSimulationSchema = z.object({
  action: z.enum(['VIEW_PROFILE', 'FOLLOW', 'MESSAGE', 'MESSAGE_REQUEST', 'COMMENT', 'MENTION', 'NOTIFY', 'CHARACTER_POST', 'CHARACTER_REPLY', 'RECOMMEND']),
  actor: socialPublicId.optional(),
  target: z.string().max(100).optional(),
  characterSlug: socialSlug.optional(),
  text: z.string().max(2000).optional(),
});
export type AdminSocialSimulationInput = z.infer<typeof adminSocialSimulationSchema>;
