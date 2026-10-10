/**
 * Home-screen category chips that follow the scroll (like menu tabs in food apps):
 * which section is on screen, and the short chip label for each section.
 */

/** Short chip names for known categories; anything else falls back to the section title. */
const SHORT_LABELS: Record<string, string> = {
  love: 'Love',
  friendship: 'Friends',
  astrology: 'Astrology',
  health: 'Health',
  coaching: 'Coaching',
  'learn-earn': 'Learn & Earn',
  professionals: 'Professionals',
  neighbours: 'Neighbours',
  wisdom: 'Wisdom',
};

export function chipLabelFor(section: { id?: string | null; title?: string | null }): string {
  const slug = (section.id || '').replace('section_cat_', '');
  if (SHORT_LABELS[slug]) return SHORT_LABELS[slug]!;
  // "❤️ Love & Romance" → "Love"
  const words = (section.title || '').replace(/[^\p{L}\p{N}\s&]/gu, '').trim().split(/\s+/);
  return words[0] || 'More';
}

/**
 * The section being read at this scroll position: the last one whose top has passed a line
 * `lead` pixels below the top of the list. Above the first section it's "All" (null).
 */
export function activeSectionAt(sections: Array<{ id: string; y: number }>, scrollY: number, lead = 80, atEnd = false): string | null {
  const ordered = [...sections].sort((a, b) => a.y - b.y);
  // At the bottom of the page the last rows can never reach the top, so the last one is "current".
  if (atEnd && ordered.length) return ordered[ordered.length - 1]!.id;
  let active: string | null = null;
  for (const s of ordered) {
    if (s.y <= scrollY + lead) active = s.id;
    else break;
  }
  return active;
}
