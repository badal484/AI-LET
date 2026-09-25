import crypto from 'crypto';
import { DEFAULT_SOCIAL_POLICY, SOCIAL_FEATURES } from '@ai-companion/config';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { signAccessToken } from '../../src/security/tokens.js';
import { SocialPolicyService } from '../../src/modules/social/policy/SocialPolicyService.js';
import { SocialProfileService } from '../../src/modules/social/identity/SocialProfileService.js';
import { SocialConsentService } from '../../src/modules/social/consent/SocialConsentService.js';
import { SocialEvents } from '../../src/modules/social/shared/SocialEvents.js';

export const rid = (n = 6) => crypto.randomBytes(n).toString('hex');

/** Every social feature on at 100% so tests exercise the rules, not the rollout. */
export async function enableAllSocialFeatures(): Promise<void> {
  const features = Object.fromEntries(SOCIAL_FEATURES.map((f) => [f, { enabled: true, rolloutPercent: 100, cohorts: ['internal'] }]));
  const killSwitches = Object.fromEntries(SOCIAL_FEATURES.map((f) => [f, false]));
  SocialPolicyService.clearCache();
  try {
    await SocialPolicyService.applyPatch({
      patch: {},
      replaceWith: {
        ...DEFAULT_SOCIAL_POLICY,
        features: features as never,
        killSwitches: killSwitches as never,
        communities: { ...DEFAULT_SOCIAL_POLICY.communities, minAccountAgeDays: 0, requireVerifiedCreator: false },
      },
      changeReason: 'test: enable all social features',
      adminId: crypto.randomUUID(),
    });
  } catch (err) {
    if (!(err instanceof Error && err.message.includes('no effect'))) throw err;
  }
  SocialPolicyService.clearCache();
}

export async function createUser(opts: { verified?: boolean; ageDays?: number } = {}) {
  const tag = rid();
  const createdAt = new Date(Date.now() - (opts.ageDays ?? 30) * 86_400_000);
  const user = await prisma.user.create({
    data: {
      email: `social_${tag}@test.local`,
      normalizedEmail: `social_${tag}@test.local`,
      emailVerifiedAt: opts.verified === false ? null : new Date(),
      createdAt,
    },
  });
  return { id: user.id, token: signAccessToken({ userId: user.id, email: user.email, roles: ['user'] }) };
}

/** Creates a user with a social profile. `username` defaults to a random valid handle. */
export async function createSocialUser(opts: { username?: string; ageDays?: number } = {}) {
  const u = await createUser({ ageDays: opts.ageDays });
  const username = opts.username ?? `u${rid(5)}`;
  const profile = await SocialProfileService.create(u.id, { username, displayName: `Tester ${username}` });
  return { ...u, username, publicId: profile.publicId };
}

export async function grant(userId: string, ...types: Parameters<typeof SocialConsentService.record>[1][]) {
  for (const t of types) await SocialConsentService.record(userId, t, true);
}

export async function makeCreator(userId: string, verified = true) {
  return prisma.creatorProfile.create({
    data: {
      userId,
      displayName: `Creator ${rid(3)}`,
      username: `creator_${rid(5)}`,
      status: 'ACTIVE',
      verificationStatus: verified ? 'VERIFIED' : 'UNVERIFIED',
    },
  });
}

export const SECRET_BACKSTORY = 'SECRET-SYSTEM-BACKSTORY-do-not-leak';

export async function createCharacter(opts: { creatorProfileId?: string | null; status?: 'PUBLISHED' | 'DRAFT'; visibility?: 'PUBLIC' | 'PRIVATE' | 'UNLISTED' } = {}) {
  const tag = rid(5);
  return prisma.character.create({
    data: {
      internalKey: `ik_${tag}`,
      slug: `char-${tag}`,
      name: `Maya ${tag}`,
      tagline: 'A thoughtful companion',
      shortDescription: 'Loves astronomy.',
      avatarUrl: 'https://cdn.test/avatar.png',
      coverImageUrl: 'https://cdn.test/cover.png',
      archetype: 'friend',
      backstory: SECRET_BACKSTORY,
      age: 25,
      gender: 'female',
      occupation: 'astronomer',
      status: opts.status ?? 'PUBLISHED',
      visibility: opts.visibility ?? 'PUBLIC',
      creatorProfileId: opts.creatorProfileId ?? null,
    },
  });
}

export async function createConversation(userId: string, characterId: string, lines: Array<['USER' | 'CHARACTER', string]>) {
  const conv = await prisma.conversation.create({ data: { userId, characterId } });
  const ids: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const [senderType, content] = lines[i]!;
    const m = await prisma.message.create({
      data: { conversationId: conv.id, senderType, role: senderType === 'USER' ? 'user' : 'assistant', content, status: 'COMPLETED', createdAt: new Date(Date.now() - (lines.length - i) * 1000) },
    });
    ids.push(m.id);
  }
  return { conversationId: conv.id, messageIds: ids };
}

export async function flushEvents() {
  await SocialEvents.flush();
}
