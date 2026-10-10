'use client';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import { date } from '@/lib/format';

export interface ReviewTarget {
  momentId?: string;
  messageId?: string;
  title: string;
}

type Msg = { id: string; role: string; content: string; createdAt: string };

/**
 * Opens the few messages around a safety moment or a rated reply. Chats are private: the admin
 * gives a reason first, and the opening is written to the audit log with their name.
 */
export function ChatReview({ target, onClose }: { target: ReviewTarget | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [chat, setChat] = useState<Msg[] | null>(null);
  const open = useMutation({
    mutationFn: () =>
      api<{ messages: Msg[] }>('/console/safety/review', {
        method: 'POST',
        body: JSON.stringify({ momentId: target?.momentId, messageId: target?.messageId, reason }),
      }),
    onSuccess: (d) => setChat(d.messages),
  });

  useEffect(() => {
    setChat(null);
    setReason('');
    open.reset();
  }, [target]);

  return (
    <Modal open={target !== null} onClose={onClose} title={target?.title ?? ''}>
      {!chat ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            open.mutate();
          }}
        >
          <p className="text-sm text-muted">This opens a private chat. Say why — it's saved in the audit log with your name.</p>
          <Input required placeholder="Reason, e.g. checking why this reply was disliked" value={reason} onChange={(e) => setReason(e.target.value)} />
          {open.error && <p className="text-sm text-bad">{(open.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={open.isPending}>Open chat</Button>
          </div>
        </form>
      ) : (
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {chat.map((m) => (
            <div key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'ml-8 bg-accent-soft' : 'mr-8 bg-surface-2'}`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              <p className="mt-1 text-[11px] text-muted">{m.role === 'user' ? 'User' : 'Character'} · {date(m.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
