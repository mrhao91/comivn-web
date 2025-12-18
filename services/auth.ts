
import { DataProvider } from './dataProvider';
import { User } from '../types';

const AUTH_KEY = 'comivn_auth_token';
const USER_KEY = 'comivn_user_info';

// NEW: Default permissions for Editor role
const EDITOR_DEFAULT_PERMISSIONS = ['dashboard', 'comics', 'comments', 'genres', 'reports'];

interface IAuthService {
    login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    isAuthenticated: () => boolean;
    getToken: () => string;
    getUser: () => User | null;
    getRole: () => string;
    isAdmin: () => boolean;
    hasPermission: (tabId: string) => boolean;
}

export const AuthService: IAuthService = {
  login: async (username: string, password: string): Promise<{success: boolean, error?: string}> => {
      const result = await DataProvider.login(username, password);
      if (result.success && result.user) {
          // Store the entire user object, including permissions
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
      const u = AuthService.getUser();
      return u?.role || 'editor';
  },

  isAdmin: (): boolean => {
      return AuthService.getRole() === 'admin';
  },

  // NEW: Permission checking logic
  hasPermission: (tabId: string): boolean => {
      const user = AuthService.getUser();
      if (!user) return false;
      if (user.role === 'admin') return true;

      // For editor, check their specific permissions array
      // If the array doesn't exist, fall back to default editor permissions
      const userPermissions = user.permissions && user.permissions.length > 0
          ? user.permissions
          : EDITOR_DEFAULT_PERMISSIONS;

      return userPermissions.includes(tabId);
  }
};