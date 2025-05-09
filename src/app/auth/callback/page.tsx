'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Obtener los parámetros de la URL
        const hash = window.location.hash;
        const query = window.location.search;
        
        console.log('URL completa:', window.location.href);
        console.log('Hash:', hash);
        console.log('Query:', query);

        let session;

        if (hash && hash.includes('access_token')) {
          // Si tenemos un access_token en el hash, procesarlo
          const hashParams = new URLSearchParams(hash.substring(1));
          const access_token = hashParams.get('access_token');
          
          if (!access_token) {
            throw new Error('No se encontró el token de acceso');
          }

          // Establecer la sesión con el token
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token: hashParams.get('refresh_token') || '',
          });

          if (error) throw error;
          session = data.session;
        } else if (query && query.includes('code=')) {
          // Si tenemos un código en la query, procesarlo
          const params = new URLSearchParams(query);
          const code = params.get('code');
          
          if (!code) {
            throw new Error('No se encontró el código de autenticación');
          }

          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          session = data.session;
        } else {
          throw new Error('No se encontró token ni código de autenticación');
        }

        if (!session) {
          throw new Error('No se pudo crear la sesión');
        }

        console.log('Sesión creada:', session);
        console.log('Redirigiendo al dashboard...');
        router.push('/dashboard');
        router.refresh();
      } catch (error) {
        console.error('Error al procesar la autenticación:', error);
        router.push('/auth/signin?error=callback_failed');
      }
    };

    handleCallback();
  }, [router, supabase.auth]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Verificando tu email...</h2>
        <p className="text-gray-600">Por favor espera mientras procesamos tu confirmación.</p>
      </div>
    </div>
  );
} 