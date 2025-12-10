// Mock Authentication Service
// In a real app, this would call your Backend API

const AUTH_KEY = 'comivn_auth_token';

export const AuthService = {
  login: (username: string, password: string): Promise<boolean> => {
    return new Promise((resolve) => {
      // Simulate API delay
      setTimeout(() => {
        // HARDCODED CREDENTIALS FOR DEMO
        if (username === 'admin' && password === '123456') {
          localStorage.setItem(AUTH_KEY, 'fake-jwt-token-xyz');
          resolve(true);
        } else {
          resolve(false);
        }
      }, 500);
    });
  },

  logout: () => {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = '#/';
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem(AUTH_KEY);
  }
};
