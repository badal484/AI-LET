import crypto from 'crypto';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { signAccessToken } from '../src/security/tokens.js';

/** Shared test helpers: users, creators, characters and conversations. */
export const rid = (n = 6) => crypto.randomBytes(n).toString('hex');

export async function createUser(opts: { verified?: boolean; ageDays?: number } = {}) {
  const tag = rid();
  const createdAt = new Date(Date.now() - (opts.ageDays ?? 30) * 86_400_000);
  const user = await prisma.user.create({
    data: {
      email: `user_${tag}@test.local`,
      normalizedEmail: `user_${tag}@test.local`,
      emailVerifiedAt: opts.verified === false ? null : new Date(),
      createdAt,
    },
  });
  return { id: user.id, token: signAccessToken({ userId: user.id, email: user.email, roles: ['user'] }) };
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

