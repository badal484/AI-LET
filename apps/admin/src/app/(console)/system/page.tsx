'use client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Live } from '@/components/ui/live';
import { api } from '@/lib/api';
import { ago, count, percent } from '@/lib/format';

interface System {
  services: { api: { ok: boolean; uptimeHours: number; memoryMb: number; node: string }; database: { ok: boolean; ms: number; error?: string }; redis: { ok: boolean; ms: number; error?: string } };
  ai: { callsLastHour: number; failedLastHour: number; failRate: number; avgReplyMs: number; lastSuccess: string | null; lastFailure: string | null; lastCause: string | null };
  replies24h: { failed: number; total: number };
  alerts: Array<{ level: 'bad' | 'warn'; text: string; href?: string }>;
}

const Status = ({ ok, label, detail }: { ok: boolean; label: string; detail: string }) => (
  <Card className="flex items-center gap-3 p-4">
    {ok ? <CheckCircle2 className="text-good" size={22} /> : <XCircle className="text-bad" size={22} />}
    <div><p className="font-medium">{label}</p><p className="text-xs text-muted">{detail}</p></div>
  </Card>
);

export default function SystemPage() {
  const { data: s, dataUpdatedAt, isFetching } = useQuery({ queryKey: ['system'], queryFn: () => api<System>('/console/system'), refetchInterval: 10_000 });
  if (!s) return <div className="h-40 animate-pulse rounded-xl bg-surface" />;
  const aiOk = !(s.ai.failedLastHour >= 3 && s.ai.failRate > 0.2);
  return (
    <div className="space-y-5">
      <div className="flex justify-end"><Live updatedAt={dataUpdatedAt} fetching={isFetching} /></div>

      <Card>
        <CardHeader><CardTitle>Alerts</CardTitle></CardHeader>
        <CardBody className="space-y-2">
          {s.alerts.length === 0 && <p className="flex items-center gap-2 text-sm text-good"><CheckCircle2 size={16} /> All good — nothing needs you right now.</p>}
          {s.alerts.map((a, i) => (
            <div key={i} className={`flex items-start gap-2 rounded-lg p-3 text-sm ${a.level === 'bad' ? 'bg-bad/10 text-bad' : 'bg-warn/10 text-warn'}`}>
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span className="flex-1">{a.text}</span>
              {a.href && <Link href={a.href} className="font-medium underline">Open</Link>}
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Status ok={s.services.api.ok} label="API server" detail={`Up ${s.services.api.uptimeHours} h · ${s.services.api.memoryMb} MB · Node ${s.services.api.node}`} />
        <Status ok={s.services.database.ok} label="Database" detail={s.services.database.ok ? `${s.services.database.ms} ms` : s.services.database.error ?? 'Down'} />
        <Status ok={s.services.redis.ok} label="Redis" detail={s.services.redis.ok ? `${s.services.redis.ms} ms` : s.services.redis.error ?? 'Down'} />
        <Status ok={aiOk} label="Gemini (AI)" detail={`${count(s.ai.callsLastHour)} calls last hour · ${percent(s.ai.failRate)} failed`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted">Average reply time</p><p className="mt-1 text-xl font-semibold">{s.ai.avgReplyMs ? `${(s.ai.avgReplyMs / 1000).toFixed(1)} s` : '—'}</p><p className="text-xs text-muted">Last hour</p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Replies that failed (24 h)</p><p className={`mt-1 text-xl font-semibold ${s.replies24h.failed > 0 ? 'text-warn' : ''}`}>{count(s.replies24h.failed)} <span className="text-sm font-normal text-muted">of {count(s.replies24h.total)}</span></p></Card>
        <Card className="p-4"><p className="text-xs text-muted">Last AI success / failure</p><p className="mt-1 text-sm">{ago(s.ai.lastSuccess)} / {ago(s.ai.lastFailure)}</p>{s.ai.lastCause && <p className="mt-1 truncate text-xs text-muted" title={s.ai.lastCause}>{s.ai.lastCause}</p>}</Card>
      </div>
    </div>
  );
}
