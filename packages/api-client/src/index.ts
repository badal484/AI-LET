import { ApiResponse, ApiSuccessResponse, ApiErrorResponse } from '@ai-companion/types';

export interface ApiClientConfig {
  baseUrl: string;
  timeoutMs?: number;
  getAuthToken?: () => string | null | Promise<string | null>;
  onAuthExpired?: () => void;
}

export class ApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = {
      timeoutMs: 15000,
      ...config,
    };
  }

  public setBaseUrl(url: string): void {
    this.config.baseUrl = url;
  }

  public async request<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      body?: unknown;
      headers?: Record<string, string>;
      query?: Record<string, string | number | boolean | undefined>;
    } = {},
  ): Promise<ApiSuccessResponse<T>> {
    const { method = 'GET', body, headers = {}, query } = options;

    let url = `${this.config.baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
    if (query) {
      const searchParams = new URLSearchParams();
      for (const [key, val] of Object.entries(query)) {
        if (val !== undefined) searchParams.append(key, String(val));
      }
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-correlation-id': `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      ...headers,
    };

    if (this.config.getAuthToken) {
      const token = await this.config.getAuthToken();
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const json = (await response.json()) as ApiResponse<T>;

      if (!response.ok || !json.success) {
        if (response.status === 401 && this.config.onAuthExpired) {
          this.config.onAuthExpired();
        }
        const errorPayload = (json as ApiErrorResponse).error || {
          code: `HTTP_${response.status}`,
          message: response.statusText || 'API Request failed',
          timestamp: new Date().toISOString(),
        };
        throw errorPayload;
      }

      return json as ApiSuccessResponse<T>;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err && typeof err === 'object' && 'code' in err) {
        throw err;
      }
      throw {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network request failed',
        timestamp: new Date().toISOString(),
      };
    }
  }

  public get<T>(endpoint: string, query?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>(endpoint, { method: 'GET', query });
  }

  public post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: 'POST', body });
  }

  public put<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: 'PUT', body });
  }

  public patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: 'PATCH', body });
  }

  public delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}
