import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsageReservationService } from '../src/modules/billing/usage/UsageReservationService.js';
import { prisma } from '../src/infrastructure/database/prisma.js';
import { UsageMeterService } from '../src/modules/billing/usage/UsageMeterService.js';

describe('UsageReservationService', () => {
  const userId = 'usr_test_reservation_123';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully creates usage reservation when quota is available', async () => {
    vi.spyOn(UsageMeterService, 'getOrCreateMeter').mockResolvedValue({
      id: 'meter_voice_1',
      userId,
      meterUnit: 'voice_seconds',
      limitAmount: 18000,
      consumedAmount: 3200,
      reservedAmount: 0,
      remainingAmount: 14800,
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      return cb({
        usageMeter: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'meter_voice_1',
            limitAmount: 18000,
            consumedAmount: 3200,
            reservedAmount: 0,
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        usageReservation: {
          create: vi.fn().mockResolvedValue({
            id: 'res_voice_123',
            userId,
            usageMeterId: 'meter_voice_1',
            meterUnit: 'voice_seconds',
            reservedAmount: 60,
            status: 'RESERVED',
            expiresAt: new Date(Date.now() + 300000),
          }),
        },
      });
    });

    const reservation = await UsageReservationService.reserveUsage(
      userId,
      'voice_seconds',
      60,
    );

    expect(reservation.id).toBe('res_voice_123');
    expect(reservation.status).toBe('RESERVED');
    expect(reservation.reservedAmount).toBe(60);
  });

  it('rejects reservation when limit would be exceeded', async () => {
    vi.spyOn(UsageMeterService, 'getOrCreateMeter').mockResolvedValue({
      id: 'meter_voice_1',
      userId,
      meterUnit: 'voice_seconds',
      limitAmount: 100,
      consumedAmount: 90,
      reservedAmount: 0,
      remainingAmount: 10,
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      return cb({
        usageMeter: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'meter_voice_1',
            limitAmount: 100,
            consumedAmount: 90,
            reservedAmount: 0,
          }),
          update: vi.fn(),
        },
      });
    });

    await expect(
      UsageReservationService.reserveUsage(
        userId,
        'voice_seconds',
        20, // 90 + 20 = 110 > 100 limit
      ),
    ).rejects.toThrow(/Monthly limit reached for voice_seconds/i);
  });

  it('consumes reservation upon successful generation', async () => {
    vi.spyOn(prisma.usageReservation, 'findUnique').mockResolvedValue({
      id: 'res_voice_123',
      userId,
      usageMeterId: 'meter_voice_1',
      meterUnit: 'voice_seconds',
      reservedAmount: 60,
      status: 'RESERVED',
      expiresAt: new Date(Date.now() + 300000),
    } as any);

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      return cb({
        usageMeter: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'meter_voice_1',
            limitAmount: 18000,
            consumedAmount: 3200,
            reservedAmount: 60,
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        usageReservation: {
          update: vi.fn().mockResolvedValue({}),
        },
      });
    });

    await expect(
      UsageReservationService.consumeReservation('res_voice_123', 45),
    ).resolves.not.toThrow();
  });

  it('releases reservation when generation fails or is cancelled', async () => {
    vi.spyOn(prisma.usageReservation, 'findUnique').mockResolvedValue({
      id: 'res_voice_123',
      userId,
      usageMeterId: 'meter_voice_1',
      meterUnit: 'voice_seconds',
      reservedAmount: 60,
      status: 'RESERVED',
      expiresAt: new Date(Date.now() + 300000),
    } as any);

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      return cb({
        usageMeter: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'meter_voice_1',
            limitAmount: 18000,
            consumedAmount: 3200,
            reservedAmount: 60,
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        usageReservation: {
          update: vi.fn().mockResolvedValue({}),
        },
      });
    });

    await expect(
      UsageReservationService.releaseReservation('res_voice_123'),
    ).resolves.not.toThrow();
  });
});
