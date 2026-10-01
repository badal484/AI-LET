import { describe, expect, it } from 'vitest';
import { activeSectionAt, chipLabelFor } from '../src/utils/sectionSpy.js';

const sections = [
  { id: 'love', y: 0 },
  { id: 'friendship', y: 500 },
  { id: 'astrology', y: 1000 },
];

describe('Home chips follow the scroll', () => {
  it('highlights the section being read', () => {
    expect(activeSectionAt(sections, 0)).toBe('love');
    expect(activeSectionAt(sections, 300)).toBe('love');
    expect(activeSectionAt(sections, 430)).toBe('friendship'); // its title is near the top
    expect(activeSectionAt(sections, 2000)).toBe('astrology');
  });

  it('highlights the last row only at the true bottom of the page', () => {
    expect(activeSectionAt(sections, 700)).toBe('friendship');
    expect(activeSectionAt(sections, 700, 80, true)).toBe('astrology');
  });

  it('is "All" above the first section', () => {
    expect(activeSectionAt([{ id: 'love', y: 300 }], 0)).toBeNull();
  });

  it('works whatever order the layouts were measured in', () => {
    expect(activeSectionAt([...sections].reverse(), 600)).toBe('friendship');
  });

  it('uses short chip names', () => {
    expect(chipLabelFor({ id: 'section_cat_friendship', title: '🤝 Friendship & Banter' })).toBe('Friends');
    expect(chipLabelFor({ id: 'section_cat_learn-earn', title: '🪙 Learn & Earn' })).toBe('Learn');
    expect(chipLabelFor({ id: 'section_cat_new', title: '🎨 Creative Arts' })).toBe('Creative');
  });
});
