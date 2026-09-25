import { describe, it, expect } from 'vitest';
import { ObjectStorageService } from '../src/infrastructure/storage/ObjectStorageService.js';

describe('ObjectStorageService & Media Security', () => {
  it('generates valid pre-signed upload URLs for allowed image MIME types', async () => {
    const result = await ObjectStorageService.generatePresignedUploadUrl({
      fileName: 'avatar.png',
      contentType: 'image/png',
      fileSizeBytes: 1024 * 500, // 500 KB
      userId: 'user_test_123',
      folder: 'avatars',
    });

    expect(result.uploadUrl).toBeDefined();
    expect(result.fileKey).toContain('avatars/user_test_123/');
    expect(result.publicCdnUrl).toContain('cdn.aicompanion.app');
  });

  it('rejects disallowed executable or script MIME types', async () => {
    await expect(
      ObjectStorageService.generatePresignedUploadUrl({
        fileName: 'script.sh',
        contentType: 'application/x-sh',
        fileSizeBytes: 1024,
        userId: 'user_test_123',
      }),
    ).rejects.toThrow(/Unsupported media type/);
  });

  it('validates magic byte content signatures accurately', () => {
    // Valid PNG signature
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(ObjectStorageService.validateFileMagicBytes(pngBuffer, 'image/png')).toBe(true);

    // Invalid PNG (fake executable disguised as png)
    const fakeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // DOS executable header
    expect(ObjectStorageService.validateFileMagicBytes(fakeBuffer, 'image/png')).toBe(false);

    // Valid JPEG signature
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(ObjectStorageService.validateFileMagicBytes(jpegBuffer, 'image/jpeg')).toBe(true);
  });
});
