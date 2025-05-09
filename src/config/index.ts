// Configuración centralizada para la aplicación
const config = {
  // Puerto de la aplicación
  port: 3001,
  
  // URLs base
  baseUrl: typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.host}` 
    : 'http://localhost:3001',
    
  // API URLs
  api: {
    supabase: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://txctbngxizudxwjzgdef.supabase.co',
  },
  
  // Configuración por entorno
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

export default config; 