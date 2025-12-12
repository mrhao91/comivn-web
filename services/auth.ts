
import { DataProvider } from './dataProvider';
import { User } from '../types';

const AUTH_KEY = 'comivn_auth_token';
const USER_KEY = 'comivn_user_info';

interface IAuthService {
    login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    isAuthenticated: () => boolean;
    getToken: () => string;
    getUser: () => User | null;
    getRole: () => string;
    isAdmin: () => boolean;
}

export const AuthService: IAuthService = {
  login: async (username: string, password: string): Promise<{success: boolean, error?: string}> => {
      // Use DataProvider to support switching between Mock and Real API
      const result = await DataProvider.login(username, password);
      if (result.success && result.user) {
          localStorage.setItem(USER_KEY, JSON.stringify(result.user));
          localStorage.setItem(AUTH_KEY, 'fake-jwt-token-xyz');
          return { success: true };
      }
      return { success: false, error: result.error };
  },

  logout: () => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/';
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem(AUTH_KEY);
  },

  getToken: (): string => {
      return localStorage.getItem(AUTH_KEY) || '';
  },

  getUser: (): User | null => {
      const u = localStorage.getItem(USER_KEY);
      return u ? JSON.parse(u) : null;
  },

  getRole: (): string => {
      const u = localStorage.getItem(USER_KEY);
      if (u) {
          const user = JSON.parse(u);
          return user.role || 'editor';
      }
      return 'editor';
  },

  // Helper to check permissions
  isAdmin: (): boolean => {
      const u = localStorage.getItem(USER_KEY);
      if (u) {
          const user = JSON.parse(u);
          return user.role === 'admin';
      }
      return false;
  }
};
