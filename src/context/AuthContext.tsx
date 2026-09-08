import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../services/api';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  linkedAccountId?: string | null;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canManageCOA: boolean;
  canEntryJournal: boolean;
  canApproveJournal: boolean;
  canDeleteJournal: boolean;
  canViewReports: boolean;
  canManageInventory: boolean;
  canManagePurchasing: boolean;
  canManageSales: boolean;
  canOperatePOS: boolean;
  canVoidPOSTransaction: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (companyCode: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accesstansi_token');
    if (!token) { setIsLoading(false); return; }

    apiFetch<AuthUser>('/api/auth/me')
      .then(setUser)
      .catch(() => localStorage.removeItem('accesstansi_token'))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (companyCode: string, email: string, password: string) => {
    const res = await apiFetch<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ companyCode, email, password }),
    });
    localStorage.setItem('accesstansi_token', res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('accesstansi_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus digunakan di dalam AuthProvider');
  return ctx;
};
