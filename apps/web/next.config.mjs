import { PrismaPlugin } from '@prisma/nextjs-monorepo-workaround-plugin';
import { withSentryConfig } from '@sentry/nextjs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  outputFileTracingRoot: repoRoot,
  transpilePackages: ['@oasis/api', '@oasis/db', '@oasis/domain'],
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? '',
  },
  async redirects() {
    return [
      {
        source: '/student/messages',
        destination: '/student/community',
        permanent: false,
      },
      {
        source: '/student/messages/:path*',
        destination: '/student/community',
        permanent: false,
      },
    ];
  },
  webpack(config, { isServer }) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    if (isServer) {
      config.plugins.push(new PrismaPlugin());
    }
    return config;
  },
};

export default withSentryConfig(nextConfig, {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG ?? 'faithful-software-solutions-lt',
  project: process.env.SENTRY_PROJECT ?? 'oasisportal-nextjs',
  silent: true,
  widenClientFileUpload: true,
});
