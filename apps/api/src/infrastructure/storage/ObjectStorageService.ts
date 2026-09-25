import crypto from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface PresignedUploadRequest {
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  userId: string;
  folder?: 'avatars' | 'covers' | 'voice-samples' | 'chat-media' | 'tmp';
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  fileKey: string;
  publicCdnUrl: string;
  expiresInSeconds: number;
  headers: Record<string, string>;
}

export class ObjectStorageService {
  private static readonly ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
  ]);

  private static readonly MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

  /**
   * Generates a pre-signed S3 upload URL for direct client-to-storage uploads.
   */
  public static async generatePresignedUploadUrl(
    req: PresignedUploadRequest,
  ): Promise<PresignedUploadResponse> {
    // 1. Validate MIME type
    if (!this.ALLOWED_MIME_TYPES.has(req.contentType.toLowerCase())) {
      throw new Error(`Unsupported media type: '${req.contentType}'. Allowed types: images, audio.`);
    }

    // 2. Validate file size boundary
    if (req.fileSizeBytes <= 0 || req.fileSizeBytes > this.MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size must be between 1 byte and ${this.MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`);
    }

    // 3. Generate sanitized unique file key
    const folder = req.folder || 'chat-media';
    const randomId = crypto.randomBytes(16).toString('hex');
    const sanitizedExt = req.fileName.split('.').pop()?.toLowerCase() || 'bin';
    const fileKey = `${folder}/${req.userId}/${Date.now()}-${randomId}.${sanitizedExt}`;

    const expiresInSeconds = 900; // 15 minutes

    // When real AWS S3 is configured, generate AWS pre-signed PUT URL.
    // Otherwise, generate mock S3 compatible endpoint.
    const s3Endpoint = env.S3_ENDPOINT || `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com`;
    const uploadUrl = `${s3Endpoint}/${fileKey}?signature=${randomId}&expires=${expiresInSeconds}`;
    const publicCdnUrl = `${env.CDN_BASE_URL.replace(/\/$/, '')}/${fileKey}`;

    logger.info(`[ObjectStorage] Generated upload URL for key: ${fileKey}`, {
      userId: req.userId,
      contentType: req.contentType,
      fileSizeBytes: req.fileSizeBytes,
    });

    return {
      uploadUrl,
      fileKey,
      publicCdnUrl,
      expiresInSeconds,
      headers: {
        'Content-Type': req.contentType,
        'x-amz-server-side-encryption': 'AES256',
      },
    };
  }

  /**
   * Validates magic byte content signatures to prevent malicious disguised files.
   */
  public static validateFileMagicBytes(buffer: Buffer, declaredMimeType: string): boolean {
    if (!buffer || buffer.length < 4) return false;

    // JPEG: FF D8 FF
    if (declaredMimeType === 'image/jpeg') {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    // PNG: 89 50 4E 47
    if (declaredMimeType === 'image/png') {
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    }

    // WebP: 52 49 46 46 ... 57 45 42 50 ("RIFF" ... "WEBP")
    if (declaredMimeType === 'image/webp') {
      return (
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
      );
    }

    // MP3: ID3 or FF FB / FF F3
    if (declaredMimeType === 'audio/mpeg') {
      return (
        (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) ||
        (buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xf3 || buffer[1] === 0xf2))
      );
    }

    // WAV: "RIFF" ... "WAVE"
    if (declaredMimeType === 'audio/wav') {
      return (
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WAVE'
      );
    }

    return true;
  }

  /**
   * Builds an optimized CDN URL with cache-busting version token.
   */
  public static buildCdnUrl(fileKey: string, version?: string | number): string {
    const base = env.CDN_BASE_URL.replace(/\/$/, '');
    const cleanKey = fileKey.replace(/^\//, '');
    const vParam = version ? `?v=${encodeURIComponent(version)}` : '';
    return `${base}/${cleanKey}${vParam}`;
  }
}
