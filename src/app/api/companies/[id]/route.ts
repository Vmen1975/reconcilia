import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// GET /api/companies/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    console.log('GET /api/companies/:id - ID recibido:', id);
    
    if (!id) {
      console.error('ID de empresa no proporcionado');
      return NextResponse.json(
        { error: 'Se requiere ID de empresa' },
        { status: 400 }
      );
    }
    
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Verificar si el usuario está autenticado
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error al obtener sesión:', sessionError);
      return NextResponse.json(
        { error: 'Error al verificar autenticación' },
        { status: 500 }
      );
    }
    
    if (!session) {
      console.error('Usuario no autenticado intentando acceder a empresa:', id);
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }
    
    console.log('Usuario autenticado:', session.user.id, 'solicita empresa:', id);
    
    // Obtener la empresa por ID
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error al obtener empresa:', error, 'ID:', id);
      // Si el registro no fue encontrado
      if (error.code === 'PGRST116' || error.message.includes('no rows')) {
        return NextResponse.json(
          { error: 'Empresa no encontrada' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    if (!data) {
      console.error('Empresa no encontrada:', id);
      return NextResponse.json(
        { error: 'Empresa no encontrada' },
        { status: 404 }
      );
    }
    
    // Verificar si el usuario tiene acceso a esta empresa
    const { data: userCompany, error: userCompanyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('company_id', id)
      .maybeSingle();
      
    if (userCompanyError) {
      console.error('Error al verificar relación usuario-empresa:', userCompanyError, 'Usuario:', session.user.id, 'Empresa:', id);
      // Continuamos para verificar si hay datos a pesar del error
    }
    
    if (!userCompany) {
      console.error('Usuario sin acceso a empresa:', session.user.id, 'Empresa:', id);
      return NextResponse.json(
        { error: 'No tienes acceso a esta empresa' },
        { status: 403 }
      );
    }
    
    console.log('Empresa obtenida exitosamente:', id);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error inesperado al obtener empresa:', error, 'Params:', params);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 