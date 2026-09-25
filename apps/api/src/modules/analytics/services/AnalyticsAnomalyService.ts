import { prisma } from '../../../infrastructure/database/prisma.js';
import { logger } from '../../../config/logger.js';
import type { AnalyticsAlertItem } from '@ai-companion/types';

export class AnalyticsAnomalyService {
  /**
   * Scans recent metrics to detect cost spikes, activation drops, or error anomalies.
   */
  public static async scanForAnomalies(): Promise<AnalyticsAlertItem[]> {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 3600 * 1000);
    const newAlerts: AnalyticsAlertItem[] = [];

    try {
      // 1. Check AI cost velocity
      const recentCost = await prisma.aIUsageEvent.aggregate({
        where: { createdAt: { gte: twentyFourHoursAgo } },
        _sum: { estimatedCost: true },
        _count: { id: true },
      });

      const total24hCost = recentCost._sum.estimatedCost || 0;
      if (total24hCost > 50.0) {
        // Threshold alert
        const alert = await prisma.analyticsAlert.create({
          data: {
            severity: total24hCost > 100.0 ? 'CRITICAL' : 'WARNING',
            category: 'AI_COST',
            title: 'High 24h AI Token Spend',
            message: `24-hour estimated AI cost reached $${total24hCost.toFixed(2)} across ${recentCost._count.id} requests.`,
            metrics: { total24hCost, requestCount: recentCost._count.id },
            status: 'OPEN',
          },
        });
        newAlerts.push(this.formatAlert(alert));
      }

      // 2. Check safety / moderation spike
      const safetyInterventions = await prisma.safetyEvaluationLog.count({
        where: {
          decision: { in: ['BLOCK', 'REVIEW'] },
          createdAt: { gte: twentyFourHoursAgo },
        },
      });

      if (safetyInterventions > 50) {
        const alert = await prisma.analyticsAlert.create({
          data: {
            severity: 'WARNING',
            category: 'SAFETY',
            title: 'Spike in Safety Blocks',
            message: `${safetyInterventions} safety blocking interventions recorded in the last 24 hours.`,
            metrics: { safetyInterventions },
            status: 'OPEN',
          },
        });
        newAlerts.push(this.formatAlert(alert));
      }
    } catch (err) {
      logger.error('Error during anomaly detection scan', { err });
    }

    return newAlerts;
  }

  /**
   * Lists alerts with status filtering.
   */
  public static async listAlerts(status?: string, limit = 50): Promise<AnalyticsAlertItem[]> {
    const alerts = await prisma.analyticsAlert.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return alerts.map(a => this.formatAlert(a));
  }

  /**
   * Acknowledges an alert.
   */
  public static async acknowledgeAlert(alertId: string, adminId: string): Promise<AnalyticsAlertItem> {
    const updated = await prisma.analyticsAlert.update({
      where: { id: alertId },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedByAdminId: adminId,
      },
    });

    return this.formatAlert(updated);
  }

  /**
   * Resolves an alert.
   */
  public static async resolveAlert(alertId: string): Promise<AnalyticsAlertItem> {
    const updated = await prisma.analyticsAlert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    return this.formatAlert(updated);
  }

  private static formatAlert(alert: any): AnalyticsAlertItem {
    return {
      id: alert.id,
      severity: alert.severity,
      category: alert.category,
      title: alert.title,
      message: alert.message,
      metrics: (alert.metrics as Record<string, unknown>) || null,
      status: alert.status,
      acknowledgedByAdminId: alert.acknowledgedByAdminId,
      resolvedAt: alert.resolvedAt?.toISOString() || null,
      createdAt: alert.createdAt.toISOString(),
    };
  }
}
