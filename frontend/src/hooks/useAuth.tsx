import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Feature, Permissions, User } from '../types';
import { authApi } from '../api/auth';

interface AuthContextType {
  user: User | null;
  permissions: Permissions;
  loading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  /** True when the superadmin's permission matrix grants this feature to the current user. */
  can: (feature: Feature) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({});
  const [loading, setLoading] = useState(true);

  const loadPermissions = async () => {
    try {
      const { data } = await authApi.myPermissions();
      setPermissions(data.permissions);
    } catch {
      // Fail closed: hide gated actions; the backend enforces them anyway.
      setPermissions({});
    }
  };

  const login = async (token: string, newUser: User) => {
    localStorage.setItem('token', token);
    setUser(newUser);
    await loadPermissions();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setPermissions({});
  };

  const refresh = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await authApi.me();
      setUser(data);
      await loadPermissions();
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const can = useCallback((feature: Feature) => Boolean(permissions[feature]), [permissions]);

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout, refresh, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
