import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: process.env.NFT_STUDIO_BASE_PATH || process.env.PRISM_BASE_PATH || '',
};

export default nextConfig;
