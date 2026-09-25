const ADMIN_API_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000/api/v1';

export interface DeepDiagnosticsData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  version: string;
  services: {
    database: { isHealthy: boolean; latencyMs: number; error?: string };
    redis: { isHealthy: boolean; latencyMs: number; error?: string };
  };
  host: {
    memoryRssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    eventLoopLagMs: number;
  };
  circuitBreakers: Array<{
    name: string;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failureCount: number;
    lastFailureAt: string | null;
  }>;
  queues: Array<{
    name: string;
    waiting: number;
    active: number;
    failed: number;
    dlqCount: number;
  }>;
  killSwitches: Array<{
    key: string;
    isEnabled: boolean;
  }>;
}

export interface KillSwitchItem {
  key: string;
  isEnabled: boolean;
  reason?: string;
  updatedByAdminId?: string;
  updatedAt: string;
}

export interface CircuitBreakerItem {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  lastFailureAt: string | null;
  lastStateChangeAt: string;
}

export interface DeadLetterJob {
  id: string;
  queueName: string;
  name: string;
  data: any;
  errorCategory: string;
  failedReason: string;
  attemptsMade: number;
  timestamp: string;
}

async function infraRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_access_token') : null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${ADMIN_API_URL}${endpoint}`, {
    credentials: 'include', // admin session cookie (httpOnly)
    ...options,
    headers,
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error?.message || `Infrastructure request failed with status ${response.status}`);
  }

  return body.data;
}

export class AdminInfrastructureApi {
  public static async getDiagnostics(): Promise<DeepDiagnosticsData> {
    return infraRequest<DeepDiagnosticsData>('/health/dependencies');
  }

  public static async getKillSwitches(): Promise<KillSwitchItem[]> {
    const data = await infraRequest<{ switches: KillSwitchItem[] }>('/health/admin/killswitches');
    return data.switches;
  }

  public static async setKillSwitch(key: string, isEnabled: boolean, reason?: string): Promise<KillSwitchItem> {
    return infraRequest<KillSwitchItem>('/health/admin/killswitches', {
      method: 'POST',
      body: JSON.stringify({ key, isEnabled, reason }),
    });
  }

  public static async getCircuitBreakers(): Promise<CircuitBreakerItem[]> {
    const data = await infraRequest<{ breakers: CircuitBreakerItem[] }>('/health/admin/circuit-breakers');
    return data.breakers;
  }

  public static async resetCircuitBreakers(): Promise<void> {
    await infraRequest<{ reset: boolean }>('/health/admin/circuit-breakers/reset', {
      method: 'POST',
    });
  }

  public static async getDeadLetterJobs(): Promise<DeadLetterJob[]> {
    const data = await infraRequest<{ jobs: DeadLetterJob[] }>('/health/admin/dlq');
    return data.jobs;
  }

  public static async retryDeadLetterJob(jobId: string): Promise<void> {
    await infraRequest<{ jobId: string; retried: boolean }>(`/health/admin/dlq/${jobId}/retry`, {
      method: 'POST',
    });
  }
}
