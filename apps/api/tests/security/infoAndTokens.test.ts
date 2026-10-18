import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import WebSocket from 'ws';
import { createApp } from '../../src/app.js';
import { Realtime } from '../../src/infrastructure/realtime/realtime.js';
import { createUser } from '../fixtures.js';

/** Audit L-2 / L-4: the API's front page says nothing about internals; live-update tokens never travel in URLs. */

describe('root endpoint', () => {
  it('only says the API is online', async () => {
    const res = await request(createApp()).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, status: 'online' });
  });
});

describe('live updates (WebSocket) sign-in', () => {
  let server: http.Server;
  let base = '';
  beforeAll(async () => {
    server = http.createServer(createApp());
    Realtime.attach(server);
    await new Promise<void>((r) => server.listen(0, r));
    base = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/realtime`;
  });
  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  /** 'open' or the HTTP status the upgrade was refused with. */
  const connect = (url: string, headers: Record<string, string> = {}) =>
    new Promise<string>((resolve) => {
      const ws = new WebSocket(url, { headers });
      ws.on('open', () => {
        ws.close();
        resolve('open');
      });
      ws.on('unexpected-response', (_req, res) => resolve(String(res.statusCode)));
      ws.on('error', () => resolve('error'));
    });

  it('accepts the token in the Authorization header and refuses it in the URL', async () => {
    const user = await createUser();
    expect(await connect(base, { Authorization: `Bearer ${user.token}` })).toBe('open');
    expect(await connect(`${base}?token=${user.token}`)).toBe('401');
    expect(await connect(base)).toBe('401');
  });
});
