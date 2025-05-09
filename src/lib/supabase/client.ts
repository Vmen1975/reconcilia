'use client';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let client: ReturnType<typeof createSupabaseClient> | null = null;

// Puerto fijo para toda la aplicación
const APP_PORT = 3001;
// Usar URL dinámica para producción vs desarrollo
const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const APP_URL = isDevelopment 
  ? `http://localhost:${APP_PORT}` 
  : (process.env.NEXT_PUBLIC_APP_URL || 'https://reconcilia-q2xq3whp5-victor-menas-projects.vercel.app');

export function createClient() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Faltan las variables de entorno de Supabase');
  }

  console.log('Creando cliente Supabase con URL:', supabaseUrl);
  console.log('URL de la aplicación:', APP_URL);

  // Crear un cliente Supabase con opciones optimizadas para el desarrollo local
  client = createSupabaseClient(supabaseUrl.trim(), supabaseAnonKey.trim(), {
    auth: {
      persistSession: true, // Mantener la sesión persistente
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    global: {
      fetch: (url, options = {}) => {
        // Asegurarse de que las cookies se envíen con la solicitud
        const fetchOptions = {
          ...options,
          credentials: 'include' as RequestCredentials, // Incluir cookies
          headers: {
            ...options.headers,
            'X-Client-Info': `reconcilia-client`,
            'Origin': APP_URL,
          },
        };
        
        // Asegurarse que la URL no tiene espacios
        const cleanUrl = typeof url === 'string' ? url.trim() : url;
        
        return fetch(cleanUrl, fetchOptions);
      },
    },
  });

  // Verificar la sesión actual para depuración
  client.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error('Error al obtener sesión:', error);
    } else if (data.session) {
      console.log('Sesión activa para usuario:', data.session.user.id);
    } else {
      console.log('No hay sesión activa');
    }
  });

  return client;
}

// Función de utilidad para obtener el usuario autenticado de forma segura
export async function getAuthenticatedUser() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('Error al obtener el usuario autenticado:', error);
      return null;
    }
    
    if (!data.user) {
      console.error('No se encontró usuario autenticado');
      return null;
    }
    
    console.log('Usuario autenticado encontrado:', data.user.id);
    return data.user;
  } catch (error) {
    console.error('Excepción al obtener usuario autenticado:', error);
    return null;
  }
} 