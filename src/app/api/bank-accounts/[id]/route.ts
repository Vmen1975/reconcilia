import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// GET /api/bank-accounts/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    console.log('GET /api/bank-accounts/:id - ID recibido:', id);
    
    if (!id) {
      console.error('ID de cuenta bancaria no proporcionado');
      return NextResponse.json(
        { error: 'Se requiere ID de cuenta bancaria' },
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
      console.error('Usuario no autenticado intentando acceder a cuenta bancaria:', id);
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }
    
    // Obtener la cuenta bancaria por ID
    const { data: bankAccount, error: bankAccountError } = await supabase
      .from('bank_accounts')
      .select('*, companies:company_id(*)')
      .eq('id', id)
      .single();
    
    if (bankAccountError) {
      console.error('Error al obtener cuenta bancaria:', bankAccountError, 'ID:', id);
      
      if (bankAccountError.code === 'PGRST116' || bankAccountError.message.includes('no rows')) {
        return NextResponse.json(
          { error: 'Cuenta bancaria no encontrada' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: bankAccountError.message },
        { status: 500 }
      );
    }
    
    if (!bankAccount) {
      console.error('Cuenta bancaria no encontrada:', id);
      return NextResponse.json(
        { error: 'Cuenta bancaria no encontrada' },
        { status: 404 }
      );
    }
    
    // Verificar si el usuario tiene acceso a la empresa de esta cuenta bancaria
    const { data: userCompany, error: userCompanyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('company_id', bankAccount.company_id)
      .maybeSingle();
      
    if (userCompanyError) {
      console.error('Error al verificar relación usuario-empresa:', userCompanyError);
    }
    
    if (!userCompany) {
      console.error('Usuario sin acceso a la empresa de esta cuenta bancaria:', 
                   'Usuario:', session.user.id, 
                   'Cuenta bancaria:', id,
                   'Empresa:', bankAccount.company_id);
      return NextResponse.json(
        { error: 'No tienes acceso a esta cuenta bancaria' },
        { status: 403 }
      );
    }
    
    console.log('Cuenta bancaria obtenida exitosamente:', id);
    return NextResponse.json(bankAccount);
  } catch (error) {
    console.error('Error inesperado al obtener cuenta bancaria:', error, 'Params:', params);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// PUT /api/bank-accounts/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    console.log('PUT /api/bank-accounts/:id - ID recibido:', id);
    
    if (!id) {
      console.error('ID de cuenta bancaria no proporcionado');
      return NextResponse.json(
        { error: 'Se requiere ID de cuenta bancaria' },
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
      console.error('Usuario no autenticado intentando actualizar cuenta bancaria:', id);
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }
    
    // Obtener los datos actualizados
    const requestData = await request.json();
    console.log('Datos recibidos para actualización:', requestData);
    
    // Primero, verificar si la cuenta existe y obtener su company_id
    const { data: existingAccount, error: getError } = await supabase
      .from('bank_accounts')
      .select('company_id')
      .eq('id', id)
      .single();
      
    if (getError) {
      console.error('Error al verificar cuenta bancaria existente:', getError);
      return NextResponse.json(
        { error: getError.message },
        { status: getError.code === 'PGRST116' ? 404 : 500 }
      );
    }
    
    if (!existingAccount) {
      return NextResponse.json(
        { error: 'Cuenta bancaria no encontrada' },
        { status: 404 }
      );
    }
    
    // Verificar si el usuario tiene acceso a la empresa de esta cuenta
    const { data: userCompany, error: userCompanyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('company_id', existingAccount.company_id)
      .maybeSingle();
      
    if (userCompanyError) {
      console.error('Error al verificar relación usuario-empresa:', userCompanyError);
    }
    
    if (!userCompany) {
      console.error('Usuario sin acceso a la empresa de esta cuenta bancaria para actualización', 
                   'Usuario:', session.user.id, 
                   'Cuenta bancaria:', id);
      return NextResponse.json(
        { error: 'No tienes acceso a esta cuenta bancaria' },
        { status: 403 }
      );
    }
    
    // Actualizar la cuenta bancaria
    const { data, error } = await supabase
      .from('bank_accounts')
      .update(requestData)
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error('Error al actualizar cuenta bancaria:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    console.log('Cuenta bancaria actualizada exitosamente:', id);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error inesperado al actualizar cuenta bancaria:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/bank-accounts/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    if (!id) {
      return NextResponse.json(
        { error: 'Se requiere ID de cuenta bancaria' },
        { status: 400 }
      );
    }
    
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Verificar si el usuario está autenticado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }
    
    // Obtener la cuenta bancaria actual para verificar permisos
    const { data: bankAccount, error: bankAccountError } = await supabase
      .from('bank_accounts')
      .select('company_id')
      .eq('id', id)
      .single();
    
    if (bankAccountError || !bankAccount) {
      return NextResponse.json(
        { error: bankAccountError?.message || 'Cuenta bancaria no encontrada' },
        { status: 404 }
      );
    }
    
    // Verificar si el usuario tiene acceso a esta empresa
    const { data: userCompany, error: userCompanyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('company_id', bankAccount.company_id)
      .maybeSingle();
      
    if (userCompanyError) {
      console.error('Error al verificar relación usuario-empresa:', userCompanyError);
    }
    
    if (!userCompany) {
      return NextResponse.json(
        { error: 'No tienes acceso a esta cuenta bancaria' },
        { status: 403 }
      );
    }
    
    // Eliminar la cuenta bancaria
    const { error } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('id', id);
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar cuenta bancaria:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 