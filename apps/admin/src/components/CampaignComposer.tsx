'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Plus, Send, Trash2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import { NotificationPreview } from '@/components/NotificationPreview';
import { api } from '@/lib/api';
import {
  KIND, LINKS, PLAN, SURFACE, type AudienceSize, type CampaignDraft, type CampaignKind, type ComposerOptions, type Plan, type Surface,
} from '@/lib/campaigns';
import { count } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Write a campaign, see it on a phone, check who gets it, test it on your own phone, then send. */

const TEST_EMAIL_KEY = 'campaign.testEmail';
const textarea =
  'w-full rounded-lg border border-border bg-surface p-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/40';
const select = 'h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm';

const Field = ({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-sm font-medium">{label}</span>
    {children}
    {hint && <span className="block text-xs text-muted">{hint}</span>}
  </label>
);

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn('rounded-full border px-3 py-1 text-xs', on ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-text')}
  >
    {children}
  </button>
);

/** A link: one of the app's screens, a chat with a character, or a website. */
function LinkPicker({ value, onChange, options }: { value: string | null; onChange: (v: string | null) => void; options?: ComposerOptions }) {
  const v = value ?? '';
  const isChat = v.startsWith('companion://chat/');
  const kind = !v ? 'none' : isChat ? 'chat' : v.startsWith('https://') ? 'web' : LINKS.some((l) => l.value === v) ? v : 'web';
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <select
        className={cn(select, 'sm:w-48')}
        value={kind}
        onChange={(e) => {
          const k = e.target.value;
          onChange(k === 'none' ? null : k === 'chat' ? `companion://chat/${options?.characters[0]?.id ?? ''}` : k === 'web' ? 'https://' : k);
        }}
      >
        <option value="none">Nothing (just open the app)</option>
        {LINKS.map((l) => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
        <option value="chat">A chat with…</option>
        <option value="web">A website</option>
      </select>
      {kind === 'chat' && (
        <select className={select} value={v.replace('companion://chat/', '')} onChange={(e) => onChange(`companion://chat/${e.target.value}`)}>
          {options?.characters.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}
      {kind === 'web' && <Input value={v} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />}
    </div>
  );
}

export function CampaignComposer({ initial, id }: { initial: CampaignDraft; id?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [d, setD] = useState<CampaignDraft>(initial);
  const set = <K extends keyof CampaignDraft>(k: K, v: CampaignDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setA = <K extends keyof CampaignDraft['audience']>(k: K, v: CampaignDraft['audience'][K]) => setD((x) => ({ ...x, audience: { ...x.audience, [k]: v } }));
  const [savedId, setSavedId] = useState(id);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [emailsText, setEmailsText] = useState(initial.audience.emails.join('\n'));
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setTestEmail(localStorage.getItem(TEST_EMAIL_KEY) ?? '');
    } catch {
      /* private mode */
    }
  }, []);

  const { data: options } = useQuery({ queryKey: ['campaign-options'], queryFn: () => api<ComposerOptions>('/console/notifications/options') });

  // Live audience size (debounced).
  const audienceKey = JSON.stringify([d.audience, d.kind, d.skipRecentDays]);
  const [size, setSize] = useState<AudienceSize | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      api<AudienceSize>('/console/notifications/audience', { method: 'POST', body: JSON.stringify({ audience: d.audience, kind: d.kind, skipRecentDays: d.skipRecentDays }) })
        .then(setSize)
        .catch(() => setSize(null));
    }, 400);
    return () => clearTimeout(t);
  }, [audienceKey]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = async (asTemplate = false) => {
    setError('');
    const body = JSON.stringify({ ...d, isTemplate: asTemplate || d.isTemplate });
    const saved = savedId
      ? await api<{ id: string }>(`/console/notifications/${savedId}`, { method: 'PUT', body })
      : await api<{ id: string }>('/console/notifications', { method: 'POST', body });
    setSavedId(saved.id);
    void qc.invalidateQueries({ queryKey: ['campaigns'] });
    if (!savedId) window.history.replaceState(null, '', `/notifications/${saved.id}`);
    return saved.id;
  };

  const run = (fn: () => Promise<void>) => fn().catch((e: Error) => setError(e.message));

  const upload = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/admin/console/notifications/image', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': file.type || 'image/jpeg' },
        body: file,
      });
      const body = await res.json();
      if (!res.ok || !body.success) throw new Error(body?.error?.message ?? 'Upload failed');
      set('imageUrl', body.data.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const test = useMutation({
    mutationFn: async () => {
      const cid = await save();
      try {
        localStorage.setItem(TEST_EMAIL_KEY, testEmail);
      } catch {
        /* ignore */
      }
      return api<{ note: string }>(`/console/notifications/${cid}/test`, { method: 'POST', body: JSON.stringify({ email: testEmail }) });
    },
    onSuccess: (r) => setNote(r.note),
    onError: (e: Error) => setError(e.message),
  });

  const send = useMutation({
    mutationFn: async () => {
      const cid = await save();
      await api(`/console/notifications/${cid}/send`, { method: 'POST' });
      return cid;
    },
    onSuccess: (cid) => {
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      router.push(`/notifications/${cid}`);
      router.refresh();
    },
    onError: (e: Error) => {
      setConfirm(false);
      setError(e.message);
    },
  });

  const sender = options?.characters.find((c) => c.id === d.senderCharacterId);
  const when =
    d.schedule.mode === 'now'
      ? 'right now'
      : d.schedule.mode === 'at'
        ? d.schedule.at ? new Date(d.schedule.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'at the time you pick'
        : `at ${String(d.schedule.localHour ?? 19).padStart(2, '0')}:00 in each person’s own time`;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px] [&>*]:min-w-0">
      <div className="space-y-5">
        {/* 1. Message */}
        <Card>
          <CardHeader><CardTitle>1. The message</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Campaign name" hint="Only you see this.">
                <Input value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Diwali offer — free users" />
              </Field>
              <Field label="Kind" hint={KIND[d.kind].hint}>
                <select className={select} value={d.kind} onChange={(e) => set('kind', e.target.value as CampaignKind)}>
                  {(Object.keys(KIND) as CampaignKind[]).map((k) => (
                    <option key={k} value={k}>{KIND[k].label}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From" hint={d.senderCharacterId ? 'Shows their photo; tapping opens their chat unless you pick another link.' : 'From the app itself.'}>
                <select className={select} value={d.senderCharacterId ?? ''} onChange={(e) => set('senderCharacterId', e.target.value || null)}>
                  <option value="">Lovira</option>
                  {options?.characters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
              {d.senderCharacterId && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 sm:mt-7">
                  <span className="text-sm">
                    Also put it in {sender?.name.split(' ')[0]}’s chat
                    <span className="block text-xs text-muted">Only for people who already chat with them</span>
                  </span>
                  <Switch checked={d.postInChat} onChange={(v) => set('postInChat', v)} label="Post in chat" />
                </div>
              )}
            </div>
            <Field label={`Title (${d.title.length}/65)`}>
              <Input value={d.title} maxLength={65} onChange={(e) => set('title', e.target.value)} placeholder="e.g. {name}, Kiara has a surprise for you 💜" />
            </Field>
            <Field
              label={`Message (${d.body.length}/400)`}
              hint={
                <>
                  Personal touches:{' '}
                  {['{name}', '{character}'].map((t) => (
                    <button key={t} type="button" className="mx-0.5 rounded bg-surface-2 px-1.5 font-mono text-text" onClick={() => set('body', `${d.body}${d.body && !d.body.endsWith(' ') ? ' ' : ''}${t}`)}>
                      {t}
                    </button>
                  ))}{' '}
                  — their first name, and the sender’s first name.
                </>
              }
            >
              <textarea className={textarea} rows={3} maxLength={400} value={d.body} onChange={(e) => set('body', e.target.value)} placeholder="What do you want to tell them?" />
            </Field>
            <Field label="Big picture (optional)" hint="Shown when the notification is opened, and on the popup. 2:1 works best (e.g. 1200×600).">
              <div className="flex items-center gap-3">
                {d.imageUrl ? (
                  <>
                    <img src={d.imageUrl} alt="" className="h-16 w-32 rounded-lg object-cover" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => set('imageUrl', null)}><Trash2 size={14} /> Remove</Button>
                  </>
                ) : (
                  <Button type="button" variant="secondary" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                    <ImagePlus size={14} /> {uploading ? 'Uploading…' : 'Upload picture'}
                  </Button>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
              </div>
            </Field>
          </CardBody>
        </Card>

        {/* 2. Where + tap */}
        <Card>
          <CardHeader><CardTitle>2. Where it shows and what a tap opens</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(SURFACE) as Surface[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('surfaces', toggle(d.surfaces, s))}
                  className={cn('rounded-lg border p-3 text-left', d.surfaces.includes(s) ? 'border-accent bg-accent-soft' : 'border-border hover:border-muted')}
                >
                  <span className={cn('text-sm font-medium', d.surfaces.includes(s) && 'text-accent')}>{SURFACE[s].label}</span>
                  <span className="block text-xs text-muted">{SURFACE[s].hint}</span>
                </button>
              ))}
            </div>
            {d.surfaces.includes('push') && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <span className="text-sm">Sound and vibration<span className="block text-xs text-muted">Off = arrives silently</span></span>
                <Switch checked={d.sound} onChange={(v) => set('sound', v)} label="Sound" />
              </div>
            )}
            <Field label="Tapping it opens">
              <LinkPicker value={d.link} onChange={(v) => set('link', v)} options={options} />
            </Field>
            {(d.surfaces.includes('popup') || d.surfaces.includes('banner')) && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Buttons on the popup (up to 2)</span>
                {d.buttons.map((b, i) => (
                  <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                    <div className="flex gap-2">
                      <Input value={b.label} maxLength={24} placeholder={i === 0 ? 'e.g. Chat now' : 'e.g. Maybe later'} onChange={(e) => set('buttons', d.buttons.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove button" onClick={() => set('buttons', d.buttons.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>
                    </div>
                    <LinkPicker value={b.link} onChange={(v) => set('buttons', d.buttons.map((x, j) => (j === i ? { ...x, link: v ?? 'companion://home' } : x)))} options={options} />
                  </div>
                ))}
                {d.buttons.length < 2 && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => set('buttons', [...d.buttons, { label: '', link: d.link ?? 'companion://home' }])}>
                    <Plus size={14} /> Add a button
                  </Button>
                )}
                <p className="text-xs text-muted">Phone notifications open the “Tapping it opens” link; buttons show on the popup.</p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* 3. Audience */}
        <Card>
          <CardHeader><CardTitle>3. Who gets it</CardTitle><span className="text-xs text-muted">Leave everything empty for everyone</span></CardHeader>
          <CardBody className="space-y-4">
            <Field label="Plan">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PLAN) as Plan[]).map((p) => (
                  <Chip key={p} on={d.audience.plans.includes(p)} onClick={() => setA('plans', toggle(d.audience.plans, p))}>{PLAN[p]}</Chip>
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              {([
                ['joinedWithinDays', 'Joined in the last … days'],
                ['activeWithinDays', 'Active in the last … days'],
                ['inactiveForDays', 'Not active for … days'],
              ] as const).map(([k, label]) => (
                <Field key={k} label={label}>
                  <Input type="number" min={1} value={d.audience[k] ?? ''} onChange={(e) => setA(k, e.target.value ? Number(e.target.value) : null)} placeholder="Any" />
                </Field>
              ))}
            </div>
            <Field label="Chats with these characters" hint="Anyone who has a chat with at least one of them.">
              <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                {options?.characters.map((c) => (
                  <Chip key={c.id} on={d.audience.characterIds.includes(c.id)} onClick={() => setA('characterIds', toggle(d.audience.characterIds, c.id))}>{c.name}</Chip>
                ))}
              </div>
            </Field>
            <Field label="…or with characters in these categories">
              <div className="flex flex-wrap gap-1.5">
                {options?.categories.map((c) => (
                  <Chip key={c.id} on={d.audience.categoryIds.includes(c.id)} onClick={() => setA('categoryIds', toggle(d.audience.categoryIds, c.id))}>{c.name}</Chip>
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="On an app older than" hint="e.g. 1.2.0 — to ask people to update.">
                <Input value={d.audience.appVersionBelow ?? ''} onChange={(e) => setA('appVersionBelow', e.target.value.trim() || null)} placeholder="Any version" />
              </Field>
              <Field label="Only these accounts" hint="One email per line. Leave empty for everyone who matches above.">
                <textarea
                  className={textarea}
                  rows={2}
                  value={emailsText}
                  onChange={(e) => {
                    setEmailsText(e.target.value);
                    setA('emails', e.target.value.split(/[\s,;]+/).map((x) => x.trim()).filter((x) => x.includes('@')));
                  }}
                  placeholder="priya@gmail.com"
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-surface-2 p-3 text-sm">
              <Users size={16} className="text-accent" />
              {size ? (
                <>
                  <span><b>{count(size.willReceive)}</b> will get it</span>
                  {d.surfaces.includes('push') && <span><b>{count(size.phoneNotifications)}</b> on their phone</span>}
                  <span className="text-muted">{count(size.matched)} match</span>
                  {size.optedOut > 0 && <span className="text-muted">{count(size.optedOut)} switched this off</span>}
                  {size.skippedRecent > 0 && <span className="text-muted">{count(size.skippedRecent)} got one recently</span>}
                </>
              ) : (
                <span className="text-muted">Counting…</span>
              )}
            </div>
          </CardBody>
        </Card>

        {/* 4. When */}
        <Card>
          <CardHeader><CardTitle>4. When</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Chip on={d.schedule.mode === 'now'} onClick={() => set('schedule', { mode: 'now' })}>Now</Chip>
              <Chip on={d.schedule.mode === 'at'} onClick={() => set('schedule', { mode: 'at', at: d.schedule.at ?? null })}>At a date and time</Chip>
              <Chip on={d.schedule.mode === 'local'} onClick={() => set('schedule', { mode: 'local', localHour: d.schedule.localHour ?? 19 })}>At an hour in each person’s time</Chip>
            </div>
            {d.schedule.mode === 'at' && (
              <Input
                type="datetime-local"
                className="sm:w-64"
                value={d.schedule.at ? toLocalInput(d.schedule.at) : ''}
                onChange={(e) => set('schedule', { mode: 'at', at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            )}
            {d.schedule.mode === 'local' && (
              <Field label="Hour" hint="Goes out over the next 26 hours as that hour comes round for each person.">
                <select className={cn(select, 'sm:w-40')} value={d.schedule.localHour ?? 19} onChange={(e) => set('schedule', { mode: 'local', localHour: Number(e.target.value) })}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
                  ))}
                </select>
              </Field>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <span className="text-sm">Wait for quiet hours to end<span className="block text-xs text-muted">Nobody woken at night</span></span>
                <Switch checked={d.respectQuietHours} onChange={(v) => set('respectQuietHours', v)} label="Quiet hours" />
              </div>
              <Field label="Skip people who got one in the last … days">
                <Input type="number" min={0} max={30} value={d.skipRecentDays} onChange={(e) => set('skipRecentDays', Math.max(0, Number(e.target.value) || 0))} />
              </Field>
              <Field label="Stop showing after … days">
                <Input type="number" min={1} max={60} value={d.expiresInDays ?? ''} placeholder="Never" onChange={(e) => set('expiresInDays', e.target.value ? Number(e.target.value) : null)} />
              </Field>
            </div>
          </CardBody>
        </Card>

        {/* Actions */}
        <Card>
          <CardBody className="space-y-4 pt-5">
            {error && <p className="text-sm text-bad">{error}</p>}
            {note && <p className="text-sm text-good">{note}</p>}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label="Send a test to (your app account email)">
                <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@gmail.com" />
              </Field>
              <Button type="button" variant="secondary" disabled={!testEmail.includes('@') || test.isPending} onClick={() => { setNote(''); test.mutate(); }}>
                {test.isPending ? 'Sending…' : 'Send test'}
              </Button>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="ghost" onClick={() => run(async () => { await save(true); setNote('Saved as a template.'); })}>Save as template</Button>
              <Button type="button" variant="secondary" onClick={() => run(async () => { await save(); setNote('Draft saved.'); })}>Save draft</Button>
              {!d.isTemplate && (
                <Button type="button" onClick={() => { setError(''); setConfirm(true); }}>
                  <Send size={14} /> {d.schedule.mode === 'now' ? 'Send…' : 'Schedule…'}
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <CardBody><NotificationPreview draft={d} options={options} /></CardBody>
        </Card>
      </div>

      <Modal open={confirm} title={d.schedule.mode === 'now' ? 'Send this now?' : 'Schedule this?'} onClose={() => setConfirm(false)}>
        <div className="space-y-4 text-sm">
          <p>
            <b>{count(size?.willReceive ?? 0)}</b> people will get “{d.title || d.body.slice(0, 40)}” {when}
            {d.surfaces.includes('push') && <> — <b>{count(size?.phoneNotifications ?? 0)}</b> of them as a phone notification</>}.
          </p>
          <p className="text-muted">Shows as: {d.surfaces.map((s) => SURFACE[s].label.toLowerCase()).join(', ')}. You can stop it while it’s going out, but sent notifications can’t be taken back.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button disabled={send.isPending || !size?.willReceive} onClick={() => send.mutate()}>
              {send.isPending ? 'Sending…' : d.schedule.mode === 'now' ? `Send to ${count(size?.willReceive ?? 0)}` : 'Schedule'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/** ISO → value for <input type="datetime-local"> in the admin's own time zone. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
