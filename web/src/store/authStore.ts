import { create } from 'zustand';
import { clearTokens, saveTokens, getAccessToken } from '../services/api.client';
import { API_BASE_URL } from '../constants/config';

export interface IUser {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  role: 'STUDENT' | 'LIBRARY_ADMIN' | 'SUPER_ADMIN';
  libraryId?: string;
  libraryName?: string;
  studentProfileId?: string;
}

export interface ILibraryOption {
  libraryId: string;
  libraryName: string;
  code: string;
  city?: string;
  studentProfileId: string;
}

interface AuthState {
  user: IUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  availableLibraries: ILibraryOption[];
  setAuth: (user: IUser, accessToken: string, refreshToken: string, availableLibraries?: ILibraryOption[]) => void;
  setAvailableLibraries: (libs: ILibraryOption[]) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  availableLibraries: [],

  setAuth: (user, accessToken, refreshToken, availableLibraries = []) => {
    saveTokens(accessToken, refreshToken);
    set({ user, isAuthenticated: true, isLoading: false, availableLibraries });
  },

  setAvailableLibraries: (availableLibraries) => {
    set({ availableLibraries });
  },

  logout: () => {
    clearTokens();
    set({ user: null, isAuthenticated: false, isLoading: false, availableLibraries: [] });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    const token = getAccessToken();
    if (!token) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        const userData = data.data;
        const role = userData.role;
        const libraryId = userData.studentProfile?.libraryId?._id || userData.adminProfile?.libraryId?._id;
        const libraryName = userData.studentProfile?.libraryId?.name || userData.adminProfile?.libraryId?.name;
        const studentProfileId = userData.studentProfile?._id;

        set({
          user: {
            id: userData._id,
            fullName: userData.fullName,
            phone: userData.phone,
            email: userData.email,
            role,
            libraryId,
            libraryName,
            studentProfileId,
          },
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        clearTokens();
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
