/**
 * Loveek load test (k6): evening traffic at 10k users/day — open apps (live connections), people browsing
 * Home / Chats, and people chatting. Run against STAGING.
 *
 *   cd apps/api && npx tsx scripts/loadtest/createUsers.ts 300 > /tmp/lt-users.json
 *   k6 run -e BASE_URL=https://staging.example/api/v1 -e USERS=/tmp/lt-users.json \
 *          -e APPS=1500 -e BROWSE_RATE=20 -e CHAT_RATE=5 infrastructure/load-tests/chat.k6.js
 *   cd apps/api && npx tsx scripts/loadtest/createUsers.ts --delete
 *
 * CHAT_RATE (messages/second) calls the real AI on a server with a Gemini key — that costs money. On a
 * staging server WITHOUT a Gemini key replies use the free mock model (tests the server, not Gemini).
 * Defaults are small so a mistaken run is harmless: APPS=100, BROWSE_RATE=5, CHAT_RATE=0, DURATION=3m.
 * Rate limits are per account: use at least as many users as browse+chat requests per minute / 100.
 */
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const BASE = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const WS_BASE = BASE.replace(/^http/, 'ws');
const USERS = JSON.parse(open(__ENV.USERS || '/tmp/lt-users.json'));
const DURATION = __ENV.DURATION || '3m';
const APPS = Number(__ENV.APPS || 100);
const BROWSE_RATE = Number(__ENV.BROWSE_RATE || 5);
const CHAT_RATE = Number(__ENV.CHAT_RATE || 0);

const firstReply = new Trend('chat_first_reply_ms', true);
const fullReply = new Trend('chat_full_reply_ms', true);
const chatFailed = new Counter('chat_failed');
const liveEvents = new Counter('live_events');

const scenarios = {
  open_apps: { executor: 'constant-vus', vus: APPS, duration: DURATION, exec: 'openApp' },
  browse: { executor: 'constant-arrival-rate', rate: BROWSE_RATE, timeUnit: '1s', duration: DURATION, preAllocatedVUs: Math.max(10, BROWSE_RATE * 2), exec: 'browse' },
};
if (CHAT_RATE > 0) {
  scenarios.chat = {
    executor: 'constant-arrival-rate',
    rate: CHAT_RATE,
    timeUnit: '1s',
    duration: DURATION,
    preAllocatedVUs: Math.max(20, CHAT_RATE * 15),
    maxVUs: Math.max(50, CHAT_RATE * 30),
    exec: 'chat',
  };
}

export const options = {
  scenarios,
  thresholds: {
    'http_req_duration{scenario:browse}': ['p(95)<500', 'p(99)<1200'],
    http_req_failed: ['rate<0.01'],
    chat_first_reply_ms: ['p(95)<6000'],
    chat_failed: ['count<5'],
  },
};

const pick = () => USERS[Math.floor(Math.random() * USERS.length)];
const auth = (u) => ({ headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' } });

/** An open app: holds a live connection for a few minutes, like someone with Loveek on screen. */
export function openApp() {
  const u = USERS[(__VU - 1) % USERS.length];
  const res = ws.connect(`${WS_BASE}/realtime?token=${encodeURIComponent(u.token)}`, {}, (socket) => {
    socket.on('message', () => liveEvents.add(1));
    socket.setTimeout(() => socket.close(), 60_000 + Math.random() * 120_000);
  });
  check(res, { 'live connection opened': (r) => r && r.status === 101 });
  sleep(1);
}

/** Opening the app / switching tabs. */
export function browse() {
  const u = pick();
  const r = http.batch([
    ['GET', `${BASE}/conversations?limit=50`, null, auth(u)],
    ['GET', `${BASE}/discovery/home`, null, auth(u)],
    ['GET', `${BASE}/billing/allowance`, null, auth(u)],
  ]);
  check(r[0], { 'chats list ok': (x) => x.status === 200 });
  check(r[1], { 'home ok': (x) => x.status === 200 });
}

const LINES = ['hi', 'kaisi ho?', 'aaj ka din thoda lamba tha', 'kya chal raha hai?', 'ek baat batao', 'thank you yaar', 'good night'];

/** One chat message, waiting for the full streamed reply. */
export function chat() {
  const u = pick();
  const started = Date.now();
  const res = http.post(
    `${BASE}/conversations/${u.conversationId}/messages`,
    JSON.stringify({ content: LINES[Math.floor(Math.random() * LINES.length)], clientRequestId: `lt-${__VU}-${__ITER}-${started}` }),
    { headers: { ...auth(u).headers, Accept: 'text/event-stream' }, timeout: '60s', tags: { scenario: 'chat' } },
  );
  const body = String(res.body || '');
  const ok = res.status === 200 && body.includes('message.completed');
  if (!ok) chatFailed.add(1);
  if (res.timings.waiting) firstReply.add(res.timings.waiting);
  fullReply.add(Date.now() - started);
  check(res, { 'reply completed': () => ok });
}
