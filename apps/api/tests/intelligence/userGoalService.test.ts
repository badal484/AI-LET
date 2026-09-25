import { describe, it, expect, beforeEach } from 'vitest';
import { UserGoalService } from '../../src/modules/characters/engine/UserGoalService.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';

describe('Phase 25 — UserGoalService', () => {
  const goalService = UserGoalService.getInstance();
  const testUserId = `usr_goal_test_${Date.now()}`;
  const testCharId = `char_maya_${Date.now()}`;

  beforeEach(async () => {
    await prisma.userGoal.deleteMany({
      where: { userId: testUserId },
    });
  });

  it('creates a new goal and pauses any existing active goal for that character', async () => {
    // Goal 1
    const goal1 = await goalService.createGoal(testUserId, {
      characterId: testCharId,
      category: 'travel_planning',
      title: 'Trip to Kyoto',
      constraints: { budget: 1000 },
    });

    expect(goal1.id).toBeDefined();
    expect(goal1.status).toBe('active');
    expect(goal1.progress).toBe(0.0);

    // Goal 2 starts for same user & character -> Goal 1 should be paused
    const goal2 = await goalService.createGoal(testUserId, {
      characterId: testCharId,
      category: 'interview_prep',
      title: 'Backend Engineer Interview',
    });

    expect(goal2.status).toBe('active');

    // Verify Goal 1 was paused
    const updated1 = await prisma.userGoal.findUnique({ where: { id: goal1.id } });
    expect(updated1?.status).toBe('paused');

    // Active goal should now be Goal 2
    const active = await goalService.getActiveGoal(testUserId, testCharId);
    expect(active?.id).toBe(goal2.id);
  });

  it('updates goal progress and completes when progress reaches 1.0', async () => {
    const goal = await goalService.createGoal(testUserId, {
      characterId: testCharId,
      category: 'study',
      title: 'Quantum Physics Review',
    });

    const mid = await goalService.updateGoalProgress(goal.id, testUserId, 0.5);
    expect(mid.progress).toBe(0.5);
    expect(mid.status).toBe('active');

    const finished = await goalService.updateGoalProgress(goal.id, testUserId, 1.0);
    expect(finished.progress).toBe(1.0);
    expect(finished.status).toBe('completed');
  });

  it('supports pause, resume, and cancellation lifecycles', async () => {
    const goal = await goalService.createGoal(testUserId, {
      characterId: testCharId,
      category: 'coding',
      title: 'Refactor Express App',
    });

    const paused = await goalService.pauseGoal(goal.id, testUserId);
    expect(paused.status).toBe('paused');

    const resumed = await goalService.resumeGoal(goal.id, testUserId);
    expect(resumed.status).toBe('active');

    const cancelled = await goalService.cancelGoal(goal.id, testUserId);
    expect(cancelled.status).toBe('cancelled');
  });

  it('lists goals and reorders by lastActiveAt', async () => {
    await goalService.createGoal(testUserId, {
      characterId: testCharId,
      category: 'reading',
      title: 'Read AI Whitepapers',
    });

    const list = await goalService.listUserGoals(testUserId);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0]?.userId).toBe(testUserId);
  });
});
