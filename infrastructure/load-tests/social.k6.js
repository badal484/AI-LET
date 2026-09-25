/**
 * Social layer load test (k6). Not part of CI.
 *
 *   k6 run -e BASE_URL=http://localhost:4000/api/v1 -e TOKENS=tok1,tok2,... -e TARGETS=publicId1,publicId2 \
 *          -e CONTENT=contentPublicId1,contentPublicId2 infrastructure/load-tests/social.k6.js
 *
 * TOKENS: user access tokens for pre-created social users (one per VU is ideal).
 * TARGETS: public ids of profiles to read/follow; CONTENT: public ids of PUBLIC shares/posts.
 * Rate limits are per user; raise `rateLimits.*` in a staging policy version before running write scenarios.
 */
import http from 'k6/http';
import { check } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const BASE = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const TOKENS = (__ENV.TOKENS || '').split(',').filter(Boolean);
const TARGETS = (__ENV.TARGETS || '').split(',').filter(Boolean);
const CONTENT = (__ENV.CONTENT || '').split(',').filter(Boolean);

export const options = {
  scenarios: {
    feed_reads: { executor: 'constant-arrival-rate', rate: 50, timeUnit: '1s', duration: '2m', preAllocatedVUs: 50, exec: 'feed' },
    profile_reads: { executor: 'constant-arrival-rate', rate: 80, timeUnit: '1s', duration: '2m', preAllocatedVUs: 50, exec: 'profile' },
    follow_writes: { executor: 'constant-arrival-rate', rate: 10, timeUnit: '1s', duration: '2m', preAllocatedVUs: 20, exec: 'follow' },
    reaction_writes: { executor: 'constant-arrival-rate', rate: 30, timeUnit: '1s', duration: '2m', preAllocatedVUs: 30, exec: 'react' },
    comment_writes: { executor: 'constant-arrival-rate', rate: 5, timeUnit: '1s', duration: '2m', preAllocatedVUs: 10, exec: 'comment' },
  },
  thresholds: {
    'http_req_duration{scenario:feed_reads}': ['p(95)<400', 'p(99)<900'],
    'http_req_duration{scenario:profile_reads}': ['p(95)<150', 'p(99)<400'],
    'http_req_duration{scenario:follow_writes}': ['p(95)<250', 'p(99)<600'],
    'http_req_duration{scenario:reaction_writes}': ['p(95)<200', 'p(99)<500'],
    'http_req_duration{scenario:comment_writes}': ['p(95)<300', 'p(99)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const auth = () => ({ Authorization: `Bearer ${pick(TOKENS)}`, 'Content-Type': 'application/json' });
const mutation = () => ({ ...auth(), 'Idempotency-Key': `k6-${uuidv4()}` });
const ok = (r) => check(r, { 'status < 400 or 429': (x) => x.status < 400 || x.status === 429 });

export function feed() {
  ok(http.get(`${BASE}/social/feed?tab=${Math.random() < 0.5 ? 'FOLLOWING' : 'FOR_YOU'}&limit=20`, { headers: auth() }));
}
export function profile() {
  ok(http.get(`${BASE}/social/users/${pick(TARGETS)}`, { headers: auth() }));
}
export function follow() {
  const target = pick(TARGETS);
  ok(http.post(`${BASE}/social/follows`, JSON.stringify({ target }), { headers: mutation() }));
  ok(http.del(`${BASE}/social/follows/${target}`, null, { headers: mutation() }));
}
export function react() {
  const id = pick(CONTENT);
  ok(http.put(`${BASE}/social/content/${id}/reactions/LIKE`, null, { headers: mutation() }));
}
export function comment() {
  ok(http.post(`${BASE}/social/content/${pick(CONTENT)}/comments`, JSON.stringify({ body: `load test comment ${uuidv4()}` }), { headers: mutation() }));
}

export default function () {
  feed();
  profile();
  react();
}

