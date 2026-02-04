import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/pacs/:path*',
        destination: 'http://localhost:8000/api/pacs/:path*',
      },
      {
        source: '/serie',
        destination: 'http://localhost:8000/serie',
      },
    ];
  },
};

export default nextConfig;
