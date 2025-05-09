import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// GET /api/user-companies
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verificar si el usuario está autenticado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }
    
    // Obtener todas las empresas asociadas al usuario
    const { data, error } = await supabase
      .from('user_companies')
      .select(`
        company_id,
        is_primary,
        is_active,
        companies (
          id, 
          name,
          rut,
          address,
          phone,
          email,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', session.user.id);
    
    if (error) {
      console.error('Error al obtener empresas del usuario:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    // Transformar los datos para la respuesta
    const transformedData = data.map(item => ({
      ...item.companies,
      is_primary: item.is_primary,
      is_active: item.is_active
    }));
    
    return NextResponse.json(transformedData);
  } catch (error) {
    console.error('Error en la obtención de empresas del usuario:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 