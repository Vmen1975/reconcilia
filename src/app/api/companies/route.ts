import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// POST /api/companies
export async function POST(request: NextRequest) {
  try {
    // Obtener el cliente Supabase del lado del servidor usando cookies
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verificar si el usuario está autenticado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }
    
    // Obtener los datos de la empresa a crear
    const companyData = await request.json();
    
    // Validar datos mínimos
    if (!companyData.name || !companyData.rut) {
      return NextResponse.json(
        { error: 'El nombre y RUT son obligatorios' },
        { status: 400 }
      );
    }
    
    console.log('Creando empresa para usuario:', session.user.id);
    console.log('Datos de empresa:', companyData);
    
    // Insertar la empresa en la base de datos
    const { data: newCompany, error: companyError } = await supabase
      .from('companies')
      .insert([companyData])
      .select()
      .single();
    
    if (companyError) {
      console.error('Error al crear empresa:', companyError);
      return NextResponse.json(
        { error: companyError.message },
        { status: 500 }
      );
    }
    
    // Verificar si el usuario ya tiene alguna empresa asociada
    const { data: existingCompanies, error: checkError } = await supabase
      .from('user_companies')
      .select('id, is_primary')
      .eq('user_id', session.user.id);
    
    if (checkError) {
      console.error('Error al verificar empresas existentes:', checkError);
    }
    
    // Determinar si esta debe ser la empresa principal
    const isPrimary = !existingCompanies || existingCompanies.length === 0;
    
    // Asociar la empresa con el usuario
    const { error: relationError } = await supabase
      .from('user_companies')
      .insert({
        user_id: session.user.id,
        company_id: newCompany.id,
        is_primary: isPrimary,
        is_active: true
      });
    
    if (relationError) {
      console.error('Error al asociar usuario con empresa:', relationError);
      return NextResponse.json(
        { 
          error: 'La empresa se creó pero no se pudo asociar al usuario',
          details: relationError.message 
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(newCompany, { status: 201 });
  } catch (error) {
    console.error('Error en la creación de empresa:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// GET /api/companies
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
    
    // Obtener todas las empresas
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('name');
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 