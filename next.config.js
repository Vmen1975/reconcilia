/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://txctbngxizudxwjzgdef.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://app.concilia.dammaq.cl',
  },
  output: 'standalone',
  eslint: {
    // Permitir producción con warnings
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignorar errores de TS durante el build
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3001", "reconcilia.vercel.app"]
    }
  },
  // Forzar el modo dinámico para todas las rutas
  staticPageGenerationTimeout: 120,
  images: {
    unoptimized: true,
  },
  poweredByHeader: false,
  // Mejorar el manejo de rutas API
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ];
  },
  // Estas opciones desactivan la generación estática
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

module.exports = nextConfig; 