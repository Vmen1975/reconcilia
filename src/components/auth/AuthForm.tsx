'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface AuthFormProps {
  type: 'signin' | 'signup';
  redirectTo?: string;
}

export function AuthForm({ type, redirectTo = '/dashboard' }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (type === 'signin') {
        console.log('Iniciando sesión con:', email);
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (signInError) throw signInError;

        // Esperar un momento para asegurar que la sesión se ha establecido
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Verificar que la sesión se haya establecido correctamente
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          console.log('Sesión establecida correctamente:', session.user.id);
          // Usar router.push para la redirección del lado del cliente
          router.push(redirectTo);
          // Forzar un refresh de la página para asegurar que la sesión se actualice completamente
          router.refresh();
        } else {
          throw new Error('No se pudo establecer la sesión');
        }
      } else if (type === 'signup') {
        console.log('Registrando usuario:', email);
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (signUpError) throw signUpError;

        if (data?.user?.identities?.length === 0) {
          setError('Este email ya está registrado. Por favor inicia sesión.');
          return;
        }

        setSuccess(
          'Te hemos enviado un correo de confirmación. Por favor revisa tu bandeja de entrada y sigue las instrucciones para activar tu cuenta.'
        );
      }
    } catch (err) {
      console.error('Error en autenticación:', err);
      if (err instanceof Error) {
        if (err.message.includes('Email rate limit exceeded')) {
          setError('Has excedido el límite de intentos. Por favor espera unos minutos antes de intentar nuevamente.');
        } else if (err.message.includes('Invalid login credentials')) {
          setError('Email o contraseña incorrectos.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Un error ha ocurrido');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm">
        <h2 className="mt-10 text-center text-2xl font-bold leading-9 tracking-tight text-gray-900">
          {type === 'signin' ? 'Iniciar Sesión' : 'Crear Cuenta'}
        </h2>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
              Email
            </label>
            <div className="mt-2">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium leading-6 text-gray-900">
              Contraseña
            </label>
            <div className="mt-2">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">{success}</h3>
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || !!success}
              className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
            >
              {loading ? 'Procesando...' : type === 'signin' ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </button>
          </div>
        </form>

        <p className="mt-10 text-center text-sm text-gray-500">
          {type === 'signin' ? '¿No tienes una cuenta?' : '¿Ya tienes una cuenta?'}{' '}
          <Link
            href={type === 'signin' ? '/auth/signup' : '/auth/signin'}
            className="font-semibold leading-6 text-indigo-600 hover:text-indigo-500"
          >
            {type === 'signin' ? 'Regístrate aquí' : 'Inicia sesión aquí'}
          </Link>
        </p>
      </div>
    </div>
  );
} 