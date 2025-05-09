import type { NextConfig } from "next";

const PORT = 3001;

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    PORT: PORT.toString(),
    NEXT_PUBLIC_PORT: PORT.toString(),
  },
  devIndicators: {
    buildActivity: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: [`localhost:${PORT}`],
    },
  },
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
