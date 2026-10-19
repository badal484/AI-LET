import { PixelRatio } from 'react-native';

/**
 * A photo address sized for where it's shown: ImageKit and Unsplash resize on their servers, so a 148-pt card loads
 * a ~450 px image instead of the full photo (3–5× less to download). Other addresses are returned unchanged.
 */
export function thumb(url: string | null | undefined, widthPt: number): string | undefined {
  if (!url) return undefined;
  const px = Math.min(1600, Math.round(PixelRatio.getPixelSizeForLayoutSize(widthPt) / 50) * 50 || 200);
  try {
    if (url.includes('ik.imagekit.io')) {
      const u = new URL(url);
      u.searchParams.set('tr', `w-${px},q-80`);
      return u.toString();
    }
    if (url.includes('images.unsplash.com')) {
      const u = new URL(url);
      u.searchParams.set('w', String(px));
      u.searchParams.set('q', '75');
      u.searchParams.set('auto', 'format');
      return u.toString();
    }
  } catch {
    // not a full URL
  }
  return url;
}
