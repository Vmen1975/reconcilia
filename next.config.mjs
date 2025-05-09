/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://reconcilia-victor-menas-projects.vercel.app',
  },
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Prevenir compilación estática
  staticPageGenerationTimeout: 1000,
  experimental: {
    // Deshabilitar SSG completamente
    appDocumentPreloading: false,
    serverActions: {
      allowedOrigins: ["localhost:3001", "reconcilia-victor-menas-projects.vercel.app"]
    }
  },
  images: {
    unoptimized: true,
  },
  // Forzar SSR para todas las páginas
  compiler: {
    emotion: true,
  },
  // Configuraciones para deshabilitar la generación estática
  generateEtags: false,
  compress: true,
  poweredByHeader: false,
  reactStrictMode: false,
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
            value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Client-Info, apikey, Prefer, Origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig; 