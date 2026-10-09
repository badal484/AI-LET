'use client';
import { useEffect, useState } from 'react';

/** Shows that a screen is live: refreshes on its own and says how fresh the numbers are. */
export function Live({ updatedAt, fetching }: { updatedAt: number; fetching?: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt) / 1000)) : null;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <span className={`h-2 w-2 rounded-full ${fetching ? 'animate-pulse bg-warn' : 'bg-good'}`} />
      Live{secs != null && ` · updated ${secs < 5 ? 'just now' : `${secs}s ago`}`}
    </span>
  );
}

/** How often live screens refresh. */
export const LIVE_MS = 15_000;
