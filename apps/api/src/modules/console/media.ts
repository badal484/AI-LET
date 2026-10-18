import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { BadRequestError } from '../../shared/errors/AppError.js';

/**
 * Character photos uploaded from the admin console. Every upload is cropped and compressed to WebP
 * (profile 600×600, cover 1200 wide) so the app loads fast, then stored:
 *  - in ImageKit when IMAGEKIT_PRIVATE_KEY is set (the owner's choice, 18 Oct 2026): permanent, served from
 *    ImageKit's CDN; optional IMAGEKIT_FOLDER (default /lovira);
 *  - else in object storage when configured (Cloudflare R2 / S3): S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID,
 *    S3_SECRET_ACCESS_KEY and MEDIA_PUBLIC_URL (the bucket's public URL, e.g. https://media.lovira.app);
 *  - otherwise on this server's disk (apps/api/uploads, served at /media) — fine on a laptop, but lost
 *    on every deploy of a cloud host, so set up ImageKit before launch.
 */

export type ImageKind = 'avatar' | 'cover' | 'gallery' | 'banner';

const SIZES: Record<ImageKind, { width: number; height?: number }> = {
  avatar: { width: 600, height: 600 },
  cover: { width: 1200 },
  // Portrait, like the gallery cards on the character's profile in the app.
  gallery: { width: 800, height: 1000 },
  // Notification big picture / popup card: 2:1, what Android shows when a notification is expanded.
  banner: { width: 1200, height: 600 },
};

export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const MAX_BYTES = 10 * 1024 * 1024;

const imagekitConfigured = () => Boolean(process.env['IMAGEKIT_PRIVATE_KEY']);
const s3Configured = () => Boolean(process.env['S3_ACCESS_KEY_ID'] && process.env['S3_SECRET_ACCESS_KEY'] && process.env['MEDIA_PUBLIC_URL']);

let client: S3Client | null = null;
const s3 = () =>
  (client ??= new S3Client({
    region: process.env['S3_REGION'] || 'auto',
    endpoint: process.env['S3_ENDPOINT'] || undefined,
    credentials: { accessKeyId: process.env['S3_ACCESS_KEY_ID']!, secretAccessKey: process.env['S3_SECRET_ACCESS_KEY']! },
  }));

export async function processImage(input: Buffer, kind: ImageKind): Promise<Buffer> {
  if (!input?.length) throw new BadRequestError('No image received.');
  if (input.length > MAX_BYTES) throw new BadRequestError('Image is too big (max 10 MB).');
  const meta = await sharp(input).metadata().catch(() => null);
  if (!meta?.format || !['jpeg', 'png', 'webp', 'heif', 'avif', 'gif'].includes(meta.format)) {
    throw new BadRequestError('Use a JPG, PNG, WebP or HEIC photo.');
  }
  const { width, height } = SIZES[kind];
  return sharp(input)
    .rotate() // respect phone camera orientation
    .resize({ width, height, fit: 'cover', position: 'attention', withoutEnlargement: false })
    .webp({ quality: 82 })
    .toBuffer();
}

/** Stores the processed image and returns its public URL. */
export async function storeImage(buffer: Buffer, folder: string, kind: ImageKind): Promise<string> {
  const key = `${folder}/${kind}-${randomUUID().slice(0, 8)}.webp`;
  if (imagekitConfigured()) return uploadToImageKit(buffer, key);
  if (s3Configured()) {
    await s3().send(
      new PutObjectCommand({
        Bucket: process.env['S3_BUCKET'],
        Key: key,
        Body: buffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${process.env['MEDIA_PUBLIC_URL']!.replace(/\/$/, '')}/${key}`;
  }
  const file = path.join(UPLOAD_DIR, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buffer);
  const origin = (process.env['PUBLIC_API_URL'] || process.env['RENDER_EXTERNAL_URL'] || `http://localhost:${process.env['PORT'] || 4000}`).replace(/\/$/, '');
  return `${origin}/media/${key}`;
}

/** ImageKit's upload API (private key as Basic auth, server side only); returns the file's CDN URL. */
async function uploadToImageKit(buffer: Buffer, key: string): Promise<string> {
  const root = (process.env['IMAGEKIT_FOLDER'] || '/lovira').replace(/\/$/, '');
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: 'image/webp' }), path.basename(key));
  form.append('fileName', path.basename(key));
  form.append('folder', `${root}/${path.dirname(key)}`);
  form.append('useUniqueFileName', 'false'); // the name already has a random part
  const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${process.env['IMAGEKIT_PRIVATE_KEY']}:`).toString('base64')}` },
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
  if (!res.ok || !body.url) throw new Error(`ImageKit upload failed (${res.status}): ${body.message ?? 'no URL returned'}`);
  return body.url;
}

export const storageMode = () => (imagekitConfigured() || s3Configured() ? 'cloud' : 'local');
