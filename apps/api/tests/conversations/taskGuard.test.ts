import { describe, expect, it, vi, beforeEach } from 'vitest';

const store: { tasks: Array<{ what: string; given: string }> } = { tasks: [] };
let herMessages: string[] = [];
vi.mock('../../src/infrastructure/database/prisma.js', () => ({
  prisma: { message: { findMany: vi.fn(async () => herMessages.map((content) => ({ content }))) } },
}));
vi.mock('../../src/modules/memory/services/userProfile.service.js', () => ({
  UserProfileService: {
    load: vi.fn(async () => ({ people: [], likes: [], dislikes: [], goals: [], health: [], jokes: [], facts: [], events: [], tasks: [...store.tasks] })),
    save: vi.fn(async (_u: string, _c: string, profile: { tasks: typeof store.tasks }) => {
      store.tasks = profile.tasks;
    }),
  },
}));
const { dropUnsaidTasks } = await import('../../src/modules/conversations/human/taskGuard.js');

const life = () => ({ firstMetAt: 0, day: { date: '2026-10-02', told: [], userMoods: [], storyShared: false }, threads: [] as any[] });

/** From the real Aarohi chat: a breathing "task" she never gave kept coming back as "maine kal kaha tha". */
describe('Task guard', () => {
  beforeEach(() => {
    store.tasks = [];
  });

  it('drops a task she never gave, even if her made-up follow-ups mention it', async () => {
    store.tasks = [{ what: 'teen gehri saansein lena', given: '2026-10-01' }, { what: 'take three slow breaths', given: '2026-10-01' }];
    herMessages = ['Maine kal tumse teen gehri saansein lene ko kaha tha, kya woh tumne try kiya?', 'Tumne wo teen gehri saansein li thi jo maine kaha tha?', 'Bura din. Kya hua aaj?'];
    const l = life();
    l.threads.push({ kind: 'task', topic: 'task', said: 'teen gehri saansein lena', mentionedAt: 0, dueAt: 0 });
    expect(await dropUnsaidTasks({ conversationId: 'c', userId: 'u', characterId: 'x', life: l })).toBe(2);
    expect(store.tasks).toEqual([]);
    expect(l.threads).toEqual([]);
  });

  it('keeps a task she really gave', async () => {
    store.tasks = [{ what: 'raat 1 baje phone kitchen mein rakhna', given: '2026-10-01' }];
    herMessages = ['Aaj ka kaam: aaj raat 1 baje phone kitchen mein rakhna, aur kal mujhe batana kaisa gaya'];
    expect(await dropUnsaidTasks({ conversationId: 'c', userId: 'u', characterId: 'x', life: life() })).toBe(0);
    expect(store.tasks).toHaveLength(1);
  });
});
