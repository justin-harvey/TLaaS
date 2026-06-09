import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow importing from @ag-grid-community
  transpilePackages: ['@ag-grid-community'],
};

export default nextConfig;
