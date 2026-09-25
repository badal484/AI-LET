'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPrincipal } from '@ai-companion/types';
import { AdminAuthService } from '../services/adminAuth';

interface AuthContextType {
  admin: AdminPrincipal | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  admin: null,
  isLoading: true,
  logout: async () => {},
  hasPermission: () => false,
  hasRole: () => false,
});

export const useAdminAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminPrincipal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const loadAdmin = async () => {
    try {
      const data = await AdminAuthService.getMe();
      setAdmin(data.admin);
    } catch {
      setAdmin(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdmin();
  }, []);

  const logout = async () => {
    try {
      await AdminAuthService.logout();
    } finally {
      setAdmin(null);
      router.push('/login');
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!admin) return false;
    if (admin.roles.includes('super_admin')) return true;
    return admin.permissions.includes(permission);
  };

  const hasRole = (role: string): boolean => {
    if (!admin) return false;
    if (admin.roles.includes('super_admin')) return true;
    return admin.roles.includes(role);
  };

  return (
    <AuthContext.Provider value={{ admin, isLoading, logout, hasPermission, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const AuthGuard: React.FC<{
  children: ReactNode;
  requiredPermission?: string;
}> = ({ children, requiredPermission }) => {
  const { admin, isLoading, hasPermission } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !admin) {
      router.push('/login');
    }
  }, [admin, isLoading, router]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#07090E',
          color: '#E2E8F0',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '3px solid rgba(168, 85, 247, 0.2)',
              borderTopColor: '#A855F7',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px auto',
            }}
          />
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>Authenticating admin session...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return null;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div
        style={{
          padding: '48px',
          textAlign: 'center',
          color: '#EF4444',
          backgroundColor: '#07090E',
          minHeight: '100vh',
        }}
      >
        <h2>403 Forbidden</h2>
        <p style={{ color: '#94A3B8', marginTop: '8px' }}>
          Your administrative account does not possess the required permission: '{requiredPermission}'
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export const PermissionGate: React.FC<{
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}> = ({ permission, children, fallback = null }) => {
  const { hasPermission } = useAdminAuth();
  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
};
