'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';

interface AuthProviderProps {
  children: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const setUser = useAuthStore((state) => state.setUser);
  const supabase = createClient();

  useEffect(() => {
    // Obtener el usuario actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Escuchar cambios en la autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser, supabase.auth]);

  return <>{children}</>;
} 