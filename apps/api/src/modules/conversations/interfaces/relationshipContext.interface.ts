import type { RelationshipState, CurrentInteractionState } from '@ai-companion/types';

export interface RelationshipContextResult {
  relationshipState: RelationshipState | null;
  currentToneState: CurrentInteractionState | null;
  relationshipContextText: string;
  isPersonalizationActive: boolean;
}

export interface IRelationshipContextProvider {
  getRelationshipContext(
    userId: string,
    characterId: string,
    conversationId: string,
  ): Promise<RelationshipContextResult>;
}

export class NullRelationshipContextProvider implements IRelationshipContextProvider {
  async getRelationshipContext(
    _userId: string,
    _characterId: string,
    _conversationId: string,
  ): Promise<RelationshipContextResult> {
    return {
      relationshipState: null,
      currentToneState: null,
      relationshipContextText: '',
      isPersonalizationActive: false,
    };
  }
}
