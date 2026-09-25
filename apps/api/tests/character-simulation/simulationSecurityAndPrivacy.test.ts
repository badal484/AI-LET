import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountDeletionService } from '../../src/modules/privacy/services/AccountDeletionService.js';
import { CharacterGoalService } from '../../src/modules/character-simulation/services/CharacterGoalService.js';
import { CharacterThreadAndCommitmentService } from '../../src/modules/character-simulation/services/CharacterThreadAndCommitmentService.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { NotFoundError } from '../../src/shared/errors/AppError.js';

vi.mock('../../src/infrastructure/database/prisma.js', () => {
  const modelHandler = {
    get: (_target: any, prop: string) => {
      if (!(prop in _target)) {
        if (prop === 'deleteMany') _target[prop] = vi.fn().mockResolvedValue({ count: 1 });
        else if (prop === 'findFirst') _target[prop] = vi.fn().mockResolvedValue(null);
        else if (prop === 'findUnique') _target[prop] = vi.fn().mockResolvedValue(null);
        else if (prop === 'findMany') _target[prop] = vi.fn().mockResolvedValue([]);
        else if (prop === 'update') _target[prop] = vi.fn().mockResolvedValue({});
        else if (prop === 'updateMany') _target[prop] = vi.fn().mockResolvedValue({ count: 1 });
        else if (prop === 'create') _target[prop] = vi.fn().mockResolvedValue({});
        else if (prop === 'delete') _target[prop] = vi.fn().mockResolvedValue({});
        else _target[prop] = vi.fn();
      }
      return _target[prop];
    },
  };

  const prismaMock: any = new Proxy(
    {
      $transaction: vi.fn(async (cb: any) => cb(prismaMock)),
    },
    {
      get: (target: any, prop: string) => {
        if (prop in target) return target[prop];
        target[prop] = new Proxy({}, modelHandler);
        return target[prop];
      },
    }
  );

  return { prisma: prismaMock };
});

describe('Character Simulation - Security, Cross-User Isolation & Privacy Purge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Account Deletion Cascade Purge (GDPR / Right to be Forgotten)', () => {
    it('purges all goals, threads, commitments, simulation state and runs on account deletion', async () => {
      // Execute account purge
      await AccountDeletionService.purgeUserData('user-to-delete');

      // Verify character simulation tables are purged
      expect(prisma.characterGoal.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-to-delete' },
      });
      expect(prisma.openConversationalThread.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-to-delete' },
      });
      expect(prisma.characterCommitment.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-to-delete' },
      });
      expect(prisma.characterSimulationState.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-to-delete' },
      });
      expect(prisma.simulationRunRecord.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-to-delete' },
      });
    });
  });

  describe('2. Cross-User Isolation & Ownership Verification', () => {
    it('prevents User A from resolving or mutating User B threads', async () => {
      const threadService = CharacterThreadAndCommitmentService.getInstance();

      // Simulate findFirst returning null when querying with mismatched userId
      vi.mocked(prisma.openConversationalThread.findFirst).mockResolvedValueOnce(null);

      await expect(
        threadService.resolveThread('thread-owned-by-user-b', 'user-a-attacker'),
      ).rejects.toThrow(NotFoundError);
    });

    it('prevents User A from deleting User B character goals', async () => {
      const goalService = CharacterGoalService.getInstance();

      // Simulate findFirst returning null because userId constraint does not match
      vi.mocked(prisma.characterGoal.findFirst).mockResolvedValueOnce(null);

      await expect(
        goalService.deleteGoal('goal-owned-by-user-b', 'user-a-attacker'),
      ).rejects.toThrow(NotFoundError);
    });

    it('prevents User A from fulfilling User B commitments', async () => {
      const threadService = CharacterThreadAndCommitmentService.getInstance();

      vi.mocked(prisma.characterCommitment.findFirst).mockResolvedValueOnce(null);

      await expect(
        threadService.fulfillCommitment('commitment-owned-by-user-b', 'user-a-attacker'),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
