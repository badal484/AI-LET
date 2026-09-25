// User & Identity Types
export type UserRole = 'USER' | 'CREATOR' | 'MODERATOR' | 'ADMIN';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type AuthProviderType = 'email_password' | 'google' | 'apple' | 'phone_otp';

export interface UserSummary {
  id: string;
  email: string;
  normalizedEmail: string;
  phoneNumber?: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastLoginAt?: string | null;
  lastActiveAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfileSummary {
  id: string;
  userId: string;
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  dateOfBirth?: string | null;
  preferredLocale: string;
  timezone: string;
  isNsfwAllowed: boolean;
  audioAutoPlay: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface AuthSession {
  id: string;
  userId: string;
  deviceId?: string | null;
  tokenFamilyId: string;
  isCurrentSession?: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  lastUsedAt: string;
  expiresAt: string;
  createdAt: string;
}

export interface UserDevice {
  id: string;
  userId: string;
  platform: 'ios' | 'android' | 'web';
  appVersion?: string | null;
  osVersion?: string | null;
  deviceName?: string | null;
  pushToken?: string | null;
  lastActiveAt: string;
  createdAt: string;
}

export interface UserPrincipal {
  userId: string;
  email: string;
  roles: string[];
  sessionId?: string;
  deviceId?: string;
  emailVerified?: boolean;
}

export type AuthPrincipal = UserPrincipal;

export interface AuthResponseData {
  user: UserSummary;
  profile: UserProfileSummary;
  tokens: AuthTokens;
  sessionId: string;
}

export interface AdminPrincipal {
  adminId: string;
  email: string;
  roles: string[];
  role?: string;
  permissions: string[];
  sessionId?: string;
}

export interface AdminSummary {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  isSuspended: boolean;
  role: {
    id: string;
    name: string;
    description: string;
    permissions: string[];
  };
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface AdminAuthResponseData {
  admin: AdminSummary;
  tokens: AuthTokens;
}

// -----------------------------------------------------------------------------
// Phase 3: Character Domain Types & Configuration Engine
// -----------------------------------------------------------------------------

export type CharacterStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED';
export type CharacterVisibility = 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
export type CharacterVersionStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'ARCHIVED' | 'ROLLED_BACK';

export type HumorStyle = 'dry' | 'playful' | 'sarcastic' | 'whimsical' | 'none';
export type CommunicationPacing = 'rapid' | 'thoughtful' | 'deliberate';
export type SentenceLength = 'short' | 'variable' | 'elaborate';
export type FormalityLevel = 'casual' | 'informal' | 'formal';
export type IntimacyProgression = 'slow_burn' | 'standard' | 'open';
export type AttachmentStyle = 'secure' | 'anxious' | 'avoidant';
export type NsfwLevel = 'strict_sfw' | 'mature_flirt' | 'unfiltered_adult';

// 1. Identity Data
export interface CharacterIdentityData {
  name: string;
  nickname?: string;
  ageRepresentation?: number;
  role: string;
  occupation: string;
  locationWorld: string;
  backstory: string;
  lifeContext?: string;
  interests: string[];
  dislikes: string[];
  goals: string[];
  values: string[];
  beliefs?: string[];
  personalitySummary: string;
}

// 2. Personality & Traits
export interface PersonalityTraitMap {
  confidence: number; // 0-100
  warmth: number; // 0-100
  playfulness: number; // 0-100
  curiosity: number; // 0-100
  sarcasm: number; // 0-100
  patience: number; // 0-100
  energy: number; // 0-100
  seriousness: number; // 0-100
  romanticism: number; // 0-100
  empathy: number; // 0-100
  assertiveness: number; // 0-100
  humor: number; // 0-100
  introversion: number; // 0-100 (0=Extroverted, 100=Introverted)
  agreeableness: number; // 0-100
  openness: number; // 0-100
  conscientiousness: number; // 0-100
  neuroticism: number; // 0-100
}

export interface TraitInteractionRule {
  id: string;
  primaryTrait: keyof PersonalityTraitMap | string;
  secondaryTrait: keyof PersonalityTraitMap | string;
  condition: string; // e.g., 'high_primary_and_high_secondary'
  behavioralEffect: string; // e.g., 'Produces witty, affectionate teasing without malice.'
}

export interface PersonalityConfigData {
  traits: PersonalityTraitMap;
  interactionRules: TraitInteractionRule[];
  humorStyle: HumorStyle;
  customQuirks: string[];
  summary?: string;
}

// 3. Communication & Language
export interface CommunicationStyleConfigData {
  pacing: CommunicationPacing;
  sentenceLength: SentenceLength;
  vocabularyComplexity: 'simple' | 'moderate' | 'sophisticated' | 'poetic';
  formality: FormalityLevel;
  punctuationStyle: 'standard' | 'expressive' | 'minimal' | 'literary';
  questionFrequency: 'rare' | 'moderate' | 'inquisitive';
  humorFrequency: 'never' | 'subtle' | 'frequent' | 'constant';
  teasingFrequency: 'never' | 'occasional' | 'playful_frequent';
  emojiPolicy: 'none' | 'minimal' | 'expressive';
  responseDensity: 'concise' | 'balanced' | 'elaborate';
  directness: 'direct' | 'tactful' | 'cryptic';
  preferredPhrases: string[];
  avoidedPhrases: string[];
  openingBehavior?: string;
  closingBehavior?: string;
}

export interface LanguageBehaviorConfigData {
  primaryLanguage: 'en' | 'hi' | 'hinglish';
  fallbackLanguages: string[];
  codeSwitchingEnabled: boolean;
  codeSwitchingStyle: 'subtle' | 'natural_conversational' | 'mirror_user';
  responseLanguagePolicy: 'always_primary' | 'match_user_language' | 'bilingual_hinglish';
}

// 4. Behavior Rules
export type BehaviorRuleCategory =
  | 'PLATFORM_SAFETY'
  | 'IDENTITY'
  | 'COMMUNICATION'
  | 'CONVERSATION_FLOW'
  | 'RELATIONSHIP'
  | 'CUSTOM';

export interface BehaviorRuleItemData {
  id: string;
  type: 'DO' | 'DO_NOT';
  category: BehaviorRuleCategory;
  ruleText: string;
  priority: number; // 1 = highest, 100 = lowest
  isEnabled: boolean;
}

// 5. Knowledge & Lore
export type CharacterKnowledgeType =
  | 'BIOGRAPHY'
  | 'LORE'
  | 'WORLD'
  | 'INTEREST'
  | 'EXPERTISE'
  | 'FAQ'
  | 'DOCUMENT';

export interface CharacterKnowledgeItemData {
  id: string;
  title: string;
  content: string;
  type: CharacterKnowledgeType;
  priority: number;
  isEnabled: boolean;
  tags: string[];
}

// 6. Relationship Configuration
export interface RelationshipBehaviorConfigData {
  familiaritySensitivity: number; // 0-100
  affectionExpression: 'reserved' | 'moderate' | 'expressive' | 'intense';
  trustSensitivity: number; // 0-100
  personalizationLevel: 'low' | 'moderate' | 'high';
  conversationContinuity: 'low' | 'high';
  boundaryBehavior: 'strict' | 'gentle' | 'adaptive';
  attachmentFraming: AttachmentStyle;
  progressionSpeed: 'slow_burn' | 'standard' | 'accelerated';
}

// 7. Memory Configuration
export interface MemoryBehaviorConfigData {
  memoryEnabled: boolean;
  preferredMemoryTypes: MemoryType[];
  memoryRecallStyle: 'subtle_implicit' | 'direct_explicit' | 'natural_contextual';
  personalizationStrength: number; // 0-100
  sensitiveMemoryPolicy: 'omit' | 'ask_permission' | 'store_with_disclaimer';
  memoryConfirmationBehavior: 'never' | 'on_ambiguity' | 'always';
}

// 8. Proactivity Configuration
export interface ProactivityBehaviorConfigData {
  enabled: boolean;
  allowedHoursStartUtc: number; // 0-23
  allowedHoursEndUtc: number; // 0-23
  maxDailyMessages: number;
  minInteractionCooldownHours: number;
  quietHoursEnabled: boolean;
  quietHoursStartUtc: number;
  quietHoursEndUtc: number;
  preferredEventTypes: string[];
}

// 9. Safety Configuration
export interface CharacterSafetyConfigData {
  contentBoundaries: string[];
  topicsRequiringCaution: string[];
  ageSuitability: 'ALL_AGES' | 'TEEN_13_PLUS' | 'MATURE_18_PLUS';
  relationshipBoundaries: string[];
  selfHarmEscalationPolicy: 'STRICT_EMERGENCY_DISCLAIMER_AND_REFUSAL';
  disclaimerBehavior: 'CRISIS_ONLY' | 'MEDICAL_FINANCIAL_LEGAL_DISCLAIMER';
  sexualContentPolicy: NsfwLevel;
  impersonationRestrictions: string[];
  identityClaimsPolicy: 'AI_CHARACTER_TRANSPARENT';
}

// 10. AI Configuration
export interface CharacterAIConfigData {
  preferredModelClass: 'fast' | 'balanced' | 'creative' | 'precise' | 'custom';
  temperature: number; // 0.0 - 2.0
  maxOutputTokens: number;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  responseLength: 'concise' | 'balanced' | 'detailed';
  fallbackStrategy: 'fallback_model' | 'graceful_degradation';
  contextBudgetTokens: number;
  customModelName?: string;
}

// 11. Voice Configuration
export interface CharacterVoiceConfigData {
  provider: 'elevenlabs' | 'playht' | 'openai';
  voiceId: string;
  speed: number;
  pitch: number;
}

// Full Version Snapshot
export interface CharacterVersionSnapshot {
  id: string;
  characterId: string;
  versionNumber: number;
  status: CharacterVersionStatus;
  identityData: CharacterIdentityData;
  personalityData: PersonalityConfigData;
  communicationData: CommunicationStyleConfigData;
  languageData: LanguageBehaviorConfigData;
  behaviorRulesData: BehaviorRuleItemData[];
  knowledgeData: CharacterKnowledgeItemData[];
  relationshipConfigData: RelationshipBehaviorConfigData;
  memoryConfigData: MemoryBehaviorConfigData;
  proactivityConfigData: ProactivityBehaviorConfigData;
  safetyConfigData: CharacterSafetyConfigData;
  aiConfigData: CharacterAIConfigData;
  voiceConfigData?: CharacterVoiceConfigData | null;
  compiledPromptSnapshot?: string;
  changeSummary: string;
  createdById?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Character Entities
export interface CharacterSummary {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  avatarUrl: string;
  coverImageUrl: string;
  category: string;
  status: CharacterStatus;
  visibility: CharacterVisibility;
  isFeatured: boolean;
  currentPublishedVersionId?: string | null;
  currentVersionNumber: number;
  updatedAt: string;
}

export interface CharacterPublicDetail {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  shortDescription: string;
  longDescription: string;
  avatarUrl: string;
  coverImageUrl: string;
  category: string;
  archetype: string;
  age: number;
  gender: string;
  occupation: string;
  isFeatured: boolean;
  versionNumber: number;
  traits: {
    warmth: number;
    playfulness: number;
    curiosity: number;
    humorStyle: string;
    quirks: string[];
  };
  communication: {
    pacing: string;
    formality: string;
    primaryLanguage: string;
  };
  voiceSampleUrl?: string | null;
  createdAt: string;
}

export interface CharacterAdminDetail {
  id: string;
  internalKey: string;
  slug: string;
  name: string;
  tagline: string;
  shortDescription: string;
  longDescription: string;
  avatarUrl: string;
  coverImageUrl: string;
  category: string;
  archetype: string;
  age: number;
  gender: string;
  occupation: string;
  status: CharacterStatus;
  visibility: CharacterVisibility;
  isFeatured: boolean;
  currentPublishedVersionId?: string | null;
  currentVersionNumber: number;
  currentPublishedVersion?: CharacterVersionSnapshot | null;
  latestDraftVersion?: CharacterVersionSnapshot | null;
  versions: Array<{
    id: string;
    versionNumber: number;
    status: CharacterVersionStatus;
    changeSummary: string;
    publishedAt?: string | null;
    createdAt: string;
  }>;
  createdById?: string | null;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

// Legacy Character Detail interface for backwards-compatibility
export interface CharacterTraits {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  humorStyle: HumorStyle;
  quirks: string[];
}

export interface CharacterCommunicationStyle {
  pacing: CommunicationPacing;
  sentenceLength: SentenceLength;
  formality: FormalityLevel;
  useOfSlang: boolean;
  useOfActionTags: boolean;
  emojiDensity: 'none' | 'minimal' | 'expressive';
}

export interface CharacterRelationshipRules {
  initialTrust: number;
  intimacyProgressionRate: IntimacyProgression;
  jealousyThreshold: number;
  attachmentStyle: AttachmentStyle;
}

export interface CharacterSafetyRules {
  nsfwLevel: NsfwLevel;
  tabooTopics: string[];
  hardBoundaries: string[];
}

export interface CharacterVoiceConfig {
  provider: 'elevenlabs' | 'playht' | 'openai';
  voiceId: string;
  speed: number;
  pitch: number;
}

export interface CharacterDetail {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  avatarUrl: string;
  coverImageUrl: string;
  archetype: string;
  backstory: string;
  age: number;
  gender: string;
  occupation: string;
  status: CharacterStatus;
  isFeatured: boolean;
  currentVersion: number;
  traits: CharacterTraits;
  communicationStyle: CharacterCommunicationStyle;
  relationshipRules: CharacterRelationshipRules;
  safetyRules: CharacterSafetyRules;
  voiceConfig?: CharacterVoiceConfig | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Runtime Execution Object
export interface CharacterRuntimeObject {
  characterId: string;
  slug: string;
  versionId: string;
  versionNumber: number;
  name: string;
  status: CharacterStatus;
  identity: CharacterIdentityData;
  personality: PersonalityConfigData;
  communication: CommunicationStyleConfigData;
  language: LanguageBehaviorConfigData;
  behaviorRules: BehaviorRuleItemData[];
  knowledge: CharacterKnowledgeItemData[];
  relationshipConfig: RelationshipBehaviorConfigData;
  memoryConfig: MemoryBehaviorConfigData;
  proactivityConfig: ProactivityBehaviorConfigData;
  safetyConfig: CharacterSafetyConfigData;
  aiConfig: CharacterAIConfigData;
  voiceConfig?: CharacterVoiceConfigData | null;
  compiledSystemPrompt: string;
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface CharacterValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
}

export interface VersionDiffItem {
  section: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  isChanged: boolean;
}

export interface VersionDiffResult {
  versionA: { id: string; versionNumber: number; status: string };
  versionB: { id: string; versionNumber: number; status: string };
  changes: VersionDiffItem[];
  totalChanges: number;
}

// -----------------------------------------------------------------------------
// Conversation & Message Types (Phase 4 Foundation)
// -----------------------------------------------------------------------------

export type ConversationStatus = 'ACTIVE' | 'ARCHIVED' | 'BLOCKED';
export type MessageSenderType = 'USER' | 'CHARACTER' | 'SYSTEM';
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'PENDING' | 'STREAMING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'INTERRUPTED';
export type MessageMediaType = 'NONE' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'ATTACHMENT';
export type MessagePartType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'tool_call'
  | 'tool_result'
  | 'structured_content';

export interface MessagePartData {
  id: string;
  partType: MessagePartType;
  content: string;
  mediaUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  orderIndex: number;
}

export interface MessageGenerationMetadataData {
  id?: string;
  messageId?: string;
  characterVersionId: string;
  modelClass: string;
  provider: string;
  temperature?: number | null;
  promptSnapshot?: string | null;
  systemFingerprint?: string | null;
  finishReason?: string | null;
  latencyMs?: number | null;
  ttftMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
  createdAt?: string;
}

export interface MessageFeedbackData {
  id: string;
  messageId: string;
  userId: string;
  rating: 'THUMBS_UP' | 'THUMBS_DOWN';
  feedbackText?: string | null;
  reasonCategory?: string | null;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  userId: string;
  characterId: string;
  characterVersionId?: string | null;
  character: CharacterSummary;
  title: string;
  status: ConversationStatus;
  unreadCount: number;
  lastMessageAt?: string | null;
  lastMessageSnippet?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  characterVersion?: CharacterVersionSnapshot | null;
  totalMessages: number;
}

export interface ChatMessageItem {
  id: string;
  conversationId: string;
  senderType: MessageSenderType;
  senderId?: string | null;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  idempotencyKey?: string | null;
  clientRequestId?: string | null;
  sequenceNumber: number;
  retryCount: number;
  replyToMessageId?: string | null;
  parts: MessagePartData[];
  metadata?: MessageGenerationMetadataData | null;
  feedback?: MessageFeedbackData | null;
  characterVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Real-Time Streaming Contracts (SSE)
// -----------------------------------------------------------------------------

export type StreamEventType =
  | 'message.started'
  | 'message.delta'
  | 'message.metadata'
  | 'message.completed'
  | 'message.failed'
  | 'message.cancelled'
  | 'heartbeat';

export interface StreamMessageStartedPayload {
  messageId: string;
  conversationId: string;
  role: 'assistant';
  characterVersionId: string;
  clientRequestId?: string;
  timestamp: string;
}

export interface StreamMessageDeltaPayload {
  messageId: string;
  conversationId: string;
  delta: string;
  accumulatedLength: number;
  index: number;
}

export interface StreamMessageMetadataPayload {
  messageId: string;
  conversationId: string;
  modelUsed: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  ttftMs?: number;
  estimatedCostUsd?: number;
}

export interface StreamMessageCompletedPayload {
  messageId: string;
  conversationId: string;
  finalContent: string;
  totalTokens: number;
  status: 'SENT';
  timestamp: string;
}

export interface StreamMessageFailedPayload {
  messageId?: string;
  conversationId: string;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
}

export interface StreamMessageCancelledPayload {
  messageId: string;
  conversationId: string;
  partialContent: string;
  reason?: string;
}

export interface StreamHeartbeatPayload {
  timestamp: string;
}

export interface CursorPaginatedResult<T> {
  items: T[];
  nextCursor?: string | null;
  prevCursor?: string | null;
  hasMore: boolean;
  total?: number;
}

// -----------------------------------------------------------------------------
// Memory Types (Phase 5 Memory & Context Intelligence Engine)
// -----------------------------------------------------------------------------

export type MemoryType = 'EPISODIC' | 'SEMANTIC_FACT' | 'PREFERENCE' | 'RELATIONSHIP_MILESTONE';

export type MemoryScope = 'GLOBAL_USER' | 'CHARACTER_SPECIFIC';

export type MemoryStatus =
  | 'CANDIDATE'
  | 'ACTIVE'
  | 'SUPERSEDED'
  | 'EXPIRED'
  | 'DELETED'
  | 'REJECTED';

export type MemoryCategory =
  | 'PREFERENCE'
  | 'INTEREST'
  | 'GOAL'
  | 'HABIT'
  | 'PERSONAL_FACT'
  | 'IMPORTANT_EVENT'
  | 'RELATIONSHIP'
  | 'COMMUNICATION_PREFERENCE'
  | 'TEMPORARY_CONTEXT'
  | 'OTHER';

export type MemorySensitivity = 'NORMAL' | 'SENSITIVE' | 'HIGHLY_SENSITIVE';

export type MemorySignalType = 'EXPLICIT' | 'IMPLICIT' | 'INFERRED' | 'SYSTEM_GENERATED';

export interface MemoryItem {
  id: string;
  userId: string;
  characterId?: string | null;
  conversationId?: string | null;
  scope: MemoryScope;
  category: MemoryCategory;
  memoryType: MemoryType;
  content: string;
  normalizedContent?: string | null;
  importanceScore: number;
  confidenceScore: number;
  sensitivity: MemorySensitivity;
  signalType: MemorySignalType;
  status: MemoryStatus;
  supersededById?: string | null;
  sourceMessageId?: string | null;
  sourceConversationId?: string | null;
  recallCount: number;
  lastRecalledAt?: string | null;
  reinforcementCount: number;
  lastReinforcedAt: string;
  expiresAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryDetail extends MemoryItem {
  characterName?: string | null;
  characterSlug?: string | null;
}

export interface MemoryExtractionCandidate {
  content: string;
  normalizedContent?: string;
  category: MemoryCategory;
  scope: MemoryScope;
  importance: number;
  confidence: number;
  sensitivity: MemorySensitivity;
  signalType: MemorySignalType;
  temporaryExpiresInDays?: number | null;
  reasoning?: string;
}

export interface MemoryExtractionResult {
  candidates: MemoryExtractionCandidate[];
  filteredCount: number;
  totalExtracted: number;
}

export interface ScoredMemory {
  memory: MemoryItem;
  similarityScore: number;
  importanceScore: number;
  recencyScore: number;
  confidenceScore: number;
  reinforcementScore: number;
  finalScore: number;
  rejectionReason?: string;
}

export interface RetrievedMemory extends MemoryItem {
  similarityScore: number;
  compositeScore: number;
}

export interface MemoryRetrievalOptions {
  userId: string;
  characterId?: string | null;
  conversationId?: string | null;
  query: string;
  maxTokens?: number;
  maxMemories?: number;
  minScore?: number;
  includeGlobal?: boolean;
  allowSensitive?: boolean;
}

export interface RetrievedMemoryContext {
  memories: MemoryItem[];
  formattedPromptBlock: string;
  tokenCount: number;
  totalCandidates: number;
  retrievalLatencyMs: number;
}

export interface UserMemorySettingsData {
  id: string;
  userId: string;
  memoryEnabled: boolean;
  personalizationEnabled: boolean;
  allowSensitiveMemory: boolean;
  allowGlobalMemory: boolean;
  retentionDays: number;
  excludedCharacterIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserMemorySettingsInput {
  memoryEnabled?: boolean;
  personalizationEnabled?: boolean;
  allowSensitiveMemory?: boolean;
  allowGlobalMemory?: boolean;
  retentionDays?: number;
  excludedCharacterIds?: string[];
}

export interface ConversationSummaryData {
  id: string;
  conversationId: string;
  summary: string;
  keyFacts: string[];
  openTopics: string[];
  startSequenceNumber: number;
  endSequenceNumber: number;
  messageCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryAnalyticsMetrics {
  totalMemories: number;
  activeMemories: number;
  supersededMemories: number;
  categoryCounts: Record<string, number>;
  scopeCounts: Record<string, number>;
  averageConfidence: number;
  averageImportance: number;
  totalRetrievals: number;
  avgRetrievalLatencyMs: number;
}

export interface MemoryDebugRetrievalResult {
  query: string;
  characterId?: string | null;
  userId: string;
  totalCandidates: number;
  scoredMemories: ScoredMemory[];
  selectedMemories: MemoryItem[];
  contextPromptBlock: string;
}

// -----------------------------------------------------------------------------
// Phase 6: Relationship & Emotional State Types
// -----------------------------------------------------------------------------

export type RelationshipStage =
  | 'STRANGER'
  | 'ACQUAINTANCE'
  | 'FRIEND'
  | 'CLOSE_FRIEND'
  | 'CONFIDANT'
  | 'ROMANTIC_PARTNER';

export type RelationshipEventType =
  | 'FIRST_CONVERSATION'
  | 'CASUAL_CHAT'
  | 'SHARED_GOAL'
  | 'SHARED_PREFERENCE'
  | 'MEANINGFUL_SUPPORT'
  | 'RETURN_AFTER_BREAK'
  | 'DEEP_CONVERSATION'
  | 'BOUNDARY_SET'
  | 'CORRECTION_GIVEN'
  | 'POSITIVE_FEEDBACK'
  | 'NEGATIVE_FEEDBACK'
  | 'MILESTONE_REACHED';

export type RelationshipMilestoneType =
  | 'FIRST_CONVERSATION'
  | 'FIRST_RETURN'
  | 'SHARED_GOAL'
  | 'DEEP_CONVERSATION'
  | 'PROLONGED_CONNECTION'
  | 'LONG_CONVERSATION'
  | 'CUSTOM_MILESTONE';

export type EmotionalTone =
  | 'neutral'
  | 'calm'
  | 'warm'
  | 'playful'
  | 'serious'
  | 'curious'
  | 'concerned'
  | 'excited'
  | 'reflective'
  | 'supportive';

export type TopicSensitivity = 'low' | 'normal' | 'high';

export interface RelationshipDimensions {
  familiarity: number; // 0-100
  trust: number; // 0-100
  comfort: number; // 0-100
  affection: number; // 0-100
  engagement: number; // 0-100
}

export interface RelationshipState extends RelationshipDimensions {
  id: string;
  userId: string;
  characterId: string;
  stage: RelationshipStage;
  totalInteractions: number;
  consecutiveDaysActive: number;
  lastInteractionAt?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipEventData {
  id: string;
  relationshipId: string;
  eventType: RelationshipEventType;
  importance: number;
  confidence: number;
  deltaFamiliarity: number;
  deltaTrust: number;
  deltaComfort: number;
  deltaAffection: number;
  deltaEngagement: number;
  sourceConversationId?: string | null;
  sourceMessageId?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface RelationshipStateHistoryData {
  id: string;
  relationshipId: string;
  previousStage: RelationshipStage;
  newStage: RelationshipStage;
  previousFamiliarity: number;
  newFamiliarity: number;
  previousTrust: number;
  newTrust: number;
  previousComfort: number;
  newComfort: number;
  previousAffection: number;
  newAffection: number;
  previousEngagement: number;
  newEngagement: number;
  reason: string;
  eventId?: string | null;
  createdAt: string;
}

export interface RelationshipMilestoneData {
  id: string;
  relationshipId: string;
  milestoneType: RelationshipMilestoneType;
  title: string;
  description: string;
  achievedAt: string;
  sourceConversationId?: string | null;
}

export interface CurrentInteractionState {
  tone: EmotionalTone;
  energy: number; // 0-100
  warmth: number; // 0-100
  seriousness: number; // 0-100
  engagement: number; // 0-100
  topicSensitivity: TopicSensitivity;
  lastUpdated: string;
}

export interface RelationshipAnalysisSignal {
  type: RelationshipEventType;
  confidence: number;
  importance: number;
  description: string;
  suggestedTone: EmotionalTone;
  topicSensitivity: TopicSensitivity;
  memoryCandidate?: {
    content: string;
    category: string;
  } | null;
}

export interface RelationshipAnalysisResult {
  signals: RelationshipAnalysisSignal[];
  dominantTone: EmotionalTone;
  energy: number;
  warmth: number;
  seriousness: number;
  engagement: number;
  topicSensitivity: TopicSensitivity;
}

export interface RelationshipSimulationResult {
  characterId: string;
  characterName: string;
  initialState: RelationshipDimensions & { stage: RelationshipStage };
  analyzedSignals: RelationshipAnalysisSignal[];
  stateDeltas: RelationshipDimensions;
  resultingState: RelationshipDimensions & { stage: RelationshipStage };
  milestonesAchieved: RelationshipMilestoneType[];
  contextPromptBlock: string;
}

export interface RelationshipAnalyticsMetrics {
  totalRelationships: number;
  stageDistribution: Record<RelationshipStage, number>;
  averageFamiliarity: number;
  averageTrust: number;
  averageComfort: number;
  averageAffection: number;
  averageEngagement: number;
  activeRelationshipsLast7Days: number;
  totalMilestonesAchieved: number;
}

export interface UserRelationshipSettingsData {
  userId: string;
  personalizationEnabled: boolean;
  relationshipProgressionEnabled: boolean;
  updatedAt: string;
}

export interface RetrievedRelationshipContext {
  relationshipState: RelationshipState | null;
  currentToneState: CurrentInteractionState | null;
  semanticContextText: string;
}

// -----------------------------------------------------------------------------
// AI Types
// -----------------------------------------------------------------------------

export type AIProviderName = 'openai' | 'anthropic' | 'google' | 'local' | 'local_ollama' | 'mock';
export type AITaskType = 'chat' | 'memory_extraction' | 'summarization' | 'embedding' | 'moderation';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
}

export interface ChatCompletionChunk {
  delta: string;
  isComplete: boolean;
  thoughtDelta?: string;
  usage?: TokenUsage;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  systemInstruction?: string;
}

export interface AIMessagePayload {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// -----------------------------------------------------------------------------
// API Envelope Types
// -----------------------------------------------------------------------------

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
    requestId?: string;
    correlationId?: string;
  };
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    requestId?: string;
    correlationId?: string;
    timestamp: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

// -----------------------------------------------------------------------------
// Phase 7: Proactive AI & Notification Intelligence Types
// -----------------------------------------------------------------------------

export type ProactiveActionStatus =
  | 'CANDIDATE'
  | 'SCHEDULED'
  | 'GENERATING'
  | 'GENERATED'
  | 'VALIDATED'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'OPENED'
  | 'REPLIED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'SKIPPED';

export type ProactiveIntentType =
  | 'FOLLOW_UP_ON_TOPIC'
  | 'ASK_ABOUT_PREVIOUS_GOAL'
  | 'OFFER_RELEVANT_INFORMATION'
  | 'INVITE_LIGHT_CONVERSATION'
  | 'USER_REQUESTED_REMINDER'
  | 'CHARACTER_TOPIC_PROMPT'
  | 'REENGAGEMENT_CHECKIN';

export type ProactiveSkipReason =
  | 'QUIET_HOURS'
  | 'DAILY_LIMIT_EXCEEDED'
  | 'WEEKLY_LIMIT_EXCEEDED'
  | 'RECENT_USER_ACTIVITY'
  | 'ACTIVE_GENERATION'
  | 'COOLDOWN_ACTIVE'
  | 'DISENGAGED_COOLDOWN'
  | 'CHARACTER_DISABLED'
  | 'USER_DISABLED_PROACTIVITY'
  | 'SAFETY_CHECK_FAILED'
  | 'HIGH_REPETITION_SIMILARITY'
  | 'LOW_RELEVANCE_CONFIDENCE';

export type ProactiveDecisionType = 'SEND' | 'WAIT' | 'SKIP';

export interface ProactiveDecisionResult {
  decision: ProactiveDecisionType;
  reason: string;
  skipReason?: ProactiveSkipReason | null;
  confidence: number;
  suggestedIntent?: ProactiveIntentType | null;
  scheduledFor?: string | null;
  supportingContextIds?: string[];
}

export type PushPlatform = 'ios' | 'android' | 'web';
export type PushPermissionStatus = 'AUTHORIZED' | 'DENIED' | 'NOT_DETERMINED' | 'PROVISIONAL';
export type NotificationDeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'INVALIDATED';

export interface UserDeviceData {
  id: string;
  userId: string;
  deviceId: string;
  pushToken?: string | null;
  platform: PushPlatform;
  appVersion?: string | null;
  pushPermissionStatus: PushPermissionStatus;
  isActive: boolean;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export type LockScreenPrivacy = 'FULL_PREVIEW' | 'LIMITED_PREVIEW' | 'HIDE_CONTENT';

export type NotificationCategory =
  | 'character_message'
  | 'conversation_reply'
  | 'system'
  | 'security'
  | 'billing'
  | 'subscription'
  | 'usage_limit'
  | 'product_update'
  | 'campaign'
  | 'reminder'
  | 'recommendations'
  | 'social';

export interface UserNotificationPreferenceData {
  userId: string;
  pushEnabled: boolean;
  proactivityEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:30"
  quietHoursEnd: string; // "08:00"
  timezone: string; // IANA e.g. "America/New_York"
  maxDailyNotifications: number;
  maxWeeklyNotifications: number;
  showPreview: boolean;
  lockScreenPrivacy?: LockScreenPrivacy;
  characterMessageCategoryEnabled: boolean;
  userReminderCategoryEnabled: boolean;
  recommendationsCategoryEnabled?: boolean;
  productUpdatesCategoryEnabled?: boolean;
  systemCategoryEnabled?: boolean;
  billingCategoryEnabled?: boolean;
  securityCategoryEnabled?: boolean;
  marketingCategoryEnabled: boolean;
  mutedCharacterIds?: string[];
  characterOverrides?: Record<string, { enabled?: boolean; maxDaily?: number }>;
  updatedAt: string;
}

export interface InAppNotificationItem {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  deepLink?: string | null;
  data?: Record<string, any> | null;
  isRead: boolean;
  readAt?: string | null;
  expiresAt?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationInboxResponse {
  items: InAppNotificationItem[];
  unreadCount: number;
  page: number;
  limit: number;
  totalCount: number;
  hasMore: boolean;
}

export type CampaignAudienceType =
  | 'ALL'
  | 'NEW_USERS'
  | 'INACTIVE_USERS'
  | 'PREMIUM_USERS'
  | 'CATEGORY_AFFINITY';

export type CampaignStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'SENDING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface NotificationCampaignData {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  status: CampaignStatus;
  targetAudience: CampaignAudienceType;
  targetCriteria?: Record<string, any> | null;
  messageTitle: string;
  messageBody: string;
  deepLink?: string | null;
  scheduledFor?: string | null;
  expiresAt?: string | null;
  estimatedAudience: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  failedCount: number;
  createdByAdminId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDryRunResult {
  targetAudience: CampaignAudienceType;
  totalMatchedUsers: number;
  eligiblePushUsers: number;
  ineligibleQuietHoursCount: number;
  ineligibleOptOutCount: number;
  sampleRecipients: Array<{
    userId: string;
    displayName: string;
    timezone: string;
    hasPushToken: boolean;
  }>;
}

export interface NotificationDeliveryLogItem {
  id: string;
  userId: string;
  deviceId?: string | null;
  category: string;
  provider: string;
  providerMessageId?: string | null;
  idempotencyKey: string;
  status: string;
  failureReason?: string | null;
  sentAt: string;
  openedAt?: string | null;
  createdAt: string;
}

export interface NotificationAnalyticsOverview {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalFailed: number;
  openRatePercent: number;
  deliveryRatePercent: number;
  invalidTokensCount: number;
  activePushDevicesCount: number;
  proactiveGeneratedCount: number;
  proactiveCancelledCount: number;
  remindersTriggeredCount: number;
  campaignsDispatchedCount: number;
  globalOptOutPercent: number;
  providerHealth: {
    providerName: string;
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    latencyMs: number;
    errorRatePercent: number;
  };
}

export interface ProactiveActionData {
  id: string;
  userId: string;
  characterId: string;
  characterVersionId: string;
  conversationId?: string | null;
  intentType: ProactiveIntentType;
  reason: string;
  status: ProactiveActionStatus;
  skipReason?: ProactiveSkipReason | null;
  scheduledFor?: string | null;
  expiresAt: string;
  generatedMessageId?: string | null;
  notificationId?: string | null;
  decisionMetadata?: {
    confidence?: number;
    score?: number;
    supportingMemoryId?: string;
    candidateSignals?: string[];
  } | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  openedAt?: string | null;
  repliedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProactiveSimulationInput {
  userId?: string;
  characterId: string;
  characterVersionId?: string;
  mockLocalTime?: string; // ISO string for local time testing
  userTimezone?: string;
  simulateRecentInteractionHours?: number;
  userMessageContext?: string;
}

export interface ProactiveSimulationResult {
  characterId: string;
  characterName: string;
  characterVersionId: string;
  eligibility: {
    isEligible: boolean;
    quietHoursActive: boolean;
    dailyLimitReached: boolean;
    cooldownActive: boolean;
    reason: string;
  };
  decision: ProactiveDecisionResult;
  intentPreview: {
    type: ProactiveIntentType;
    promptSnippet: string;
    supportingMemoryCount: number;
  } | null;
  generatedMessagePreview: string | null;
  notificationPreview: {
    title: string;
    body: string;
    deepLink: string;
  } | null;
}

export interface ProactiveAnalyticsMetrics {
  totalActionsGenerated: number;
  totalActionsSent: number;
  totalActionsDelivered: number;
  totalActionsOpened: number;
  totalActionsReplied: number;
  totalActionsSkipped: number;
  skipReasonBreakdown: Record<string, number>;
  averageReplyTimeMinutes: number;
  activeProactiveCharactersCount: number;
}

export interface UserReminderData {
  id: string;
  userId: string;
  characterId: string;
  title: string;
  content: string;
  targetTime: string;
  timezone: string;
  status: 'PENDING' | 'TRIGGERED' | 'CANCELLED' | 'EXPIRED';
  proactiveActionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PushPayload {
  toToken: string;
  title: string;
  body: string;
  data: {
    type: NotificationCategory | string;
    conversationId?: string;
    characterId?: string;
    proactiveActionId?: string;
    deepLink: string;
  };
}

// -----------------------------------------------------------------------------
// Phase 8: Production AI Quality, Model Routing, Evaluation & Reliability Types
// -----------------------------------------------------------------------------

export type AIModelCapability =
  | 'chat'
  | 'streaming'
  | 'structured_output'
  | 'tool_calling'
  | 'vision'
  | 'multilingual'
  | 'long_context'
  | 'embeddings'
  | 'moderation'
  | 'reasoning';

export type AILatencyClass = 'fast' | 'balanced' | 'quality';
export type AIQualityClass = 'standard' | 'advanced' | 'flagship';

export type AIWorkloadType =
  | 'CONVERSATION'
  | 'MEMORY_EXTRACTION'
  | 'MEMORY_SUMMARIZATION'
  | 'RELATIONSHIP_ANALYSIS'
  | 'PROACTIVE_DECISION'
  | 'PROACTIVE_GENERATION'
  | 'EMBEDDING'
  | 'MODERATION'
  | 'EVALUATION';

export type AIFailureType =
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'AUTH_ERROR'
  | 'BAD_REQUEST'
  | 'CONTEXT_OVERFLOW'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'CONTENT_BLOCK'
  | 'PROVIDER_UNAVAILABLE'
  | 'timeout'
  | 'rate_limit'
  | 'authentication_error'
  | 'bad_request'
  | 'context_overflow'
  | 'server_error'
  | 'network_error'
  | 'invalid_response'
  | 'content_block'
  | 'provider_unavailable';

export interface AIModelData {
  id: string;
  provider: AIProviderName;
  modelName: string;
  displayName: string;
  capabilities: AIModelCapability[];
  contextWindow: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  latencyClass: AILatencyClass;
  qualityClass: AIQualityClass;
  isEnabled: boolean;
  isDefault: boolean;
  fallbackModelId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AIRoutingPolicyData {
  id: string;
  workload: AIWorkloadType;
  preferredModelId: string;
  fallbackModelIds: string[];
  latencySensitivity: 'LOW' | 'MEDIUM' | 'HIGH';
  maxCostPerRequest?: number | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIRouteSelectionResult {
  primaryModel: AIModelData;
  fallbackModels: AIModelData[];
  workload: AIWorkloadType;
  routingPolicyVersion?: string;
  reason?: string;
  model?: AIModelData;
  provider?: AIProviderName;
  isFallback?: boolean;
  fallbackReason?: string;
  routingPolicyId?: string;
}

export type AICircuitBreakerStatus = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface AICircuitBreakerInfo {
  provider: string;
  modelName: string;
  state: AICircuitBreakerStatus;
  failureCount: number;
  lastFailureTime?: string;
  cooldownUntil?: string;
  successRate: number;
}

export interface AIGenerateRequest {
  model?: string;
  workload?: AIWorkloadType;
  systemPrompt?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  responseFormat?: { type?: 'text' | 'json_object'; schema?: any };
  options?: GenerationOptions;
  preferredModelId?: string;
  contextBudget?: ContextBudgetBreakdown;
  metadata?: Record<string, any>;
}

export interface AIGenerateResponse {
  id: string;
  content: string;
  usage: TokenUsage;
  finishReason: string;
  model?: string;
  modelId?: string;
  provider: string;
  latencyMs: number;
  ttftMs?: number;
  timeToFirstTokenMs?: number;
  costUsd?: number;
  routingTrace?: {
    modelName: string;
    isFallback: boolean;
    attempts: number;
  };
}

export interface AIStreamEvent {
  type: 'started' | 'start' | 'delta' | 'metadata' | 'completed' | 'complete' | 'failed' | 'cancelled' | 'heartbeat';
  id?: string;
  model?: string;
  delta?: string;
  fullContent?: string;
  finishReason?: string;
  usage?: TokenUsage;
  latencyMs?: number;
  ttftMs?: number;
  error?: string;
  timestamp?: number;
  metadata?: any;
}

export type ContextBudgetCategory =
  | 'system_safety'
  | 'runtime_constraints'
  | 'user_message'
  | 'character_identity'
  | 'conversation_history'
  | 'memory'
  | 'relationship'
  | 'historical_archive'
  | 'output_reserve'
  | 'SYSTEM_SAFETY'
  | 'RUNTIME_CONSTRAINTS'
  | 'USER_MESSAGE'
  | 'CHARACTER_IDENTITY'
  | 'CURRENT_CONVERSATION'
  | 'RELEVANT_MEMORY'
  | 'RELATIONSHIP_CONTEXT'
  | 'OPTIONAL_HISTORY';

export interface ContextBudgetBreakdown {
  totalCapacity?: number;
  allocatedTokens?: number;
  remainingTokens?: number;
  categories?: Partial<Record<ContextBudgetCategory, number>>;
  maxTokens?: number;
  allocated?: Record<string, number>;
  totalAllocated?: number;
}

export interface ContextPruningResult {
  prunedSections?: any;
  originalTokenCount?: number;
  finalTokenCount?: number;
  wasPruned: boolean;
  droppedCategories?: ContextBudgetCategory[];
  prunedMessages?: AIMessagePayload[];
  prunedTokens?: number;
  originalTokens?: number;
  itemsPruned?: string[];
  safetyPreserved?: boolean;
}

export interface ContextHashData {
  hash: string;
  tokenEstimate?: number;
  tokenCount?: number;
  componentCount?: number;
  componentsHash?: string;
  createdAt?: string;
}

export type AIPromptCategory =
  | 'CONVERSATION_SYSTEM'
  | 'MEMORY_EXTRACTION'
  | 'MEMORY_DEDUPLICATION'
  | 'RELATIONSHIP_ANALYSIS'
  | 'PROACTIVE_DECISION'
  | 'PROACTIVE_GENERATION'
  | 'CONVERSATION_TITLE'
  | 'EVALUATION';

export type AIPromptVersionStatus = 'DRAFT' | 'TESTING' | 'PUBLISHED' | 'ARCHIVED';

export interface AIPromptData {
  id: string;
  name: string;
  slug: string;
  category: AIPromptCategory;
  description: string;
  activeVersionId?: string | null;
  versions?: AIPromptVersionData[];
  createdAt: string;
  updatedAt: string;
}

export interface AIPromptVersionData {
  id: string;
  promptId: string;
  versionNumber: number;
  status: AIPromptVersionStatus;
  templateContent: string;
  inputVariables: string[];
  tokenEstimate: number;
  hash: string;
  createdByAdminId?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AIPromptExperimentData {
  id: string;
  name: string;
  promptId: string;
  controlVersionId: string;
  testVersionId: string;
  trafficSplitRatio: number; // 0.5 = 50/50
  isActive: boolean;
  metrics?: any;
  createdAt: string;
  updatedAt: string;
}

export interface ResponseValidationResult {
  isValid: boolean;
  sanitizedContent?: string;
  issues?: string[];
  flags?: string[];
  violationReason?: string;
  isRepairable?: boolean;
}

export interface AIEvaluationDatasetData {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  version: number;
  testCases?: AIEvaluationTestCaseData[];
  runs?: AIEvaluationRunData[];
  createdAt: string;
  updatedAt: string;
}

export interface AIEvaluationTestCaseData {
  id: string;
  datasetId: string;
  title: string;
  category: string;
  inputPrompt: string;
  userMessage: string;
  characterId?: string | null;
  characterConfigSnapshot?: any;
  memoryContextSnapshot?: any;
  relationshipStateSnapshot?: any;
  expectedProperties: Record<string, any>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AIEvaluationRunData {
  id: string;
  datasetId: string;
  datasetVersion: number;
  characterId?: string | null;
  characterVersionId?: string | null;
  promptVersionId?: string | null;
  modelId: string;
  provider?: string;
  evaluatorVersion?: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalCases?: number;
  passedCases?: number;
  failedCases?: number;
  averageLatencyMs?: number;
  totalCostUsd?: number;
  compositeScore?: number;
  averageScore?: number;
  scoreBreakdown?: Record<string, any>;
  metrics?: any;
  regressionStatus?: string;
  baselineRunId?: string | null;
  results?: AIEvaluationResultData[];
  startedAt?: string;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AIEvaluationResultData {
  id: string;
  runId: string;
  testCaseId: string;
  generatedOutput?: string;
  actualOutput?: string;
  latencyMs?: number;
  tokensUsed?: number;
  costUsd?: number;
  score?: number;
  scores?: Record<string, number>;
  metrics?: Record<string, number>;
  passed: boolean;
  reasoning?: string | null;
  violations?: string[];
  evaluatorModel?: string;
  regressionDelta?: number | null;
  createdAt?: string;
}

export interface HumanFeedbackData {
  id: string;
  generationTraceId?: string | null;
  messageId?: string;
  conversationId?: string;
  userId: string;
  characterId?: string | null;
  score?: 1 | -1;
  rating?: 'POSITIVE' | 'NEGATIVE';
  reasonCategory?: string | null;
  comment?: string | null;
  detailedFeedback?: string | null;
  createdAt: string;
}

export interface AIAnalyticsOverview {
  totalRequests: number;
  successRate: number;
  failureRate: number;
  averageLatencyMs?: number;
  avgLatencyMs?: number;
  averageTtftMs?: number;
  avgTtftMs?: number;
  totalTokens: number;
  estimatedCostUsd?: number;
  totalCostUsd?: number;
  providerHealth: Array<{
    provider: string;
    status: string;
    consecutiveFailures?: number;
    avgLatencyMs?: number;
    averageLatencyMs?: number;
    successRate?: number;
    circuitOpen?: boolean;
    lastCheckedAt: string;
  }>;
  workloadBreakdown?: Record<string, number>;
}

export interface AIModelMetrics {
  modelId: string;
  modelName: string;
  provider: string;
  totalRequests: number;
  requestCount?: number;
  errorRate: number;
  averageLatencyMs: number;
  avgLatencyMs?: number;
  totalTokens: number;
  estimatedCostUsd: number;
  totalCostUsd?: number;
}

export interface AICostMetrics {
  dailyCostUsd?: number;
  monthlyCostUsd?: number;
  dailyCost?: number;
  weeklyCost?: number;
  monthlyCost?: number;
  byProvider?: Record<string, number>;
  byModel?: Record<string, number>;
  byWorkload?: Record<string, number>;
  byEnvironment?: Record<string, number>;
}

export interface ProductionReplayRequest {
  traceId?: string;
  generationTraceId?: string;
  overrideModelId?: string;
  overrideTemperature?: number;
}

export interface ProductionReplayResult {
  traceId?: string;
  requestId?: string;
  originalMetadata?: any;
  originalTrace?: any;
  replayOutput: string;
  replayLatencyMs?: number;
  replayedTokens?: TokenUsage;
  replayedCostUsd?: number;
  matchAssessment: {
    isReproducible: boolean;
    divergenceNotes: string;
  };
}

export interface AIPlaygroundRequest {
  characterId?: string;
  characterVersionId?: string;
  modelId: string;
  promptVersionId?: string;
  temperature?: number;
  maxTokens?: number;
  userMessage?: string;
  messages?: AIMessagePayload[];
  mockContext?: {
    memories?: string[];
    relationship?: any;
  };
  mockMemoryIds?: string[];
  mockRelationshipStage?: string;
}

export interface AIPlaygroundResult {
  outputContent?: string;
  output?: string;
  modelUsed?: string;
  providerUsed?: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  costUsd?: number;
  contextHash: string;
  validation?: ResponseValidationResult;
  budgetBreakdown?: ContextBudgetBreakdown;
  evaluatedSafety?: boolean;
}

// -----------------------------------------------------------------------------
// Phase 9: Voice Conversation & Real-Time Audio Infrastructure
// -----------------------------------------------------------------------------

export type VoiceSessionStatus =
  | 'created'
  | 'connecting'
  | 'connected'
  | 'active'
  | 'paused'
  | 'ending'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type VoiceMode = 'push_to_talk' | 'hands_free';
export type VoiceTransport = 'websocket' | 'webrtc';

export type VoiceClientState =
  | 'IDLE'
  | 'CONNECTING'
  | 'LISTENING'
  | 'USER_SPEAKING'
  | 'PROCESSING'
  | 'AI_SPEAKING'
  | 'INTERRUPTED'
  | 'RECONNECTING'
  | 'ERROR'
  | 'ENDED';

export type VoiceEventType =
  | 'voice.session.started'
  | 'voice.session.ready'
  | 'voice.audio.started'
  | 'voice.audio.chunk'
  | 'voice.audio.stopped'
  | 'voice.transcript.interim'
  | 'voice.transcript.final'
  | 'voice.generation.started'
  | 'voice.generation.delta'
  | 'voice.generation.completed'
  | 'voice.tts.started'
  | 'voice.tts.audio'
  | 'voice.tts.completed'
  | 'voice.interrupted'
  | 'voice.state.changed'
  | 'voice.error'
  | 'voice.session.ended'
  | 'voice.heartbeat'
  | 'voice.ack';

export interface VoiceRealtimeEvent<T = any> {
  id: string;
  sessionId: string;
  type: VoiceEventType;
  sequence: number;
  timestamp: string;
  payload: T;
}

export interface CharacterVoiceSettings {
  voiceEnabled: boolean;
  provider: 'elevenlabs' | 'openai' | 'playht' | 'mock';
  voiceId: string;
  language: string;
  speakingStyle?: string;
  speed: number;
  pitch: number;
  stability?: number;
  fallbackVoiceId?: string;
  fallbackProvider?: string;
  defaultVoiceMode?: VoiceMode;
}

export interface VoiceSessionSummary {
  id: string;
  userId: string;
  characterId: string;
  characterVersionId?: string | null;
  conversationId?: string | null;
  status: VoiceSessionStatus;
  voiceMode: VoiceMode;
  transport: VoiceTransport;
  language: string;
  voiceId: string;
  provider: string;
  totalDurationSeconds: number;
  userSpeakingSeconds: number;
  aiSpeakingSeconds: number;
  turnsCount: number;
  interruptionCount: number;
  totalCostUsd: number;
  startedAt: string;
  endedAt?: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceSessionDetail extends VoiceSessionSummary {
  characterName?: string;
  characterAvatarUrl?: string;
  turns?: VoiceSessionTurnData[];
}

export interface VoiceSessionTurnData {
  id: string;
  sessionId: string;
  turnIndex: number;
  userTranscript: string;
  userSpeechDurationMs: number;
  sttLatencyMs: number;
  sttConfidence: number;
  aiResponseText: string;
  llmFirstTokenMs: number;
  llmTotalMs: number;
  ttsFirstAudioMs: number;
  ttsTotalMs: number;
  totalTurnLatencyMs: number;
  interrupted: boolean;
  interruptedAtMs?: number | null;
  sttCostUsd: number;
  llmCostUsd: number;
  ttsCostUsd: number;
  totalCostUsd: number;
  createdAt: string;
}

export interface UserVoicePreferenceData {
  id: string;
  userId: string;
  voiceEnabled: boolean;
  preferredMode: VoiceMode;
  speechSpeed: number;
  preferredLanguage: string;
  subtitlesEnabled: boolean;
  autoPlayAudio: boolean;
  noiseSuppression: boolean;
  updatedAt: string;
}

export interface VoicePreviewRequest {
  characterId?: string;
  provider: string;
  voiceId: string;
  text: string;
  language?: string;
  speed?: number;
  pitch?: number;
  stability?: number;
}

export interface VoicePreviewResult {
  audioBase64?: string;
  audioUrl?: string;
  durationSeconds: number;
  format: string;
  sampleRate: number;
  latencyMs: number;
  costUsd: number;
}

export interface VoiceQualityMetrics {
  avgSttLatencyMs: number;
  avgLlmTtftMs: number;
  avgTtsLatencyMs: number;
  avgTotalTurnLatencyMs: number;
  interruptionRate: number;
  /** null: provider failures are not recorded per turn yet. */
  sttFailureRate: number | null;
  ttsFailureRate: number | null;
  activeSessionsCount: number;
  totalVoiceMinutes: number;
}

export interface VoiceCostOverview {
  totalCostUsd: number;
  sttCostUsd: number;
  llmCostUsd: number;
  ttsCostUsd: number;
  totalVoiceMinutes: number;
  costByProvider: Record<string, number>;
  costByCharacter: Array<{ characterId: string; characterName: string; costUsd: number; minutes: number }>;
}

export interface CreateVoiceSessionRequest {
  characterId: string;
  conversationId?: string;
  language?: string;
  voiceMode?: VoiceMode;
}

export interface CreateVoiceSessionResponse {
  sessionId: string;
  sessionToken: string;
  websocketUrl: string;
  voiceConfig: CharacterVoiceSettings;
  transport: VoiceTransport;
  expiresAt: string;
}

// -----------------------------------------------------------------------------
// Phase 11: Production Monetization, Subscriptions, Credits & Entitlements
// -----------------------------------------------------------------------------

export type ProductType = 'subscription' | 'one_time' | 'credit_pack' | 'add_on';
export type ProductStatus = 'active' | 'archived' | 'draft';
export type BillingProviderType = 'apple' | 'google' | 'stripe' | 'mock';
export type PriceCurrency = 'INR' | 'USD' | 'EUR' | 'GBP';
export type PlanInterval = 'month' | 'year' | 'one_time';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'grace_period'
  | 'paused'
  | 'cancelled'
  | 'expired'
  | 'incomplete'
  | 'payment_failed';

export type EntitlementSource =
  | 'subscription'
  | 'promotion'
  | 'one_time'
  | 'admin_grant'
  | 'trial'
  | 'system_free';

export type MeterUnit =
  | 'ai_text_tokens'
  | 'voice_seconds'
  | 'image_generations'
  | 'premium_messages'
  | 'proactive_messages';

export type UsageReservationStatus = 'RESERVED' | 'CONSUMED' | 'RELEASED' | 'EXPIRED';

export type CreditTransactionType =
  | 'purchase'
  | 'grant'
  | 'consumption'
  | 'refund'
  | 'expiration'
  | 'adjustment'
  | 'reversal';

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REFUNDED'
  | 'DISPUTED';

export type WebhookProcessingStatus =
  | 'received'
  | 'verified'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'ignored';

export type PromoDiscountType =
  | 'percentage'
  | 'fixed_amount'
  | 'free_credits'
  | 'trial_extension';

export type ReconciliationStatus = 'MATCH' | 'MISMATCH' | 'RESOLVED';

export interface BillingProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: ProductType;
  status: ProductStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BillingPrice {
  id: string;
  productId: string;
  planId?: string | null;
  currency: PriceCurrency;
  amountMinorUnits: number; // e.g. 999 for $9.99, 29900 for ₹299
  billingInterval?: PlanInterval | null;
  billingIntervalCount: number;
  provider: BillingProviderType;
  providerPriceId: string;
  country?: string | null;
  active: boolean;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PlanEntitlementConfig {
  entitlementKey: string;
  metadata?: Record<string, unknown>;
}

export interface PlanUsageLimitConfig {
  meterUnit: MeterUnit | string;
  limitAmount: number;
  period: 'month' | 'year' | 'day' | 'lifetime';
}

export interface BillingPlan {
  id: string;
  productId: string;
  code: string; // 'FREE', 'PLUS', 'PRO', 'ULTRA'
  name: string;
  tagline: string;
  description: string;
  isActive: boolean;
  isPopular: boolean;
  trialDays: number;
  entitlements: string[];
  usageLimits: PlanUsageLimitConfig[];
  prices: BillingPrice[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BillingPlanSummary {
  id: string;
  code: string;
  name: string;
  tagline: string;
  description: string;
  trialDays: number;
  isPopular: boolean;
  prices: Array<{
    id: string;
    currency: PriceCurrency;
    amountMinorUnits: number;
    billingInterval: PlanInterval;
    formattedPrice: string;
  }>;
  entitlements: string[];
  limits: Record<string, number>;
}

export interface BillingSubscription {
  id: string;
  userId: string;
  planId: string;
  planCode: string;
  planName: string;
  status: SubscriptionStatus;
  provider: BillingProviderType;
  providerSubscriptionId?: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart?: string | null;
  trialEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string | null;
  endedAt?: string | null;
  gracePeriodEnd?: string | null;
  priceAmountMinorUnits: number;
  currency: PriceCurrency;
  billingInterval: PlanInterval;
  createdAt: string;
  updatedAt: string;
}

export interface UserEntitlement {
  id: string;
  userId: string;
  entitlementKey: string;
  source: EntitlementSource;
  sourceId?: string | null;
  grantedAt: string;
  expiresAt?: string | null;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface EffectiveEntitlementsResponse {
  userId: string;
  planCode: string;
  subscriptionStatus: SubscriptionStatus;
  entitlements: Record<string, boolean>;
  activeEntitlementsList: string[];
  expiresAt?: string | null;
  syncedAt: string;
}

export interface UsageMeterItem {
  id: string;
  userId: string;
  meterUnit: MeterUnit | string;
  periodStart: string;
  periodEnd: string;
  limitAmount: number;
  consumedAmount: number;
  reservedAmount: number;
  remainingAmount: number;
  unitFormatted: string;
}

export interface UsageReservationResult {
  reservationId: string;
  userId: string;
  meterUnit: string;
  reservedAmount: number;
  status: UsageReservationStatus;
  expiresAt: string;
}

export interface CreditWalletSummary {
  userId: string;
  availableBalance: number;
  purchasedCredits: number;
  promotionalCredits: number;
  expiringCredits?: {
    amount: number;
    expiresAt: string;
  } | null;
  updatedAt: string;
}

export interface CreditTransactionItem {
  id: string;
  userId: string;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  idempotencyKey: string;
  referenceType?: string | null;
  referenceId?: string | null;
  description: string;
  expiresAt?: string | null;
  createdAt: string;
}

export interface PurchaseVerificationRequest {
  provider: BillingProviderType;
  receiptData: string;
  productId: string;
  transactionId: string;
  planCode?: string;
  idempotencyKey?: string;
  currency?: PriceCurrency;
  priceAmountMinorUnits?: number;
}

export interface PurchaseVerificationResponse {
  success: boolean;
  status: 'VERIFIED' | 'ALREADY_PROCESSED' | 'PENDING' | 'REJECTED';
  subscription?: BillingSubscription | null;
  entitlements: string[];
  creditsGranted?: number;
  message?: string;
}

export interface RestorePurchasesResponse {
  success: boolean;
  restoredCount: number;
  activeSubscription?: BillingSubscription | null;
  entitlements: string[];
  syncedAt: string;
}

export interface PaywallBenefitItem {
  icon: string;
  title: string;
  description: string;
  highlighted?: boolean;
}

export interface PaywallPlanCard {
  planId: string;
  code: string;
  name: string;
  tagline: string;
  badge?: string | null;
  isPopular: boolean;
  monthlyPrice?: {
    id: string;
    amountMinorUnits: number;
    currency: PriceCurrency;
    formatted: string;
  } | null;
  yearlyPrice?: {
    id: string;
    amountMinorUnits: number;
    currency: PriceCurrency;
    formatted: string;
    savingsText?: string;
    monthlyEquivalentFormatted?: string;
  } | null;
  trialDays: number;
  features: string[];
}

export interface PaywallConfig {
  headline: string;
  subtitle: string;
  badge?: string;
  featuredPlanCode: string;
  benefits: PaywallBenefitItem[];
  plans: PaywallPlanCard[];
  termsUrl: string;
  privacyUrl: string;
  experimentVariant?: string;
}

export interface BillingWebhookEventSummary {
  id: string;
  provider: BillingProviderType;
  providerEventId: string;
  eventType: string;
  status: WebhookProcessingStatus;
  retryCount: number;
  failureReason?: string | null;
  receivedAt: string;
  processedAt?: string | null;
}

export interface BillingPromotion {
  id: string;
  code: string;
  name: string;
  description: string;
  discountType: PromoDiscountType;
  discountValue: number; // percentage (e.g. 50) or fixed minor units / credits
  planId?: string | null;
  maxRedemptions?: number | null;
  currentRedemptions: number;
  perUserLimit: number;
  validFrom: string;
  validUntil?: string | null;
  isActive: boolean;
  targetAudience?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingAuditLog {
  id: string;
  adminUserId?: string | null;
  actorType: 'ADMIN' | 'SYSTEM' | 'USER';
  action: string;
  targetType: string;
  targetId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  reason?: string | null;
  requestId?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface BillingReconciliationRecord {
  id: string;
  userId: string;
  subscriptionId?: string | null;
  provider: BillingProviderType;
  providerState: Record<string, unknown>;
  internalState: Record<string, unknown>;
  status: ReconciliationStatus;
  mismatchReason?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillingRevenueMetrics {
  totalGrossRevenueMinorUnits: number;
  totalRefundsMinorUnits: number;
  netRevenueMinorUnits: number;
  currency: PriceCurrency;
  activeSubscribersCount: number;
  newSubscribersCount: number;
  trialConversionsCount: number;
  churnRatePercent: number;
  subscribersByPlan: Record<string, number>;
  revenueByPlan: Record<string, number>;
  period: string;
}

export interface AIEconomicsMetrics {
  totalAICostUsd: number;
  totalVoiceCostUsd: number;
  totalImageCostUsd: number;
  totalCombinedCostUsd: number;
  costByPlan: Record<string, number>;
  avgCostPerActiveUserUsd: number;
  avgCostPerConversationUsd: number;
  estimatedContributionMarginPercent: number;
  highCostUsers: Array<{
    userId: string;
    email: string;
    planCode: string;
    totalCostUsd: number;
    tokensUsed: number;
    voiceSeconds: number;
  }>;
}

export interface AdminBillingOverview {
  revenue: BillingRevenueMetrics;
  aiEconomics: AIEconomicsMetrics;
  recentTransactions: Array<{
    id: string;
    userId: string;
    userEmail: string;
    amountFormatted: string;
    status: PaymentStatus;
    provider: BillingProviderType;
    createdAt: string;
  }>;
  recentWebhooks: BillingWebhookEventSummary[];
  mismatchCount: number;
}

// Convenience Type Aliases
export type UsageMeter = UsageMeterItem;
export type CreditWallet = CreditWalletSummary;
export type CreditTransaction = CreditTransactionItem;
export type PurchaseTransaction = PurchaseVerificationResponse;

// -----------------------------------------------------------------------------
// Phase 12: Discovery, Character Catalog, Search & Recommendations Types
// -----------------------------------------------------------------------------

export type HomeSectionLayoutType = 'HERO' | 'CAROUSEL' | 'GRID' | 'BANNER' | 'CHIPS';
export type DiscoveryEventTypeType = 'IMPRESSION' | 'CLICK' | 'DETAIL_VIEW' | 'CHAT_START' | 'FAVORITE' | 'DISMISS';

export interface CharacterCategorySummary {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  description: string;
  iconUrl?: string | null;
  coverImageUrl?: string | null;
  displayOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  characterCount?: number;
  tags?: CharacterTagSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface CharacterTagSummary {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  description: string;
  categoryId?: string | null;
  isCurated: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CuratedCollectionSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  heroImageUrl?: string | null;
  badgeText?: string | null;
  displayOrder: number;
  isPublished: boolean;
  publishStartAt?: string | null;
  publishEndAt?: string | null;
  itemCount: number;
  items?: CollectionCharacterItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CollectionCharacterItem {
  id: string;
  collectionId: string;
  characterId: string;
  character: CharacterCatalogItem;
  displayOrder: number;
  customBadge?: string | null;
  highlightNote?: string | null;
}

export interface CharacterDiscoveryMetadata {
  isDiscoverable: boolean;
  isSearchable: boolean;
  isTrendingEnabled: boolean;
  isRecommendationEnabled: boolean;
  editorialPriority: number;
  editorialBoost: number;
  newUntil?: string | null;
  conversationStarters: string[];
  highlightBadges: string[];
  ageGate: number;
  localizedProfiles?: Record<string, { name?: string; tagline?: string; shortDescription?: string }>;
}

export interface CharacterCatalogItem {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  shortDescription: string;
  avatarUrl: string;
  coverImageUrl: string;
  category: string;
  categoryDisplayName?: string;
  archetype: string;
  age: number;
  gender: string;
  occupation: string;
  status: CharacterStatus;
  visibility: CharacterVisibility;
  isFeatured: boolean;
  isFavorite?: boolean;
  accessType: 'free' | 'entitlement' | 'credit' | 'subscription' | 'campaign';
  requiredEntitlement?: string | null;
  currentVersionNumber: number;
  tags: Array<{ id: string; slug: string; name: string; displayName: string }>;
  conversationStarters?: string[];
  highlightBadges?: string[];
  voiceAvailable?: boolean;
  recommendationReason?: string | null;
  recommendationReasonCode?: string | null;
  updatedAt: string;
}

export interface ContinueConversationItem {
  conversationId: string;
  characterId: string;
  characterSlug: string;
  characterName: string;
  characterAvatarUrl: string;
  category: string;
  relationshipStage?: string;
  relationshipLevel?: number;
  lastMessageSnippet: string;
  lastInteractedAt: string;
  unreadCount: number;
  hasProactiveMessage: boolean;
}

export interface HomeFeedSection {
  id: string;
  sectionKey: 'CONTINUE' | 'RECOMMENDED' | 'FEATURED' | 'NEW' | 'TRENDING' | 'COLLECTIONS' | 'CATEGORIES' | string;
  title: string;
  subtitle: string;
  layoutStyle: HomeSectionLayoutType;
  items: Array<CharacterCatalogItem | CuratedCollectionSummary | CharacterCategorySummary | ContinueConversationItem | any>;
  hasMore?: boolean;
  nextCursor?: string | null;
  metadata?: Record<string, unknown>;
}

export interface HomeFeedResponse {
  greeting: {
    title: string;
    subtitle: string;
    userDisplayName?: string;
    isReturningUser: boolean;
  };
  sections: HomeFeedSection[];
  experimentVersion?: string;
  recommendationVersion?: string;
}

export interface SearchCharacterQueryParams {
  q?: string;
  category?: string;
  tags?: string[];
  language?: string;
  accessType?: 'free' | 'premium' | 'all';
  cursor?: string;
  limit?: number;
  sort?: 'recommended' | 'popular' | 'new' | 'trending' | 'personalized' | 'relevance';
}


export interface SearchCharacterResult {
  items: CharacterCatalogItem[];
  nextCursor?: string | null;
  hasMore: boolean;
  totalEstimated: number;
  suggestedCategories?: CharacterCategorySummary[];
  suggestedQueries?: string[];
}

export interface PublicCharacterDetailedProfile {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  shortDescription: string;
  longDescription: string;
  avatarUrl: string;
  coverImageUrl: string;
  category: string;
  categoryDisplayName: string;
  archetype: string;
  age: number;
  gender: string;
  occupation: string;
  isFeatured: boolean;
  isFavorite: boolean;
  accessType: 'free' | 'entitlement' | 'credit' | 'subscription' | 'campaign';
  requiredEntitlement?: string | null;
  isLockedForUser: boolean;
  tags: Array<{ id: string; slug: string; name: string; displayName: string }>;
  traits: {
    warmth: number;
    playfulness: number;
    curiosity: number;
    sarcasm?: number;
    empathy?: number;
    humorStyle: string;
    quirks: string[];
  };
  communication: {
    pacing: string;
    formality: string;
    primaryLanguage: string;
  };
  conversationStarters: string[];
  highlightBadges: string[];
  voiceAvailable: boolean;
  voiceSampleUrl?: string | null;
  existingConversationId?: string | null;
  similarCharacters: CharacterCatalogItem[];
  sourceType?: 'OFFICIAL' | 'CREATOR' | 'COMMUNITY';
  creator?: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    isVerified?: boolean;
  } | null;
  createdAt: string;
}

export interface UserDiscoveryPreferencesData {
  userId: string;
  preferredLanguages: string[];
  preferredCategoryIds: string[];
  preferredTagIds: string[];
  preferredStyles: string[];
  personalizationEnabled: boolean;
  allowNsfw: boolean;
  updatedAt: string;
}

export interface DiscoveryAnalyticsOverview {
  totalImpressions: number;
  totalClicks: number;
  totalChatStarts: number;
  totalFavorites: number;
  overallCtrPercent: number;
  startConversionPercent: number;
  topSearchQueries: Array<{ query: string; count: number; resultCount: number }>;
  zeroResultQueries: Array<{ query: string; count: number }>;
  topTrendingCharacters: Array<{ characterId: string; name: string; startsCount: number; score: number }>;
}

// -----------------------------------------------------------------------------
// Phase 18: Production Search, Semantic Discovery, Ranking & Intelligence Types
// -----------------------------------------------------------------------------

export interface SearchSynonymItem {
  id: string;
  term: string;
  synonyms: string[];
  language: string;
  category?: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SearchSynonymCreateInput {
  term: string;
  synonyms: string[];
  language?: string;
  category?: string | null;
  priority?: number;
  isActive?: boolean;
}

export interface SearchSynonymUpdateInput {
  term?: string;
  synonyms?: string[];
  language?: string;
  category?: string | null;
  priority?: number;
  isActive?: boolean;
}

export interface CharacterDiscoveryDocument {
  id: string;
  characterId: string;
  name: string;
  slug: string;
  tagline: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  tags: string[];
  language: string;
  supportedLanguages: string[];
  personalityDescriptors: string[];
  communicationStyles: string[];
  creatorId?: string | null;
  creatorUsername?: string | null;
  searchText: string;
  embedding?: number[] | null;
  embeddingModel?: string | null;
  embeddingVersion?: string | null;
  indexVersion: number;
  popularityScore: number;
  qualityScore: number;
  trendingScore: number;
  publishedAt?: string | null;
  indexedAt: string;
  updatedAt: string;
}

export interface CharacterSimilarityItem {
  id: string;
  characterId: string;
  similarCharacterId: string;
  similarCharacter?: CharacterCatalogItem;
  similarityScore: number;
  matchReason?: string | null;
  createdAt: string;
}

export interface RankingWeights {
  semanticRelevance: number;
  categoryMatch: number;
  tagMatch: number;
  popularity: number;
  trendingVelocity: number;
  quality: number;
  userPreference: number;
  languageMatch: number;
  freshness: number;
  novelty: number;
  fatiguePenalty: number;
  negativeSignalPenalty: number;
  repetitionPenalty: number;
}

export interface DiversityRules {
  maxPerCreator: number;
  maxPerCategory: number;
  mmrLambda: number; // 0.0 to 1.0 (1 = pure relevance, 0 = pure diversity)
  explorationRatio: number; // 0.0 to 0.3 for new character exploration
}

export interface RankingConfigItem {
  id: string;
  version: string;
  name: string;
  description: string;
  status: 'DRAFT' | 'TESTING' | 'PUBLISHED' | 'ARCHIVED';
  weights: RankingWeights;
  diversityRules: DiversityRules;
  isDefault: boolean;
  isShadow: boolean;
  createdByAdminId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RankingConfigCreateInput {
  version: string;
  name: string;
  description?: string;
  weights?: Partial<RankingWeights>;
  diversityRules?: Partial<DiversityRules>;
  isDefault?: boolean;
  isShadow?: boolean;
}

export interface RankingConfigUpdateInput {
  name?: string;
  description?: string;
  status?: 'DRAFT' | 'TESTING' | 'PUBLISHED' | 'ARCHIVED';
  weights?: Partial<RankingWeights>;
  diversityRules?: Partial<DiversityRules>;
  isDefault?: boolean;
  isShadow?: boolean;
}

export interface UserSearchHistoryItem {
  id: string;
  userId: string;
  query: string;
  normalizedQuery: string;
  categoryFilter?: string | null;
  lastSearchedAt: string;
  createdAt: string;
}

export type UserNegativeSignalType = 'HIDE_CHARACTER' | 'HIDE_CREATOR' | 'NOT_INTERESTED';

export interface UserNegativeSignalItem {
  id: string;
  userId: string;
  signalType: UserNegativeSignalType;
  characterId?: string | null;
  creatorProfileId?: string | null;
  reason?: string | null;
  createdAt: string;
}

export interface UserNegativeSignalCreateInput {
  signalType: UserNegativeSignalType;
  characterId?: string;
  creatorProfileId?: string;
  reason?: string;
}

export type CandidateSourceType =
  | 'POPULAR'
  | 'TRENDING'
  | 'NEW'
  | 'SIMILAR'
  | 'HISTORY'
  | 'PREFERENCE'
  | 'COLLABORATIVE'
  | 'EDITORIAL'
  | 'CREATOR'
  | 'SEMANTIC';

export interface CandidateCharacterItem {
  characterId: string;
  candidateSources: CandidateSourceType[];
  initialScore: number;
  document?: CharacterDiscoveryDocument;
  catalogItem?: CharacterCatalogItem;
}

export interface SearchQueryAnalysisResult {
  originalQuery: string;
  normalizedQuery: string;
  tokens: string[];
  intent: 'CHARACTER_NAME' | 'PERSONALITY' | 'TOPIC_ACTIVITY' | 'ROLE_RELATIONSHIP' | 'GENERAL' | 'MULTILINGUAL' | 'ROLE' | 'RELATIONSHIP';
  primaryIntent?: string;
  extractedCategories: string[];
  extractedTags: string[];
  extractedPersonality: string[];
  extractedLanguage?: string;
  language?: string;
  synonymExpansions?: string[];
  isSemanticSearchPreferred: boolean;
  spellCorrection?: string | null;
}


export interface SearchSuggestionItem {
  type: 'CHARACTER' | 'CATEGORY' | 'TAG' | 'QUERY' | 'RECENT';
  id?: string;
  text: string;
  subtext?: string;
  category?: string;
  avatarUrl?: string;
}

export interface IndexHealthSummary {
  totalPublishedCharacters: number;
  totalIndexedDocuments: number;
  missingFromIndex: number;
  staleDocuments: number;
  indexVersion: number;
  embeddingModel: string;
  embeddingVersion: string;
  lastReindexedAt?: string | null;
}

export interface SearchQualityMetrics {
  totalSearches: number;
  zeroResultSearches: number;
  zeroResultRatePercent: number;
  searchToClickRatePercent: number;
  searchToStartRatePercent: number;
  averageSearchLatencyMs: number;
  topZeroResultQueries: Array<{ query: string; count: number; lastSearchedAt: string }>;
  topHighConversionQueries: Array<{ query: string; searches: number; starts: number; conversionPercent: number }>;
}

export interface RankingSimulationInput {
  rankingVersion?: string;
  userId?: string;
  preferredCategories?: string[];
  preferredLanguages?: string[];
  candidateLimit?: number;
}

export interface RankingSimulationItem {
  rank: number;
  characterId: string;
  name: string;
  category: string;
  creatorUsername?: string;
  score: number;
  featureScores: Record<string, number>;
  candidateSources: CandidateSourceType[];
  isExploration: boolean;
  explanationReason?: string;
}

export interface RankingSimulationResult {
  rankingVersion: string;
  userContext: {
    userId?: string;
    preferredCategories: string[];
    preferredLanguages: string[];
    isReturningUser: boolean;
  };
  totalCandidates: number;
  eligibleCandidates: number;
  diversifiedCount: number;
  results: RankingSimulationItem[];
  rankedItems?: RankingSimulationItem[];
  appliedDiversityCapStats: {
    creatorsCapped: number;
    categoriesCapped: number;
  };
}

// -----------------------------------------------------------------------------
// Phase 13: Onboarding, First Session, Profile, Preferences & Activation Types
// -----------------------------------------------------------------------------

export type OnboardingStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'NEEDS_RECOVERY';

export type ConversationStyle =
  | 'CASUAL'
  | 'FUNNY'
  | 'DEEP'
  | 'SUPPORTIVE'
  | 'DIRECT'
  | 'PLAYFUL';

export type OnboardingStepKey =
  | 'WELCOME'
  | 'LANGUAGE'
  | 'INTERESTS'
  | 'STYLE'
  | 'CHARACTER_SELECTION'
  | 'COMPLETED';

export interface OnboardingProgress {
  status: OnboardingStatus;
  version: number;
  currentStep: OnboardingStepKey;
  completedSteps: string[];
  startedAt?: string | null;
  completedAt?: string | null;
  conversationStyle?: ConversationStyle;
}

export interface OnboardingStepConfigItem {
  id: string;
  stepKey: OnboardingStepKey;
  title: string;
  subtitle: string;
  isRequired: boolean;
  displayOrder: number;
  version: number;
  configData: {
    options?: Array<{ key: string; label: string; description?: string; icon?: string }>;
    starterCharacterIds?: string[];
    fallbackOpeningPrompt?: string;
  };
  isEnabled: boolean;
}

export interface OnboardingStarterCharacterItem {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  shortDescription: string;
  avatarUrl: string;
  coverImageUrl: string;
  category: string;
  categoryDisplayName: string;
  conversationStyleTag: string;
  personalityHook: string;
  starterPromptPill?: string;
  isLocked?: boolean;
}

export interface UserPreferenceProfile {
  displayName: string;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  locale: string;
  timezone: string;
  preferredLanguage: string;
  conversationStyle: ConversationStyle;
  preferredCategoryIds: string[];
  preferredTagIds: string[];
  personalizationEnabled: boolean;
  isNsfwAllowed: boolean;
  audioAutoPlay: boolean;
}

export interface BootstrapResponseData {
  user: {
    id: string;
    email: string;
    status: string;
    emailVerified: boolean;
  };
  profile: {
    id: string;
    displayName: string;
    username?: string | null;
    avatarUrl?: string | null;
    locale: string;
    timezone: string;
    preferredLanguage: string;
    conversationStyle: ConversationStyle;
  };
  onboarding: OnboardingProgress;
  preferences: {
    preferredLanguage: string;
    conversationStyle: ConversationStyle;
    preferredCategoryIds: string[];
    personalizationEnabled: boolean;
  };
  entitlements: string[];
  featureFlags: Record<string, boolean>;
  starterCompanions: OnboardingStarterCharacterItem[];
}

export interface ActivationFunnelOverview {
  totalVisitors: number;
  totalSignups: number;
  totalOnboardingStarted: number;
  totalOnboardingCompleted: number;
  totalCharacterSelected: number;
  totalConversationsStarted: number;
  totalFirstMessageSent: number;
  totalFirstResponseReceived: number;
  totalActivatedUsers: number;
  totalReturnedUsers: number;
  onboardingCompletionRatePercent: number;
  firstMessageRatePercent: number;
  activationConversionPercent: number;
  d1RetentionPercent: number;
  d7RetentionPercent: number;
}

export interface OnboardingDropoffMetrics {
  stepKey: string;
  stepTitle: string;
  enteredCount: number;
  completedCount: number;
  skippedCount: number;
  dropoffCount: number;
  dropoffRatePercent: number;
}

export interface CharacterActivationRankItem {
  characterId: string;
  name: string;
  avatarUrl: string;
  category: string;
  selectionCount: number;
  firstMessageCount: number;
  firstResponseCount: number;
  activatedUserCount: number;
  activationRatePercent: number;
  d1ReturnRatePercent: number;
}

export interface RetentionCohortMetrics {
  cohortDate: string;
  cohortSize: number;
  d1ReturnCount: number;
  d1RatePercent: number;
  d3ReturnCount: number;
  d3RatePercent: number;
  d7ReturnCount: number;
  d7RatePercent: number;
  d14ReturnCount: number;
  d14RatePercent: number;
  d30ReturnCount: number;
  d30RatePercent: number;
}
// -----------------------------------------------------------------------------
// PHASE 15: CREATOR PLATFORM, MODERATION & CREATOR MONETIZATION TYPES
// -----------------------------------------------------------------------------

export type CreatorStatus = 'PENDING' | 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'BANNED' | 'CLOSED';
export type CreatorVerificationStatus = 'UNVERIFIED' | 'VERIFIED' | 'PARTNER';
export type CharacterSourceType = 'OFFICIAL' | 'CREATOR' | 'PARTNER';
export type CharacterModerationStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'IN_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED';
export type ModerationDecisionType = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'SUSPEND' | 'UNPUBLISH';
export type ReportReasonCode =
  | 'UNSAFE'
  | 'HARASSMENT'
  | 'IMPERSONATION'
  | 'COPYRIGHT'
  | 'SEXUAL_CONTENT'
  | 'MISLEADING'
  | 'SPAM'
  | 'OTHER';
export type RejectionReasonCode =
  | 'PROHIBITED_CONTENT'
  | 'IMPERSONATION'
  | 'COPYRIGHT_CONCERN'
  | 'SAFETY_CONFIGURATION'
  | 'MISLEADING_DESCRIPTION'
  | 'SEXUAL_CONTENT_POLICY'
  | 'MINOR_SAFETY'
  | 'HARASSMENT'
  | 'SPAM'
  | 'OTHER';

export interface CreatorProfileData {
  id: string;
  userId: string;
  displayName: string;
  username: string;
  bio: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  website?: string | null;
  socialLinks?: Record<string, string> | null;
  status: CreatorStatus;
  verificationStatus: CreatorVerificationStatus;
  acceptedGuidelinesVersion: number;
  guidelinesAcceptedAt: string;
  totalCharactersCount: number;
  publishedCharactersCount: number;
  totalFollowersCount: number;
  totalConversationsCount: number;
  totalMessagesCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatorPublicProfile {
  id: string;
  displayName: string;
  username: string;
  bio: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  website?: string | null;
  socialLinks?: Record<string, string> | null;
  verificationStatus: CreatorVerificationStatus;
  totalCharactersCount: number;
  publishedCharactersCount: number;
  totalFollowersCount: number;
  isFollowing?: boolean;
  publishedCharacters: Array<{
    id: string;
    slug: string;
    name: string;
    tagline: string;
    avatarUrl: string;
    category: string;
    isFeatured: boolean;
  }>;
  createdAt: string;
}

export interface CreatorCharacterSummary {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  avatarUrl: string;
  coverImageUrl: string;
  category: string;
  status: CharacterStatus;
  moderationStatus: CharacterModerationStatus;
  visibility: CharacterVisibility;
  rejectionReason?: RejectionReasonCode | null;
  changeRequestDetails?: string | null;
  currentVersionNumber: number;
  isPublished: boolean;
  activeConversationsCount: number;
  totalMessagesCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface CreatorCharacterBuilderState {
  characterId: string;
  slug: string;
  name: string;
  tagline: string;
  shortDescription: string;
  longDescription: string;
  avatarUrl: string;
  coverImageUrl: string;
  category: string;
  archetype: string;
  age: number;
  gender: string;
  occupation: string;
  status: CharacterStatus;
  moderationStatus: CharacterModerationStatus;
  visibility: CharacterVisibility;
  rejectionReason?: string | null;
  changeRequestDetails?: string | null;
  versionNumber: number;
  identityData: CharacterIdentityData;
  personalityData: PersonalityConfigData;
  communicationData: CommunicationStyleConfigData;
  languageData: LanguageBehaviorConfigData;
  behaviorRulesData: BehaviorRuleItemData[];
  knowledgeData: CharacterKnowledgeItemData[];
  relationshipConfigData: RelationshipBehaviorConfigData;
  memoryConfigData: MemoryBehaviorConfigData;
  proactivityConfigData: ProactivityBehaviorConfigData;
  safetyConfigData: CharacterSafetyConfigData;
  aiConfigData: CharacterAIConfigData;
  voiceConfigData?: CharacterVoiceConfigData | null;
  updatedAt: string;
}

export interface CreatorCharacterSubmitResult {
  success: boolean;
  characterId: string;
  moderationCaseId: string;
  moderationStatus: CharacterModerationStatus;
  validationIssues: ValidationIssue[];
  autoApproved: boolean;
  message: string;
}

export interface CharacterModerationQueueItem {
  id: string;
  characterId: string;
  character: {
    id: string;
    slug: string;
    name: string;
    tagline: string;
    avatarUrl: string;
    category: string;
    sourceType: CharacterSourceType;
  };
  characterVersionId?: string | null;
  creatorProfile?: {
    id: string;
    displayName: string;
    username: string;
    verificationStatus: CreatorVerificationStatus;
  } | null;
  source: string;
  status: CharacterModerationStatus;
  riskScore: number;
  automatedFlags?: Record<string, any> | null;
  decision?: ModerationDecisionType | null;
  rejectionReason?: RejectionReasonCode | null;
  changeRequestDetails?: string | null;
  moderatorNotes?: string | null;
  reportsCount: number;
  createdAt: string;
}

export interface CharacterReportItem {
  id: string;
  characterId: string;
  characterName: string;
  reporterUserId: string;
  reasonCode: ReportReasonCode;
  details: string;
  status: string;
  createdAt: string;
}

export interface ModerationAppealItem {
  id: string;
  moderationCaseId: string;
  characterId: string;
  characterName: string;
  creatorUsername: string;
  appealReason: string;
  status: string;
  reviewedByAdminId?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export interface CreatorAnalyticsOverview {
  totalViews: number;
  totalConversationStarts: number;
  totalActiveConversations: number;
  totalMessagesExchanged: number;
  totalFavorites: number;
  /** null: session duration is not instrumented yet. */
  averageSessionDurationMinutes: number | null;
  returnRatePercent: number;
  voiceUsageMinutes: number;
  totalReports: number;
  characterBreakdown: Array<{
    characterId: string;
    name: string;
    avatarUrl: string;
    views: number;
    starts: number;
    messages: number;
    favorites: number;
    returnRatePercent: number;
  }>;
}

export interface SandboxedPlaygroundMessage {
  id: string;
  sender: 'USER' | 'CHARACTER' | 'SYSTEM';
  text: string;
  timestamp: string;
  debugTrace?: {
    model: string;
    tokensUsed: number;
    latencyMs: number;
    appliedRulesCount: number;
  };
}

export interface SandboxedPlaygroundSession {
  sessionId: string;
  characterId: string;
  messages: SandboxedPlaygroundMessage[];
}

export interface CreatorProductData {
  id: string;
  creatorProfileId: string;
  characterId: string;
  productType: string;
  name: string;
  description?: string | null;
  priceAmount: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreatorEarningsLedgerItem {
  id: string;
  creatorProfileId: string;
  characterId?: string | null;
  eventType: string;
  grossAmount: number;
  platformFee: number;
  creatorNetAmount: number;
  currency: string;
  referenceId?: string | null;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// PHASE 16: SAFETY, TRUST, PRIVACY, ENFORCEMENT & GOVERNANCE TYPES
// -----------------------------------------------------------------------------

export type SafetySurface =
  | 'INPUT'
  | 'OUTPUT'
  | 'CREATOR_CONTENT'
  | 'KNOWLEDGE'
  | 'MEDIA'
  | 'VOICE'
  | 'PROACTIVE'
  | 'STREAM';

export type SafetyDecision =
  | 'ALLOW'
  | 'ALLOW_WITH_TRANSFORM'
  | 'BLOCK'
  | 'REVIEW'
  | 'ESCALATE';

export type SafetyRiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AccountRestrictionType =
  | 'CANNOT_CREATE_CHARACTER'
  | 'CANNOT_PUBLISH'
  | 'CANNOT_UPLOAD_MEDIA'
  | 'CANNOT_USE_VOICE'
  | 'CANNOT_SEND_MESSAGES'
  | 'CANNOT_PURCHASE'
  | 'SOCIAL_RESTRICTED'
  | 'CANNOT_COMMENT'
  | 'CANNOT_DIRECT_MESSAGE'
  | 'CANNOT_SHARE_CONTENT'
  | 'CANNOT_CREATE_COMMUNITIES'
  | 'ACCOUNT_RESTRICTED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_BANNED';

export type DataExportStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED';

export type AccountDeletionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED';

export type IncidentSeverity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';

export type IncidentCategory =
  | 'SAFETY'
  | 'PRIVACY'
  | 'SECURITY'
  | 'BILLING'
  | 'AVAILABILITY';

export type IncidentStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'MITIGATED'
  | 'RESOLVED'
  | 'CLOSED';

export type KillSwitchType =
  | 'DISABLE_CHARACTER_PUBLISHING'
  | 'DISABLE_IMAGE_GENERATION'
  | 'DISABLE_VOICE_CALLS'
  | 'DISABLE_PROACTIVE_NOTIFICATIONS'
  | 'DISABLE_MODEL_PROVIDER'
  | 'DISABLE_CHARACTER';

export type SafeFallbackCategory =
  | 'cannot_assist'
  | 'safety_redirect'
  | 'unsupported_request'
  | 'content_unavailable';

export interface StandardSafeFallbackResponse {
  category: SafeFallbackCategory;
  message: string;
  suggestedAction?: 'RETRY' | 'TOPIC_CHANGE' | 'CONTACT_SUPPORT';
}

export interface SafetyEvaluationRequest {
  surface: SafetySurface;
  content: string;
  userId?: string;
  characterId?: string;
  conversationId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface SafetyEvaluationResult {
  decision: SafetyDecision;
  riskLevel: SafetyRiskLevel;
  score: number;
  categories: string[];
  reason?: string;
  sanitizedContent?: string;
  fallbackResponse?: StandardSafeFallbackResponse;
  policyVersion: number;
  classifierVersion?: string;
  latencyMs: number;
}

export interface SafetyPolicyRule {
  id: string;
  category: string;
  name: string;
  description: string;
  severity: SafetyRiskLevel;
  action: SafetyDecision;
  patterns?: string[];
  customEvaluator?: string;
}

export interface SafetyPolicyVersionData {
  id: string;
  versionNumber: number;
  name: string;
  description?: string | null;
  rules: SafetyPolicyRule[];
  isActive: boolean;
  effectiveFrom: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserRestrictionItem {
  id: string;
  userId: string;
  restrictionType: AccountRestrictionType;
  reason: string;
  issuedByAdminId?: string | null;
  expiresAt?: string | null;
  isActive: boolean;
  revokedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface UserBlockItem {
  id: string;
  userId: string;
  blockedUserId?: string | null;
  blockedCharacterId?: string | null;
  blockedCreatorId?: string | null;
  targetName?: string;
  reason?: string | null;
  createdAt: string;
}

export interface UserPrivacySettingsData {
  userId: string;
  memoryStorageEnabled: boolean;
  personalizationEnabled: boolean;
  analyticsConsent: boolean;
  aiTrainingConsent: boolean;
  dataRetentionDays: number;
  updatedAt: string;
}

export interface DataExportRequestItem {
  id: string;
  userId: string;
  status: DataExportStatus;
  dataTypes: string[];
  downloadUrl?: string | null;
  downloadExpiresAt?: string | null;
  fileSizeBytes?: number | null;
  errorMessage?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface AccountDeletionRequestItem {
  id: string;
  userId: string;
  status: AccountDeletionStatus;
  reason?: string | null;
  scheduledFor: string;
  anonymizeFinancialRecords: boolean;
  completedAt?: string | null;
  createdAt: string;
}

export interface SafetyIncidentItem {
  id: string;
  severity: IncidentSeverity;
  category: IncidentCategory;
  title: string;
  description: string;
  status: IncidentStatus;
  impactSummary?: string | null;
  affectedComponents?: string[] | null;
  actionsTaken?: string | null;
  leadAdminId?: string | null;
  detectedAt: string;
  mitigatedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface EmergencyKillSwitchItem {
  id: string;
  switchType: KillSwitchType;
  targetId?: string | null;
  isActive: boolean;
  reason: string;
  activatedByAdminId?: string | null;
  activatedAt?: string | null;
  deactivatedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AccountRestrictionCreateInput {
  userId: string;
  restrictionType: AccountRestrictionType;
  reason: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UserBlockCreateInput {
  blockedUserId?: string;
  blockedCharacterId?: string;
  blockedCreatorId?: string;
  reason?: string;
}

export interface PrivacySettingsUpdateInput {
  memoryStorageEnabled?: boolean;
  personalizationEnabled?: boolean;
  analyticsConsent?: boolean;
  aiTrainingConsent?: boolean;
  dataRetentionDays?: number;
}

// -----------------------------------------------------------------------------
// PHASE 17: ANALYTICS, EXPERIMENTATION, AI ECONOMICS & COMMAND CENTER TYPES
// -----------------------------------------------------------------------------

export type AnalyticsCategory =
  | 'IDENTITY'
  | 'ONBOARDING'
  | 'SESSION'
  | 'CONVERSATION'
  | 'CHARACTER'
  | 'DISCOVERY'
  | 'SEARCH'
  | 'RECOMMENDATION'
  | 'MEMORY'
  | 'RELATIONSHIP'
  | 'VOICE'
  | 'MEDIA'
  | 'NOTIFICATION'
  | 'PROACTIVE'
  | 'BILLING'
  | 'CREATOR'
  | 'MODERATION'
  | 'SAFETY'
  | 'EXPERIMENT'
  | 'INFRASTRUCTURE';

export type AnalyticsEventName =
  // Identity & Auth
  | 'app_opened'
  | 'app_backgrounded'
  | 'signup_started'
  | 'signup_completed'
  | 'login_completed'
  | 'logout_completed'
  // Session
  | 'session_started'
  | 'session_ended'
  // Onboarding
  | 'welcome_viewed'
  | 'onboarding_started'
  | 'language_selected'
  | 'interest_selected'
  | 'character_previewed'
  | 'character_selected'
  | 'first_chat_started'
  | 'first_message_sent'
  | 'onboarding_completed'
  | 'activation_completed'
  // Character & Conversation
  | 'character_viewed'
  | 'character_started'
  | 'character_returned_to'
  | 'character_favorited'
  | 'character_unfavorited'
  | 'conversation_started'
  | 'message_sent'
  | 'assistant_message_completed'
  | 'conversation_completed'
  | 'conversation_regenerated'
  | 'conversation_abandoned'
  | 'message_feedback_given'
  // Discovery & Search
  | 'home_viewed'
  | 'section_viewed'
  | 'search_started'
  | 'search_result_clicked'
  | 'recommendation_impression'
  | 'recommendation_clicked'
  // Voice & Media
  | 'voice_opened'
  | 'voice_session_started'
  | 'voice_session_connected'
  | 'voice_response_started'
  | 'voice_session_completed'
  | 'voice_session_failed'
  | 'image_generation_requested'
  | 'image_generation_completed'
  | 'image_generation_failed'
  | 'media_viewed'
  // Proactive & Notifications
  | 'notification_sent'
  | 'notification_opened'
  | 'notification_opt_in'
  | 'notification_opt_out'
  | 'proactive_message_opened'
  | 'proactive_message_replied'
  | 'proactive_conversation_continued'
  // Memory & Relationship
  | 'memory_accepted'
  | 'memory_rejected'
  | 'memory_deleted'
  | 'relationship_stage_changed'
  | 'relationship_milestone_reached'
  // Billing
  | 'paywall_viewed'
  | 'product_viewed'
  | 'checkout_started'
  | 'purchase_started'
  | 'purchase_completed'
  | 'purchase_failed'
  | 'subscription_started'
  | 'subscription_cancelled'
  | 'refund_requested'
  // Creator
  | 'creator_onboarding_started'
  | 'creator_profile_created'
  | 'character_created'
  | 'character_submitted'
  | 'character_published'
  // Experiments
  | 'experiment_assigned'
  | 'experiment_exposed';

export interface AnalyticsBatchIngestItem {
  id: string; // client UUID for idempotency
  eventName: AnalyticsEventName | string;
  eventVersion?: number;
  userId?: string;
  anonymousId?: string;
  sessionId?: string;
  deviceId?: string;
  characterId?: string;
  creatorId?: string;
  conversationId?: string;
  timestamp: string;
  properties?: Record<string, unknown>;
  appVersion?: string;
  platform?: 'ios' | 'android' | 'web' | string;
  locale?: string;
  timezone?: string;
  experimentId?: string;
  experimentVariant?: string;
  requestId?: string;
  source?: string;
}

export interface AnalyticsBatchIngestRequest {
  events: AnalyticsBatchIngestItem[];
  sentAt?: string;
}

export interface AnalyticsBatchIngestResponse {
  received: number;
  accepted: number;
  duplicate: number;
  errors: number;
}

// AI Economics Types
export interface AIUsageRecordInput {
  requestId: string;
  provider: string;
  model: string;
  task: 'CHAT_STREAM' | 'MEMORY_EXTRACTION' | 'EMBEDDING' | 'VOICE_TTS' | 'IMAGE_GEN' | 'EVALUATION' | string;
  userId?: string;
  characterId?: string;
  conversationId?: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  latencyMs: number;
  status?: 'SUCCESS' | 'FAILED' | 'CIRCUIT_BROKEN';
  breakdown?: {
    baseTokens?: number;
    memoryTokens?: number;
    historyTokens?: number;
    userTokens?: number;
  };
}

export interface AIModelPricingItem {
  id: string;
  provider: string;
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion: number;
  currency: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export interface AIModelPricingCreateInput {
  provider: string;
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion?: number;
  currency?: string;
}

export interface AIUnitEconomicsSummary {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  totalEstimatedCost: number;
  costPerUser: number;
  costPerConversation: number;
  costPerMessage: number;
  costByProvider: Record<string, number>;
  costByModel: Record<string, number>;
  costByTask: Record<string, number>;
  topCharactersByCost: Array<{
    characterId: string;
    name: string;
    totalCost: number;
    totalTokens: number;
    requestCount: number;
  }>;
  recentAnomalies: Array<{
    requestId: string;
    model: string;
    tokens: number;
    cost: number;
    reason: string;
    createdAt: string;
  }>;
}

// Daily Aggregations & Metrics
export interface ProductDailyMetricItem {
  id: string;
  date: string;
  dau: number;
  wau: number;
  mau: number;
  newUsers: number;
  activatedUsers: number;
  d1Retained: number;
  d7Retained: number;
  d30Retained: number;
  conversations: number;
  messages: number;
  revenue: number;
  aiCost: number;
  grossMargin: number;
  voiceMinutes: number;
  imageGenerations: number;
}

export interface CharacterDailyMetricItem {
  id: string;
  date: string;
  characterId: string;
  views: number;
  starts: number;
  messages: number;
  activeUsers: number;
  returningUsers: number;
  favorites: number;
  voiceSessions: number;
  mediaInteractions: number;
  reports: number;
  aiCost: number;
  grossRevenue: number;
}

export interface CreatorDailyMetricItem {
  id: string;
  date: string;
  creatorProfileId: string;
  publishedCharacters: number;
  totalStarts: number;
  activeUsers: number;
  returningUsers: number;
  grossEarnings: number;
  creatorNet: number;
  reports: number;
}

export interface CohortRetentionItem {
  cohortDate: string;
  cohortSize: number;
  d1Rate: number;
  d3Rate: number;
  d7Rate: number;
  d14Rate: number;
  d30Rate: number;
}

export interface OnboardingFunnelStep {
  stepName: string;
  count: number;
  conversionRate: number;
  dropoffRate: number;
}

export interface AttributionChannelSummary {
  source: string;
  signups: number;
  activated: number;
  activationRate: number;
  payingUsers: number;
  grossRevenue: number;
}

// Experiments Framework
export interface ExperimentVariantItem {
  id: string;
  experimentId: string;
  key: string;
  name?: string | null;
  configuration?: Record<string, unknown> | null;
  allocationPercentage: number;
}

export interface ExperimentItem {
  id: string;
  name: string;
  description?: string | null;
  status: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  targeting?: {
    platform?: string[];
    minAppVersion?: string;
    subscription?: string[];
    languages?: string[];
  } | null;
  primaryMetric: string;
  secondaryMetrics?: string[] | null;
  guardrailMetrics?: string[] | null;
  allocation: number;
  startAt?: string | null;
  endAt?: string | null;
  variants: ExperimentVariantItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentCreateInput {
  id: string;
  name: string;
  description?: string;
  targeting?: Record<string, unknown>;
  primaryMetric: string;
  secondaryMetrics?: string[];
  guardrailMetrics?: string[];
  allocation?: number;
  variants: Array<{
    key: string;
    name?: string;
    configuration?: Record<string, unknown>;
    allocationPercentage: number;
  }>;
}

export interface ExperimentUpdateInput {
  name?: string;
  description?: string;
  status?: 'DRAFT' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  targeting?: Record<string, unknown>;
  allocation?: number;
  startAt?: string | null;
  endAt?: string | null;
}

export interface ExperimentVariantAnalysis {
  variantKey: string;
  assignedUsers: number;
  exposedUsers: number;
  primaryMetricValue: number;
  primaryMetricRate: number;
  upliftVsControl: number; // percentage
  zScore: number;
  pValue: number;
  confidenceInterval: [number, number];
  isSignificant: boolean;
  guardrails: Record<string, number>;
}

export interface ExperimentAnalysisResult {
  experimentId: string;
  status: string;
  totalSubjects: number;
  totalExposed: number;
  primaryMetric: string;
  variants: ExperimentVariantAnalysis[];
  recommendation: 'CONTINUE_RUNNING' | 'INCONCLUSIVE' | 'ROLLOUT_TREATMENT' | 'ROLLBACK';
}

// Analytics Alerts & Command Center
export interface AnalyticsAlertItem {
  id: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  category: 'AI_COST' | 'REVENUE' | 'ACTIVATION' | 'API_ERRORS' | 'NOTIFICATIONS' | 'SAFETY';
  title: string;
  message: string;
  metrics?: Record<string, unknown> | null;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  acknowledgedByAdminId?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface AdminAnalyticsOverviewData {
  dau: number;
  wau: number;
  mau: number;
  newUsersToday: number;
  activatedUsersToday: number;
  activationRate: number;
  d1RetentionRate: number;
  d7RetentionRate: number;
  dailyRevenue: number;
  dailyAICost: number;
  estimatedGrossMargin: number;
  activeConversations: number;
  totalMessagesToday: number;
  activeAlerts: AnalyticsAlertItem[];
  recentDailyMetrics: ProductDailyMetricItem[];
}

// -----------------------------------------------------------------------------
// PHASE 21: PRODUCTION LAUNCH OPERATIONS, SUPPORT, INCIDENTS & CONTROLLED BETA
// -----------------------------------------------------------------------------

export type BetaCohortType =
  | 'INTERNAL'
  | 'FRIENDS_FAMILY'
  | 'EARLY_ADOPTERS'
  | 'CREATOR_BETA'
  | 'PREMIUM_BETA';

export interface BetaInvitationItem {
  id: string;
  code: string;
  cohort: BetaCohortType;
  creatorUserId?: string | null;
  recipientEmail?: string | null;
  redeemedByUserId?: string | null;
  status: 'ACTIVE' | 'REDEEMED' | 'EXPIRED' | 'REVOKED';
  maxRedemptions: number;
  redemptionCount: number;
  createdAt: string;
  expiresAt?: string | null;
  redeemedAt?: string | null;
}

export interface BetaInvitationCreateInput {
  cohort: BetaCohortType;
  code?: string;
  recipientEmail?: string;
  maxRedemptions?: number;
  expiresAt?: string;
}

export interface BetaRedeemInput {
  code: string;
}

export interface BetaRedeemResult {
  success: boolean;
  cohort: BetaCohortType;
  message: string;
  featuresUnlocked: string[];
}

export type SupportTicketCategory =
  | 'account'
  | 'authentication'
  | 'billing'
  | 'subscription'
  | 'credits'
  | 'ai_response'
  | 'voice'
  | 'media'
  | 'notifications'
  | 'privacy'
  | 'memory'
  | 'creator'
  | 'technical'
  | 'bug'
  | 'safety';

export type SupportTicketPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type SupportTicketStatus =
  | 'open'
  | 'triaged'
  | 'in_progress'
  | 'waiting_user'
  | 'resolved'
  | 'closed';

export interface SupportTicketItem {
  id: string;
  userId: string;
  userEmail?: string;
  category: SupportTicketCategory;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  subject: string;
  description: string;
  screen?: string | null;
  appVersion?: string | null;
  deviceInfo?: Record<string, unknown> | null;
  requestId?: string | null;
  assignedAdminId?: string | null;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketCreateInput {
  category: SupportTicketCategory;
  subject: string;
  description: string;
  screen?: string;
  appVersion?: string;
  deviceInfo?: Record<string, unknown>;
  requestId?: string;
}

export interface SupportTicketUpdateInput {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assignedAdminId?: string | null;
  resolutionNotes?: string;
}

export interface SupportAuditLogItem {
  id: string;
  actorAdminId: string;
  targetUserId?: string | null;
  action: string;
  reason: string;
  requestId?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export type IncidentSeverityType = 'SEV_0' | 'SEV_1' | 'SEV_2' | 'SEV_3';

export type IncidentCommandStatus =
  | 'detected'
  | 'investigating'
  | 'identified'
  | 'mitigating'
  | 'monitoring'
  | 'resolved'
  | 'postmortem';

export interface IncidentTimelineEvent {
  timestamp: string;
  note: string;
  author: string;
}

export interface IncidentCommandItem {
  id: string;
  incidentNumber: string;
  title: string;
  severity: IncidentSeverityType;
  status: IncidentCommandStatus;
  commanderAdminId?: string | null;
  techLeadAdminId?: string | null;
  commsLeadAdminId?: string | null;
  affectedServices: string[];
  impactSummary: string;
  timeline: IncidentTimelineEvent[];
  customerFacingMessage?: string | null;
  detectedAt: string;
  mitigatedAt?: string | null;
  resolvedAt?: string | null;
  postmortemUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentCreateInput {
  title: string;
  severity: IncidentSeverityType;
  affectedServices: string[];
  impactSummary: string;
  commanderAdminId?: string;
  techLeadAdminId?: string;
  customerFacingMessage?: string;
}

export interface IncidentUpdateInput {
  status?: IncidentCommandStatus;
  severity?: IncidentSeverityType;
  timelineNote?: string;
  customerFacingMessage?: string;
  postmortemUrl?: string;
}

export interface PublicServiceHealthStatus {
  overall: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE' | 'MAINTENANCE';
  updatedAt: string;
  services: Array<{
    serviceKey: 'api' | 'chat' | 'voice' | 'media' | 'discovery' | 'notifications' | 'billing';
    name: string;
    status: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE';
    latencyP95Ms?: number;
    uptimePercent30d: number;
  }>;
  activeIncidents: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    customerMessage: string;
    updatedAt: string;
  }>;
}

export interface OperationalKillSwitchItem {
  id: string;
  switchKey:
    | 'image_generation'
    | 'voice_calls'
    | 'proactive_messaging'
    | 'creator_publishing'
    | 'model_routing'
    | 'discovery_indexing'
    | string;
  isEnabled: boolean;
  scope: 'GLOBAL' | 'COHORT' | 'PROVIDER' | 'CHARACTER';
  targetId?: string | null;
  reason: string;
  updatedByAdminId: string;
  updatedAt: string;
}

export interface KillSwitchUpdateInput {
  switchKey: string;
  isEnabled: boolean;
  scope?: 'GLOBAL' | 'COHORT' | 'PROVIDER' | 'CHARACTER';
  targetId?: string | null;
  reason: string;
}

export interface TwoPersonApprovalRequestItem {
  id: string;
  action:
    | 'DELETE_USER'
    | 'REFUND_LARGE'
    | 'UNPUBLISH_POPULAR_CHARACTER'
    | 'GLOBAL_KILL_SWITCH'
    | 'DATABASE_MAINTENANCE';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'EXPIRED';
  requestedByAdminId: string;
  approvedByAdminId?: string | null;
  payload: Record<string, unknown>;
  reason: string;
  createdAt: string;
  expiresAt: string;
}

export interface TwoPersonApprovalCreateInput {
  action: TwoPersonApprovalRequestItem['action'];
  payload: Record<string, unknown>;
  reason: string;
}

export interface ConsentRecordItem {
  userId: string;
  termsVersion: string;
  privacyVersion: string;
  consentVersion: string;
  ipAddress?: string;
  acceptedAt: string;
}

// -----------------------------------------------------------------------------
// Phase 22: Production Intelligence, AI Quality, Personalization & Continuous Learning
// -----------------------------------------------------------------------------

// 1. Personalization & Context Engine
export type ResponseDensityStyle = 'concise' | 'balanced' | 'detailed';
export type UserInteractionStylePreference = 'friendly' | 'intellectual' | 'humorous' | 'empathetic' | 'direct';
export type PersonalizationResetScope = 'all' | 'inferred_only';

export interface UserExplicitPreferences {
  primaryLanguage: 'en' | 'hi' | 'hinglish' | string;
  responseLength: ResponseDensityStyle;
  topicsOfInterest: string[];
  interactionStyle: UserInteractionStylePreference;
  favoriteCategories: string[];
  customStyleNotes?: string;
}

export interface UserInferredPreferenceItem {
  key: string;
  value: string;
  confidence: number; // 0.0 - 1.0
  source: string;
  lastObservedAt: string;
  lastReinforcedAt: string;
  decayHalfLifeDays: number;
}

export interface UserPersonalizationProfile {
  userId: string;
  explicitPreferences: UserExplicitPreferences;
  inferredPreferences: UserInferredPreferenceItem[];
  isPersonalizationEnabled: boolean;
  updatedAt: string;
}

export interface UserContextSnapshot {
  userId: string;
  language: string;
  responseLength: ResponseDensityStyle;
  explicitPreferences: Partial<UserExplicitPreferences>;
  activeInferredPreferences: Array<{ key: string; value: string; confidence: number }>;
  retrievedMemoryIds: string[];
  relationshipStateSummary?: string;
  tokenBudgetUsed: Record<string, number>;
}

export interface UpdatePersonalizationInput {
  isPersonalizationEnabled?: boolean;
  explicitPreferences?: Partial<UserExplicitPreferences>;
}

// 2. Privacy & PII / Secrets Redaction
export interface RedactionResult {
  sanitizedText: string;
  detectedPiiTypes: string[];
  hasSecrets: boolean;
  redactionCount: number;
}

// 3. Failure Dataset & Evaluation
export type FailureCategory =
  | 'hallucination'
  | 'personality_drift'
  | 'memory_failure'
  | 'relationship_inconsistency'
  | 'safety_issue'
  | 'language_issue'
  | 'formatting_issue'
  | 'latency_issue'
  | 'tool_failure'
  | 'billing_issue';

export interface EvaluationRubricScore {
  relevance: number; // 0-1
  factuality: number; // 0-1
  instructionFollowing: number; // 0-1
  characterConsistency: number; // 0-1
  emotionalAppropriateness: number; // 0-1
  memoryCorrectness: number; // 0-1
  conversationalNaturalness: number; // 0-1
  safety: number; // 0-1
  languageQuality: number; // 0-1
  compositeScore: number; // 0-1
}

export interface EvaluationDatasetItem {
  id: string;
  datasetVersion: string;
  caseId: string;
  category: FailureCategory;
  sanitizedInput: string;
  expectedBehavior: string;
  observedBehavior: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  source: 'USER_REPORT' | 'INTERNAL_AUDIT' | 'AUTOMATED_MONITOR' | 'SYNTHETIC';
  modelVersion: string;
  promptVersion: string;
  characterVersion: string;
  isRegressionActive: boolean;
  rubricScores?: EvaluationRubricScore | null;
  createdAt: string;
  evaluatedAt?: string | null;
}

export interface CreateFailureCaseInput {
  datasetVersion?: string;
  category: FailureCategory;
  sanitizedInput: string;
  expectedBehavior: string;
  observedBehavior: string;
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  source: 'USER_REPORT' | 'INTERNAL_AUDIT' | 'AUTOMATED_MONITOR' | 'SYNTHETIC';
  modelVersion: string;
  promptVersion: string;
  characterVersion: string;
}

export interface EvaluateFailureCaseInput {
  caseId: string;
  rubricScores: EvaluationRubricScore;
}

// 4. Generation Debugger & Replay
export interface GenerationDebugSnapshot {
  generationId: string;
  requestId: string;
  conversationId: string;
  userId: string;
  characterId: string;
  characterVersionId: string;
  model: string;
  provider: string;
  promptVersion: string;
  latencyMs: number;
  ttftMs?: number;
  promptTokens: number;
  completionTokens: number;
  totalCostUsd: number;
  contextAttribution: {
    memoryIds: string[];
    relationshipSummary?: string;
    preferenceKeys: string[];
    promptTokensByComponent: Record<string, number>;
  };
  moderationResult?: {
    flagged: boolean;
    categories: string[];
  };
  userFeedback?: {
    rating: string;
    reason?: string;
  };
  createdAt: string;
}

export interface ReplayRequest {
  generationId: string;
  targetModel?: string;
  targetPromptVersion?: string;
  overrideTemperature?: number;
}

export interface ReplayResult {
  originalGenerationId: string;
  replayedOutput: string;
  replayedModel: string;
  replayedLatencyMs: number;
  replayedTokens: number;
  estimatedCostUsd: number;
  rubricDiff?: {
    originalComposite: number;
    replayedComposite: number;
  };
  timestamp: string;
}

// 5. Circuit Breakers & Intelligence Metrics
export interface CircuitBreakerStatus {
  name: 'AI_COST_CIRCUIT_BREAKER' | 'AI_QUALITY_CIRCUIT_BREAKER' | 'SAFETY_REGRESSION_CIRCUIT_BREAKER' | string;
  isTripped: boolean;
  threshold: number;
  currentValue: number;
  metricUnit: string;
  trippedAt?: string | null;
  actionTaken: string;
}

export interface CircuitBreakerUpdateInput {
  name: string;
  isTripped: boolean;
  threshold?: number;
  reason: string;
}

export interface IntelligenceOverviewSummary {
  dailyTokens: number;
  dailyCostUsd: number;
  activeModels: number;
  /** null until a memory-retrieval evaluation run has produced a measurement. */
  memoryPrecision: number | null;
  memoryRecall: number | null;
  /** null when there were no generations in the window. */
  p95LatencyMs: number | null;
  safetyIncidentRate: number | null;
  activeCircuitBreakers: number;
  activeExperiments: number;
  totalRegressionCases: number;
}

// 6. Metric Registry & Data Lineage
export interface MetricDefinitionItem {
  id: string;
  name: string;
  category: 'NORTH_STAR' | 'ACTIVATION' | 'ENGAGEMENT' | 'RETENTION' | 'MONETIZATION' | 'AI_QUALITY' | 'SAFETY';
  formula: string;
  sourceEvent: string;
  timeWindow: string;
  targetPopulation: string;
  owner: string;
  description: string;
}

export interface DataLineageItem {
  id: string;
  eventName: string;
  producer: 'MOBILE_CLIENT' | 'API_SERVER' | 'GATEWAY' | 'AI_WORKER';
  ingestionTopic: string;
  primaryTable: string;
  transformationJob: string;
  aggregatedMetrics: string[];
  piiSensitivity: 'NONE' | 'PSEUDONYMIZED' | 'REDACTED';
}

// -----------------------------------------------------------------------------
// Phase 23: Advanced Agent & Tool Orchestration, Multimodal & Character Capabilities
// -----------------------------------------------------------------------------

// 1. Agent Task & State Machine Types
export type AgentTaskStatus =
  | 'created'
  | 'planning'
  | 'awaiting_confirmation'
  | 'approved'
  | 'executing'
  | 'waiting'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'rejected';

export type AgentTaskType =
  | 'WORKFLOW'
  | 'ONE_SHOT_TOOL'
  | 'RESEARCH'
  | 'MULTIMODAL_EXTRACTION'
  | 'SCHEDULED_AUTOMATION';

export interface AgentTaskBounds {
  maxSteps: number;
  maxToolCalls: number;
  maxDurationMs: number;
  maxTokens: number;
  maxCostUsd: number;
  maxRetries: number;
  maxParallelTools: number;
}

export interface AgentTaskItem {
  id: string;
  userId: string;
  characterId?: string | null;
  conversationId?: string | null;
  status: AgentTaskStatus;
  taskType: AgentTaskType;
  objective: string;
  bounds: AgentTaskBounds;
  currentStepIndex: number;
  planId?: string | null;
  failureCode?: string | null;
  failureReason?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  expiresAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateAgentTaskInput {
  characterId?: string;
  conversationId?: string;
  taskType?: AgentTaskType;
  objective: string;
  bounds?: Partial<AgentTaskBounds>;
  metadata?: Record<string, unknown>;
}

// 2. Agent Plan & Steps Types
export type PlanStepRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AgentPlanStep {
  stepId: string;
  toolSlug: string;
  toolVersion: string;
  arguments: Record<string, unknown>;
  dependencyStepIds: string[];
  riskLevel: PlanStepRiskLevel;
  requiresConfirmation: boolean;
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  output?: unknown;
  error?: string;
  argumentsHash: string;
  receiptId?: string;
}

export interface AgentPlan {
  planId: string;
  taskId: string;
  objective: string;
  steps: AgentPlanStep[];
  estimatedCostUsd: number;
  estimatedDurationMs: number;
  requiredPermissions: string[];
  riskLevel: PlanStepRiskLevel;
  generatedByModel: string;
  promptVersion: string;
  createdAt: string;
}

// 3. Tool Registry & Execution Types
export type ToolCategory =
  | 'READ_ONLY'
  | 'USER_ACTION'
  | 'COMMUNICATION'
  | 'SCHEDULED_ACTION'
  | 'EXTERNAL_API'
  | 'BROWSER'
  | 'MULTIMODAL'
  | 'DATA_PROCESSING'
  | 'ADMIN_INTERNAL'
  | 'HIGH_RISK';

export type ToolRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ToolLifecycleStatus = 'draft' | 'testing' | 'approved' | 'enabled' | 'disabled' | 'deprecated' | 'retired';

export interface ToolRegistryItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  category: ToolCategory;
  status: ToolLifecycleStatus;
  riskLevel: ToolRiskLevel;
  requiredCapability: string;
  permissionScope: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  timeoutMs: number;
  isSideEffecting: boolean;
  isReversible: boolean;
  costUsd: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActionReceiptItem {
  receiptId: string;
  taskId: string;
  stepId: string;
  toolSlug: string;
  provider: string;
  externalReferenceId?: string;
  actionSummary: string;
  executedAt: string;
  isReversible: boolean;
}

export interface ToolExecutionRequest {
  taskId: string;
  stepId: string;
  toolSlug: string;
  toolVersion?: string;
  arguments: Record<string, unknown>;
  userId: string;
  characterId?: string;
  confirmationToken?: string;
  idempotencyKey?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string; retryable: boolean };
  metadata: {
    durationMs: number;
    costUsd: number;
    sanitized: boolean;
    cached: boolean;
    source?: string;
  };
  receipt?: ActionReceiptItem;
}

// 4. High-Risk Confirmation Types
export interface HighRiskConfirmationRequest {
  token: string;
  taskId: string;
  stepId: string;
  toolSlug: string;
  argumentsHash: string;
  riskLevel: ToolRiskLevel;
  explanation: string;
  proposedArguments: Record<string, unknown>;
  expiresAt: string;
}

export interface ConfirmStepInput {
  token: string;
  action: 'CONFIRM' | 'REJECT';
  reason?: string;
}

// 5. Character Capabilities & Skills Types
export interface CharacterCapabilityItem {
  id: string;
  characterId: string;
  characterVersionId?: string;
  capabilitySlug: string;
  isEnabled: boolean;
  permissionScope: string;
  config?: Record<string, unknown>;
}

export interface SkillItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  category: string;
  status: 'draft' | 'approved' | 'published' | 'deprecated';
  requiredCapabilities: string[];
  requiredToolSlugs: string[];
  maxSteps: number;
  maxCostUsd: number;
  createdAt: string;
}

// 6. User Consents & OAuth Types
export interface UserToolConsentItem {
  id: string;
  userId: string;
  capabilitySlug: string;
  provider: string;
  scope: string;
  grantedAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  consentVersion: string;
}

export interface OAuthConnectionItem {
  id: string;
  userId: string;
  provider: 'google' | 'microsoft' | 'github' | 'notion' | 'slack' | string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'DISCONNECTED';
  scopes: string[];
  accountEmail?: string;
  expiresAt?: string;
  createdAt: string;
}

// 7. Multimodal Intelligence & Attachments Types
export type MultimodalPartType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'structured_json';

export interface MultimodalAttachmentItem {
  id: string;
  userId: string;
  partType: MultimodalPartType;
  mimeType: string;
  originalFilename: string;
  fileSizeBytes: number;
  storageUrl: string;
  moderationStatus: 'PENDING' | 'PASSED' | 'FLAGGED';
  extractedText?: string;
  extractedMetadata?: Record<string, unknown>;
  provenance: {
    sourceId: string;
    modelUsed?: string;
    confidence: number;
  };
  createdAt: string;
}

// 8. Scheduled Agent Tasks Types
export interface ScheduledAgentTaskItem {
  id: string;
  userId: string;
  characterId?: string;
  taskTemplate: {
    objective: string;
    toolSlugs: string[];
    arguments: Record<string, unknown>;
  };
  cronSchedule: string;
  timezone: string;
  isEnabled: boolean;
  nextRunAt: string;
  lastRunAt?: string;
  totalRuns: number;
  maxRuns?: number;
  createdAt: string;
}

// 9. Agent Tracing & Forensics Types
export interface AgentTaskTrace {
  taskId: string;
  plan: AgentPlan;
  stepsExecution: Array<{
    stepId: string;
    toolSlug: string;
    durationMs: number;
    status: string;
    tokensUsed: number;
    costUsd: number;
    receiptId?: string;
    timestamp: string;
  }>;
  totalDurationMs: number;
  totalCostUsd: number;
  finalStatus: AgentTaskStatus;
}

// =============================================================================
// PHASE 24: ADVANCED SOCIAL & COMMUNICATION LAYER TYPES
//
// Public DTOs identify people ONLY by `publicId` / `username`. Internal user ids,
// emails, billing, memories, private conversations and moderation internals are
// never part of these shapes.
// =============================================================================

export type SocialProfileVisibility = 'PUBLIC' | 'LIMITED' | 'PRIVATE';
export type SocialAudience = 'EVERYONE' | 'FOLLOWERS' | 'MUTUALS' | 'NOBODY';
export type SocialFollowPolicy = 'EVERYONE' | 'APPROVAL_REQUIRED' | 'NOBODY';
export type SocialFollowStatus = 'ACTIVE' | 'PENDING';
export type SocialMuteTargetType = 'USER' | 'CREATOR' | 'CHARACTER' | 'COMMUNITY' | 'TOPIC' | 'NOTIFICATION_CATEGORY';
export type SocialMuteScope = 'ALL' | 'POSTS' | 'COMMENTS' | 'NOTIFICATIONS';

/** Who authored a piece of social content — always shown to viewers. */
export type SocialAuthorType = 'USER' | 'CREATOR' | 'AI_CHARACTER' | 'PLATFORM';

export type SocialContentKind =
  | 'CHARACTER_SHARE'
  | 'CONVERSATION_EXCERPT'
  | 'MEDIA_SHARE'
  | 'COLLECTION_SHARE'
  | 'CREATOR_POST'
  | 'CHARACTER_POST'
  | 'COMMUNITY_POST';

export type SocialContentVisibility = 'PUBLIC' | 'UNLISTED' | 'FOLLOWERS' | 'COMMUNITY';

export type SocialContentStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'PENDING_MODERATION'
  | 'PUBLISHED'
  | 'RESTRICTED'
  | 'HIDDEN'
  | 'REJECTED'
  | 'DELETED'
  | 'ARCHIVED';

export type SocialReactionType = 'LIKE' | 'FAVORITE' | 'APPRECIATION' | 'USEFUL';

export type SocialSafetyAction =
  | 'ALLOW'
  | 'ALLOW_WITH_LIMITS'
  | 'REQUIRE_CONFIRMATION'
  | 'REQUIRE_MODERATION'
  | 'TEMPORARILY_RESTRICT'
  | 'BLOCK';

/** Internal, explainable decision. `reasons` are internal codes; `userMessage` is what a user may see. */
export interface SocialSafetyDecision {
  action: SocialSafetyAction;
  reasons: string[];
  userMessage?: string;
  limits?: Record<string, number>;
}

/** Minimal public card for a person. */
export interface SocialUserCard {
  publicId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  isCreator: boolean;
  isVerified: boolean;
}

export interface SocialViewerRelationship {
  isSelf: boolean;
  following: SocialFollowStatus | null;
  followedBy: boolean;
  isMutual: boolean;
  isMuted: boolean;
  hasBlocked: boolean;
  canMessage: boolean;
  canMention: boolean;
}

export interface SocialProfileView extends SocialUserCard {
  bio: string | null;
  pronouns: string | null;
  visibility: SocialProfileVisibility;
  /** False when the viewer only sees the limited card (privacy). */
  isFullView: boolean;
  followersCount: number | null;
  followingCount: number | null;
  joinedAt: string | null;
  relationship: SocialViewerRelationship | null;
}

export interface SocialPrivacySettingsDto {
  profileVisibility: SocialProfileVisibility;
  followPolicy: SocialFollowPolicy;
  followListAudience: SocialAudience;
  creationsAudience: SocialAudience;
  sharedContentAudience: SocialAudience;
  activityAudience: SocialAudience;
  communitiesAudience: SocialAudience;
  showOnlineStatus: boolean;
  whoCanMessage: SocialAudience;
  whoCanMention: SocialAudience;
  whoCanComment: SocialAudience;
  whoCanInviteToCommunities: SocialAudience;
  discoverable: boolean;
  searchable: boolean;
  socialRecommendations: boolean;
  characterSocialInteractions: boolean;
  version: number;
  updatedAt: string;
}

export interface SocialMyProfile extends SocialProfileView {
  usernameChangeAvailableAt: string | null;
  privacy: SocialPrivacySettingsDto;
}

export interface UsernameAvailability {
  username: string;
  available: boolean;
  reason?: 'INVALID' | 'RESERVED' | 'TAKEN' | 'CONFUSABLE' | 'HELD' | 'PROFANITY';
  message?: string;
}

export interface SocialCursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface SocialMuteItem {
  targetType: SocialMuteTargetType;
  /** Public id for users, character slug, community slug, topic or category key. */
  target: string;
  scope: SocialMuteScope;
  expiresAt: string | null;
  createdAt: string;
}

export interface SocialCharacterRef {
  slug: string;
  name: string;
  avatarUrl: string | null;
  /** Always true: characters are AI and are labelled as such everywhere. */
  isAi: true;
}

export interface SocialAiProvenance {
  generationId: string;
  model: string;
  characterVersionId: string | null;
  promptVersion: string | null;
  safetyVersion: string | null;
  generatedAt: string;
}

/** Label that tells the viewer who produced this content (human creator vs AI vs platform). */
export type SocialContentAttribution = 'CREATOR_WROTE_THIS' | 'AI_GENERATED' | 'USER_SHARED' | 'PLATFORM';

export interface SocialContentView {
  publicId: string;
  kind: SocialContentKind;
  attribution: SocialContentAttribution;
  author: SocialUserCard | null;
  character: SocialCharacterRef | null;
  community: { slug: string; name: string } | null;
  title: string | null;
  body: string | null;
  /** Immutable, redacted snapshot. Shape depends on `kind`. */
  snapshot: Record<string, unknown>;
  visibility: SocialContentVisibility;
  status: SocialContentStatus;
  isAiGenerated: boolean;
  reactionCount: number;
  commentCount: number;
  viewerReactions: SocialReactionType[];
  isOwner: boolean;
  isEdited: boolean;
  expiresAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  shareUrl: string;
}

export interface SocialSharePreviewMessage {
  ref: string;
  speaker: 'USER' | 'CHARACTER';
  text: string;
  redacted: boolean;
}

export interface SocialRedactionFinding {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  count: number;
}

/** Returned before anything becomes public: exactly what will be visible. */
export interface SocialSharePreview {
  kind: SocialContentKind;
  visibleMessageCount: number;
  messages: SocialSharePreviewMessage[];
  character: SocialCharacterRef | null;
  findings: SocialRedactionFinding[];
  decision: SocialSafetyDecision;
  /** Must be echoed back to confirm when `decision.action === 'REQUIRE_CONFIRMATION'`. */
  confirmationToken: string | null;
  externalCopyNotice: string;
}

export interface SocialShareMetadata {
  title: string;
  description: string;
  imageUrl: string | null;
  canonicalUrl: string;
}

export type SocialCommentStatus = 'PENDING_MODERATION' | 'PUBLISHED' | 'HIDDEN' | 'REMOVED' | 'DELETED';

export interface SocialCommentView {
  id: string;
  author: SocialUserCard | null;
  character: SocialCharacterRef | null;
  attribution: SocialContentAttribution;
  parentId: string | null;
  body: string | null;
  status: SocialCommentStatus;
  replyCount: number;
  isOwner: boolean;
  canEdit: boolean;
  isEdited: boolean;
  createdAt: string;
}

export type SocialMessageRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'BLOCKED' | 'EXPIRED';
export type SocialDirectMessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'DELETED' | 'MODERATED';

export interface SocialMessageRequestView {
  id: string;
  from: SocialUserCard;
  to: SocialUserCard;
  preview: string | null;
  status: SocialMessageRequestStatus;
  expiresAt: string;
  createdAt: string;
}

export interface SocialThreadView {
  id: string;
  status: 'REQUESTED' | 'ACTIVE' | 'CLOSED';
  counterpart: SocialUserCard;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
}

export interface SocialDirectMessageView {
  id: string;
  clientMessageId: string;
  isMine: boolean;
  body: string | null;
  /** Automated checks flagged this message: clients show a tap-to-view safety interstitial. */
  isFlagged: boolean;
  attachments: Array<{ id: string; mimeType: string; sizeBytes: number; url: string | null }>;
  status: SocialDirectMessageStatus;
  createdAt: string;
}

export type CommunityPrivacy = 'PUBLIC' | 'DISCOVERABLE_PRIVATE' | 'INVITE_ONLY';
export type CommunityRole = 'OWNER' | 'MODERATOR' | 'MEMBER';
export type CommunityMemberStatus = 'ACTIVE' | 'INVITED' | 'PENDING' | 'MUTED' | 'BANNED' | 'LEFT';

export interface CommunityView {
  slug: string;
  name: string;
  description: string;
  rules: string[];
  privacy: CommunityPrivacy;
  status: string;
  memberCount: number;
  character: SocialCharacterRef | null;
  viewerMembership: { role: CommunityRole; status: CommunityMemberStatus } | null;
  /** False when the viewer can see that the community exists but not its content. */
  canViewContent: boolean;
  createdAt: string;
}

export interface CommunityMemberView {
  user: SocialUserCard;
  role: CommunityRole;
  status: CommunityMemberStatus;
  joinedAt: string;
}

export interface CharacterSocialCapabilities {
  characterSlug: string;
  canPublish: boolean;
  canReply: boolean;
  canComment: boolean;
  canReact: boolean;
  canSendNotifications: boolean;
  canMentionUsers: boolean;
  /** Always false in the effective view: character-initiated DMs are platform-prohibited. */
  canMessageUsers: false;
  requiresCreatorApproval: boolean;
  maxPostsPerDay: number;
  maxRepliesPerHour: number;
  maxInteractionsPerUserPerDay: number;
  maxDailyCostCents: number;
  cooldownSeconds: number;
  platformApproved: boolean;
  version: number;
}

export interface CharacterFollowState {
  characterSlug: string;
  following: boolean;
  notificationsEnabled: boolean;
  followerCount: number;
}

export type SocialFeedTab = 'FOR_YOU' | 'FOLLOWING';

export interface SocialFeedItem {
  content: SocialContentView;
  /** Why this item is shown (transparency), e.g. FOLLOWED_CREATOR, FOLLOWED_CHARACTER, COMMUNITY, EDITORIAL. */
  reason: string;
  rankPosition: number;
}

export interface SocialFeedPage {
  items: SocialFeedItem[];
  nextCursor: string | null;
  /** True when ranking failed and a chronological fallback was served. */
  degraded: boolean;
}

export type SocialReportTargetType =
  | 'PROFILE'
  | 'CHARACTER'
  | 'CONTENT'
  | 'COMMENT'
  | 'DIRECT_MESSAGE'
  | 'COMMUNITY'
  | 'CREATOR';

export interface SocialReportReceipt {
  reportId: string;
  status: 'RECEIVED';
  /** True when this reporter had already reported the same target (deduplicated). */
  duplicate: boolean;
}

export type SocialAppealStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'UPHELD' | 'REVERSED' | 'EXPIRED';

/** What a user is told about an enforcement — never the internal anti-abuse logic. */
export interface SocialEnforcementNotice {
  caseId: string;
  what: string;
  feature: string | null;
  until: string | null;
  canAppeal: boolean;
  appealStatus: SocialAppealStatus | null;
}

export interface SocialConsentItem {
  consentType: string;
  granted: boolean;
  policyVersion: string;
  updatedAt: string | null;
}

export interface SocialFeatureAvailability {
  features: Record<string, boolean>;
  policyVersion: number;
}

export interface SocialSimulationStep {
  check: string;
  passed: boolean;
  detail: string;
}

export interface SocialSimulationResult {
  action: string;
  allowed: boolean;
  decision: SocialSafetyDecision;
  steps: SocialSimulationStep[];
}

export interface SocialPolicyVersionItem {
  version: number;
  isActive: boolean;
  changeReason: string;
  authorAdminId: string | null;
  rolledBackFrom: number | null;
  diff: Record<string, unknown> | null;
  effectiveAt: string;
}

export interface SocialModerationCaseItem {
  id: string;
  targetType: SocialReportTargetType;
  targetId: string;
  queue: string;
  status: string;
  severity: string;
  priorityScore: number;
  reportCount: number;
  uniqueReporterCount: number;
  reasonCounts: Record<string, number>;
  automatedSignals: Record<string, unknown> | null;
  reach: number;
  decision: string | null;
  firstReportedAt: string | null;
  lastReportedAt: string | null;
  createdAt: string;
}

export interface SocialOverviewMetrics {
  windowDays: number;
  socialProfiles: number;
  activeSocialUsers: number;
  follows: number;
  characterFollows: number;
  blocks: number;
  mutes: number;
  shares: number;
  comments: number;
  reactions: number;
  messageRequests: number;
  messagesSent: number;
  communities: number;
  reports: number;
  openCases: number;
  moderationActions: number;
  aiSocialActionsAllowed: number;
  aiSocialActionsDenied: number;
  /** Safety guardrails — first-class alongside engagement. */
  reportRatePer1kContent: number;
  blockRatePer1kFollows: number;
  contentRejectionRate: number;
}

// =============================================================================
// PHASE 25: ADVANCED CHARACTER INTELLIGENCE, GOALS, SKILLS & EXPERIENCES
// =============================================================================

export type UserGoalStatus =
  | 'created'
  | 'active'
  | 'paused'
  | 'blocked'
  | 'awaiting_input'
  | 'awaiting_confirmation'
  | 'executing'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'failed';

export interface UserGoalItem {
  id: string;
  userId: string;
  characterId?: string | null;
  conversationId?: string | null;
  category: string;
  title: string;
  status: UserGoalStatus;
  priority: number;
  progress: number;
  constraints?: Record<string, unknown> | null;
  activeTaskId?: string | null;
  metadata?: Record<string, unknown> | null;
  lastActiveAt: string;
  createdAt: string;
  updatedAt: string;
}

export type IntentType =
  | 'casual_conversation'
  | 'question'
  | 'advice'
  | 'planning'
  | 'task_request'
  | 'information_lookup'
  | 'creative'
  | 'emotional_support'
  | 'media_understanding'
  | 'external_action'
  | 'social_action'
  | 'reminder'
  | 'long_running_task'
  | 'unknown';

export interface DetectedIntent {
  intent: IntentType;
  confidence: number;
  source: 'rule_heuristic' | 'semantic_model' | 'fallback';
  category?: string;
  extractedEntities?: Record<string, unknown>;
  timestamp: string;
}

export interface CharacterExperienceItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  characterId?: string | null;
  creatorId?: string | null;
  goalTemplate: string;
  requiredSkillSlugs: string[];
  initialPrompt: string;
  uiConfig?: Record<string, unknown> | null;
  evaluationCriteria?: Record<string, unknown> | null;
  status: 'draft' | 'published' | 'archived';
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterRuntimeSnapshotItem {
  id: string;
  conversationId: string;
  messageId?: string | null;
  characterId: string;
  characterVersionId: string;
  promptVersion: string;
  behaviorPolicyHash: string;
  safetyPolicyVersion: string;
  modelId: string;
  memoryIds: string[];
  relationshipStage?: string | null;
  activeGoalId?: string | null;
  activeTaskId?: string | null;
  selectedSkillSlugs: string[];
  contextAttribution?: Record<string, unknown> | null;
  tokensPrompt: number;
  tokensCompletion: number;
  costUsd: number;
  createdAt: string;
}

export interface TaskCheckpointItem {
  id: string;
  taskId: string;
  stepIndex: number;
  stepId: string;
  stateSnapshot: Record<string, unknown>;
  accumulatedOutput?: unknown;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Phase 26: Production Knowledge, RAG, Web Research & Grounded Citations
// ---------------------------------------------------------------------------

export type KnowledgeSourceType =
  | 'CHARACTER_KNOWLEDGE'
  | 'CREATOR_KNOWLEDGE'
  | 'PLATFORM_KNOWLEDGE'
  | 'USER_KNOWLEDGE'
  | 'USER_DOCUMENT'
  | 'CONVERSATION_CONTEXT'
  | 'MEMORY'
  | 'EXTERNAL_SOURCE'
  | 'WEB_SOURCE'
  | 'TOOL_RESULT';

export type KnowledgeDocumentStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'INDEXED'
  | 'FAILED'
  | 'RESTRICTED'
  | 'DELETED';

export type KnowledgeVisibility =
  | 'PRIVATE'
  | 'SHARED'
  | 'CHARACTER_ACCESSIBLE'
  | 'TASK_ONLY'
  | 'PUBLIC';

export interface KnowledgeDocumentItem {
  id: string;
  ownerId: string;
  ownerType: 'USER' | 'CREATOR' | 'PLATFORM';
  characterId?: string | null;
  title: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  storageUrl?: string | null;
  contentHash: string;
  status: KnowledgeDocumentStatus;
  failureReason?: string | null;
  currentVersion: number;
  totalChunks: number;
  totalTokens: number;
  pageCount: number;
  visibility: KnowledgeVisibility;
  collectionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunkItem {
  id: string;
  documentId: string;
  versionNumber: number;
  chunkIndex: number;
  content: string;
  pageNumber?: number | null;
  sectionHeading?: string | null;
  sourceOffset?: number | null;
  tokenCount: number;
  contentHash: string;
  score?: number;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface KnowledgeCollectionItem {
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  visibility: KnowledgeVisibility;
  documentCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type WebResearchStatus =
  | 'INITIATED'
  | 'SEARCHING'
  | 'EXTRACTING'
  | 'SYNTHESIZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type SourceFreshnessPolicy =
  | 'ALWAYS_FRESH'
  | 'HOURLY'
  | 'DAILY'
  | 'STABLE';

export interface WebSourceItem {
  id: string;
  researchTaskId?: string | null;
  url: string;
  domain: string;
  title: string;
  publisher?: string | null;
  contentSnippet: string;
  contentHash: string;
  publishedAt?: string | null;
  retrievedAt: string;
  credibilityScore?: number | null;
  isAccessible: boolean;
}

export interface WebResearchTaskItem {
  id: string;
  userId: string;
  conversationId?: string | null;
  query: string;
  status: WebResearchStatus;
  freshnessPolicy: SourceFreshnessPolicy;
  sourceCount: number;
  costUsd: number;
  summary?: string | null;
  sources?: WebSourceItem[];
  findings?: Record<string, unknown> | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface CitationItem {
  id: string;
  messageId?: string | null;
  generationId?: string | null;
  sourceType: KnowledgeSourceType;
  documentId?: string | null;
  chunkId?: string | null;
  webSourceId?: string | null;
  url?: string | null;
  title: string;
  pageNumber?: number | null;
  sectionHeading?: string | null;
  exactQuote?: string | null;
  createdAt: string;
}

export interface HybridSearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  pageNumber?: number | null;
  sectionHeading?: string | null;
  semanticScore: number;
  lexicalScore: number;
  compositeScore: number;
  sourceType: KnowledgeSourceType;
  ownerId: string;
  metadata?: Record<string, unknown> | null;
}

export interface GroundedAnswerResult {
  answer: string;
  groundedness: 'SUPPORTED' | 'INFERRED' | 'UNKNOWN';
  citations: CitationItem[];
  sourcesUsedCount: number;
  hasContradictions: boolean;
  contradictionNotes?: string | null;
}

// =============================================================================
// PHASE 27: CHARACTER SIMULATION, PERSISTENT GOALS, ROUTINES & CONTINUITY
// =============================================================================

export type ObjectiveOwner = 'CHARACTER' | 'USER' | 'SHARED' | 'SYSTEM';

export type GoalStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'ABANDONED'
  | 'EXPIRED'
  | 'CANCELLED';

export type ProgressType =
  | 'BINARY'
  | 'PERCENTAGE'
  | 'COUNT'
  | 'MILESTONE'
  | 'QUALITATIVE';

export type QualitativeProgress =
  | 'NOT_STARTED'
  | 'EARLY'
  | 'DEVELOPING'
  | 'ADVANCED'
  | 'NEAR_COMPLETE'
  | 'COMPLETE';

export interface CharacterGoalMilestoneItem {
  id: string;
  goalId: string;
  title: string;
  orderIndex: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  completedAt?: string | null;
  tasks?: CharacterGoalTaskItem[];
  createdAt: string;
}

export interface CharacterGoalTaskItem {
  id: string;
  goalId: string;
  milestoneId?: string | null;
  title: string;
  description?: string | null;
  assignedTo: 'CHARACTER' | 'USER' | 'SHARED';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  completedAt?: string | null;
  createdAt: string;
}

export interface CharacterGoalItem {
  id: string;
  characterId: string;
  characterVersionId?: string | null;
  userId: string;
  owner: ObjectiveOwner;
  category: string;
  title: string;
  description?: string | null;
  priority: number;
  status: GoalStatus;
  progress: number;
  progressType: ProgressType;
  qualitativeProgress?: QualitativeProgress | null;
  startAt: string;
  dueAt?: string | null;
  lastProgressAt?: string | null;
  completedAt?: string | null;
  abandonedAt?: string | null;
  source?: string | null;
  confidence: number;
  constraints?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  milestones?: CharacterGoalMilestoneItem[];
  tasks?: CharacterGoalTaskItem[];
  createdAt: string;
  updatedAt: string;
}

export type RoutineType =
  | 'TIME_BASED'
  | 'EVENT_BASED'
  | 'CONVERSATION_BASED'
  | 'RELATIONSHIP_BASED'
  | 'GOAL_BASED'
  | 'CONTEXT_BASED';

export interface CharacterRoutineItem {
  id: string;
  characterId: string;
  characterVersionId?: string | null;
  name: string;
  description?: string | null;
  routineType: RoutineType;
  scheduleCron?: string | null;
  timezonePolicy: string;
  frequencyLimitPerDay: number;
  cooldownMinutes: number;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  priority: number;
  active: boolean;
  constraints?: Record<string, unknown> | null;
  lastTriggeredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ThreadStatus =
  | 'OPEN'
  | 'WAITING_FOR_USER'
  | 'WAITING_FOR_SYSTEM'
  | 'RESOLVED'
  | 'EXPIRED'
  | 'DISMISSED';

export interface OpenConversationalThreadItem {
  id: string;
  userId: string;
  characterId: string;
  conversationId?: string | null;
  topic: string;
  contextSnippet?: string | null;
  status: ThreadStatus;
  priority: number;
  sourceMessageId?: string | null;
  expiresAt: string;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CommitmentStatus = 'PENDING' | 'FULFILLED' | 'EXPIRED' | 'CANCELLED';

export interface CharacterCommitmentItem {
  id: string;
  userId: string;
  characterId: string;
  conversationId?: string | null;
  commitmentType: string;
  description: string;
  sourceMessageId?: string | null;
  status: CommitmentStatus;
  maxAttempts: number;
  attemptsMade: number;
  expiresAt: string;
  fulfilledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type BehaviorMode =
  | 'curious'
  | 'supportive'
  | 'playful'
  | 'reflective'
  | 'focused'
  | 'quiet'
  | 'energetic';

export interface CharacterSimulationStateItem {
  id: string;
  userId: string;
  characterId: string;
  version: number;
  currentFocus?: string | null;
  behaviorMode: BehaviorMode;
  behaviorReason?: string | null;
  behaviorExpiresAt?: string | null;
  initiativeLevel: 'OFF' | 'LOW' | 'BALANCED' | 'HIGH';
  lastSimulationAt?: string | null;
  nextEligibleSimulationAt?: string | null;
  metadata?: Record<string, unknown> | null;
  updatedAt: string;
}

export type SimulationProposalType =
  | 'CREATE_GOAL'
  | 'UPDATE_GOAL'
  | 'COMPLETE_GOAL'
  | 'PAUSE_GOAL'
  | 'CREATE_PLAN'
  | 'ADVANCE_PLAN'
  | 'UPDATE_WORLD_STATE'
  | 'CREATE_THREAD'
  | 'RESOLVE_THREAD'
  | 'CREATE_COMMITMENT'
  | 'UPDATE_COMMITMENT'
  | 'SUGGEST_BEHAVIOR_MODE'
  | 'SUGGEST_PROACTIVE_MESSAGE'
  | 'REQUEST_KNOWLEDGE'
  | 'REQUEST_TOOL'
  | 'SCHEDULE_FOLLOWUP'
  | 'NO_ACTION';

export interface SimulationProposalItem {
  type: SimulationProposalType;
  payload: Record<string, unknown>;
  reason: string;
  confidence: number;
  evidence?: string | null;
  risk?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface SimulationRunItem {
  id: string;
  userId: string;
  characterId: string;
  characterVersionId?: string | null;
  triggerType: string;
  triggerEventId?: string | null;
  status: 'RUNNING' | 'COMPLETED' | 'NO_ACTION' | 'FAILED';
  modelId?: string | null;
  promptVersion?: string | null;
  contextHash?: string | null;
  outputHash?: string | null;
  proposalsCount: number;
  acceptedProposalsCount: number;
  costUsd: number;
  latencyMs: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface CharacterContinuityContext {
  activeGoals: CharacterGoalItem[];
  openThreads: OpenConversationalThreadItem[];
  activeCommitments: CharacterCommitmentItem[];
  behaviorMode: BehaviorMode;
  currentFocus?: string | null;
  continuityPromptSnippet: string;
}

// =============================================================================
// PHASE 30: ADVANCED CHARACTER SIMULATION, PLANS, WORLD STATE & PERSISTENT CONTINUITY
// =============================================================================

export type PlanStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type PlanStepStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

export interface CharacterPlanStepItem {
  id: string;
  planId: string;
  sequence: number;
  title: string;
  description?: string | null;
  status: PlanStepStatus;
  dependencies: Array<string | number>;
  completionCriteria?: string | null;
  estimatedEffort?: string | null;
  output?: Record<string, unknown> | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterPlanItem {
  id: string;
  characterId: string;
  userId: string;
  characterVersionId?: string | null;
  goalId?: string | null;
  title: string;
  description?: string | null;
  status: PlanStatus;
  currentStepIndex: number;
  version: number;
  expiresAt?: string | null;
  completedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  steps?: CharacterPlanStepItem[];
  createdAt: string;
  updatedAt: string;
}

export type WorldEntityType =
  | 'SETTING'
  | 'STORY_ARC'
  | 'ACTIVE_PROJECT'
  | 'FACTION'
  | 'ITEM'
  | 'RELATIONSHIP_MILESTONE'
  | 'CUSTOM';

export interface CharacterWorldStateItem {
  id: string;
  characterId: string;
  userId?: string | null;
  characterVersionId?: string | null;
  entityKey: string;
  entityType: WorldEntityType;
  stateValue: Record<string, unknown>;
  version: number;
  lastEventId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type WorldStateEventType =
  | 'PROJECT_STARTED'
  | 'PROJECT_PROGRESS_UPDATED'
  | 'PROJECT_COMPLETED'
  | 'LOCATION_CHANGED'
  | 'FICTIONAL_EVENT_OCCURRED'
  | 'ROUTINE_COMPLETED'
  | 'PLAN_ADVANCED'
  | 'CUSTOM_EVENT';

export interface CharacterWorldStateEventItem {
  id: string;
  characterId: string;
  userId?: string | null;
  characterVersionId?: string | null;
  eventType: WorldStateEventType;
  entityKey: string;
  delta: Record<string, unknown>;
  source: string;
  version: number;
  createdAt: string;
}

export type SimulationEventSource =
  | 'USER_MESSAGE'
  | 'SYSTEM_EVENT'
  | 'ROUTINE'
  | 'GOAL'
  | 'PLAN'
  | 'TOOL_RESULT'
  | 'KNOWLEDGE_EVENT'
  | 'CREATOR_CONFIG'
  | 'ADMIN_ACTION'
  | 'USER_ACTION';

export interface CharacterSimulationEventItem {
  id: string;
  characterId: string;
  userId?: string | null;
  characterVersionId?: string | null;
  eventType: string;
  source: SimulationEventSource;
  payload: Record<string, unknown>;
  stateVersion: number;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
}

export type AutonomyLevel =
  | 'PASSIVE'
  | 'CONTEXTUAL'
  | 'PROACTIVE'
  | 'TASK_ORIENTED';

export interface UserSimulationSettingsItem {
  id: string;
  userId: string;
  characterId: string;
  enabled: boolean;
  autonomyLevel: AutonomyLevel;
  proactiveEnabled: boolean;
  routinesEnabled: boolean;
  remindersEnabled: boolean;
  plansEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  userTimezone: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeContextDTO {
  currentTime: string;
  timezone: string;
  localDate: string;
  dayOfWeek: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  elapsedSinceLastInteractionSeconds?: number | null;
}

export interface SimulationContextPack {
  activeGoals: CharacterGoalItem[];
  relevantPlans: CharacterPlanItem[];
  dueRoutines: CharacterRoutineItem[];
  activeCommitments: CharacterCommitmentItem[];
  recentWorldEvents: CharacterWorldStateEventItem[];
  timeContext: TimeContextDTO;
  behaviorMode: BehaviorMode;
  currentFocus?: string | null;
  continuityPromptSnippet: string;
}

export interface SimulationConflictItem {
  id: string;
  conflictType: 'STATE_VS_MESSAGE' | 'STATE_VS_MEMORY' | 'STATE_VS_CREATOR' | 'VERSION_MISMATCH';
  sourceA: { type: string; value: unknown };
  sourceB: { type: string; value: unknown };
  resolvedValue: unknown;
  reason: string;
  resolvedAt: string;
}

export interface SimulationMigrationResultDTO {
  characterId: string;
  oldVersionId: string;
  newVersionId: string;
  goalsMigrated: number;
  plansMigrated: number;
  routinesMigrated: number;
  worldStateMigrated: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  incompatibleItems?: Array<{ type: string; id: string; reason: string }>;
  migratedAt: string;
}

export interface SimulationReplayDTO {
  simulationRunId: string;
  characterId: string;
  userId: string;
  originalRun: SimulationRunItem;
  replayedProposals: SimulationProposalItem[];
  isDeterministicMatch: boolean;
  discrepancies?: string[];
  replayedAt: string;
}

export interface SimulationKillSwitchesDTO {
  disableCharacterSimulation: boolean;
  disableCharacterRoutines: boolean;
  disableSimulationProactive: boolean;
  disableLongHorizonGoals: boolean;
  disableSimulationModelCalls: boolean;
  updatedAt: string;
  updatedBy: string;
}

// =============================================================================
// PHASE 28: DEVELOPER PLATFORM, PUBLIC APIS, SDK, OAUTH & WEBHOOKS
// =============================================================================

export type OrgRole = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'BILLING' | 'ANALYST' | 'READ_ONLY';
export type DeveloperTier = 'FREE' | 'BUILDER' | 'SCALE' | 'ENTERPRISE';
export type ProjectEnvironment = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
export type ProjectStatus = 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED';

export interface DeveloperOrganizationItem {
  id: string;
  name: string;
  slug: string;
  billingEmail: string;
  tier: DeveloperTier;
  monthlyBudgetUsd?: number | null;
  spendAlertThresholds: number[];
  hardLimitEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeveloperOrgMemberItem {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
  updatedAt: string;
}

export interface DeveloperProjectItem {
  id: string;
  organizationId?: string | null;
  userId: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  environment: ProjectEnvironment;
  allowedOrigins: string[];
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export type ApiKeyType = 'PUBLIC' | 'SERVER' | 'ADMIN';

export interface DeveloperApiKeyItem {
  id: string;
  projectId: string;
  name: string;
  keyPrefix: string;
  keyType: ApiKeyType;
  scopes: string[];
  environment: ProjectEnvironment;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedApiKeyResult extends DeveloperApiKeyItem {
  secretKey: string; // Plaintext secret returned ONCE at creation time
}

export interface OAuthApplicationItem {
  id: string;
  projectId: string;
  name: string;
  clientId: string;
  redirectUris: string[];
  allowedScopes: string[];
  isPublicClient: boolean;
  clientType: string;
  logoUrl?: string | null;
  privacyPolicyUrl?: string | null;
  termsUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthConsentItem {
  id: string;
  applicationId: string;
  userId: string;
  grantedScopes: string[];
  consentedAt: string;
  revokedAt?: string | null;
}

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken?: string | null;
  tokenType: 'Bearer';
  expiresIn: number;
  scope: string;
  access_token?: string;
  refresh_token?: string | null;
  token_type?: string;
  expires_in?: number;
}

export interface WebhookEndpointItem {
  id: string;
  projectId: string;
  url: string;
  secret: string;
  description?: string | null;
  eventTypes: string[];
  environment: ProjectEnvironment;
  active: boolean;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export type WebhookDeliveryStatus =
  | 'PENDING'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'RETRYING'
  | 'FAILED'
  | 'EXPIRED';

export interface WebhookDeliveryItem {
  id: string;
  endpointId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  statusCode?: number | null;
  responseBody?: string | null;
  durationMs?: number | null;
  attemptNumber: number;
  nextRetryAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
}

export interface DeveloperUsageRecordItem {
  id: string;
  projectId: string;
  metric: string;
  quantity: number;
  costUsd: number;
  modelId?: string | null;
  endpoint?: string | null;
  environment: ProjectEnvironment;
  idempotencyKey?: string | null;
  timestamp: string;
  createdAt: string;
}

export interface DeveloperEmbedConfigItem {
  id: string;
  projectId: string;
  characterId: string;
  originAllowlist: string[];
  theme?: Record<string, unknown> | null;
  features?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCharacterDTO {
  id: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  avatarUrl?: string | null;
  category?: string;
  tags?: string[];
  isNsfw?: boolean;
  totalConversations?: number;
  totalMessages?: number;
  supportedCapabilities?: string[];
  createdAt: string;
  updatedAt?: string;
  version?: number;
  voiceId?: string | null;
}

export interface PublicConversationDTO {
  id: string;
  characterId: string;
  userId?: string;
  title?: string | null;
  status: string;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicMessageDTO {
  id: string;
  conversationId: string;
  senderType?: 'USER' | 'CHARACTER' | 'SYSTEM' | string;
  role?: 'user' | 'assistant' | 'system';
  content: string;
  status?: string;
  mediaUrl?: string | null;
  audioDurationSeconds?: number | null;
  createdAt: string;
}

export type PublicStreamEventType =
  | 'message.started'
  | 'message.delta'
  | 'message.completed'
  | 'message.failed'
  | 'message.cancelled';

export interface PublicStreamPayload {
  event: PublicStreamEventType;
  data: {
    messageId?: string;
    conversationId?: string;
    characterId?: string;
    delta?: string;
    content?: string;
    error?: {
      code: string;
      message: string;
    };
    finishReason?: string;
  };
}


