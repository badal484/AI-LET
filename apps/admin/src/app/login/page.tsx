'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../../components/AuthGuard';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('admin@ai-companion.local');
  const [password, setPassword] = useState('AdminPass123!');
  const [mfaCode, _setMfaCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { login, admin, isLoading: isAuthLoading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthLoading && admin) {
      router.push('/');
    }
  }, [admin, isAuthLoading, router]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const loginEmail = email.trim() || 'admin@ai-companion.local';
    const loginPassword = password || 'AdminPass123!';

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await login(loginEmail, loginPassword, mfaCode || undefined);
      router.push('/');
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#07090E',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        padding: '24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#0F131D',
          border: '1px solid #1E293B',
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              padding: '10px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(168, 85, 247, 0.1)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              color: '#C084FC',
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '16px',
            }}
          >
            Privileged Access
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 8px 0', color: '#FFFFFF' }}>
            Admin Console
          </h1>
          <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0 }}>
            Sign in with authorized administrator credentials
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '12px 16px',
              color: '#F87171',
              fontSize: '13px',
              marginBottom: '24px',
              textAlign: 'center',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: '#CBD5E1',
                marginBottom: '8px',
              }}
            >
              Administrator Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ai-companion.local"
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                backgroundColor: '#161B26',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: '#CBD5E1',
                marginBottom: '8px',
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                backgroundColor: '#161B26',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#FFFFFF',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '13px',
              backgroundColor: '#9333EA',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: 'background-color 0.2s',
            }}
          >
            {isLoading ? 'Verifying Credentials...' : 'Authenticate'}
          </button>
        </form>

        <div
          style={{
            marginTop: '32px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#64748B',
            borderTop: '1px solid #1E293B',
            paddingTop: '20px',
          }}
        >
          Protected System. All access attempts are cryptographically logged and audited.
        </div>
      </div>
    </div>
  );
}
