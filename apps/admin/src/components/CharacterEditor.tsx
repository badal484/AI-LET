'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ApiError, api } from '@/lib/api';

export interface EditableCharacter { id: string; name: string; tagline: string; avatarUrl: string; coverImageUrl: string }

/** Uploads one photo as the raw body; the server crops, compresses and stores it. */
async function uploadImage(id: string, kind: 'avatar' | 'cover', file: File): Promise<{ url: string; storage: string }> {
  const res = await fetch(`/api/v1/admin/console/characters/${id}/image?kind=${kind}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': file.type || 'image/jpeg' },
    body: file,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) throw new ApiError(res.status, body?.error?.message ?? 'Upload failed');
  return body.data;
}

function PhotoPicker({ label, hint, url, round, busy, onPick }: { label: string; hint: string; url: string; round?: boolean; busy: boolean; onPick: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted">{label}</p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onPick(f); }}
        className={`group relative block overflow-hidden border-2 border-dashed ${drag ? 'border-accent' : 'border-border'} ${round ? 'h-28 w-28 rounded-full' : 'h-32 w-full rounded-xl'}`}
        aria-label={`Change ${label.toLowerCase()}`}
      >
        {url && <img src={url} alt="" className="h-full w-full object-cover" />}
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
          {busy ? <Loader2 className="animate-spin" size={20} /> : <ImagePlus size={20} />}
          {busy ? 'Uploading…' : 'Change'}
        </span>
        {busy && <span className="absolute inset-0 flex items-center justify-center bg-black/55"><Loader2 className="animate-spin text-white" size={22} /></span>}
      </button>
      <p className="text-xs text-muted">{hint}</p>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
    </div>
  );
}

export function CharacterEditor({ character, onClose }: { character: EditableCharacter | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [avatar, setAvatar] = useState('');
  const [cover, setCover] = useState('');
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);

  if (character && opened !== character.id) {
    setOpened(character.id);
    setAvatar(character.avatarUrl);
    setCover(character.coverImageUrl);
    setName(character.name);
    setTagline(character.tagline);
    setNote(null);
  }

  const upload = useMutation({
    mutationFn: (v: { kind: 'avatar' | 'cover'; file: File }) => uploadImage(character!.id, v.kind, v.file),
    onSuccess: (d, v) => {
      if (v.kind === 'avatar') setAvatar(d.url);
      else setCover(d.url);
      setNote(d.storage === 'local' ? 'Saved on this computer (local storage). Set up Cloudflare R2 before launch so photos survive deploys.' : 'Saved to cloud storage.');
      void qc.invalidateQueries({ queryKey: ['characters'] });
    },
  });
  const save = useMutation({
    mutationFn: () => api(`/console/characters/${character!.id}`, { method: 'PATCH', body: JSON.stringify({ name, tagline }) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['characters'] }); onClose(); },
  });

  const pick = (kind: 'avatar' | 'cover') => (file: File) => {
    if (file.size > 10 * 1024 * 1024) return setNote('That photo is over 10 MB — pick a smaller one.');
    upload.mutate({ kind, file });
  };

  return (
    <Modal open={character !== null} onClose={onClose} title={`Edit ${character?.name ?? ''}`}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="flex gap-5">
          <PhotoPicker label="Profile photo" hint="Square, face centred" url={avatar} round busy={upload.isPending && upload.variables?.kind === 'avatar'} onPick={pick('avatar')} />
          <div className="min-w-0 flex-1">
            <PhotoPicker label="Cover photo" hint="Wide (shown on the profile)" url={cover} busy={upload.isPending && upload.variables?.kind === 'cover'} onPick={pick('cover')} />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted">Drag a photo onto a box or click it. JPG, PNG, WebP or HEIC up to 10 MB — it's cropped and compressed automatically. Photos change in the app right away.</p>
        <label className="block space-y-1.5"><span className="text-sm text-muted">Name</span><Input required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="block space-y-1.5"><span className="text-sm text-muted">Tagline (shown under the name)</span><Input required minLength={2} maxLength={255} value={tagline} onChange={(e) => setTagline(e.target.value)} /></label>
        {(upload.error || save.error) && <p className="text-sm text-bad">{((upload.error ?? save.error) as Error).message}</p>}
        {note && !upload.error && <p className="text-xs text-muted">{note}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
          <Button type="submit" disabled={save.isPending || upload.isPending}>{save.isPending ? 'Saving…' : 'Save name & tagline'}</Button>
        </div>
      </form>
    </Modal>
  );
}
