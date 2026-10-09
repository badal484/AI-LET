'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { ApiError, api } from '@/lib/api';

export interface EditableCharacter { id: string; name: string; tagline: string; avatarUrl: string; coverImageUrl: string; gallery: string[] }

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


/** Recommended sizes (what looks sharp in the app), and the minimum before a photo looks blurry. */
const SIZE_GUIDE = {
  avatar: { text: 'Square 1:1 · best 1080×1080 px (min 600×600) · face in the centre', minW: 600, minH: 600 },
  cover: { text: 'Wide 16:9 · best 1920×1080 px (min 1200×675) · subject in the middle', minW: 1200, minH: 675 },
  gallery: { text: 'Portrait 4:5 · best 1080×1350 px (min 800×1000) · same person in every photo', minW: 800, minH: 1000 },
} as const;

/** Reads a photo's pixel size in the browser (HEIC may not decode — then we just skip the check). */
async function photoSize(file: File): Promise<{ w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const size = { w: bmp.width, h: bmp.height };
    bmp.close();
    return size;
  } catch {
    return null;
  }
}

async function sizeWarning(file: File, kind: keyof typeof SIZE_GUIDE): Promise<string | null> {
  const s = await photoSize(file);
  const g = SIZE_GUIDE[kind];
  if (!s || (s.w >= g.minW && s.h >= g.minH)) return null;
  return `${file.name} is small (${s.w}×${s.h}) — it may look blurry. Recommended at least ${g.minW}×${g.minH}.`;
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
      <p className="text-[11px] leading-snug text-muted">{hint}</p>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
    </div>
  );
}


const MAX_GALLERY = 12;

/** The photo grid on the character's profile in the app: add several at once, reorder, remove. */
function Gallery({ characterId, images, onChange }: { characterId: string; images: string[]; onChange: (g: string[]) => void }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  const addFiles = async (files: File[]) => {
    const room = MAX_GALLERY - images.length;
    const list = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)).slice(0, Math.max(0, room));
    if (!list.length) return setError(room <= 0 ? `The gallery is full (${MAX_GALLERY} photos) — remove one first.` : 'Pick photos (JPG, PNG, WebP or HEIC).');
    setError(files.length > list.length && room < files.length ? `Only ${room} more photo(s) fit — added the first ${list.length}.` : null);
    const small = (await Promise.all(list.map((f) => sizeWarning(f, 'gallery')))).filter(Boolean);
    if (small.length && !window.confirm(`${small.length} photo(s) are smaller than recommended and may look blurry:\n${small.slice(0, 4).join('\n')}\n\nUpload anyway?`)) return;
    setProgress({ done: 0, total: list.length });
    let latest = images;
    for (const [i, file] of list.entries()) {
      try {
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is over 10 MB`);
        const res = await fetch(`/api/v1/admin/console/characters/${characterId}/gallery`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': file.type || 'image/jpeg' }, body: file });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.success === false) throw new Error(body?.error?.message ?? `Upload failed (${file.name})`);
        latest = body.data.gallery;
        onChange(latest);
      } catch (err) {
        setError((err as Error).message);
      }
      setProgress({ done: i + 1, total: list.length });
    }
    setProgress(null);
    void qc.invalidateQueries({ queryKey: ['characters'] });
  };

  const save = useMutation({
    mutationFn: (next: string[]) => api<{ gallery: string[] }>(`/console/characters/${characterId}/gallery`, { method: 'PUT', body: JSON.stringify({ images: next }) }),
    onSuccess: (d) => { onChange(d.gallery); void qc.invalidateQueries({ queryKey: ['characters'] }); },
    onError: (e) => setError((e as Error).message),
  });
  const move = (i: number, by: number) => {
    const next = [...images];
    const [x] = next.splice(i, 1);
    next.splice(i + by, 0, x!);
    save.mutate(next);
  };
  const remove = (i: number) => {
    if (!window.confirm('Remove this photo from the gallery?')) return;
    save.mutate(images.filter((_, j) => j !== i));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Gallery <span className="text-xs">({images.length}/{MAX_GALLERY}) · shown on the profile, first 6 in order</span></p>
      </div>
      <p className="-mt-1 text-[11px] leading-snug text-muted">{SIZE_GUIDE.gallery.text}</p>
      <div className="grid grid-cols-4 gap-2">
        {images.map((url, i) => (
          <div key={url} className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-surface-2">
            <img src={url} alt="" className="h-full w-full object-cover" />
            {i < 6 && <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[10px] text-white">{i + 1}</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" disabled={i === 0 || save.isPending} onClick={() => move(i, -1)} className="rounded p-0.5 text-white disabled:opacity-30" aria-label="Move left"><ChevronLeft size={14} /></button>
              <button type="button" disabled={save.isPending} onClick={() => remove(i)} className="rounded p-0.5 text-white" aria-label="Remove photo"><X size={14} /></button>
              <button type="button" disabled={i === images.length - 1 || save.isPending} onClick={() => move(i, 1)} className="rounded p-0.5 text-white disabled:opacity-30" aria-label="Move right"><ChevronRight size={14} /></button>
            </div>
          </div>
        ))}
        {images.length < MAX_GALLERY && (
          <button
            type="button"
            disabled={progress !== null}
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); void addFiles([...e.dataTransfer.files]); }}
            className={`flex aspect-[4/5] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs text-muted hover:text-text ${drag ? 'border-accent' : 'border-border'}`}
          >
            {progress ? <><Loader2 size={18} className="animate-spin" />{progress.done}/{progress.total}</> : <><ImagePlus size={18} />Add photos</>}
          </button>
        )}
      </div>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic" className="hidden" onChange={(e) => { void addFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}

export function CharacterEditor({ character, onClose }: { character: EditableCharacter | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [avatar, setAvatar] = useState('');
  const [cover, setCover] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);

  if (character && opened !== character.id) {
    setOpened(character.id);
    setAvatar(character.avatarUrl);
    setCover(character.coverImageUrl);
    setGallery(character.gallery ?? []);
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

  const pick = (kind: 'avatar' | 'cover') => async (file: File) => {
    if (file.size > 10 * 1024 * 1024) return setNote('That photo is over 10 MB — pick a smaller one.');
    const warn = await sizeWarning(file, kind);
    if (warn && !window.confirm(`${warn}\n\nUpload anyway?`)) return;
    upload.mutate({ kind, file });
  };

  return (
    <Modal open={character !== null} onClose={onClose} title={`Edit ${character?.name ?? ''}`}>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="flex gap-5">
          <PhotoPicker label="Profile photo" hint={SIZE_GUIDE.avatar.text} url={avatar} round busy={upload.isPending && upload.variables?.kind === 'avatar'} onPick={pick('avatar')} />
          <div className="min-w-0 flex-1">
            <PhotoPicker label="Cover photo" hint={SIZE_GUIDE.cover.text} url={cover} busy={upload.isPending && upload.variables?.kind === 'cover'} onPick={pick('cover')} />
          </div>
        </div>
        {character && <Gallery characterId={character.id} images={gallery} onChange={setGallery} />}
        <p className="-mt-2 text-[11px] leading-snug text-muted">Drag a photo onto a box or click it. JPG, PNG, WebP or HEIC, up to 10 MB each. Bigger is fine — every photo is cropped and compressed automatically. Photos change in the app right away.</p>
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
