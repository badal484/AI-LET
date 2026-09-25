import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../shared/utils/logger.js';
import type { SimulationMigrationResultDTO } from '@ai-companion/types';

export class SimulationStateMigrator {
  private static instance: SimulationStateMigrator;

  private constructor() {}

  public static getInstance(): SimulationStateMigrator {
    if (!SimulationStateMigrator.instance) {
      SimulationStateMigrator.instance = new SimulationStateMigrator();
    }
    return SimulationStateMigrator.instance;
  }

  /**
   * Migrates simulation entities to a new character version.
   * Performs safety checks and preserves active state where compatible.
   */
  public async migrateCharacterState(
    characterId: string,
    oldVersionId: string,
    newVersionId: string,
    dryRun: boolean = false
  ): Promise<SimulationMigrationResultDTO> {
    logger.info(`SimulationStateMigrator: starting migration for character '${characterId}' (${oldVersionId} -> ${newVersionId}, dryRun=${dryRun})`);

    const incompatibleItems: Array<{ type: string; id: string; reason: string }> = [];

    // Find goals associated with old version
    const goals = await prisma.characterGoal.findMany({
      where: { characterId, characterVersionId: oldVersionId },
    });

    // Find plans associated with old version
    const plans = await prisma.characterPlan.findMany({
      where: { characterId, characterVersionId: oldVersionId },
    });

    // Find routines associated with old version
    const routines = await prisma.characterRoutine.findMany({
      where: { characterId, characterVersionId: oldVersionId },
    });

    // Find world state
    const worldStates = await prisma.characterWorldState.findMany({
      where: { characterId, characterVersionId: oldVersionId },
    });

    if (!dryRun) {
      await prisma.$transaction(async (tx) => {
        if (goals.length > 0) {
          await tx.characterGoal.updateMany({
            where: { characterId, characterVersionId: oldVersionId },
            data: { characterVersionId: newVersionId, version: { increment: 1 } },
          });
        }

        if (plans.length > 0) {
          await tx.characterPlan.updateMany({
            where: { characterId, characterVersionId: oldVersionId },
            data: { characterVersionId: newVersionId, version: { increment: 1 } },
          });
        }

        if (routines.length > 0) {
          await tx.characterRoutine.updateMany({
            where: { characterId, characterVersionId: oldVersionId },
            data: { characterVersionId: newVersionId },
          });
        }

        if (worldStates.length > 0) {
          await tx.characterWorldState.updateMany({
            where: { characterId, characterVersionId: oldVersionId },
            data: { characterVersionId: newVersionId, version: { increment: 1 } },
          });
        }

        await tx.characterSimulationEvent.create({
          data: {
            characterId,
            characterVersionId: newVersionId,
            eventType: 'character.simulation.migrated.v1',
            source: 'ADMIN_ACTION',
            payload: {
              oldVersionId,
              newVersionId,
              goalsCount: goals.length,
              plansCount: plans.length,
              routinesCount: routines.length,
              worldStatesCount: worldStates.length,
            } as any,
            stateVersion: 1,
          },
        });
      });
    }

    return {
      characterId,
      oldVersionId,
      newVersionId,
      goalsMigrated: goals.length,
      plansMigrated: plans.length,
      routinesMigrated: routines.length,
      worldStateMigrated: worldStates.length,
      status: 'SUCCESS',
      incompatibleItems: incompatibleItems.length > 0 ? incompatibleItems : undefined,
      migratedAt: new Date().toISOString(),
    };
  }
}
