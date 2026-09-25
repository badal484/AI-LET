import { prisma } from '../../../infrastructure/database/prisma.js';
import { SYSTEM_CONSTANTS, ErrorCode } from '@ai-companion/config';
import { AppError, NotFoundError } from '../../../shared/errors/AppError.js';
import { UsageMeterService } from './UsageMeterService.js';
import { logger } from '../../../config/logger.js';

export class UsageReservationService {
  private static readonly TTL_SECONDS = SYSTEM_CONSTANTS.BILLING.USAGE_RESERVATION_TTL_SECONDS || 300;

  /**
   * Atomically reserve usage quota before starting generation/streaming.
   */
  public static async reserveUsage(
    userId: string,
    meterUnit: string,
    estimatedAmount: number,
    idempotencyKey?: string
  ) {
    if (estimatedAmount <= 0) {
      throw new AppError('Reserved amount must be a positive integer', 400, ErrorCode.BAD_REQUEST);
    }

    // Check for existing reservation by idempotency key
    if (idempotencyKey) {
      const existing = await prisma.usageReservation.findUnique({
        where: { idempotencyKey },
      });
      if (existing && existing.status === 'RESERVED') {
        return existing;
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.TTL_SECONDS * 1000);

    return await prisma.$transaction(async (tx) => {
      // 1. Get or create active meter
      const meter = await UsageMeterService.getOrCreateMeter(userId, meterUnit, now);

      // 2. Fetch fresh meter record inside transaction
      const freshMeter = await tx.usageMeter.findUniqueOrThrow({
        where: { id: meter.id },
      });

      const currentUsed = freshMeter.consumedAmount + freshMeter.reservedAmount;
      const available = freshMeter.limitAmount - currentUsed;

      if (available < estimatedAmount) {
        throw new AppError(
          `Monthly limit reached for ${meterUnit}. Limit: ${freshMeter.limitAmount}, consumed: ${freshMeter.consumedAmount}, available: ${Math.max(0, available)}`,
          429,
          ErrorCode.USAGE_LIMIT_REACHED,
        );
      }

      // 3. Atomically increment reserved amount on meter
      await tx.usageMeter.update({
        where: { id: freshMeter.id },
        data: {
          reservedAmount: { increment: estimatedAmount },
        },
      });

      // 4. Create reservation record
      const reservation = await tx.usageReservation.create({
        data: {
          usageMeterId: freshMeter.id,
          userId,
          meterUnit,
          reservedAmount: estimatedAmount,
          consumedAmount: 0,
          status: 'RESERVED',
          idempotencyKey,
          expiresAt,
        },
      });

      return reservation;
    });
  }

  /**
   * Settle a reserved usage with actual consumed amount upon completion.
   */
  public static async consumeReservation(reservationId: string, actualAmount?: number): Promise<void> {
    const reservation = await prisma.usageReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      throw new NotFoundError(`Usage reservation '${reservationId}' not found`);
    }

    if (reservation.status !== 'RESERVED') {
      logger.info(`Reservation '${reservationId}' already in status '${reservation.status}', skipping consumption`);
      return;
    }

    const amountToConsume = actualAmount !== undefined ? actualAmount : reservation.reservedAmount;

    await prisma.$transaction(async (tx) => {
      const meter = await tx.usageMeter.findUniqueOrThrow({
        where: { id: reservation.usageMeterId },
      });

      const newReserved = Math.max(0, meter.reservedAmount - reservation.reservedAmount);
      const newConsumed = meter.consumedAmount + amountToConsume;

      await tx.usageMeter.update({
        where: { id: meter.id },
        data: {
          reservedAmount: newReserved,
          consumedAmount: newConsumed,
        },
      });

      await tx.usageReservation.update({
        where: { id: reservationId },
        data: {
          status: 'CONSUMED',
          consumedAmount: amountToConsume,
          settledAt: new Date(),
        },
      });
    });
  }

  /**
   * Release reserved usage when generation fails or is cancelled without consuming quota.
   */
  public static async releaseReservation(reservationId: string): Promise<void> {
    const reservation = await prisma.usageReservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return;
    }

    if (reservation.status !== 'RESERVED') {
      return;
    }

    await prisma.$transaction(async (tx) => {
      const meter = await tx.usageMeter.findUnique({
        where: { id: reservation.usageMeterId },
      });

      if (meter) {
        const newReserved = Math.max(0, meter.reservedAmount - reservation.reservedAmount);
        await tx.usageMeter.update({
          where: { id: meter.id },
          data: {
            reservedAmount: newReserved,
          },
        });
      }

      await tx.usageReservation.update({
        where: { id: reservationId },
        data: {
          status: 'RELEASED',
          settledAt: new Date(),
        },
      });
    });
  }

  /**
   * Periodic cleanup job for abandoned or expired reservations.
   */
  public static async cleanupStaleReservations(): Promise<number> {
    const now = new Date();
    const staleReservations = await prisma.usageReservation.findMany({
      where: {
        status: 'RESERVED',
        expiresAt: { lt: now },
      },
      take: 100,
    });

    let cleanedCount = 0;
    for (const res of staleReservations) {
      try {
        await prisma.$transaction(async (tx) => {
          const meter = await tx.usageMeter.findUnique({
            where: { id: res.usageMeterId },
          });

          if (meter) {
            const newReserved = Math.max(0, meter.reservedAmount - res.reservedAmount);
            await tx.usageMeter.update({
              where: { id: meter.id },
              data: { reservedAmount: newReserved },
            });
          }

          await tx.usageReservation.update({
            where: { id: res.id },
            data: {
              status: 'EXPIRED',
              settledAt: now,
            },
          });
        });
        cleanedCount++;
      } catch (err) {
        logger.error(`Error cleaning stale reservation '${res.id}':`, err);
      }
    }

    return cleanedCount;
  }
}
