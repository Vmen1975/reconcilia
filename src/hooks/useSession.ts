import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export function useSession() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userCompanies, setUserCompanies] = useState<any[]>([]);
  const supabase = createClientComponentClient();
  const router = useRouter();
  
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        setSession(currentSession);
        
        if (currentSession) {
          // Obtener empresas asociadas al usuario
          const { data: companies, error: companiesError } = await supabase
            .from('user_companies')
            .select(`
              *,
              companies:company_id (*)
            `)
            .eq('user_id', currentSession.user.id)
            .eq('is_active', true);
            
          if (companiesError) {
            console.error('Error al cargar empresas del usuario:', companiesError);
          } else {
            // Transformar los datos para facilitar su uso
            const transformedCompanies = companies?.map(uc => ({
              id: uc.company_id,
              name: uc.companies?.name || 'Empresa sin nombre',
              rut: uc.companies?.rut || '',
              isActive: uc.is_active,
              role: uc.role
            })) || [];
            
            setUserCompanies(transformedCompanies);
          }
        } else {
          // Si no hay sesión, redirigir a la página de login
          router.push('/login');
        }
      } catch (error) {
        console.error('Error al obtener sesión:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSession();
    
    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        router.push('/login');
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);
  
  return {
    session,
    loading,
    userCompanies
  };
} 