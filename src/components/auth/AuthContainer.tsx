'use client';

import { useEffect, useState } from 'react';
import { AuthForm } from './AuthForm';

export function AuthContainer({ type }: { type: 'signin' | 'signup' }) {
  const [redirectTo, setRedirectTo] = useState<string>('/');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Usar window.location en el cliente es seguro
    const params = new URLSearchParams(window.location.search);
    setRedirectTo(params.get('redirectTo') || '/');
    setError(params.get('error') || '');
  }, []);

  return (
    <>
      {error === 'callback_failed' && (
        <div className="rounded-md bg-yellow-50 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                La verificación de email falló. Por favor intenta iniciar sesión o solicita un nuevo enlace de verificación.
              </h3>
            </div>
          </div>
        </div>
      )}
      <AuthForm type={type} redirectTo={redirectTo} />
    </>
  );
} 