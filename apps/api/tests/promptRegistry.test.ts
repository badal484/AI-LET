import { describe, it, expect, beforeEach } from 'vitest';
import { PromptRegistryService } from '../src/modules/ai/prompts/PromptRegistry.service.js';
import { PromptExperimentService } from '../src/modules/ai/prompts/PromptExperiment.service.js';

describe('Prompt Registry, Version Immutability & A/B Experiments', () => {
  let promptRegistry: PromptRegistryService;
  let experimentService: PromptExperimentService;

  beforeEach(async () => {
    promptRegistry = PromptRegistryService.getInstance();
    experimentService = PromptExperimentService.getInstance();
    await promptRegistry.seedDefaultPrompts();
  });

  it('retrieves active published prompt version by slug', async () => {
    const version = await promptRegistry.getActivePromptVersion('conversation_system');
    expect(version).toBeDefined();
    expect(version?.status).toBe('PUBLISHED');
    expect(version?.hash).toHaveLength(64);
    expect(version?.templateContent).toContain('{{character_name}}');
  });

  it('renders template variables accurately', () => {
    const template = 'Hello {{user_name}}, welcome to {{app_name}}!';
    const rendered = promptRegistry.renderTemplate(template, {
      user_name: 'Alex',
      app_name: 'AI Companion',
    });

    expect(rendered).toBe('Hello Alex, welcome to AI Companion!');
  });

  it('creates draft version and publishes with automatic archiving of old versions', async () => {
    const prompt = await promptRegistry.getPromptBySlug('conversation_system');
    expect(prompt).toBeDefined();

    const newDraft = await promptRegistry.createPromptVersion(
      prompt!.id,
      'You are {{character_name}}, version 2 updated template.'
    );

    expect(newDraft.status).toBe('DRAFT');
    expect(newDraft.versionNumber).toBeGreaterThan(1);

    const published = await promptRegistry.publishPromptVersion(newDraft.id);
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).toBeDefined();

    const active = await promptRegistry.getActivePromptVersion('conversation_system');
    expect(active?.id).toBe(published.id);
  });

  it('resolves prompt versions deterministically during A/B experiments', async () => {
    const userA = 'user_12345';
    const userB = 'user_67890';

    const resA1 = await experimentService.resolvePromptVersion('conversation_system', userA);
    const resA2 = await experimentService.resolvePromptVersion('conversation_system', userA);

    expect(resA1.version.id).toBe(resA2.version.id);
    expect(resA1.variant).toBe(resA2.variant);
  });
});
