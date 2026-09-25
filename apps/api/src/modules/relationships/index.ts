// Phase 6: Relationship & Emotional State Engine Domain Module
export const RELATIONSHIPS_MODULE_NAME = 'relationships';

export * from './services/relationshipPolicyEngine.service.js';
export * from './services/emotionalTone.service.js';
export * from './services/relationshipAnalyzer.service.js';
export * from './services/relationshipDecay.service.js';
export * from './services/relationshipState.service.js';
export * from './services/relationshipContext.provider.js';
export * from './services/relationshipSimulator.service.js';
export * from './controllers/relationship.controller.js';
export * from './controllers/adminRelationship.controller.js';
export * from './routes/relationship.routes.js';
export * from './routes/adminRelationship.routes.js';
