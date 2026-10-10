import type { ImageSourcePropType } from 'react-native';

const CATEGORY_ORBS: Record<string, ImageSourcePropType> = {
  all: require('../assets/categories/all.jpg'),
  love: require('../assets/categories/love.jpg'),
  astrology: require('../assets/categories/astrology.jpg'),
  'learn-earn': require('../assets/categories/learn_earn.jpg'),
  learn_earn: require('../assets/categories/learn_earn.jpg'),
  learn: require('../assets/categories/learn_earn.jpg'),
  friendship: require('../assets/categories/friends.jpg'),
  friends: require('../assets/categories/friends.jpg'),
  health: require('../assets/categories/health.jpg'),
  coaching: require('../assets/categories/coaching.jpg'),
  wisdom: require('../assets/categories/wisdom.jpg'),
  professionals: require('../assets/categories/professionals.jpg'),
  'working-professionals': require('../assets/categories/professionals.jpg'),
  working_professionals: require('../assets/categories/professionals.jpg'),
  neighbours: require('../assets/categories/neighbours.jpg'),
  'chatty-neighbours': require('../assets/categories/neighbours.jpg'),
  chatty_neighbours: require('../assets/categories/neighbours.jpg'),
};

export function getCategoryOrbImage(slug: string | null | undefined): ImageSourcePropType {
  if (!slug || slug === 'all') {
    return CATEGORY_ORBS.all;
  }
  const cleanSlug = slug.toLowerCase().replace(/^section_cat_/, '');
  if (CATEGORY_ORBS[cleanSlug]) return CATEGORY_ORBS[cleanSlug]!;
  if (cleanSlug.includes('pro')) return CATEGORY_ORBS.professionals;
  if (cleanSlug.includes('neighb')) return CATEGORY_ORBS.neighbours;
  if (cleanSlug.includes('love')) return CATEGORY_ORBS.love;
  if (cleanSlug.includes('astro')) return CATEGORY_ORBS.astrology;
  if (cleanSlug.includes('learn') || cleanSlug.includes('earn')) return CATEGORY_ORBS['learn-earn'];
  if (cleanSlug.includes('friend')) return CATEGORY_ORBS.friendship;
  if (cleanSlug.includes('health')) return CATEGORY_ORBS.health;
  if (cleanSlug.includes('coach')) return CATEGORY_ORBS.coaching;
  if (cleanSlug.includes('wisd')) return CATEGORY_ORBS.wisdom;
  return CATEGORY_ORBS.all;
}
