import { prisma } from '../../../infrastructure/database/prisma.js';
import { AppError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import { EntitlementService } from '../../billing/entitlements/EntitlementService.js';
import { OnboardingService } from './OnboardingService.js';
import { ActivationFunnelService } from './ActivationFunnelService.js';
import type { BootstrapResponseData, ConversationStyle, OnboardingStatus, OnboardingStepKey } from '@ai-companion/types';

export class BootstrapService {
  /**
   * Fast, unified bootstrap initialization endpoint for mobile client boot.
   */
  public static async getBootstrapData(userId: string): Promise<BootstrapResponseData> {
    const user = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      include: {
        profile: true,
        discoveryPreferences: true,
      },
    });

    if (!user || !user.profile) {
      throw new AppError('User profile not found', 404, ErrorCode.NOT_FOUND);
    }

    // 1. Resolve Effective Entitlements & Starter Characters concurrently
    const [effectiveEntitlementsRes, starterCompanions] = await Promise.all([
      EntitlementService.getEffectiveEntitlements(userId).catch(() => null),
      OnboardingService.getStarterCharacters(userId).catch(() => []),
    ]);

    const entitlementKeys = effectiveEntitlementsRes?.entitlements
      ? Object.keys(effectiveEntitlementsRes.entitlements)
      : [];

    // 2. Record Return Visit for retention tracking
    ActivationFunnelService.recordUserReturnVisit(userId).catch(() => {});

    // 3. Assemble compact response
    return {
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        emailVerified: !!user.emailVerifiedAt,
      },
      profile: {
        id: user.profile.id,
        displayName: user.profile.displayName,
        username: user.profile.username,
        avatarUrl: user.profile.avatarUrl,
        locale: user.profile.locale,
        timezone: user.profile.timezone,
        preferredLanguage: user.profile.preferredLanguage,
        conversationStyle: (user.profile.conversationStyle as ConversationStyle) || 'CASUAL',
      },
      onboarding: {
        status: (user.profile.onboardingStatus as OnboardingStatus) || 'NOT_STARTED',
        version: user.profile.onboardingVersion || 1,
        currentStep: (user.profile.onboardingCurrentStep as OnboardingStepKey) || 'WELCOME',
        completedSteps: (user.profile.onboardingCompletedSteps as string[]) || [],
        startedAt: user.profile.onboardingStartedAt?.toISOString() || null,
        completedAt: user.profile.onboardingCompletedAt?.toISOString() || null,
        conversationStyle: (user.profile.conversationStyle as ConversationStyle) || 'CASUAL',
      },
      preferences: {
        preferredLanguage: user.profile.preferredLanguage,
        conversationStyle: (user.profile.conversationStyle as ConversationStyle) || 'CASUAL',
        preferredCategoryIds: (user.discoveryPreferences?.preferredCategoryIds as string[]) || [],
        personalizationEnabled: user.discoveryPreferences?.personalizationEnabled ?? true,
      },
      entitlements: entitlementKeys,
      featureFlags: {
        discovery_v2: true,
        onboarding_v2: true,
        recommendations_v2: true,
        voice_realtime_v2: true,
        monetization_v2: true,
      },
      starterCompanions,
    };
  }
}
