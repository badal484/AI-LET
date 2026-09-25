import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { ApiErrorResponse } from '@ai-companion/types';
import { SecureAuthStorage } from '../auth/SecureAuthStorage.js';

import { API_BASE_URL } from '../../config/appInfo.js';

export { API_BASE_URL };

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];
let onSessionExpiredCallback: (() => void) | null = null;

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
}

function onRefreshFailed() {
  refreshSubscribers = [];
  if (onSessionExpiredCallback) {
    onSessionExpiredCallback();
  }
}

export class ApiClient {
  private static instance: AxiosInstance | null = null;
  private static authToken: string | null = null;

  public static setAuthToken(token: string | null): void {
    ApiClient.authToken = token;
  }

  public static setSessionExpiredHandler(handler: () => void): void {
    onSessionExpiredCallback = handler;
  }

  public static getBaseUrl(): string {
    return ApiClient.instance?.defaults.baseURL || API_BASE_URL;
  }

  public static getInstance(): AxiosInstance {
    if (!ApiClient.instance) {
      ApiClient.instance = axios.create({
        baseURL: API_BASE_URL,
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      // Request Interceptor: Attach bearer token and tracing correlation IDs
      ApiClient.instance.interceptors.request.use(
        (config: InternalAxiosRequestConfig) => {
          if (ApiClient.authToken && config.headers) {
            config.headers.Authorization = `Bearer ${ApiClient.authToken}`;
          }

          if (!config.headers['x-correlation-id']) {
            const correlationId = `mob-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            config.headers['x-correlation-id'] = correlationId;
            config.headers['x-request-id'] = correlationId;
          }

          return config;
        },
        (error: unknown) => Promise.reject(error),
      );

      // Response Interceptor: Single-flight refresh mutex queue
      ApiClient.instance.interceptors.response.use(
        response => response,
        async (error: AxiosError<ApiErrorResponse>) => {
          const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

          // If error is 401 and request hasn't already been retried
          const isAuthError =
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !originalRequest.url?.includes('/auth/login') &&
            !originalRequest.url?.includes('/auth/register') &&
            !originalRequest.url?.includes('/auth/refresh');

          if (isAuthError) {
            if (isRefreshing) {
              // Refresh is already in progress: queue this request until refresh resolves
              return new Promise((resolve, reject) => {
                subscribeTokenRefresh((newToken: string) => {
                  if (!newToken) {
                    return reject(error.response?.data?.error || error);
                  }
                  if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                  }
                  resolve(ApiClient.getInstance()(originalRequest));
                });
              });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
              const session = await SecureAuthStorage.getSession();
              if (!session?.refreshToken) {
                throw new Error('No refresh token available');
              }

              // Perform single-flight refresh
              const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refreshToken: session.refreshToken,
              });

              const { tokens } = refreshResponse.data.data;
              const newAccessToken = tokens.accessToken;
              const newRefreshToken = tokens.refreshToken;

              // Persist rotated tokens
              ApiClient.setAuthToken(newAccessToken);
              await SecureAuthStorage.updateTokens(
                newAccessToken,
                newRefreshToken,
                tokens.expiresIn,
              );

              // Notify all waiting requests with the new access token
              onRefreshed(newAccessToken);
              isRefreshing = false;

              // Retry the original failed request
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              }
              return ApiClient.getInstance()(originalRequest);
            } catch {
              isRefreshing = false;
              onRefreshFailed();
              await SecureAuthStorage.clearSession();
              ApiClient.setAuthToken(null);

              return Promise.reject(
                error.response?.data?.error || {
                  code: 'AUTH_SESSION_EXPIRED',
                  message: 'Your session has expired. Please log in again.',
                  timestamp: new Date().toISOString(),
                },
              );
            }
          }

          if (error.response?.data?.error) {
            return Promise.reject(error.response.data.error);
          }

          // Network Error fallback (e.g. Wi-Fi <-> USB adb reverse switch)
          const isDev = typeof __DEV__ !== 'undefined' ? Boolean(__DEV__) : process.env.NODE_ENV !== 'production';
          if (!error.response && !(originalRequest as any)._networkRetried && isDev) {
            (originalRequest as any)._networkRetried = true;
            const currentBase = ApiClient.instance?.defaults.baseURL || API_BASE_URL;
            let altBase = '';
            if (currentBase.includes('192.168.1.45')) {
              altBase = currentBase.replace('192.168.1.45', 'localhost');
            } else if (currentBase.includes('localhost') || currentBase.includes('127.0.0.1')) {
              altBase = currentBase.replace(/localhost|127\.0\.0\.1/, '192.168.1.45');
            } else if (currentBase.includes('10.0.2.2')) {
              altBase = currentBase.replace('10.0.2.2', '192.168.1.45');
            }

            if (altBase && altBase !== currentBase) {
              if (ApiClient.instance) {
                ApiClient.instance.defaults.baseURL = altBase;
              }
              originalRequest.baseURL = altBase;
              return ApiClient.getInstance()(originalRequest);
            }
          }

          const fallbackError = {
            code: 'NETWORK_ERROR',
            message: error.message || 'Unable to connect to server. Please check your connection.',
            timestamp: new Date().toISOString(),
          };

          return Promise.reject(fallbackError);
        },
      );
    }

    return ApiClient.instance;
  }
}

export const api = ApiClient.getInstance();
export const setApiAuthToken = ApiClient.setAuthToken;
export const setSessionExpiredHandler = ApiClient.setSessionExpiredHandler;
