import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/pacs/:path*',
        destination: 'http://localhost:8000/api/pacs/:path*',
      },
    ];
  },
};

export default nextConfig;
