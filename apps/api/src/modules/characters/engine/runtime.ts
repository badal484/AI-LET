import type {
  CharacterRuntimeObject,
  CharacterVersionSnapshot,
  CharacterStatus,
} from '@ai-companion/types';
import { CharacterCompiler, type CompilationContext } from './compiler.js';

export class CharacterRuntimeBuilder {
  /**
   * Constructs an immutable CharacterRuntimeObject from a version snapshot and character entity.
   */
  public static buildRuntime(
    character: { id: string; slug: string; name: string; status: CharacterStatus },
    version: CharacterVersionSnapshot,
    context?: CompilationContext,
  ): CharacterRuntimeObject {
    const compiledResult = CharacterCompiler.compile(version, context);

    const runtime = {
      characterId: character.id,
      slug: character.slug,
      versionId: version.id,
      versionNumber: version.versionNumber,
      name: character.name,
      status: character.status,
      identity: Object.freeze({ ...version.identityData }),
      personality: Object.freeze({
        ...version.personalityData,
        traits: Object.freeze({ ...version.personalityData.traits }),
        interactionRules: Object.freeze([...(version.personalityData.interactionRules || [])]),
        customQuirks: Object.freeze([...(version.personalityData.customQuirks || [])]),
      }),
      communication: Object.freeze({
        ...version.communicationData,
        preferredPhrases: Object.freeze([...(version.communicationData.preferredPhrases || [])]),
        avoidedPhrases: Object.freeze([...(version.communicationData.avoidedPhrases || [])]),
      }),
      language: Object.freeze({
        ...version.languageData,
        fallbackLanguages: Object.freeze([...(version.languageData?.fallbackLanguages || ['en'])]),
      }),
      behaviorRules: Object.freeze(
        (Array.isArray(version.behaviorRulesData)
          ? version.behaviorRulesData
          : Array.isArray((version.behaviorRulesData as any)?.rules)
          ? (version.behaviorRulesData as any).rules
          : []
        ).map(r => Object.freeze({ ...r })),
      ),
      knowledge: Object.freeze(
        (Array.isArray(version.knowledgeData)
          ? version.knowledgeData
          : Array.isArray((version.knowledgeData as any)?.items)
          ? (version.knowledgeData as any).items
          : []
        ).map(k =>
          Object.freeze({ ...k, tags: Object.freeze([...(k.tags || [])]) }),
        ),
      ),
      relationshipConfig: Object.freeze({ ...version.relationshipConfigData }),
      memoryConfig: Object.freeze({
        ...version.memoryConfigData,
        preferredMemoryTypes: Object.freeze([...(version.memoryConfigData?.preferredMemoryTypes || [])]),
      }),
      proactivityConfig: Object.freeze({
        ...version.proactivityConfigData,
        preferredEventTypes: Object.freeze([
          ...(version.proactivityConfigData?.preferredEventTypes || []),
        ]),
      }),
      safetyConfig: Object.freeze({
        ...version.safetyConfigData,
        contentBoundaries: Object.freeze([...(version.safetyConfigData?.contentBoundaries || [])]),
        topicsRequiringCaution: Object.freeze([
          ...(version.safetyConfigData?.topicsRequiringCaution || []),
        ]),
        relationshipBoundaries: Object.freeze([
          ...(version.safetyConfigData?.relationshipBoundaries || []),
        ]),
        impersonationRestrictions: Object.freeze([
          ...(version.safetyConfigData?.impersonationRestrictions || []),
        ]),
      }),
      aiConfig: Object.freeze({ ...version.aiConfigData }),
      voiceConfig: version.voiceConfigData ? Object.freeze({ ...version.voiceConfigData }) : null,
      compiledSystemPrompt: version.compiledPromptSnapshot || compiledResult.systemPrompt,
    };

    return Object.freeze(runtime) as unknown as CharacterRuntimeObject;
  }
}
