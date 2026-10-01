import { API_BASE_URL } from '../constants/config';
import { useAuthStore } from '../store/authStore';

export interface IApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

export function getAccessToken(): string | null {
  return localStorage.getItem('access_token');
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token');
}

export function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

export async function apiRequest<T = any>(
  endpoint: string,
  optionsOrMethod?: RequestInit | string,
  bodyData?: any,
  timeoutMs = 25000
): Promise<IApiResponse<T>> {
  let options: RequestInit = {};

  if (typeof optionsOrMethod === 'string') {
    const isFormData = typeof FormData !== 'undefined' && bodyData instanceof FormData;
    options = {
      method: optionsOrMethod,
      ...(bodyData !== undefined ? { body: isFormData ? bodyData : JSON.stringify(bodyData) } : {}),
    };
  } else if (optionsOrMethod) {
    options = optionsOrMethod;
  }

  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Token Expiration -> Attempt Refresh Rotation
    if (response.status === 401) {
      const refreshToken = getRefreshToken();
      let refreshedSuccessfully = false;

      if (refreshToken) {
        try {
          const refreshController = new AbortController();
          const refreshTimeoutId = setTimeout(() => refreshController.abort(), 6000);

          const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
            signal: refreshController.signal,
          });

          clearTimeout(refreshTimeoutId);

          const refreshData: IApiResponse = await refreshResponse.json();
          if (refreshData.success && refreshData.data) {
            saveTokens(refreshData.data.accessToken, refreshData.data.refreshToken);
            headers['Authorization'] = `Bearer ${refreshData.data.accessToken}`;

            const retryController = new AbortController();
            const retryTimeoutId = setTimeout(() => retryController.abort(), timeoutMs);

            response = await fetch(url, {
              ...options,
              headers,
              signal: retryController.signal,
            });

            clearTimeout(retryTimeoutId);

            if (response.status !== 401) {
              refreshedSuccessfully = true;
            }
          }
        } catch (e) {
          // Token refresh failed
        }
      }

      if (!refreshedSuccessfully && response.status === 401) {
        useAuthStore.getState().logout();
        return {
          success: false,
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Session expired. Please log in again.',
          },
        };
      }
    }

    const data: IApiResponse<T> = await response.json();
    if (!data.success && (data.error?.code === 'TOKEN_EXPIRED' || data.error?.code === 'UNAUTHORIZED')) {
      useAuthStore.getState().logout();
    }

    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 'TIMEOUT_ERROR',
          message: 'Request timed out. Please check server connection.',
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'Unable to connect to NextLib server.',
      },
    };
  }
}
