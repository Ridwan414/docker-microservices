import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, usersApi } from '../api/services.js';
import {
  clearAuth,
  getAccessToken,
  getStoredUser,
  setStoredUser,
  setTokens,
} from '../utils/storage.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [ready, setReady] = useState(false);

  // On mount: if we have a token but no user object, fetch /users/me.
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      if (getAccessToken() && !getStoredUser()) {
        try {
          const me = await usersApi.me();
          if (!cancelled) {
            setStoredUser(me);
            setUser(me);
          }
        } catch {
          if (!cancelled) {
            clearAuth();
            setUser(null);
          }
        }
      }
      if (!cancelled) setReady(true);
    }
    bootstrap();

    function onExpired() {
      clearAuth();
      setUser(null);
    }
    window.addEventListener('ms:auth-expired', onExpired);
    return () => {
      cancelled = true;
      window.removeEventListener('ms:auth-expired', onExpired);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const tokens = await authApi.login(email, password);
    setTokens(tokens);
    const me = await usersApi.me();
    setStoredUser(me);
    setUser(me);
    return me;
  }, []);

  const register = useCallback(async (data) => {
    const newUser = await authApi.register(data);
    // Newly registered users need to log in to get tokens
    return newUser;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await usersApi.me();
    setStoredUser(me);
    setUser(me);
    return me;
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout, refreshUser, isAuthenticated: !!user }),
    [user, ready, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}