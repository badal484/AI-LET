/** @type {import('next').NextConfig} */
// The browser only talks to this app; /api/* is forwarded to the API server, so the admin session
// cookie stays same-origin (no CORS). API_URL: e.g. https://ai-let.onrender.com (default local :4000).
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_URL = process.env.API_URL || 'http://localhost:4000';
const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: monorepoRoot,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
