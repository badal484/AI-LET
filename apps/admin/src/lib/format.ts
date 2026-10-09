/** ₹ with Indian grouping (₹1,23,456). Small amounts keep paise. */
export const rupees = (n: number | null | undefined, digits?: number) =>
  n == null
    ? '—'
    : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: digits ?? (Math.abs(n) < 10 && n !== 0 ? 2 : 0), maximumFractionDigits: digits ?? (Math.abs(n) < 10 ? 2 : 0) })}`;

export const count = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-IN'));

export const percent = (r: number | null | undefined) => (r == null ? '—' : `${Math.round(r * 100)}%`);

export const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
