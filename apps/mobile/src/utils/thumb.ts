import { Image, PixelRatio } from 'react-native';

/**
 * A photo address sized and compressed for where it's shown: ImageKit and Unsplash resize and convert to WebP
 * on their servers (3–10× smaller payload). Other addresses are returned unchanged.
 */
export function thumb(url: string | null | undefined, widthPt: number): string | undefined {
  if (!url) return undefined;
  const px = Math.min(1600, Math.round(PixelRatio.getPixelSizeForLayoutSize(widthPt) / 50) * 50 || 200);
  try {
    if (url.includes('ik.imagekit.io')) {
      const u = new URL(url);
      u.searchParams.set('tr', `w-${px},q-75,f-webp`);
      return u.toString();
    }
    if (url.includes('images.unsplash.com')) {
      const u = new URL(url);
      u.searchParams.set('w', String(px));
      u.searchParams.set('q', '75');
      u.searchParams.set('fm', 'webp');
      u.searchParams.set('auto', 'format');
      u.searchParams.set('fit', 'crop');
      return u.toString();
    }
    if (url.includes('res.cloudinary.com')) {
      // Cloudinary format: /upload/f_auto,q_auto,w_${px}/...
      return url.replace('/upload/', `/upload/f_auto,q_auto,w_${px}/`);
    }
  } catch {
    // not a full URL
  }
  return url;
}

/**
 * Prime disk cache for critical images ahead of time so they load instantaneously with 0 network lag.
 */
export function prefetchImages(urls: Array<string | null | undefined>, widthPt = 160): void {
  const seen = new Set<string>();
  for (const raw of urls) {
    const finalUrl = thumb(raw, widthPt);
    if (finalUrl && finalUrl.startsWith('http') && !seen.has(finalUrl)) {
      seen.add(finalUrl);
      Image.prefetch(finalUrl).catch(() => undefined);
    }
  }
}
