import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CharacterWorldStateService } from '../../src/modules/character-simulation/services/CharacterWorldStateService.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';

vi.mock('../../src/infrastructure/database/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(async (cb: any) => cb(prisma)),
    characterWorldState: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    characterWorldStateEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    characterSimulationEvent: {
      create: vi.fn(),
    },
  },
}));

describe('CharacterWorldStateService - Persistent Contextual Facts & Event Log', () => {
  let worldService: CharacterWorldStateService;

  beforeEach(() => {
    vi.clearAllMocks();
    worldService = CharacterWorldStateService.getInstance();
  });

  it('upserts world state and atomically creates an immutable world event', async () => {
    vi.mocked(prisma.characterWorldState.findFirst).mockResolvedValueOnce(null); // New entity

    const mockEvent = { id: 'evt-1' };
    vi.mocked(prisma.characterWorldStateEvent.create).mockResolvedValueOnce(mockEvent as any);

    const mockState = {
      id: 'ws-1',
      characterId: 'char-maya',
      userId: 'user-1',
      entityKey: 'active_painting',
      entityType: 'ACTIVE_PROJECT',
      stateValue: { title: 'Sunset in Venice', progress: 50 },
      version: 1,
      lastEventId: 'evt-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(prisma.characterWorldState.create).mockResolvedValueOnce(mockState as any);

    const result = await worldService.setEntityState({
      characterId: 'char-maya',
      userId: 'user-1',
      entityKey: 'active_painting',
      entityType: 'ACTIVE_PROJECT',
      stateValue: { title: 'Sunset in Venice', progress: 50 },
      eventType: 'PROJECT_STARTED',
      source: 'USER_CONVERSATION',
    });

    expect(result.entityKey).toBe('active_painting');
    expect(result.version).toBe(1);
    expect(prisma.characterWorldStateEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'PROJECT_STARTED',
          entityKey: 'active_painting',
        }),
      })
    );
    expect(prisma.characterSimulationEvent.create).toHaveBeenCalled();
  });

  it('increments version on subsequent state mutations', async () => {
    const existing = {
      id: 'ws-1',
      characterId: 'char-maya',
      userId: 'user-1',
      entityKey: 'active_painting',
      entityType: 'ACTIVE_PROJECT',
      stateValue: { title: 'Sunset in Venice', progress: 50 },
      version: 1,
    };
    vi.mocked(prisma.characterWorldState.findFirst).mockResolvedValueOnce(existing as any);

    const mockEvent = { id: 'evt-2' };
    vi.mocked(prisma.characterWorldStateEvent.create).mockResolvedValueOnce(mockEvent as any);

    const updatedState = {
      ...existing,
      stateValue: { title: 'Sunset in Venice', progress: 100 },
      version: 2,
      lastEventId: 'evt-2',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(prisma.characterWorldState.update).mockResolvedValueOnce(updatedState as any);

    const result = await worldService.setEntityState({
      characterId: 'char-maya',
      userId: 'user-1',
      entityKey: 'active_painting',
      entityType: 'ACTIVE_PROJECT',
      stateValue: { title: 'Sunset in Venice', progress: 100 },
      eventType: 'PROJECT_COMPLETED',
    });

    expect(result.version).toBe(2);
    expect(prisma.characterWorldState.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ws-1' },
        data: expect.objectContaining({ version: 2 }),
      })
    );
  });
});
