import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import type { User } from '../types';
import { authApi } from '../api';
import { setToken, clearToken } from '../api/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, name: string, password: string, role: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export function useAuthState(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('dmms_token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.me()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { user: u, token } = await authApi.login({ username, password });
    setToken(token);
    setUser(u);
  }, []);

  const register = useCallback(async (username: string, name: string, password: string, role: string) => {
    await authApi.register({ username, name, password, role });
    await login(username, password);
  }, [login]);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return { user, loading, login, register, logout };
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
