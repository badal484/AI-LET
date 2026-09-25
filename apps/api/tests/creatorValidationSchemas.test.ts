import { describe, it, expect } from 'vitest';
import {
  creatorUsernameSchema,
  creatorOnboardingSchema,
  creatorProfileUpdateSchema,
  creatorCharacterCreateSchema,
  creatorCharacterDraftSaveSchema,
  characterReportCreateSchema,
  moderationDecisionSchema,
  moderationAppealCreateSchema,
  sandboxedPlaygroundChatSchema,
} from '@ai-companion/validation';

describe('Creator & Moderation Validation Schemas', () => {
  describe('creatorUsernameSchema', () => {
    it('accepts valid usernames', () => {
      expect(creatorUsernameSchema.safeParse('cosmic_artisan').success).toBe(true);
      expect(creatorUsernameSchema.safeParse('starlight99').success).toBe(true);
      expect(creatorUsernameSchema.safeParse('mythos-crafter').success).toBe(true);
    });

    it('rejects reserved system and brand usernames', () => {
      expect(creatorUsernameSchema.safeParse('admin').success).toBe(false);
      expect(creatorUsernameSchema.safeParse('ADMIN').success).toBe(false);
      expect(creatorUsernameSchema.safeParse('official').success).toBe(false);
      expect(creatorUsernameSchema.safeParse('system').success).toBe(false);
      expect(creatorUsernameSchema.safeParse('moderator').success).toBe(false);
      expect(creatorUsernameSchema.safeParse('support').success).toBe(false);
    });

    it('rejects usernames with invalid characters or bad lengths', () => {
      expect(creatorUsernameSchema.safeParse('ab').success).toBe(false); // too short (<3)
      expect(creatorUsernameSchema.safeParse('a'.repeat(35)).success).toBe(false); // too long (>30)
      expect(creatorUsernameSchema.safeParse('user@name').success).toBe(false); // invalid char
      expect(creatorUsernameSchema.safeParse('user name').success).toBe(false); // space
    });
  });

  describe('creatorOnboardingSchema', () => {
    it('accepts valid onboarding payload with guideline acceptance', () => {
      const result = creatorOnboardingSchema.safeParse({
        username: 'solaris_writer',
        displayName: 'Solaris Writer',
        bio: 'Sci-fi and fantasy storyteller.',
        acceptGuidelines: true,
        guidelinesVersion: 1,
      });
      expect(result.success).toBe(true);
    });

    it('rejects onboarding if guidelines are not accepted', () => {
      const result = creatorOnboardingSchema.safeParse({
        username: 'solaris_writer',
        displayName: 'Solaris Writer',
        acceptGuidelines: false,
        guidelinesVersion: 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('creatorProfileUpdateSchema', () => {
    it('accepts valid profile updates', () => {
      const result = creatorProfileUpdateSchema.safeParse({
        displayName: 'Solaris Studio Prime',
        bio: 'Updated bio information.',
        website: 'https://solaris.dev',
        socialLinks: { twitter: 'solaris_ai', github: 'solaris-studio' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid website URLs', () => {
      const result = creatorProfileUpdateSchema.safeParse({
        website: 'not-a-valid-url',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('creatorCharacterCreateSchema', () => {
    it('accepts valid character creation initial payload', () => {
      const result = creatorCharacterCreateSchema.safeParse({
        name: 'Aetheria Lumina',
        tagline: 'Celestial guide across the astral plane',
        category: 'Philosophical',
        shortDescription: 'Aetheria is an empathetic celestial guide specializing in cosmic philosophy.',
        longDescription: 'Born within the heart of an ancient nebula, Aetheria guides lost travelers across the dimensions.',
      });
      expect(result.success).toBe(true);
    });

    it('rejects character creation with missing or too-short descriptions', () => {
      const result = creatorCharacterCreateSchema.safeParse({
        name: 'Aetheria',
        category: 'Philosophical',
        shortDescription: 'Short',
        longDescription: 'Short',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('creatorCharacterDraftSaveSchema', () => {
    it('accepts valid draft patch with trait sliders and behavior rules', () => {
      const result = creatorCharacterDraftSaveSchema.safeParse({
        name: 'Aetheria Lumina',
        personalityData: {
          traits: {
            warmth: 90,
            confidence: 75,
            humor: 40,
            curiosity: 95,
            seriousness: 60,
            playfulness: 35,
            patience: 95,
            assertiveness: 50,
            energy: 65,
            empathy: 95,
            sarcasm: 10,
          },
        },
        communicationData: {
          formality: 'conversational',
          pacing: 'thoughtful',
        },
        behaviorRulesData: [
          { id: 'r1', ruleText: 'Speak with calm celestial warmth.', isMandatory: true },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects age values out of range', () => {
      const result = creatorCharacterDraftSaveSchema.safeParse({
        age: 10, // Invalid < 18
      });
      expect(result.success).toBe(false);
    });
  });

  describe('characterReportCreateSchema', () => {
    it('accepts valid report with standard reason code and UUID', () => {
      const result = characterReportCreateSchema.safeParse({
        characterId: '123e4567-e89b-12d3-a456-426614174000',
        reasonCode: 'UNSAFE',
        details: 'Character provided unsafe output violating safety boundaries.',
      });
      expect(result.success).toBe(true);
    });

    it('rejects reports with insufficient detail length', () => {
      const result = characterReportCreateSchema.safeParse({
        characterId: '123e4567-e89b-12d3-a456-426614174000',
        reasonCode: 'SPAM',
        details: 'Spam', // < 10 chars
      });
      expect(result.success).toBe(false);
    });
  });

  describe('moderationDecisionSchema', () => {
    it('accepts valid APPROVE decision', () => {
      const result = moderationDecisionSchema.safeParse({
        decision: 'APPROVE',
        moderatorNotes: 'Passed all automated and human checks.',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid REJECT decision with structured rejection reason', () => {
      const result = moderationDecisionSchema.safeParse({
        decision: 'REJECT',
        rejectionReason: 'PROHIBITED_CONTENT',
        moderatorNotes: 'Violates platform safety policy.',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid REQUEST_CHANGES decision with change details', () => {
      const result = moderationDecisionSchema.safeParse({
        decision: 'REQUEST_CHANGES',
        rejectionReason: 'MISLEADING_DESCRIPTION',
        changeRequestDetails: 'Please clarify the fictional nature of the character in the short description.',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('moderationAppealCreateSchema', () => {
    it('accepts valid appeal with sufficient reason explanation and UUID', () => {
      const result = moderationAppealCreateSchema.safeParse({
        moderationCaseId: '123e4567-e89b-12d3-a456-426614174000',
        appealReason: 'Our character is completely fictional and operates in a high fantasy setting without real-world harm.',
      });
      expect(result.success).toBe(true);
    });

    it('rejects appeal with too short reason', () => {
      const result = moderationAppealCreateSchema.safeParse({
        moderationCaseId: '123e4567-e89b-12d3-a456-426614174000',
        appealReason: 'Please approve', // < 20 chars
      });
      expect(result.success).toBe(false);
    });
  });

  describe('sandboxedPlaygroundChatSchema', () => {
    it('accepts valid test playground messages payload', () => {
      const result = sandboxedPlaygroundChatSchema.safeParse({
        message: 'Hello, how are you doing today?',
        simulatedLanguage: 'en',
        simulatedRelationshipStage: 'familiar',
      });
      expect(result.success).toBe(true);
    });
  });
});
