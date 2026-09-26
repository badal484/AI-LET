'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../../components/AuthGuard';
import { Sparkles, Shield, Lock, Mail, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

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

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault();
    const loginEmail = (customEmail || email).trim() || 'admin@ai-companion.local';
    const loginPassword = customPass || password || 'AdminPass123!';

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await login(loginEmail, loginPassword, mfaCode || undefined);
      router.push('/');
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = () => {
    setEmail('admin@ai-companion.local');
    setPassword('AdminPass123!');
    handleLogin(undefined, 'admin@ai-companion.local', 'AdminPass123!');
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
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient background glow effects */}
      <div
        style={{
          position: 'absolute',
          top: '-15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '700px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.18) 0%, rgba(99, 102, 241, 0.08) 50%, transparent 70%)',
          pointerEvents: 'none',
          filter: 'blur(80px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '10%',
          width: '450px',
          height: '450px',
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
          filter: 'blur(90px)',
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#0C1019',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '40px 36px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          position: 'relative',
          zIndex: 10,
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Top Header Badge */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '9999px',
              backgroundColor: 'rgba(168, 85, 247, 0.12)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              color: '#C084FC',
              fontSize: '12px',
              fontWeight: '700',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: '16px',
            }}
          >
            <Shield size={13} />
            Privileged Operations Hub
          </div>

          <h1
            style={{
              fontSize: '26px',
              fontWeight: '800',
              margin: '0 0 8px 0',
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #FFFFFF 0%, #CBD5E1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            AI Companion Admin
          </h1>
          <p style={{ fontSize: '14px', color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
            Production command & governance dashboard
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '10px',
              padding: '12px 16px',
              color: '#F87171',
              fontSize: '13px',
              marginBottom: '22px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '18px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '700',
                color: '#CBD5E1',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px',
              }}
            >
              Administrator Email
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'absolute', left: '14px', color: '#64748B', display: 'flex' }}>
                <Mail size={16} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ai-companion.local"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  backgroundColor: '#131927',
                  border: '1px solid #1E293B',
                  borderRadius: '10px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#A855F7')}
                onBlur={(e) => (e.target.style.borderColor = '#1E293B')}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#CBD5E1',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Password
              </label>
              <span style={{ fontSize: '11px', color: '#64748B' }}>Default: AdminPass123!</span>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'absolute', left: '14px', color: '#64748B', display: 'flex' }}>
                <Lock size={16} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  backgroundColor: '#131927',
                  border: '1px solid #1E293B',
                  borderRadius: '10px',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#A855F7')}
                onBlur={(e) => (e.target.style.borderColor = '#1E293B')}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '13px 20px',
              background: 'linear-gradient(135deg, #9333EA 0%, #7C3AED 100%)',
              border: 'none',
              borderRadius: '10px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: '700',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(147, 51, 234, 0.4)',
              transition: 'all 0.15s ease',
            }}
          >
            {isLoading ? (
              'Authenticating Superadmin...'
            ) : (
              <>
                Sign In to Console
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Quick Dev Login Helper */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '18px',
            borderTop: '1px solid rgba(255, 255, 255, 0.07)',
          }}
        >
          <button
            type="button"
            onClick={handleQuickLogin}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '10px 16px',
              backgroundColor: 'rgba(168, 85, 247, 0.08)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              borderRadius: '10px',
              color: '#D8B4FE',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.16)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.08)')}
          >
            <Zap size={14} color="#C084FC" />
            1-Click Dev Superadmin Login
          </button>
        </div>

        <div
          style={{
            marginTop: '20px',
            textAlign: 'center',
            fontSize: '11px',
            color: '#64748B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <CheckCircle2 size={12} color="#10B981" />
          Gateway Connected • TLS End-to-End Encrypted
        </div>
      </div>
    </div>
  );
}

