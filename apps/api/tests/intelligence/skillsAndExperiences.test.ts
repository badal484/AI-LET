import { describe, it, expect } from 'vitest';
import { SkillRegistryService } from '../../src/modules/agents/SkillRegistryService.js';
import { ExperienceRuntimeService } from '../../src/modules/agents/ExperienceRuntimeService.js';

describe('Phase 25 — Skills & Experiences Runtime', () => {
  const skillService = SkillRegistryService.getInstance();
  const experienceService = ExperienceRuntimeService.getInstance();

  it('initializes default catalog of skills', async () => {
    await skillService.initialize();
    const skills = skillService.listSkills();
    expect(skills.length).toBeGreaterThanOrEqual(4);

    const travel = skillService.getSkill('travel_planner');
    expect(travel).toBeDefined();
    expect(travel?.name).toBe('Travel & Itinerary Planner');
    expect(travel?.status).toBe('published');
  });

  it('enforces creator skill sandboxing constraints', async () => {
    // Creator skill exceeding maxSteps (> 10) must be rejected
    await expect(
      skillService.registerSkill(
        {
          id: 'skill_unsafe_steps',
          slug: 'unsafe_steps',
          name: 'Unsafe Steps Skill',
          description: 'Too many steps',
          version: '1.0.0',
          category: 'Testing',
          status: 'published',
          requiredCapabilities: [],
          requiredToolSlugs: [],
          maxSteps: 25,
          maxCostUsd: 0.10,
          createdAt: new Date().toISOString(),
        },
        'creator_123'
      )
    ).rejects.toThrow(/maxSteps/);

    // Creator skill exceeding cost (> $0.50) must be rejected
    await expect(
      skillService.registerSkill(
        {
          id: 'skill_unsafe_cost',
          slug: 'unsafe_cost',
          name: 'Unsafe Cost Skill',
          description: 'Too expensive',
          version: '1.0.0',
          category: 'Testing',
          status: 'published',
          requiredCapabilities: [],
          requiredToolSlugs: [],
          maxSteps: 5,
          maxCostUsd: 1.50,
          createdAt: new Date().toISOString(),
        },
        'creator_123'
      )
    ).rejects.toThrow(/maxCostUsd/);
  });

  it('manages character skill assignments', async () => {
    const charId = `char_skill_test_${Date.now()}`;
    await skillService.assignSkillToCharacter(charId, 'travel_planner', 'default', true);

    const assigned = await skillService.getCharacterSkills(charId);
    expect(assigned.some((s) => s.slug === 'travel_planner')).toBe(true);
  });

  it('initializes and lists experiences', async () => {
    await experienceService.initialize();
    const exps = experienceService.listExperiences();
    expect(exps.length).toBeGreaterThanOrEqual(4);

    const study = experienceService.getExperience('study_session');
    expect(study).toBeDefined();
    expect(study?.name).toContain('Study');
  });

  it('starts a guided experience and automatically provisions an active UserGoal', async () => {
    const userId = `usr_exp_${Date.now()}`;
    const result = await experienceService.startExperience(userId, 'char_maya_001', 'study_session');

    expect(result.experience.slug).toBe('study_session');
    expect(result.goalId).toBeDefined();
    expect(result.initialPrompt).toContain('Welcome to our study session');
  });
});
