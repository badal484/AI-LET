import { create } from 'zustand';

interface DiscoveryState {
  recentSearches: string[];
  favoriteIds: Set<string>;
  selectedCategory: string | null;
  addRecentSearch: (query: string) => void;
  removeRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  setFavorites: (ids: string[]) => void;
  toggleFavoriteOptimistic: (characterId: string) => boolean;
  setSelectedCategory: (categorySlug: string | null) => void;
}

export const useDiscoveryStore = create<DiscoveryState>((set, get) => ({
  recentSearches: ['Elena', 'Companion', 'Stoic philosophy', 'Creative writer'],
  favoriteIds: new Set<string>(),
  selectedCategory: null,

  addRecentSearch: query => {
    const trimmed = query.trim();
    if (!trimmed) return;
    set(state => {
      const filtered = state.recentSearches.filter(
        q => q.toLowerCase() !== trimmed.toLowerCase(),
      );
      return {
        recentSearches: [trimmed, ...filtered].slice(0, 10),
      };
    });
  },

  removeRecentSearch: query => {
    set(state => ({
      recentSearches: state.recentSearches.filter(
        q => q.toLowerCase() !== query.toLowerCase(),
      ),
    }));
  },

  clearRecentSearches: () => {
    set({ recentSearches: [] });
  },

  setFavorites: ids => {
    set({ favoriteIds: new Set(ids) });
  },

  toggleFavoriteOptimistic: characterId => {
    const current = get().favoriteIds;
    const isNowFavorite = !current.has(characterId);
    const updated = new Set(current);
    if (isNowFavorite) {
      updated.add(characterId);
    } else {
      updated.delete(characterId);
    }
    set({ favoriteIds: updated });
    return isNowFavorite;
  },

  setSelectedCategory: categorySlug => {
    set({ selectedCategory: categorySlug });
  },
}));
