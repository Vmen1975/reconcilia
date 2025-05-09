import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Obtener el ID de la cuenta bancaria del query string
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    
    if (!accountId) {
      return NextResponse.json(
        { error: 'Se requiere un ID de cuenta bancaria' },
        { status: 400 }
      );
    }
    
    // Crear cliente de Supabase
    const supabase = createRouteHandlerClient({ cookies });
    
    // Verificar autenticación
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    
    // Verificar que el usuario tiene acceso a esta cuenta bancaria
    const { data: bankAccount, error: bankAccountError } = await supabase
      .from('bank_accounts')
      .select('*, companies:company_id(id)')
      .eq('id', accountId)
      .single();
    
    if (bankAccountError || !bankAccount) {
      console.error('Error al obtener la cuenta bancaria:', bankAccountError);
      return NextResponse.json(
        { error: 'Cuenta bancaria no encontrada' },
        { status: 404 }
      );
    }
    
    // Verificar que el usuario tiene acceso a la empresa propietaria de la cuenta
    const { data: userCompany, error: userCompanyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('company_id', bankAccount.company_id)
      .eq('is_active', true)
      .single();
    
    if (userCompanyError || !userCompany) {
      console.error('Error al verificar permisos de usuario:', userCompanyError);
      return NextResponse.json(
        { error: 'No tiene permisos para acceder a esta cuenta bancaria' },
        { status: 403 }
      );
    }
    
    // Obtener parámetros de filtro opcionales
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const status = searchParams.get('status');
    const searchTerm = searchParams.get('search');
    
    // Construir la consulta
    let query = supabase
      .from('bank_transactions')
      .select('*')
      .eq('bank_account_id', accountId);
    
    // Aplicar filtros si existen
    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }
    
    if (endDate) {
      query = query.lte('transaction_date', endDate);
    }
    
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    if (searchTerm) {
      query = query.ilike('description', `%${searchTerm}%`);
    }
    
    // Ordenar por fecha descendente
    query = query.order('transaction_date', { ascending: false });
    
    // Ejecutar la consulta
    const { data: transactions, error: transactionsError } = await query;
    
    if (transactionsError) {
      console.error('Error al obtener transacciones:', transactionsError);
      return NextResponse.json(
        { error: 'Error al obtener transacciones bancarias' },
        { status: 500 }
      );
    }
    
    // Devolver las transacciones con información de la cuenta
    return NextResponse.json({
      account: {
        id: bankAccount.id,
        name: bankAccount.name,
        account_number: bankAccount.account_number,
        bank_name: bankAccount.bank_name,
        company_id: bankAccount.company_id
      },
      filters: {
        startDate,
        endDate,
        status,
        searchTerm
      },
      total: transactions?.length || 0,
      transactions: transactions || []
    });
    
  } catch (error) {
    console.error('Error en API de transacciones bancarias:', error);
    return NextResponse.json(
      { error: 'Error del servidor' },
      { status: 500 }
    );
  }
} 