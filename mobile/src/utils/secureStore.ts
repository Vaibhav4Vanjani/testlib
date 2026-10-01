import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'nextlib_access_token';
const REFRESH_TOKEN_KEY = 'nextlib_refresh_token';

export const saveTokens = async (accessToken: string, refreshToken?: string): Promise<void> => {
  const safeAccess = typeof accessToken === 'string' ? accessToken : String(accessToken || '');
  const safeRefresh = typeof refreshToken === 'string' ? refreshToken : (refreshToken ? String(refreshToken) : '');

  if (!safeAccess) return;

  if (Platform.OS === 'web') {
    localStorage.setItem(ACCESS_TOKEN_KEY, safeAccess);
    if (safeRefresh && safeRefresh.trim() !== '') {
      localStorage.setItem(REFRESH_TOKEN_KEY, safeRefresh);
    }
    return;
  }
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, safeAccess);
  if (safeRefresh && safeRefresh.trim() !== '') {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, safeRefresh);
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
};

export const clearTokens = async (): Promise<void> => {
  if (Platform.OS === 'web') {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
};
