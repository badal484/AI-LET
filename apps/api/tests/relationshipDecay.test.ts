import { describe, it, expect } from 'vitest';
import { RelationshipDecayService } from '../src/modules/relationships/services/relationshipDecay.service.js';
import type { RelationshipDimensions } from '@ai-companion/types';

describe('Phase 6: RelationshipDecayService', () => {
  const initialDimensions: RelationshipDimensions = {
    familiarity: 70,
    trust: 80,
    comfort: 75,
    affection: 50,
    engagement: 90,
  };

  it('should apply zero decay for active users within 7 days', () => {
    const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const result = RelationshipDecayService.calculateDecayedDimensions(initialDimensions, recentDate);

    expect(result.familiarity).toBe(70);
    expect(result.trust).toBe(80);
    expect(result.comfort).toBe(75);
    expect(result.affection).toBe(50);
    expect(result.engagement).toBe(90);
  });

  it('should decay engagement smoothly after 7 days while preserving trust', () => {
    const inactiveDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days ago (7 days past grace)
    const result = RelationshipDecayService.calculateDecayedDimensions(initialDimensions, inactiveDate);

    // Engagement should drop (7 days * 5 = 35 drop -> 90 - 35 = 55)
    expect(result.engagement).toBe(55);
    // Trust is permanent & stable
    expect(result.trust).toBe(80);
    // Familiarity stays intact under 30 days
    expect(result.familiarity).toBe(70);
  });

  it('should gently decay familiarity past 30 days without erasing history', () => {
    const longInactiveDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    const result = RelationshipDecayService.calculateDecayedDimensions(initialDimensions, longInactiveDate);

    // Trust is permanent
    expect(result.trust).toBe(80);
    // Engagement hits floor of 30
    expect(result.engagement).toBe(30);
    // Familiarity decays slightly but stays strong (2 months past 30 days * 1% = 2% drop)
    expect(result.familiarity).toBe(68);
  });
});
