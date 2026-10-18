import { afterEach, describe, expect, it, vi } from 'vitest';
import { storageMode, storeImage } from '../src/modules/console/media.js';

/** Character photos go to ImageKit when IMAGEKIT_PRIVATE_KEY is set (Render's disk is wiped on every deploy). */
describe('photo storage: ImageKit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['IMAGEKIT_PRIVATE_KEY'];
    delete process.env['IMAGEKIT_FOLDER'];
  });

  it('uploads to ImageKit with the private key as Basic auth and returns the CDN URL', async () => {
    process.env['IMAGEKIT_PRIVATE_KEY'] = 'private_test_key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://ik.imagekit.io/demo/lovira/characters/aanya-mehta/cover-1.webp' }), { status: 200 }),
    );

    const url = await storeImage(Buffer.from('webp-bytes'), 'characters/aanya-mehta', 'cover');

    expect(url).toBe('https://ik.imagekit.io/demo/lovira/characters/aanya-mehta/cover-1.webp');
    const [endpoint, init] = fetchMock.mock.calls[0]!;
    expect(endpoint).toBe('https://upload.imagekit.io/api/v1/files/upload');
    expect((init!.headers as Record<string, string>)['Authorization']).toBe(`Basic ${Buffer.from('private_test_key:').toString('base64')}`);
    const form = init!.body as FormData;
    expect(form.get('folder')).toBe('/lovira/characters/aanya-mehta');
    expect(String(form.get('fileName'))).toMatch(/^cover-[0-9a-f]{8}\.webp$/);
    expect(storageMode()).toBe('cloud');
  });

  it('fails loudly instead of saving a broken URL', async () => {
    process.env['IMAGEKIT_PRIVATE_KEY'] = 'wrong_key';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'Your account cannot be authenticated.' }), { status: 403 }));
    await expect(storeImage(Buffer.from('x'), 'characters/riya', 'avatar')).rejects.toThrow(/ImageKit upload failed \(403\)/);
  });

  it('without the key, says the photos are only on this server', () => {
    expect(storageMode()).toBe('local');
  });
});
