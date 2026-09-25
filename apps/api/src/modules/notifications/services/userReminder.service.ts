import { prisma } from '../../../infrastructure/database/prisma.js';
import { NotFoundError } from '../../../shared/errors/AppError.js';
import { ErrorCode } from '@ai-companion/config';
import type { UserReminderData } from '@ai-companion/types';
import type { CreateReminderInput } from '@ai-companion/validation';

export class UserReminderService {
  /**
   * Creates an explicit user-requested reminder
   */
  public static async createReminder(
    userId: string,
    input: CreateReminderInput,
  ): Promise<UserReminderData> {
    const { characterId, title, content, targetTime, timezone } = input;

    const reminder = await prisma.userReminder.create({
      data: {
        userId,
        characterId,
        title,
        content,
        targetTime: new Date(targetTime),
        timezone,
        status: 'PENDING',
      },
    });

    return {
      id: reminder.id,
      userId: reminder.userId,
      characterId: reminder.characterId,
      title: reminder.title,
      content: reminder.content,
      targetTime: reminder.targetTime.toISOString(),
      timezone: reminder.timezone,
      status: reminder.status as any,
      proactiveActionId: reminder.proactiveActionId,
      createdAt: reminder.createdAt.toISOString(),
      updatedAt: reminder.updatedAt.toISOString(),
    };
  }

  /**
   * Lists reminders for a user
   */
  public static async listReminders(userId: string): Promise<UserReminderData[]> {
    const items = await prisma.userReminder.findMany({
      where: { userId },
      orderBy: { targetTime: 'asc' },
    });

    return items.map(r => ({
      id: r.id,
      userId: r.userId,
      characterId: r.characterId,
      title: r.title,
      content: r.content,
      targetTime: r.targetTime.toISOString(),
      timezone: r.timezone,
      status: r.status as any,
      proactiveActionId: r.proactiveActionId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /**
   * Cancels a pending reminder
   */
  public static async cancelReminder(userId: string, reminderId: string): Promise<UserReminderData> {
    const existing = await prisma.userReminder.findFirst({
      where: { id: reminderId, userId },
    });

    if (!existing) {
      throw new NotFoundError('Reminder not found', ErrorCode.REMINDER_NOT_FOUND);
    }

    const updated = await prisma.userReminder.update({
      where: { id: reminderId },
      data: { status: 'CANCELLED' },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      characterId: updated.characterId,
      title: updated.title,
      content: updated.content,
      targetTime: updated.targetTime.toISOString(),
      timezone: updated.timezone,
      status: updated.status as any,
      proactiveActionId: updated.proactiveActionId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
