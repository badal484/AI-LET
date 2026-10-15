/** "P1D" → 1, "P3D" → 3, "P1W" → 7, "P1M" → 30 (Play's ISO-8601 billing periods). */
export function isoDays(period: string): number {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(period ?? '');
  if (!m) return 1;
  const [, y, mo, w, d] = m.map((x) => Number(x ?? 0));
  return Math.max(1, y * 365 + mo * 30 + w * 7 + d);
}
