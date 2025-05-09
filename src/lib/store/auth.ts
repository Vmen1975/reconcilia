import { create } from 'zustand';
import type { User } from '@/types';
import { createClient } from '@/lib/supabase/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  hasCompany: boolean;
  setUser: (user: User | null) => void;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  checkCompanyAssociation: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  error: null,
  initialized: false,
  hasCompany: false,
  setUser: (user) => set({ user }),
  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null, hasCompany: false });
  },
  initialize: async () => {
    const supabase = createClient();
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw error;
      }

      if (session?.user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userError) {
          // Si no existe el usuario en la tabla custom users, no hay un error crítico
          // porque el usuario está autenticado en auth.users
          set({ user: session.user as User });
        } else {
          set({ 
            user: { ...session.user, ...userData } as User,
            hasCompany: !!userData?.company_id 
          });
        }
        
        // Verificamos si tiene empresa asociada
        await get().checkCompanyAssociation();
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error al inicializar la sesión' });
    } finally {
      set({ loading: false, initialized: true });
    }
  },
  checkCompanyAssociation: async () => {
    const supabase = createClient();
    const { user } = get();
    
    if (!user) return false;
    
    try {
      // Primero intentamos obtener el usuario de la tabla personalizada users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();
      
      if (userError || !userData?.company_id) {
        set({ hasCompany: false });
        return false;
      }
      
      set({ hasCompany: true });
      return true;
    } catch (error) {
      console.error('Error al verificar asociación de empresa:', error);
      set({ hasCompany: false });
      return false;
    }
  }
})); 