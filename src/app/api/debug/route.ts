import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // 1. Obtener sesión actual del usuario
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'No se encontró una sesión activa' },
        { status: 401 }
      );
    }
    
    // 2. Obtener empresas del usuario
    const { data: userCompanies, error: userCompaniesError } = await supabase
      .from('user_companies')
      .select('company_id')
      .eq('user_id', session.user.id)
      .eq('is_active', true);
      
    if (userCompaniesError) {
      return NextResponse.json(
        { error: 'Error al obtener empresas del usuario' },
        { status: 500 }
      );
    }
    
    if (!userCompanies || userCompanies.length === 0) {
      return NextResponse.json(
        { error: 'El usuario no tiene empresas asociadas' },
        { status: 404 }
      );
    }
    
    const companyIds = userCompanies.map(uc => uc.company_id);
    
    // 3. Obtener detalles de las empresas
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .in('id', companyIds);
      
    if (companiesError) {
      return NextResponse.json(
        { error: 'Error al obtener detalles de las empresas' },
        { status: 500 }
      );
    }
    
    // 4. Obtener cuentas bancarias de las empresas
    const { data: bankAccounts, error: bankAccountsError } = await supabase
      .from('bank_accounts')
      .select('*, companies:company_id(name)')
      .in('company_id', companyIds);
      
    if (bankAccountsError) {
      return NextResponse.json(
        { error: 'Error al obtener cuentas bancarias' },
        { status: 500 }
      );
    }
    
    // 5. Para cada cuenta, obtener conteo y ejemplo de transacciones
    const accountsWithTransactions = await Promise.all(bankAccounts.map(async (account) => {
      // 5.1 Contar transacciones pendientes
      const { count: pendingCount, error: pendingError } = await supabase
        .from('bank_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('bank_account_id', account.id)
        .eq('status', 'pending');
        
      // 5.2 Contar todas las transacciones
      const { count: totalCount, error: totalError } = await supabase
        .from('bank_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('bank_account_id', account.id);
        
      // 5.3 Obtener una muestra de transacciones
      const { data: sampleTransactions, error: sampleError } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('bank_account_id', account.id)
        .order('transaction_date', { ascending: false })
        .limit(5);
        
      // Buscar específicamente el pago de proveedores
      const { data: pagoProveedores, error: pagoError } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('bank_account_id', account.id)
        .ilike('description', '%proveedores%')
        .limit(5);
        
      return {
        ...account,
        transactions: {
          pending_count: pendingCount,
          total_count: totalCount,
          sample: sampleTransactions || [],
          pago_proveedores: pagoProveedores || []
        },
        errors: {
          pending_error: pendingError,
          total_error: totalError,
          sample_error: sampleError,
          pago_error: pagoError
        }
      };
    }));
    
    // 6. Obtener conteo y ejemplo de registros contables para cada empresa
    const companiesWithEntries = await Promise.all(companies.map(async (company) => {
      // 6.1 Contar registros contables pendientes
      const { count: pendingCount, error: pendingError } = await supabase
        .from('accounting_entries')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .eq('status', 'pending');
        
      // 6.2 Contar todos los registros contables
      const { count: totalCount, error: totalError } = await supabase
        .from('accounting_entries')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id);
        
      // 6.3 Obtener una muestra de registros contables
      const { data: sampleEntries, error: sampleError } = await supabase
        .from('accounting_entries')
        .select('*')
        .eq('company_id', company.id)
        .order('date', { ascending: false })
        .limit(5);
        
      // Buscar facturas con monto cercano a 11.900.000
      const { data: facturaRelevante, error: facturaError } = await supabase
        .from('accounting_entries')
        .select('*')
        .eq('company_id', company.id)
        .eq('amount', 11900000)
        .limit(5);
        
      return {
        ...company,
        accounting_entries: {
          pending_count: pendingCount,
          total_count: totalCount,
          sample: sampleEntries || [],
          factura_relevante: facturaRelevante || []
        },
        errors: {
          pending_error: pendingError,
          total_error: totalError,
          sample_error: sampleError,
          factura_error: facturaError
        }
      };
    }));
    
    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email
      },
      companies: companiesWithEntries,
      bank_accounts: accountsWithTransactions
    });
  } catch (error: any) {
    console.error('❌ Error en debug:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
} 