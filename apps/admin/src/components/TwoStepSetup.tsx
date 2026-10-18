'use client';
import { useEffect, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

/**
 * Two-step sign-in setup (required before the console opens): scan the QR code with an authenticator app
 * (Google Authenticator, Microsoft Authenticator, 1Password…), then type the 6-digit code it shows.
 */
export function TwoStepSetup({ email, onDone, onSignOut }: { email: string; onDone: () => void; onSignOut: () => void }) {
  const [setup, setSetup] = useState<{ otpauthUri: string; secret: string } | null>(null);
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setError(null);
    try {
      const s = await api<{ otpauthUri: string; secret: string }>('/mfa/setup', { method: 'POST' });
      setSetup(s);
      setQr(await QRCode.toDataURL(s.otpauthUri, { margin: 1, width: 220 }));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void start();
  }, []);

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/mfa/enable', { method: 'POST', body: JSON.stringify({ code: code.replace(/\s/g, '') }) });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={confirm} className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-surface p-7">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Turn on two-step sign-in</h1>
          <p className="mt-1 text-sm text-muted">Needed once for {email}. After this, signing in asks for a 6-digit code from your phone.</p>
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…) and scan this code.</li>
          <li>Type the 6-digit code it shows.</li>
        </ol>
        <div className="flex justify-center rounded-xl bg-white p-3">
          {qr ? <img src={qr} alt="QR code for your authenticator app" width={220} height={220} /> : <div className="h-[220px] w-[220px]" />}
        </div>
        {setup && (
          <p className="text-center text-xs text-muted">
            Can&apos;t scan? Enter this key in the app: <code className="select-all break-all font-mono text-text">{setup.secret}</code>
          </p>
        )}
        <label className="block space-y-1.5">
          <span className="text-sm text-muted">6-digit code</span>
          <Input inputMode="numeric" autoComplete="one-time-code" maxLength={7} required value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        {error && <p className="text-sm text-bad">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={busy || !setup}>
            {busy ? 'Checking…' : 'Turn on'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => void start()}>
            New code
          </Button>
          <Button type="button" variant="ghost" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </form>
    </main>
  );
}
