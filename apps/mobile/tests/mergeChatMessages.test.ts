import { describe, expect, it } from 'vitest';
import { mergeChatMessages } from '../src/utils/mergeChatMessages.js';

const at = (hhmm: string) => new Date(`2026-10-14T${hhmm}:00+05:30`).toISOString();
const msg = (id: string, hhmm: string) => ({ id, createdAt: at(hhmm) });

describe('chat list order', () => {
  const now = new Date(at('21:38')).getTime() + 30_000;
  const server = [msg('her-21:38', '21:38'), msg('me-21:38', '21:38'), msg('her-21:37', '21:37')]; // newest first

  it('a message still being sent sits at the bottom (newest)', () => {
    const sending = msg('temp-now', '21:38');
    expect(mergeChatMessages([sending], server, now)[0]!.id).toBe('temp-now');
  });

  it('an old phone-only message is placed by its time, not pinned under newer replies (the bug of 14 Oct)', () => {
    const old = msg('local-21:31', '21:31');
    const list = mergeChatMessages([old], server, now).map((m) => m.id);
    expect(list[0]).not.toBe('local-21:31');
    expect(list[list.length - 1]).toBe('local-21:31');
  });

  it('keeps the server order when there is nothing local', () => {
    expect(mergeChatMessages([], server, now).map((m) => m.id)).toEqual(server.map((m) => m.id));
  });
});
