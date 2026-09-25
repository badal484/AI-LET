import { OperationalKillSwitchItem, KillSwitchUpdateInput } from '@ai-companion/types';
import { logger } from '../../shared/utils/logger.js';

export class KillSwitchService {
  private static instance: KillSwitchService;
  private switches: Map<string, OperationalKillSwitchItem> = new Map();

  private constructor() {
    this.seedDefaultSwitches();
  }

  public static getInstance(): KillSwitchService {
    if (!KillSwitchService.instance) {
      KillSwitchService.instance = new KillSwitchService();
    }
    return KillSwitchService.instance;
  }

  private seedDefaultSwitches(): void {
    const defaultKeys = [
      { key: 'image_generation', label: 'Image Generation Subsystem' },
      { key: 'voice_calls', label: 'Voice Streaming Subsystem' },
      { key: 'proactive_messaging', label: 'Proactive Outreach Scanner' },
      { key: 'creator_publishing', label: 'Creator Character Publishing' },
      { key: 'model_routing', label: 'Dynamic Model Routing' },
      { key: 'discovery_indexing', label: 'Background Semantic Discovery Indexer' },
    ];

    for (const d of defaultKeys) {
      this.switches.set(d.key, {
        id: `ks-${d.key}`,
        switchKey: d.key,
        isEnabled: true, // Enabled = system is active/functional
        scope: 'GLOBAL',
        targetId: null,
        reason: 'Normal baseline operations',
        updatedByAdminId: 'system',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  public isServiceActive(switchKey: string, targetId?: string): boolean {
    const globalSwitch = this.switches.get(switchKey);
    if (globalSwitch && !globalSwitch.isEnabled) {
      return false; // Global kill switch active
    }

    if (targetId) {
      const specificKey = `${switchKey}:${targetId}`;
      const specificSwitch = this.switches.get(specificKey);
      if (specificSwitch && !specificSwitch.isEnabled) {
        return false;
      }
    }

    return true;
  }

  public updateSwitch(adminId: string, input: KillSwitchUpdateInput): OperationalKillSwitchItem {
    const lookupKey = input.targetId ? `${input.switchKey}:${input.targetId}` : input.switchKey;

    const item: OperationalKillSwitchItem = {
      id: `ks-${lookupKey}`,
      switchKey: input.switchKey,
      isEnabled: input.isEnabled,
      scope: input.scope || 'GLOBAL',
      targetId: input.targetId || null,
      reason: input.reason.trim(),
      updatedByAdminId: adminId,
      updatedAt: new Date().toISOString(),
    };

    this.switches.set(lookupKey, item);
    logger.warn('[KillSwitchService] Operational switch state changed', {
      key: lookupKey,
      isEnabled: input.isEnabled,
      reason: input.reason,
      adminId,
    });
    return item;
  }

  public listSwitches(): OperationalKillSwitchItem[] {
    return Array.from(this.switches.values()).sort((a, b) => a.switchKey.localeCompare(b.switchKey));
  }
}
