import { create } from 'zustand';
import { clearTokens, saveTokens } from '../utils/secureStore';

export interface IUser {
  id: string;
  fullName: string;
  phone: string;
  role: 'STUDENT' | 'LIBRARY_ADMIN' | 'SUPER_ADMIN';
  libraryId?: string;
  studentProfileId?: string;
}

interface AuthState {
  user: IUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: IUser, accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  setAuth: async (user, accessToken, refreshToken) => {
    await saveTokens(accessToken, refreshToken);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await clearTokens();
    set({ user: null, isAuthenticated: false });
  },
}));
