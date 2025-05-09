import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// GET /api/bank-accounts?companyId=123
export async function GET(request: NextRequest) {
  try {
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
    
    // Obtener el companyId de los query params
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'Se requiere el ID de la empresa' },
        { status: 400 }
      );
    }
    
    // Verificar si el usuario tiene acceso a esta empresa
    const { data: userCompany, error: userCompanyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('company_id', companyId)
      .maybeSingle();
      
    if (userCompanyError) {
      console.error('Error al verificar relación usuario-empresa:', userCompanyError);
    }
    
    if (!userCompany) {
      return NextResponse.json(
        { error: 'No tienes acceso a esta empresa' },
        { status: 403 }
      );
    }
    
    // Obtener las cuentas bancarias de la empresa
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('company_id', companyId);
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error al obtener cuentas bancarias:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST /api/bank-accounts
export async function POST(request: NextRequest) {
  try {
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
    
    // Obtener los datos de la solicitud
    const requestData = await request.json();
    const { company_id, name, account_number, bank_name, current_balance = 0, account_type = 'corriente', currency = 'CLP', rut, description } = requestData;
    
    if (!company_id || !name || !account_number || !bank_name) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: company_id, name, account_number, bank_name' },
        { status: 400 }
      );
    }
    
    // Verificar si el usuario tiene acceso a esta empresa
    const { data: userCompany, error: userCompanyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('company_id', company_id)
      .maybeSingle();
      
    if (userCompanyError) {
      console.error('Error al verificar relación usuario-empresa:', userCompanyError);
    }
    
    if (!userCompany) {
      return NextResponse.json(
        { error: 'No tienes acceso a esta empresa' },
        { status: 403 }
      );
    }
    
    // Insertar la cuenta bancaria
    const { data, error } = await supabase
      .from('bank_accounts')
      .insert({
        company_id,
        name,
        account_number,
        bank_name,
        current_balance,
        account_type,
        currency,
        rut,
        description
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error al crear cuenta bancaria:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 