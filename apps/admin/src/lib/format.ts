/** ₹ with Indian grouping (₹1,23,456). Small amounts keep paise. */
export const rupees = (n: number | null | undefined, digits?: number) =>
  n == null
    ? '—'
    : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: digits ?? (Math.abs(n) < 10 && n !== 0 ? 2 : 0), maximumFractionDigits: digits ?? (Math.abs(n) < 10 ? 2 : 0) })}`;

export const count = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-IN'));

export const percent = (r: number | null | undefined) => (r == null ? '—' : `${Math.round(r * 100)}%`);

export const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** "3m ago", "2h ago", "5 Oct". */
export function ago(iso: string | null | undefined): string {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
