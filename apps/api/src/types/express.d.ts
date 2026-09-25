export interface DeveloperContext {
  projectId: string;
  userId: string;
  authType: 'API_KEY' | 'OAUTH' | 'EMBED';
  scopes: string[];
  environment: string;
  keyType?: string;
  apiKeyId?: string;
  clientId?: string;
  characterId?: string;
  requestId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPrincipal;
      admin?: AdminPrincipal;
      correlationId?: string;
      requestId?: string;
      developerContext?: DeveloperContext;
    }
  }
}

export {};

