import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

/** The public pages payment providers (Razorpay) and Google Play review: each exists and links to the others. */
describe('public business pages', () => {
  const app = createApp();
  it.each([
    ['/legal', /₹499 a month/],
    ['/legal/about', /What we sell/],
    ['/legal/refunds', /Cancel Premium/],
    ['/legal/contact', /Contact us/],
    ['/legal/privacy', /Razorpay/],
    ['/legal/terms', /UPI Autopay/],
  ])('%s is served with its content and the full footer', async (path, text) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(200);
    expect(res.text).toMatch(text);
    for (const link of ['/legal/about', '/legal/privacy', '/legal/terms', '/legal/refunds', '/legal/contact']) expect(res.text).toContain(`href="${link}"`);
  });
});
