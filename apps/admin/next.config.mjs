/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@ai-companion/types',
    '@ai-companion/config',
    '@ai-companion/validation',
    '@ai-companion/ui-tokens',
    '@ai-companion/utils',
    '@ai-companion/api-client',
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
