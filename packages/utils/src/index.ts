/**
 * Pure utility functions for the platform
 */

export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

export const calculatePaginationMeta = (totalItems: number, page: number, limit: number) => {
  const totalPages = Math.ceil(totalItems / limit);
  return {
    total: totalItems,
    page,
    limit,
    totalPages,
    hasMore: page < totalPages,
  };
};

export const truncate = (text: string, maxLength: number, suffix = '...'): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
};
