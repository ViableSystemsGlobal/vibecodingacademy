'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/types/auth';
import apiClient from '@/lib/api-client';
import { getStoredToken, clearStoredTokens } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      const userData = await apiClient.get<User>('/auth/me');
      setUser(userData);
    } catch (error) {
      clearStoredTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiClient.post<{ user: User; token: string }>('/auth/login', {
      email,
      password,
    });
    
    // The apiClient.post already extracts data, so response is the data object
    if (response && response.token && response.user) {
      apiClient.setToken(response.token);
      setUser(response.user);
    } else {
      throw new Error('Invalid login response');
    }
  };

  const logout = () => {
    clearStoredTokens();
    setUser(null);
    if (typeof window !== 'undefined') {
      // Redirect to home page instead of generic login
      window.location.href = '/';
    }
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

