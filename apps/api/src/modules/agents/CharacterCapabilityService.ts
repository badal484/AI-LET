import { ErrorCode } from '@ai-companion/config';
import { ForbiddenError } from '../../shared/errors/AppError.js';
import { HARD_DISABLED_TOOLS } from './toolSafety.js';
import { CharacterCapabilityItem } from '@ai-companion/types';
import { logger } from '../../shared/utils/logger.js';

export class CharacterCapabilityService {
  private static instance: CharacterCapabilityService;

  private readonly capabilities: Map<string, CharacterCapabilityItem[]> = new Map();

  private constructor() {
    this.seedDefaultCharacterCapabilities();
  }

  public static getInstance(): CharacterCapabilityService {
    if (!CharacterCapabilityService.instance) {
      CharacterCapabilityService.instance = new CharacterCapabilityService();
    }
    return CharacterCapabilityService.instance;
  }

  /**
   * Retrieves all capabilities for a character
   */
  public getCharacterCapabilities(characterId: string): CharacterCapabilityItem[] {
    return this.capabilities.get(characterId) || [];
  }

  /**
   * Checks if a character is authorized for a specific capability
   */
  public isCapabilityAllowed(characterId: string, capabilitySlug: string): boolean {
    const list = this.getCharacterCapabilities(characterId);
    const cap = list.find((c) => c.capabilitySlug === capabilitySlug);
    return cap ? cap.isEnabled : false;
  }

  /**
   * Sets or updates a character capability
   */
  public setCapability(
    characterId: string,
    capabilitySlug: string,
    isEnabled: boolean,
    permissionScope: string = 'default'
  ): CharacterCapabilityItem {
    const disabled = HARD_DISABLED_TOOLS.get(capabilitySlug);
    if (disabled && isEnabled) {
      // Neither creators, characters nor admins can grant a hard-disabled capability.
      throw new ForbiddenError(disabled.message, ErrorCode.PAYMENT_TOOL_DISABLED);
    }
    let list = this.capabilities.get(characterId) || [];
    const existingIndex = list.findIndex((c) => c.capabilitySlug === capabilitySlug);

    let item: CharacterCapabilityItem;
    if (existingIndex >= 0) {
      item = { ...list[existingIndex]!, isEnabled, permissionScope };
      list[existingIndex] = item;
    } else {
      item = {
        id: `cap_${characterId}_${capabilitySlug}`,
        characterId,
        capabilitySlug,
        isEnabled,
        permissionScope,
      };
      list.push(item);
    }

    this.capabilities.set(characterId, list);
    logger.info(`Updated character capability: character '${characterId}' -> ${capabilitySlug} (enabled=${isEnabled})`);
    return item;
  }

  private seedDefaultCharacterCapabilities() {
    // Enable core safe capabilities for default companion characters
    const defaultCaps = [
      'calendar.read',
      'calendar.write',
      'email.draft',
      'email.send',
      'browser.read',
      'document.analyze',
    ];

    // Seed for universal fallback character 'char_maya_001'
    for (const cap of defaultCaps) {
      this.setCapability('char_maya_001', cap, true);
    }
  }
}
