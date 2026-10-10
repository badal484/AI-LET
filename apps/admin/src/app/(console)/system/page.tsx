'use client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, Td, Th } from '@/components/ui/table';
import { Live } from '@/components/ui/live';
import { api } from '@/lib/api';
import { ago, count, percent } from '@/lib/format';

interface System {
  services: { api: { ok: boolean; uptimeHours: number; memoryMb: number; node: string }; database: { ok: boolean; ms: number; error?: string }; redis: { ok: boolean; ms: number; error?: string } };
  ai: { callsLastHour: number; failedLastHour: number; failRate: number; avgReplyMs: number; lastSuccess: string | null; lastFailure: string | null; lastCause: string | null };
  replies24h: { failed: number; total: number };
  alerts: Array<{ level: 'bad' | 'warn'; text: string; href?: string }>;
  errors: { items: Array<{ at: string; status: number; method: string; path: string; message: string; code?: string }>; lastHour: number };
  jobs: Array<{ name: string; everyMs: number; lastRun: string; lastOk: string | null; ok: boolean; error: string | null; late: boolean }>;
  worker: { seen: boolean; running: boolean };
  aiToday: Array<{ model: string; calls: number; failed: number; tokens: number }>;
  appVersions: Array<{ platform: string; version: string | null; users: number }>;
}

const JOB: Record<string, string> = { 'account-deletion': 'Account deletions', 'account-deletion-reconcile': 'Deletion check-up' };
const PLATFORM: Record<string, string> = { android: 'Android', ios: 'iPhone', web: 'Web' };
const every = (ms: number) => (ms >= 3_600_000 ? `every ${ms / 3_600_000} h` : `every ${Math.round(ms / 60_000)} min`);

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

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Background jobs</CardTitle>
            <span className={`text-xs ${s.worker.running ? 'text-good' : 'text-warn'}`}>{s.worker.running ? 'Worker running' : s.worker.seen ? 'Worker stopped' : 'Worker never started'}</span>
          </CardHeader>
          <CardBody className="px-0">
            {s.jobs.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">
                No job has run yet. On the server, start the worker next to the API: <code className="rounded bg-surface-2 px-1">pnpm --filter api start:worker</code>
              </p>
            ) : (
              <Table>
                <tbody>
                  {s.jobs.map((j) => (
                    <tr key={j.name}>
                      <Td>{JOB[j.name] ?? j.name}<span className="block text-xs text-muted">{every(j.everyMs)}</span></Td>
                      <Td>{j.late ? <Badge tone="warn">Late</Badge> : j.ok ? <Badge tone="good">OK</Badge> : <Badge tone="bad">Failing</Badge>}</Td>
                      <Td className="whitespace-normal text-muted">Last run {ago(j.lastRun)}{!j.ok && j.error && <span className="block text-xs text-bad">{j.error}</span>}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>AI calls today</CardTitle><span className="text-xs text-muted">Watch these against Gemini's daily limits</span></CardHeader>
          <CardBody className="px-0">
            {s.aiToday.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">No AI calls yet today.</p>
            ) : (
              <Table>
                <thead><tr><Th>Model</Th><Th className="text-right">Calls</Th><Th className="text-right">Failed</Th><Th className="text-right">Tokens</Th></tr></thead>
                <tbody>
                  {s.aiToday.map((m) => (
                    <tr key={m.model}>
                      <Td>{m.model}</Td>
                      <Td className="text-right tabular-nums">{count(m.calls)}</Td>
                      <Td className={`text-right tabular-nums ${m.failed ? 'text-warn' : 'text-muted'}`}>{count(m.failed)}</Td>
                      <Td className="text-right tabular-nums text-muted">{count(m.tokens)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>App versions in use</CardTitle><span className="text-xs text-muted">People active in the last 30 days</span></CardHeader>
          <CardBody className="px-0">
            {s.appVersions.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">No devices yet.</p>
            ) : (
              <Table>
                <tbody>
                  {s.appVersions.map((v, i) => (
                    <tr key={i}>
                      <Td>{PLATFORM[v.platform] ?? v.platform}</Td>
                      <Td className="text-muted">{v.version ? `v${v.version}` : 'Version not reported'}</Td>
                      <Td className="text-right tabular-nums">{count(v.users)} {v.users === 1 ? 'person' : 'people'}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <p className="px-5 pb-4 pt-2 text-xs text-muted">To make old versions update, set a minimum version in <Link href="/settings" className="text-accent hover:underline">Settings</Link>.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent server errors</CardTitle>
            <span className={`text-xs ${s.errors.lastHour ? 'text-warn' : 'text-muted'}`}>{count(s.errors.lastHour)} in the last hour</span>
          </CardHeader>
          <CardBody className="px-0">
            {s.errors.items.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted">No server errors. 👍</p>
            ) : (
              <Table>
                <tbody>
                  {s.errors.items.map((e, i) => (
                    <tr key={i}>
                      <Td className="whitespace-normal">
                        <span className="font-mono text-xs">{e.method} {e.path}</span>
                        <span className="block text-xs text-muted">{e.message}</span>
                      </Td>
                      <Td><Badge tone="bad">{e.status}</Badge></Td>
                      <Td className="text-muted">{ago(e.at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
