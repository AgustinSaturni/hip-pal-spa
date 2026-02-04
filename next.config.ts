import type { NextConfig } from "next";

const API_URL = process.env.API_URL || 'http://localhost:8000';

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/pacs/:path*',
        destination: `${API_URL}/api/pacs/:path*`,
      },
      {
        source: '/serie',
        destination: `${API_URL}/serie`,
      },
    ];
  },
};

export default nextConfig;
