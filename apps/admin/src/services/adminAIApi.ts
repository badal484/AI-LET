import {
  AIModelData,
  AIRoutingPolicyData,
  AIPromptData,
  AIPromptVersionData,
  AIPromptExperimentData,
  AIEvaluationDatasetData,
  AIEvaluationRunData,
  AIAnalyticsOverview,
  AIModelMetrics,
  AICostMetrics,
  AIPlaygroundRequest,
  AIPlaygroundResult,
  ProductionReplayRequest,
  ProductionReplayResult,
} from '@ai-companion/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

async function authFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_access_token') : null;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include', // admin session cookie (httpOnly)
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || errorData.message || `API Error: ${res.statusText}`);
  }

  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

const q = (params: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1])).toString();

export const adminAIApi = {
  // Overview & Analytics
  getOverview: (days = 7) => authFetch<{ overview: AIAnalyticsOverview; modelMetrics: AIModelMetrics[] }>(`/admin/ai/overview?days=${days}`),
  getCosts: () => authFetch<AICostMetrics>('/admin/ai/costs'),

  // Models & Routing
  listModels: () => authFetch<AIModelData[]>('/admin/ai/models'),
  createModel: (data: Partial<AIModelData>) => authFetch<AIModelData>('/admin/ai/models', { method: 'POST', body: JSON.stringify(data) }),
  updateModel: (id: string, data: Partial<AIModelData>) => authFetch<AIModelData>(`/admin/ai/models/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  listRoutingPolicies: () => authFetch<AIRoutingPolicyData[]>('/admin/ai/routing-policies'),
  updateRoutingPolicy: (data: Partial<AIRoutingPolicyData>) => authFetch<AIRoutingPolicyData>('/admin/ai/routing-policies', { method: 'POST', body: JSON.stringify(data) }),
  resetCircuitBreaker: (provider: string, model: string) => authFetch<{ message: string }>('/admin/ai/circuit-breaker/reset', { method: 'POST', body: JSON.stringify({ provider, model }) }),

  // Prompts & Experiments
  listPrompts: () => authFetch<AIPromptData[]>('/admin/ai/prompts'),
  createPrompt: (data: { name: string; slug: string; category: string; description?: string }) => authFetch<AIPromptData>('/admin/ai/prompts', { method: 'POST', body: JSON.stringify(data) }),
  createPromptVersion: (promptId: string, data: { templateContent: string; inputVariables?: string[] }) => authFetch<AIPromptVersionData>(`/admin/ai/prompts/${promptId}/versions`, { method: 'POST', body: JSON.stringify(data) }),
  publishPromptVersion: (versionId: string) => authFetch<AIPromptVersionData>(`/admin/ai/prompts/versions/${versionId}/publish`, { method: 'POST' }),
  createPromptExperiment: (data: any) => authFetch<AIPromptExperimentData>('/admin/ai/prompts/experiments', { method: 'POST', body: JSON.stringify(data) }),

  // Playground & Replay
  runPlayground: (data: AIPlaygroundRequest) => authFetch<AIPlaygroundResult>('/admin/ai/playground', { method: 'POST', body: JSON.stringify(data) }),
  replayGeneration: (data: ProductionReplayRequest) => authFetch<ProductionReplayResult>('/admin/ai/replay', { method: 'POST', body: JSON.stringify(data) }),

  // Evaluation Lab
  listDatasets: () => authFetch<AIEvaluationDatasetData[]>('/admin/evaluation/datasets'),
  createDataset: (data: { name: string; slug: string; category?: string; description?: string }) => authFetch<AIEvaluationDatasetData>('/admin/evaluation/datasets', { method: 'POST', body: JSON.stringify(data) }),
  createTestCase: (datasetId: string, data: any) => authFetch<any>(`/admin/evaluation/datasets/${datasetId}/test-cases`, { method: 'POST', body: JSON.stringify(data) }),
  runEvaluation: (data: { datasetId: string; modelId: string; characterId?: string; evaluatorType?: string }) => authFetch<AIEvaluationRunData>('/admin/evaluation/run', { method: 'POST', body: JSON.stringify(data) }),
  getRunDetails: (runId: string) => authFetch<AIEvaluationRunData>(`/admin/evaluation/runs/${runId}`),
  compareRuns: (runId: string, baselineRunId?: string) => authFetch<any>(`/admin/evaluation/runs/${runId}/compare${baselineRunId ? `?baselineRunId=${baselineRunId}` : ''}`),

  // Feedback Analytics
  getFeedbackSummary: (days = 30) => authFetch<any>(`/feedback/summary?days=${days}`),

  // Phase 25: Intelligence, Skills, Experiences & Tasks
  listSkills: () => authFetch<any[]>('/admin/agents/skills'),
  listExperiences: () => authFetch<any[]>('/admin/agents/experiences'),
  // Persisted agent tasks across users (admin view of task lifecycle).
  listTasks: () => authFetch<any[]>('/admin/agents/tasks'),
  explainGeneration: (messageId: string) => authFetch<any>(`/admin/agents/generations/${messageId}/explain`),

  // Phase 26: Knowledge, Documents, Collections & Web Research
  // Metadata only; search/research run in the admin's own sandbox, never over users' documents.
  listKnowledgeDocuments: () => authFetch<any[]>('/admin/knowledge/documents'),
  listKnowledgeCollections: () => authFetch<any[]>('/admin/knowledge/collections'),
  testHybridSearch: (data: { query: string; maxCandidates?: number }) =>
    authFetch<any>('/admin/knowledge/search', { method: 'POST', body: JSON.stringify(data) }),
  testWebResearch: (data: { query: string; maxSources?: number }) =>
    authFetch<any>('/admin/knowledge/research', { method: 'POST', body: JSON.stringify(data) }),

  // Phase 27 & 30: Character Simulation, Goals, Plans, Routines, World State & Long-Horizon Behavior
  listSimulationRuns: (characterId?: string, limit: number = 20) =>
    authFetch<any[]>(`/admin/simulation/runs?${new URLSearchParams({ ...(characterId ? { characterId } : {}), limit: String(limit) }).toString()}`),
  // Operator inspection of one user's simulation state: the target user is always explicit.
  listCharacterGoals: (characterId: string, userId: string) =>
    authFetch<any[]>(`/admin/simulation/users/goals/${characterId}?${q({ userId })}`),
  createCharacterGoal: (data: any & { userId: string }) =>
    authFetch<any>('/admin/simulation/users/goals', { method: 'POST', body: JSON.stringify(data) }),
  listCharacterPlans: (characterId: string, userId: string) =>
    authFetch<any[]>(`/admin/simulation/users/plans/${characterId}?${q({ userId })}`),
  createCharacterPlan: (data: any & { userId: string }) =>
    authFetch<any>('/admin/simulation/users/plans', { method: 'POST', body: JSON.stringify(data) }),
  listCharacterRoutines: (characterId: string) =>
    authFetch<any[]>(`/admin/simulation/routines/${characterId}`),
  createCharacterRoutine: (data: any) =>
    authFetch<any>('/admin/simulation/routines', { method: 'POST', body: JSON.stringify(data) }),
  listCharacterCommitments: (characterId: string, userId: string) =>
    authFetch<any[]>(`/admin/simulation/users/commitments/${characterId}?${q({ userId })}`),
  listWorldState: (characterId: string, userId?: string) =>
    authFetch<any[]>(`/admin/simulation/world-state/${characterId}?${q({ userId })}`),
  setWorldState: (data: any) =>
    authFetch<any>('/admin/simulation/world-state', { method: 'POST', body: JSON.stringify(data) }),
  listWorldStateEvents: (characterId: string, limit = 50, userId?: string) =>
    authFetch<any[]>(`/admin/simulation/world-state/${characterId}/events?${q({ userId, limit: String(limit) })}`),
  getSimulationSettings: (characterId: string, userId: string) =>
    authFetch<any>(`/admin/simulation/users/settings/${characterId}?${q({ userId })}`),
  updateSimulationSettings: (characterId: string, data: any, userId: string) =>
    authFetch<any>(`/admin/simulation/users/settings/${characterId}?${q({ userId })}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetSimulationState: (characterId: string, data: { scope?: string; userId: string }) =>
    authFetch<any>(`/admin/simulation/users/reset/${characterId}`, { method: 'POST', body: JSON.stringify(data) }),
  getSimulationContextPack: (characterId: string, userId: string, maxTokens?: number) =>
    authFetch<any>(`/admin/simulation/users/context-pack/${characterId}?${q({ userId, ...(maxTokens ? { maxTokens: String(maxTokens) } : {}) })}`),
  triggerSimulation: (data: { characterId: string; userId: string; triggerType?: string; forceExecution?: boolean; messageContent?: string }) =>
    authFetch<any>('/admin/simulation/run', { method: 'POST', body: JSON.stringify(data) }),
  replaySimulationRun: (runId: string) =>
    authFetch<any>(`/admin/simulation/replay/${runId}`, { method: 'POST' }),
  migrateSimulationVersion: (data: { characterId: string; targetVersionId: string; strategy?: string; dryRun?: boolean }) =>
    authFetch<any>('/admin/simulation/migrate', { method: 'POST', body: JSON.stringify(data) }),
};
