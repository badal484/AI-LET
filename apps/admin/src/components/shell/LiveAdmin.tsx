'use client';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { AlertTriangle, CreditCard, LifeBuoy, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * The admin's live connection (server: apps/api/src/infrastructure/realtime/realtime.ts).
 * Gets a 1-minute ticket through the normal admin login, connects, reconnects by itself. Each event
 * refreshes the screens it affects; safety and support also pop a toast with a sound and count on the
 * browser tab until you open that screen. The 15-second refresh stays as a safety net.
 */

type Kind = 'signup' | 'payment' | 'safety' | 'support' | 'campaign' | 'error' | 'online' | 'activity';
interface AdminEvent { type: 'admin' | 'hello'; kind?: Kind; text?: string; id?: string }
interface Toast { id: number; kind: Kind; text: string; href: string }

const REFRESH: Record<Kind, QueryKey[]> = {
  signup: [['overview'], ['users']],
  payment: [['overview'], ['money'], ['users']],
  safety: [['safety'], ['overview']],
  support: [['support'], ['overview']],
  campaign: [['campaigns'], ['campaign'], ['notification-stats']],
  error: [['system']],
  online: [['online']],
  // People chatting (batched by the server, at most every 4 s): messages, active users, AI cost.
  activity: [['overview'], ['ai-cost'], ['characters'], ['character'], ['users'], ['user'], ['notification-stats']],
};

const TOAST: Partial<Record<Kind, { text: (e: AdminEvent) => string; href: string }>> = {
  safety: { text: (e) => `Safety moment: ${e.text ?? 'needs a look'}`, href: '/safety' },
  support: { text: () => 'New support message', href: '/support' },
  payment: { text: () => 'New payment 🎉', href: '/money' },
  signup: { text: () => 'New sign-up', href: '/users' },
};
const LOUD: Kind[] = ['safety', 'support'];

function chime(urgent: boolean) {
  try {
    const ctx = new AudioContext();
    const tone = (freq: number, at: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.3);
    };
    tone(880, 0);
    tone(urgent ? 660 : 1320, 0.18);
    setTimeout(() => void ctx.close(), 800);
  } catch {
    /* the browser blocks sound until the page was clicked once */
  }
}

export function LiveAdmin() {
  const qc = useQueryClient();
  const path = usePathname();
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unseen, setUnseen] = useState<{ safety: number; support: number }>({ safety: 0, support: 0 });
  const pathRef = useRef(path);
  pathRef.current = path;

  const { data: online } = useQuery({ queryKey: ['online'], queryFn: () => api<{ online: number }>('/console/online'), refetchInterval: 60_000 });

  useEffect(() => {
    let ws: WebSocket | null = null;
    let stopped = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const handle = (e: AdminEvent) => {
      if (e.type === 'hello') return setConnected(true);
      if (!e.kind) return;
      REFRESH[e.kind]?.forEach((key) => void qc.invalidateQueries({ queryKey: key }));
      const t = TOAST[e.kind];
      if (!t) return;
      // Already looking at that screen: it updates in place, no toast.
      if (pathRef.current.startsWith(t.href)) return;
      const toast = { id: Date.now() + Math.random(), kind: e.kind, text: t.text(e), href: t.href };
      setToasts((all) => [...all.slice(-3), toast]);
      setTimeout(() => setToasts((all) => all.filter((x) => x.id !== toast.id)), LOUD.includes(e.kind) ? 15_000 : 6_000);
      if (e.kind === 'safety' || e.kind === 'support') {
        const k = e.kind;
        setUnseen((u) => ({ ...u, [k]: u[k] + 1 }));
        chime(k === 'safety');
      }
    };

    const connect = async () => {
      try {
        const { ticket, url } = await api<{ ticket: string; url: string }>('/console/realtime-ticket');
        if (stopped) return;
        ws = new WebSocket(`${url}?ticket=${encodeURIComponent(ticket)}`);
        ws.onopen = () => {
          retry = 0;
        };
        ws.onmessage = (m) => {
          try {
            handle(JSON.parse(String(m.data)) as AdminEvent);
          } catch {
            /* ignore */
          }
        };
        ws.onclose = () => {
          setConnected(false);
          if (!stopped) timer = setTimeout(() => void connect(), Math.min(15_000, 1000 * 2 ** retry++));
        };
      } catch {
        if (!stopped) timer = setTimeout(() => void connect(), Math.min(15_000, 1000 * 2 ** retry++));
      }
    };
    void connect();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, [qc]);

  // Opening Safety / Support clears its count.
  useEffect(() => {
    if (path.startsWith('/safety')) setUnseen((u) => ({ ...u, safety: 0 }));
    if (path.startsWith('/support')) setUnseen((u) => ({ ...u, support: 0 }));
  }, [path]);

  // Count on the browser tab, like a mail app.
  const total = unseen.safety + unseen.support;
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, '');
    document.title = total ? `(${total}) ${base}` : base;
  }, [total, path]);

  const icon = (k: Kind) =>
    k === 'safety' ? <AlertTriangle size={16} /> : k === 'support' ? <LifeBuoy size={16} /> : k === 'payment' ? <CreditCard size={16} /> : <UserPlus size={16} />;

  return (
    <>
      <span
        className={cn('hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs sm:inline-flex', connected ? 'text-text' : 'text-muted')}
        title={connected ? 'Live: updates arrive the moment they happen' : 'Reconnecting… (screens still refresh every 15 s)'}
      >
        <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-good' : 'bg-warn')} />
        {online ? `${online.online} online now` : 'Live'}
      </span>

      {/* On <body>: the header's blur would otherwise pin "fixed" toasts to the header. */}
      {typeof document !== 'undefined' && createPortal(
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-center gap-3 rounded-xl border p-3 text-sm shadow-lg',
              t.kind === 'safety' ? 'border-bad/40 bg-bad/10 text-bad' : t.kind === 'support' ? 'border-warn/40 bg-surface text-text' : 'border-border bg-surface text-text',
            )}
          >
            {icon(t.kind)}
            <Link href={t.href} className="flex-1 font-medium hover:underline" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}>
              {t.text}
            </Link>
            <button aria-label="Close" className="text-muted hover:text-text" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>,
      document.body,
      )}
    </>
  );
}
