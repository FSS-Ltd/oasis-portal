/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@oasis/api', '@oasis/db', '@oasis/domain'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
