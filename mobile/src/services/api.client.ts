import { API_BASE_URL } from '../constants/config';
import { getAccessToken, getRefreshToken, saveTokens } from '../utils/secureStore';
import { useAuthStore } from '../store/authStore';
import { router } from 'expo-router';
import { Alert } from 'react-native';

export interface IApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

let isSessionExpiredAlertShowing = false;

function handleSessionExpiredAlert() {
  if (isSessionExpiredAlertShowing) return;
  isSessionExpiredAlertShowing = true;

  Alert.alert(
    'Session Expired',
    'Your session has expired. Please log in again to continue.',
    [
      {
        text: 'Log In',
        onPress: () => {
          isSessionExpiredAlertShowing = false;
          router.replace('/(auth)/login');
        },
      },
    ],
    { cancelable: false }
  );

  setTimeout(() => {
    isSessionExpiredAlertShowing = false;
    router.replace('/(auth)/login');
  }, 4000);
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
  const token = await getAccessToken();

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
      const refreshToken = await getRefreshToken();
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
            await saveTokens(refreshData.data.accessToken, refreshData.data.refreshToken);
            headers['Authorization'] = `Bearer ${refreshData.data.accessToken}`;

            // Retry original request with new token
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
          // Token refresh failed due to network error or expired refresh token
        }
      }

      // If refresh failed or was not possible and response is still 401
      if (!refreshedSuccessfully && response.status === 401) {
        await useAuthStore.getState().logout();
        handleSessionExpiredAlert();

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
      await useAuthStore.getState().logout();
      handleSessionExpiredAlert();
    }

    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: {
          code: 'TIMEOUT_ERROR',
          message: 'Request timed out. Please check server connection and tap to retry.',
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'Unable to connect to NextLib server. Please check connection.',
      },
    };
  }
}
