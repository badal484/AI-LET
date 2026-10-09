'use client';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/v1/admin/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok || body?.success === false) {
      setError(res?.status === 429 ? 'Too many tries. Wait a few minutes and try again.' : 'Email or password is wrong.');
      return;
    }
    const next = new URLSearchParams(window.location.search).get('next');
    window.location.href = next && next.startsWith('/') ? next : '/';
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-surface p-7">
        <div className="flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent to-accent-2" />
          <h1 className="text-xl font-bold tracking-tight">Lovira admin</h1>
        </div>
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-sm text-muted">Email</span>
            <Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-muted">Password</span>
            <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  );
}
