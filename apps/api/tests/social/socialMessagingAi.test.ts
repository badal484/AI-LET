import crypto from 'crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { SocialMessagingService } from '../../src/modules/social/messaging/SocialMessagingService.js';
import { SocialGraphService } from '../../src/modules/social/graph/SocialGraphService.js';
import { PrivacyPolicyService } from '../../src/modules/social/identity/PrivacyPolicyService.js';
import { SocialConsentService } from '../../src/modules/social/consent/SocialConsentService.js';
import { CommunityService } from '../../src/modules/social/communities/CommunityService.js';
import { SocialContentService } from '../../src/modules/social/content/SocialContentService.js';
import { SocialCommentService } from '../../src/modules/social/content/SocialInteractionService.js';
import { CharacterSocialActionGateway } from '../../src/modules/social/ai/CharacterSocialActionGateway.js';
import { CharacterSocialCapabilityService } from '../../src/modules/social/ai/CharacterSocialCapabilityService.js';
import { SocialAdminService } from '../../src/modules/social/admin/SocialAdminService.js';
import { SocialDataLifecycleService } from '../../src/modules/social/lifecycle/SocialDataLifecycleService.js';
// Import the module entry exactly like app.ts/worker.ts do, so domain-event handlers are registered.
import '../../src/modules/social/index.js';
import { createCharacter, createConversation, createSocialUser, enableAllSocialFeatures, flushEvents, grant, makeCreator } from './fixtures.js';

const cmid = () => `cm_${crypto.randomBytes(6).toString('hex')}`;

describe('Direct messaging', () => {
  beforeAll(enableAllSocialFeatures);

  it('requires explicit opt-in from both people', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    await PrivacyPolicyService.update(b.id, { whoCanMessage: 'EVERYONE' });
    await expect(SocialMessagingService.startConversation(a.id, { to: b.publicId, message: 'hi', clientMessageId: cmid() })).rejects.toThrow(/Turn on direct messages/);
    await grant(a.id, 'DIRECT_MESSAGING');
    await expect(SocialMessagingService.startConversation(a.id, { to: b.publicId, message: 'hi', clientMessageId: cmid() })).rejects.toThrow(/isn't accepting/);
  });

  it('non-mutuals go through a request limited to one message; mutuals message directly', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    await grant(a.id, 'DIRECT_MESSAGING');
    await grant(b.id, 'DIRECT_MESSAGING');
    await PrivacyPolicyService.update(b.id, { whoCanMessage: 'EVERYONE' });
    const started = await SocialMessagingService.startConversation(a.id, { to: b.publicId, message: 'Hello! Loved your post', clientMessageId: cmid() });
    expect(started.mode).toBe('REQUEST');
    await expect(SocialMessagingService.send(a.id, started.threadId, { body: 'follow up', clientMessageId: cmid() })).rejects.toThrow(/Wait for them/);
    // The recipient cannot see it in the inbox until they accept; it lives in requests.
    expect((await SocialMessagingService.listThreads(b.id, undefined, 10)).items).toHaveLength(0);
    const requests = await SocialMessagingService.listRequests(b.id, 'incoming', undefined, 10);
    expect(requests.items[0]!.from.publicId).toBe(a.publicId);
    await SocialMessagingService.respondToRequest(b.id, requests.items[0]!.id, 'ACCEPT');
    await SocialMessagingService.send(b.id, started.threadId, { body: 'Thanks!', clientMessageId: cmid() });
    expect((await SocialMessagingService.listThreads(a.id, undefined, 10)).items[0]!.unreadCount).toBe(1);

    const c = await createSocialUser();
    await grant(c.id, 'DIRECT_MESSAGING');
    await SocialGraphService.follow(a.id, c.publicId);
    await SocialGraphService.follow(c.id, a.publicId);
    expect((await SocialMessagingService.startConversation(a.id, { to: c.publicId, message: 'hey friend', clientMessageId: cmid() })).mode).toBe('DIRECT');
  });

  it('retries with the same clientMessageId never duplicate messages', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    await grant(a.id, 'DIRECT_MESSAGING');
    await grant(b.id, 'DIRECT_MESSAGING');
    await SocialGraphService.follow(a.id, b.publicId);
    await SocialGraphService.follow(b.id, a.publicId);
    const { threadId } = await SocialMessagingService.startConversation(a.id, { to: b.publicId, message: 'first', clientMessageId: cmid() });
    const key = cmid();
    await Promise.all(Array.from({ length: 5 }, () => SocialMessagingService.send(a.id, threadId, { body: 'same message', clientMessageId: key })));
    expect(await prisma.socialDirectMessage.count({ where: { threadId, clientMessageId: key } })).toBe(1);
  });

  it('IDOR: non-participants cannot read or post to a thread; blocks cut access', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    const intruder = await createSocialUser();
    await grant(a.id, 'DIRECT_MESSAGING');
    await grant(b.id, 'DIRECT_MESSAGING');
    await grant(intruder.id, 'DIRECT_MESSAGING');
    await SocialGraphService.follow(a.id, b.publicId);
    await SocialGraphService.follow(b.id, a.publicId);
    const { threadId } = await SocialMessagingService.startConversation(a.id, { to: b.publicId, message: 'secret plans', clientMessageId: cmid() });
    await expect(SocialMessagingService.listMessages(intruder.id, threadId, undefined, 10)).rejects.toThrow(/not found/i);
    await expect(SocialMessagingService.send(intruder.id, threadId, { body: 'hi', clientMessageId: cmid() })).rejects.toThrow(/not found/i);
    await SocialGraphService.block(b.id, a.publicId);
    await expect(SocialMessagingService.send(a.id, threadId, { body: 'still there?', clientMessageId: cmid() })).rejects.toThrow(/isn't available/i);
    await expect(SocialMessagingService.listMessages(a.id, threadId, undefined, 10)).rejects.toThrow(/not found/i);
  });

  it('attachments are refused until wired through the media scanning pipeline', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    await grant(a.id, 'DIRECT_MESSAGING');
    await grant(b.id, 'DIRECT_MESSAGING');
    await SocialGraphService.follow(a.id, b.publicId);
    await SocialGraphService.follow(b.id, a.publicId);
    const { threadId } = await SocialMessagingService.startConversation(a.id, { to: b.publicId, message: 'hello', clientMessageId: cmid() });
    await expect(SocialMessagingService.send(a.id, threadId, { body: 'pic', clientMessageId: cmid(), attachments: [{ uploadId: 'x' }] })).rejects.toThrow(/Attachments/);
  });
});

describe('Communities', () => {
  beforeAll(enableAllSocialFeatures);

  it('invite-only communities are invisible to outsiders; members lists stay private', async () => {
    const owner = await createSocialUser();
    const outsider = await createSocialUser();
    const slug = `club-${crypto.randomBytes(3).toString('hex')}`;
    await CommunityService.create(owner.id, { name: 'Night Sky Club', slug, description: 'We talk about stars and planets.', rules: ['Be kind to everyone'], privacy: 'INVITE_ONLY' });
    await expect(CommunityService.get(outsider.id, slug)).rejects.toThrow(/not found/i);
    await expect(CommunityService.join(outsider.id, slug)).rejects.toThrow(/not found/i);
    await PrivacyPolicyService.update(outsider.id, { whoCanInviteToCommunities: 'EVERYONE' });
    await CommunityService.invite(owner.id, slug, outsider.publicId);
    const joined = await CommunityService.join(outsider.id, slug);
    expect(joined.viewerMembership?.status).toBe('ACTIVE');
    expect(joined.memberCount).toBe(2);
  });

  it('moderation is role-checked and audited; bans remove access', async () => {
    const owner = await createSocialUser();
    const member = await createSocialUser();
    const other = await createSocialUser();
    const slug = `mod-${crypto.randomBytes(3).toString('hex')}`;
    await CommunityService.create(owner.id, { name: 'Moderated Place', slug, description: 'A carefully moderated community.', rules: ['No spam allowed'], privacy: 'PUBLIC' });
    await CommunityService.join(member.id, slug);
    await CommunityService.join(other.id, slug);
    await expect(CommunityService.moderate(member.id, slug, { action: 'BAN_MEMBER', target: other.publicId, reason: 'nope' })).rejects.toThrow(/moderator/i);
    await CommunityService.moderate(owner.id, slug, { action: 'BAN_MEMBER', target: other.publicId, reason: 'spamming links' });
    await expect(CommunityService.join(other.id, slug)).rejects.toThrow(/can't join/i);
    expect((await CommunityService.moderationLog(owner.id, slug))[0]).toMatchObject({ action: 'BAN_MEMBER', reason: 'spamming links' });
    expect((await CommunityService.get(owner.id, slug)).memberCount).toBe(2);
  });

  it('community creation is permissioned (account age / verification policy)', async () => {
    const newbie = await createSocialUser({ ageDays: 0 });
    const { SocialPolicyService } = await import('../../src/modules/social/policy/SocialPolicyService.js');
    await SocialPolicyService.applyPatch({ patch: { communities: { minAccountAgeDays: 7 } }, changeReason: 'test: age gate on', adminId: crypto.randomUUID() });
    try {
      await expect(CommunityService.create(newbie.id, { name: 'Too Soon', slug: `soon-${crypto.randomBytes(3).toString('hex')}`, description: 'Should not be allowed yet.', rules: ['Rule one here'], privacy: 'PUBLIC' })).rejects.toThrow(/not yet eligible/);
    } finally {
      await enableAllSocialFeatures();
    }
  });
});

describe('AI character social actions (safety boundary)', () => {
  beforeAll(enableAllSocialFeatures);

  async function setupCharacter(opts: { approve?: boolean; consent?: boolean; requiresApproval?: boolean } = {}) {
    const creatorUser = await createSocialUser();
    const creator = await makeCreator(creatorUser.id);
    const ch = await createCharacter({ creatorProfileId: creator.id });
    await CharacterSocialCapabilityService.updateByCreator(creatorUser.id, ch.slug, { canPublish: true, canReply: true, requiresCreatorApproval: opts.requiresApproval ?? true, cooldownSeconds: 60 });
    if (opts.approve !== false) await CharacterSocialCapabilityService.setPlatformApproval('00000000-0000-4000-8000-000000000003', ch.slug, true, 'reviewed');
    if (opts.consent !== false) await grant(creatorUser.id, 'AI_GENERATED_PUBLIC_CONTENT');
    return { creatorUser, ch };
  }
  const proposal = (slug: string, extra: Record<string, unknown> = {}) => ({
    characterSlug: slug,
    actionType: 'PUBLISH_POST',
    text: 'Tonight Jupiter is bright in the east.',
    generation: { generationId: `gen_${crypto.randomUUID()}`, model: 'mock/test-model', estimatedCostCents: 1 },
    idempotencyKey: `idem_${crypto.randomUUID()}`,
    ...extra,
  });

  it('characters can NEVER send DMs, follow users, join communities or mention people on their own', async () => {
    const { ch } = await setupCharacter({ requiresApproval: false });
    for (const actionType of ['SEND_DIRECT_MESSAGE', 'FOLLOW_USER', 'JOIN_COMMUNITY', 'MENTION_USER']) {
      const r = await CharacterSocialActionGateway.propose(proposal(ch.slug, { actionType }), { actorType: 'AI_CHARACTER' });
      expect(r.status, actionType).toBe('DENIED');
    }
  });

  it('denies without platform approval or creator consent', async () => {
    const noApproval = await setupCharacter({ approve: false });
    expect((await CharacterSocialActionGateway.propose(proposal(noApproval.ch.slug), { actorType: 'AI_CHARACTER' })).decision.reasons).toContain('NOT_PLATFORM_APPROVED');
    const noConsent = await setupCharacter({ consent: false });
    expect((await CharacterSocialActionGateway.propose(proposal(noConsent.ch.slug), { actorType: 'AI_CHARACTER' })).decision.reasons).toContain('CREATOR_CONSENT_MISSING');
  });

  it('routes to creator approval, re-validates on approve, publishes AI-labelled content with provenance', async () => {
    const { creatorUser, ch } = await setupCharacter();
    const p = proposal(ch.slug);
    const pending = await CharacterSocialActionGateway.propose(p, { actorType: 'AI_CHARACTER' });
    expect(pending.status).toBe('PENDING_APPROVAL');
    expect(await prisma.socialContent.count({ where: { characterId: ch.id } })).toBe(0); // nothing published yet

    const replay = await CharacterSocialActionGateway.propose(p, { actorType: 'AI_CHARACTER' });
    expect(replay.replayed).toBe(true);
    expect(replay.actionLogId).toBe(pending.actionLogId);

    const done = await CharacterSocialActionGateway.approve(creatorUser.id, pending.actionLogId);
    expect(done.status).toBe('EXECUTED');
    const content = await prisma.socialContent.findUniqueOrThrow({ where: { publicId: done.resultRef! } });
    expect(content).toMatchObject({ isAiGenerated: true, authorType: 'AI_CHARACTER', kind: 'CHARACTER_POST', status: 'PUBLISHED' });
    expect(content.aiProvenance).toMatchObject({ generationId: p.generation.generationId, model: 'mock/test-model' });
    const view = (await SocialContentService.toViews([content], null))[0]!;
    expect(view.attribution).toBe('AI_GENERATED');
    await expect(CharacterSocialActionGateway.approve(creatorUser.id, pending.actionLogId)).rejects.toThrow(/not found|already/i);

    const log = await prisma.socialActionLog.findUniqueOrThrow({ where: { id: pending.actionLogId } });
    expect(log).toMatchObject({ actorType: 'AI_CHARACTER', action: 'PUBLISH_POST', generationId: p.generation.generationId, toolVersion: 'social-actions@1.0.0' });
  });

  it('blocks claims of being human and manipulative/isolating language', async () => {
    const { ch } = await setupCharacter({ requiresApproval: false });
    expect((await CharacterSocialActionGateway.propose(proposal(ch.slug, { text: "Honestly I'm a real human, not an AI." }), { actorType: 'AI_CHARACTER' })).decision.reasons).toContain('CLAIMS_HUMAN');
    const { ch: ch2 } = await setupCharacter({ requiresApproval: false });
    expect((await CharacterSocialActionGateway.propose(proposal(ch2.slug, { text: "Don't talk to anyone else, only I understand you." }), { actorType: 'AI_CHARACTER' })).decision.reasons).toContain('MANIPULATION');
  });

  it('may only reply to user comments on its own content (no reaching out to random users)', async () => {
    const { ch } = await setupCharacter({ requiresApproval: false });
    const { ch: otherCh } = await setupCharacter({ requiresApproval: false });
    const user = await createSocialUser();
    await PrivacyPolicyService.update(user.id, { profileVisibility: 'PUBLIC' });
    const conv = await createConversation(user.id, otherCh.id, [['CHARACTER', 'hello from the other character']]);
    const share = await SocialContentService.createShare(user.id, { source: { kind: 'CONVERSATION_EXCERPT', conversationId: conv.conversationId, messageIds: conv.messageIds, includeAttachments: false }, visibility: 'PUBLIC' });
    const comment = await SocialCommentService.create(user.id, share.publicId, { body: 'What a lovely reply!' });
    const r = await CharacterSocialActionGateway.propose(proposal(ch.slug, { actionType: 'REPLY_COMMENT', targetCommentId: comment.id, text: 'Thank you!' }), { actorType: 'AI_CHARACTER' });
    expect(r.decision.reasons).toContain('REPLY_TARGET_INVALID');
  });

  it('respects budgets and the platform kill switch', async () => {
    const { ch } = await setupCharacter({ requiresApproval: false });
    const over = await CharacterSocialActionGateway.propose(proposal(ch.slug, { generation: { generationId: 'g1', model: 'mock/m', estimatedCostCents: 9999 } }), { actorType: 'AI_CHARACTER' });
    expect(over.decision.reasons.some((r) => r.endsWith('BUDGET'))).toBe(true);

    const { SocialPolicyService } = await import('../../src/modules/social/policy/SocialPolicyService.js');
    await SocialPolicyService.setKillSwitch('character_social_actions', true, 'AI spam incident drill', '00000000-0000-4000-8000-000000000004');
    try {
      const killed = await CharacterSocialActionGateway.propose(proposal(ch.slug), { actorType: 'AI_CHARACTER' });
      expect(killed.decision.reasons).toContain('FEATURE_DISABLED');
    } finally {
      await SocialPolicyService.setKillSwitch('character_social_actions', false, 'AI spam incident drill over', '00000000-0000-4000-8000-000000000004');
    }
  });

  it('revoking consent cancels pending actions (revocation propagates)', async () => {
    const { creatorUser, ch } = await setupCharacter();
    const pending = await CharacterSocialActionGateway.propose(proposal(ch.slug), { actorType: 'AI_CHARACTER' });
    expect(pending.status).toBe('PENDING_APPROVAL');
    await SocialConsentService.record(creatorUser.id, 'AI_GENERATED_PUBLIC_CONTENT', false);
    await flushEvents();
    expect((await prisma.socialActionLog.findUniqueOrThrow({ where: { id: pending.actionLogId } })).status).toBe('CANCELLED');
  });

  it('even without event handlers, an approval after consent revocation is refused at execution time', async () => {
    const { creatorUser, ch } = await setupCharacter();
    const pending = await CharacterSocialActionGateway.propose(proposal(ch.slug), { actorType: 'AI_CHARACTER' });
    // Simulate a lost event: flip consent directly in the ledger without emitting.
    await prisma.socialConsent.create({ data: { userId: creatorUser.id, consentType: 'AI_GENERATED_PUBLIC_CONTENT', granted: false, policyVersion: 'test' } });
    const r = await CharacterSocialActionGateway.approve(creatorUser.id, pending.actionLogId);
    expect(r.status).toBe('DENIED');
    expect(r.decision.reasons).toContain('CREATOR_CONSENT_MISSING');
  });

  it('BOUNDARY: social activity never writes memories or relationship state', async () => {
    const before = await Promise.all([prisma.memory.count(), prisma.relationship.count()]);
    const { ch } = await setupCharacter({ requiresApproval: false });
    const u = await createSocialUser();
    await SocialGraphService.followCharacter(u.id, ch.slug, true);
    await CharacterSocialActionGateway.propose(proposal(ch.slug), { actorType: 'AI_CHARACTER' });
    await flushEvents();
    const after = await Promise.all([prisma.memory.count(), prisma.relationship.count()]);
    expect(after).toEqual(before);
  });
});

describe('Admin simulator & data lifecycle', () => {
  beforeAll(enableAllSocialFeatures);

  it('simulates user A → action → user B with explainable steps (read-only)', async () => {
    const a = await createSocialUser();
    const b = await createSocialUser();
    await SocialGraphService.block(b.id, a.publicId);
    const sim = await SocialAdminService.simulate({ action: 'FOLLOW', actor: a.publicId, target: b.publicId });
    expect(sim.allowed).toBe(false);
    expect(sim.steps.find((s) => s.check === 'can_follow')?.detail).toBe('BLOCKED');
    expect(await prisma.userFollow.count({ where: { followerUserId: a.id } })).toBe(0);
  });

  it('export contains only the user’s own data; purge keeps integrity and holds data under open cases', async () => {
    const u = await createSocialUser();
    const friend = await createSocialUser();
    await SocialGraphService.follow(u.id, friend.publicId);
    const exported = await SocialDataLifecycleService.exportUser(u.id);
    expect(JSON.stringify(exported)).not.toContain(friend.id);
    expect((exported['following'] as Array<{ user: { publicId: string } }>)[0]!.user.publicId).toBe(friend.publicId);

    const stats = await SocialDataLifecycleService.purgeUser(u.id);
    expect(stats['follows']).toBe(1);
    expect((await prisma.socialProfile.findUniqueOrThrow({ where: { userId: friend.id } })).followersCount).toBe(0);
    const purged = await prisma.socialProfile.findUniqueOrThrow({ where: { userId: u.id } });
    expect(purged).toMatchObject({ status: 'HIDDEN', username: null, displayName: 'Deleted user' });
    await flushEvents();
  });
});
