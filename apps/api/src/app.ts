import express, { Express } from 'express';
import './shared/utils/expressAsyncErrors.js';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { correlationIdMiddleware } from './shared/middleware/correlationId.js';
import { requestLoggerMiddleware } from './shared/middleware/requestLogger.js';
import { idempotencyMiddleware } from './shared/middleware/idempotency.js';
import { DeadlineManager } from './infrastructure/resilience/Deadline.js';
import { errorHandler } from './shared/middleware/errorHandler.js';
import { standardRateLimiter } from './shared/middleware/rateLimiter.js';
import { NotFoundError } from './shared/errors/AppError.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { characterRouter } from './modules/characters/routes/character.routes.js';
import { adminCharacterRouter } from './modules/characters/routes/adminCharacter.routes.js';
import { conversationRouter } from './modules/conversations/routes/conversation.routes.js';
import { memoryRouter } from './modules/memory/routes/memory.routes.js';
import { adminMemoryRouter } from './modules/memory/routes/adminMemory.routes.js';
import { relationshipRouter, adminRelationshipRouter } from './modules/relationships/index.js';
import {
  notificationRouter,
  adminProactivityRouter,
  adminNotificationRouter,
} from './modules/notifications/index.js';
import { adminAIRouter, adminEvaluationRouter, feedbackRouter } from './modules/ai/index.js';
import { voiceRoutes, adminVoiceRoutes } from './modules/voice/index.js';
import { billingRouter, adminBillingRouter } from './modules/billing/index.js';
import { homeRouter, discoveryRouter, searchRouter, adminDiscoveryRouter } from './modules/discovery/index.js';

import {
  bootstrapRoutes,
  onboardingRoutes,
  preferencesRoutes,
  adminOnboardingRoutes,
} from './modules/onboarding/index.js';
import { creatorRouter } from './modules/creators/index.js';
import { moderationRouter, adminModerationRouter } from './modules/moderation/index.js';
import { safetyRouter } from './modules/safety/routes/safetyRouter.js';
import { adminSafetyRouter } from './modules/safety/routes/adminSafetyRouter.js';
import { privacyRouter } from './modules/privacy/routes/privacyRouter.js';
import { adminPrivacyRouter } from './modules/privacy/routes/adminPrivacyRouter.js';
import { analyticsRouter } from './modules/analytics/routes/analyticsRouter.js';
import { adminAnalyticsRouter } from './modules/analytics/routes/adminAnalyticsRouter.js';
import { operationsRouter, adminOperationsRouter } from './modules/operations/index.js';
import { intelligenceRouter, adminIntelligenceRouter } from './modules/intelligence/index.js';
import { agentsRouter, adminAgentsRouter } from './modules/agents/index.js';
import { socialRouter, adminSocialRouter } from './modules/social/index.js';
import { knowledgeRouter, adminKnowledgeRouter } from './modules/knowledge/knowledge.routes.js';
import { simulationRouter, adminSimulationRouter } from './modules/character-simulation/simulation.routes.js';
import { publicApiRouter, developerConsoleRouter, oauthRouter, adminDeveloperPlatformRouter } from './modules/developer-platform/index.js';

export const createApp = (): Express => {
  const app = express();

  // Security headers & CORS
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map(o => o.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'x-correlation-id',
        'x-request-id',
        'x-idempotency-key',
        'Idempotency-Key',
        'x-client-platform',
        'x-app-version',
      ],
    }),
  );

  // Cookie parser for web admin sessions
  app.use(cookieParser());

  // Body parsers
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Tracing, Request Logging & Request Deadlines
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(DeadlineManager.requestDeadlineMiddleware(30000));
  app.use(idempotencyMiddleware(86400));

  // Global Rate Limiting
  app.use(standardRateLimiter);

  // Root and Health Routes
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      message: 'AI Companion Platform API',
      version: '0.1.0',
      status: 'online',
      endpoints: {
        health: '/api/v1/health',
        apiPrefix: env.API_PREFIX,
        adminStudio: 'http://localhost:3001',
      },
    });
  });
  app.use('/health', healthRoutes);
  app.use(`${env.API_PREFIX}/health`, healthRoutes);

  // Phase 2 Identity, Auth & Admin Routes
  app.use(`${env.API_PREFIX}/auth`, authRouter);
  app.use(`${env.API_PREFIX}/users`, usersRouter);
  app.use(`${env.API_PREFIX}/admin`, adminRouter);

  // Phase 3 AI Character Engine Routes
  app.use(`${env.API_PREFIX}/characters`, characterRouter);
  app.use(`${env.API_PREFIX}/admin/characters`, adminCharacterRouter);

  // Phase 4 Conversation & Real-Time Streaming Chat Routes
  app.use(`${env.API_PREFIX}/conversations`, conversationRouter);

  // Phase 5 Memory & Context Intelligence Engine Routes
  app.use(`${env.API_PREFIX}/memories`, memoryRouter);
  app.use(`${env.API_PREFIX}/settings/memory`, memoryRouter);
  app.use(`${env.API_PREFIX}/admin/memories`, adminMemoryRouter);

  // Phase 6 Relationship & Emotional State Engine Routes
  app.use(`${env.API_PREFIX}/relationships`, relationshipRouter);
  app.use(`${env.API_PREFIX}/admin/relationships`, adminRelationshipRouter);

  // Phase 7 & 14 Proactive AI, Notifications & Campaign Intelligence Routes
  app.use(`${env.API_PREFIX}/notifications`, notificationRouter);
  app.use(`${env.API_PREFIX}/admin/proactivity`, adminProactivityRouter);
  app.use(`${env.API_PREFIX}/admin/notifications`, adminNotificationRouter);

  // Phase 8 AI Quality, Model Routing, Evaluation Lab & Feedback Routes
  app.use(`${env.API_PREFIX}/feedback`, feedbackRouter);
  app.use(`${env.API_PREFIX}/admin/ai`, adminAIRouter);
  app.use(`${env.API_PREFIX}/admin/evaluation`, adminEvaluationRouter);

  // Phase 9 Voice Conversation & Real-Time Audio Infrastructure Routes
  app.use(`${env.API_PREFIX}/voice`, voiceRoutes);
  app.use(`${env.API_PREFIX}/admin/voice`, adminVoiceRoutes);

  // Phase 11 Monetization, Subscriptions, Credits, Entitlements & Billing Routes
  app.use(`${env.API_PREFIX}/billing`, billingRouter);
  app.use(`${env.API_PREFIX}/admin/billing`, adminBillingRouter);

  // Phase 12 & Phase 18 Production Home, Discovery, Character Catalog, Search & Recommendations Routes
  app.use(`${env.API_PREFIX}/home`, homeRouter);
  app.use(`${env.API_PREFIX}/discovery`, discoveryRouter);
  app.use(`${env.API_PREFIX}/search`, searchRouter);
  app.use(`${env.API_PREFIX}/admin/discovery`, adminDiscoveryRouter);


  // Phase 13 Onboarding, Bootstrap, User Preferences & Growth Analytics Routes
  app.use(`${env.API_PREFIX}/bootstrap`, bootstrapRoutes);
  app.use(`${env.API_PREFIX}/onboarding`, onboardingRoutes);
  app.use(`${env.API_PREFIX}/preferences`, preferencesRoutes);
  app.use(`${env.API_PREFIX}/admin/onboarding`, adminOnboardingRoutes);

  // Phase 15 Creator Platform, User-Generated Characters & Moderation Routes
  app.use(`${env.API_PREFIX}/creators`, creatorRouter);
  app.use(`${env.API_PREFIX}/moderation`, moderationRouter);
  app.use(`${env.API_PREFIX}/admin/moderation`, adminModerationRouter);

  // Phase 16 Safety, Trust, Privacy & Platform Governance Routes
  app.use(`${env.API_PREFIX}/safety`, safetyRouter);
  app.use(`${env.API_PREFIX}/privacy`, privacyRouter);
  app.use(`${env.API_PREFIX}/admin/safety`, adminSafetyRouter);
  app.use(`${env.API_PREFIX}/admin/privacy`, adminPrivacyRouter);

  // Phase 17 Analytics, Growth, Experimentation, AI Economics & Command Center Routes
  app.use(`${env.API_PREFIX}/analytics`, analyticsRouter);
  app.use(`${env.API_PREFIX}/admin/analytics`, adminAnalyticsRouter);

  // Phase 21 Production Launch Operations, Beta, Support & Incident Command Routes
  app.use(`${env.API_PREFIX}/operations`, operationsRouter);
  app.use(`${env.API_PREFIX}/admin/operations`, adminOperationsRouter);
  app.use('/status', operationsRouter); // Top-level status endpoint alias

  // Phase 22 Production Intelligence, AI Quality, Personalization & Continuous Learning Routes
  app.use(`${env.API_PREFIX}/personalization`, intelligenceRouter);
  app.use(`${env.API_PREFIX}/intelligence`, intelligenceRouter);
  app.use(`${env.API_PREFIX}/admin/intelligence`, adminIntelligenceRouter);

  // Phase 23 Advanced Agent & Tool Orchestration Routes
  app.use(`${env.API_PREFIX}/agents`, agentsRouter);
  app.use(`${env.API_PREFIX}/admin/agents`, adminAgentsRouter);

  // Phase 24 Advanced Social & Communication Layer Routes
  app.use(`${env.API_PREFIX}/social`, socialRouter);
  app.use(`${env.API_PREFIX}/admin/social`, adminSocialRouter);

  // Phase 26 Production Knowledge, RAG, Web Research & Grounded Intelligence Routes
  app.use(`${env.API_PREFIX}/knowledge`, knowledgeRouter);
  app.use(`${env.API_PREFIX}/admin/knowledge`, adminKnowledgeRouter);

  // Phase 27 Advanced Character Simulation, Goals, Routines & Long-Horizon Behavior Routes
  app.use(`${env.API_PREFIX}/simulation`, simulationRouter);
  app.use(`${env.API_PREFIX}/admin/simulation`, adminSimulationRouter);

  // Phase 28 Developer Platform, Public API, SDK, Webhooks & Extensibility Routes
  app.use('/v1', publicApiRouter);
  app.use('/oauth', oauthRouter);
  app.use(`${env.API_PREFIX}/oauth`, oauthRouter);
  app.use(`${env.API_PREFIX}/developers`, developerConsoleRouter);
  app.use(`${env.API_PREFIX}/admin/developer-platform`, adminDeveloperPlatformRouter);

  // 404 Route Catch-All
  app.use('*', (req, _res, next) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // Central Error Handler
  app.use(errorHandler);

  return app;
};

