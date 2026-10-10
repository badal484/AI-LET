'use client';
import { Bell, ChevronDown, Heart, X } from 'lucide-react';
import { useState } from 'react';
import { personalize, type CampaignDraft, type ComposerOptions } from '@/lib/campaigns';
import { cn } from '@/lib/utils';

/** How the campaign will look on an Android phone: the notification (closed / opened), the popup and the banner. */

type View = 'closed' | 'open' | 'popup' | 'banner';

export function NotificationPreview({ draft, options }: { draft: CampaignDraft; options?: ComposerOptions }) {
  const sender = options?.characters.find((c) => c.id === draft.senderCharacterId);
  const views: Array<{ id: View; label: string; on: boolean }> = [
    { id: 'closed', label: 'Notification', on: draft.surfaces.includes('push') },
    { id: 'open', label: 'Opened', on: draft.surfaces.includes('push') },
    { id: 'popup', label: 'Popup', on: draft.surfaces.includes('popup') },
    { id: 'banner', label: 'Banner', on: draft.surfaces.includes('banner') },
  ];
  const available = views.filter((v) => v.on);
  const [picked, setPicked] = useState<View>('closed');
  const view = available.find((v) => v.id === picked)?.id ?? available[0]?.id;

  const title = personalize(draft.title || sender?.name || 'Lovira', sender?.name);
  const body = personalize(draft.body, sender?.name);
  const buttons = draft.buttons.filter((b) => b.label.trim());

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        {available.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setPicked(v.id)}
            className={cn('rounded-md px-2.5 py-1 text-xs', view === v.id ? 'bg-accent-soft text-accent' : 'text-muted hover:text-text')}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Phone */}
      <div className="mx-auto w-[300px] rounded-[2.2rem] border-[6px] border-neutral-800 bg-[#0d0a14] p-3 shadow-xl">
        <div className="mb-3 flex justify-between px-2 text-[10px] text-white/70">
          <span>9:41</span>
          <span>●●● 5G</span>
        </div>

        {!view && <p className="py-24 text-center text-xs text-white/60">Pick where it shows to see a preview.</p>}

        {(view === 'closed' || view === 'open') && (
          <div className="rounded-2xl bg-[#2a2433] p-3 text-white">
            <div className="flex items-center gap-1.5 text-[11px] text-white/70">
              <Heart size={11} className="fill-pink-500 text-pink-500" />
              <span>Lovira</span>
              <span>· now</span>
              <ChevronDown size={12} className={cn('ml-auto transition-transform', view === 'open' && 'rotate-180')} />
            </div>
            <div className="mt-1.5 flex gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{title}</p>
                <p className={cn('text-[12px] text-white/80', view === 'closed' ? 'line-clamp-1' : 'whitespace-pre-wrap')}>{body}</p>
              </div>
              {view === 'closed' && draft.imageUrl && <img src={draft.imageUrl} alt="" className="h-10 w-10 rounded-md object-cover" />}
            </div>
            {view === 'open' && draft.imageUrl && <img src={draft.imageUrl} alt="" className="mt-2 aspect-[2/1] w-full rounded-lg object-cover" />}
          </div>
        )}

        {view === 'popup' && (
          <div className="relative flex min-h-[420px] items-center bg-black/50 py-6">
            <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#15111d] text-white">
              {draft.imageUrl ? (
                <img src={draft.imageUrl} alt="" className="aspect-[2/1] w-full object-cover" />
              ) : sender ? (
                <div className="flex justify-center pt-5">
                  {sender.avatarUrl ? <img src={sender.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" /> : <div className="h-16 w-16 rounded-full bg-pink-500/30" />}
                </div>
              ) : null}
              <span className="absolute right-2 top-2 rounded-full bg-black/50 p-1">
                <X size={10} />
              </span>
              <div className="space-y-1.5 p-4">
                {sender && draft.imageUrl && <p className="text-[11px] font-semibold text-white/70">{sender.name}</p>}
                <p className="text-[15px] font-bold leading-tight">{title}</p>
                {body && <p className="text-[12px] leading-snug text-white/75">{body}</p>}
                <div className="space-y-1.5 pt-2">
                  {(buttons.length ? buttons : [{ label: draft.link ? 'Open' : 'OK', link: '' }]).map((b, i) => (
                    <div key={i} className={cn('rounded-xl py-2 text-center text-[12px] font-semibold', i === 0 ? 'bg-violet-500' : 'text-white/70')}>
                      {b.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'banner' && (
          <div className="flex min-h-[420px] flex-col justify-end pb-14">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#211b2b] p-3 text-white">
              {sender?.avatarUrl ? (
                <img src={sender.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-500/20">
                  <Bell size={14} className="text-pink-400" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-bold">{title}</p>
                <p className="line-clamp-2 text-[11px] text-white/70">{body}</p>
              </div>
              <X size={12} className="text-white/50" />
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-muted">{'{name}'} shows as each person’s first name (here: Priya).</p>
    </div>
  );
}
