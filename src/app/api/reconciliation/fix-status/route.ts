import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // 1. Obtener los datos del cuerpo de la solicitud
    const { 
      bankAccountId, 
      transactionId,
      accountingEntryId,
      reset = false  // Si es true, resetea el estado a 'pending', de lo contrario arregla el estado
    } = await request.json();
    
    if (!bankAccountId) {
      return NextResponse.json(
        { error: 'Se requiere bankAccountId' },
        { status: 400 }
      );
    }
    
    // 2. Verificar que el usuario tenga permiso para esta cuenta bancaria
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'No se encontró una sesión activa' },
        { status: 401 }
      );
    }
    
    // 3. Obtener la cuenta bancaria para verificar la empresa
    const { data: bankAccount, error: bankAccountError } = await supabase
      .from('bank_accounts')
      .select('company_id')
      .eq('id', bankAccountId)
      .single();
      
    if (bankAccountError) {
      return NextResponse.json(
        { error: 'Error al obtener información de la cuenta bancaria' },
        { status: 500 }
      );
    }
    
    // 4. Verificar que el usuario tenga acceso a esta empresa
    const { data: userCompany, error: userCompanyError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('company_id', bankAccount.company_id)
      .single();
      
    if (userCompanyError || !userCompany) {
      return NextResponse.json(
        { error: 'No tiene permiso para acceder a esta empresa' },
        { status: 403 }
      );
    }
    
    // 5. Realizar las actualizaciones según los parámetros
    const results = {
      transactions_updated: 0,
      entries_updated: 0,
      specific_transaction_updated: false,
      specific_entry_updated: false,
      message: ''
    };
    
    // Actualizar el estado de todas las transacciones de la cuenta
    if (!transactionId) {
      const { data, error, count } = await supabase
        .from('bank_transactions')
        .update({ status: reset ? 'pending' : 'pending' })
        .eq('bank_account_id', bankAccountId)
        .is('reconciliation_id', null);
        
      if (error) {
        console.error('Error al actualizar transacciones:', error);
      } else {
        results.transactions_updated = count || 0;
        results.message += `Se actualizaron ${results.transactions_updated} transacciones bancarias. `;
      }
    } 
    // Actualizar el estado de una transacción específica
    else if (transactionId) {
      const { data, error } = await supabase
        .from('bank_transactions')
        .update({ status: reset ? 'pending' : 'pending' })
        .eq('id', transactionId);
        
      if (error) {
        console.error('Error al actualizar transacción específica:', error);
      } else {
        results.specific_transaction_updated = true;
        results.message += `Transacción ${transactionId} actualizada. `;
      }
    }
    
    // Actualizar el estado de los registros contables de la empresa
    if (!accountingEntryId) {
      const { data, error, count } = await supabase
        .from('accounting_entries')
        .update({ status: reset ? 'pending' : 'pending' })
        .eq('company_id', bankAccount.company_id)
        .is('reconciliation_id', null);
        
      if (error) {
        console.error('Error al actualizar registros contables:', error);
      } else {
        results.entries_updated = count || 0;
        results.message += `Se actualizaron ${results.entries_updated} registros contables. `;
      }
    } 
    // Actualizar el estado de un registro contable específico
    else if (accountingEntryId) {
      const { data, error } = await supabase
        .from('accounting_entries')
        .update({ status: reset ? 'pending' : 'pending' })
        .eq('id', accountingEntryId);
        
      if (error) {
        console.error('Error al actualizar registro contable específico:', error);
      } else {
        results.specific_entry_updated = true;
        results.message += `Registro contable ${accountingEntryId} actualizado. `;
      }
    }
    
    // 6. Buscar específicamente el pago a proveedores de 11.900.000 y la factura correspondiente
    const { data: pagoProveedores, error: pagoError } = await supabase
      .from('bank_transactions')
      .select('id, status')
      .eq('bank_account_id', bankAccountId)
      .ilike('description', '%proveedores%')
      .order('transaction_date', { ascending: false })
      .limit(5);
      
    if (pagoProveedores && pagoProveedores.length > 0) {
      results.message += `\nPago a proveedores encontrado: ${pagoProveedores[0].id} (estado: ${pagoProveedores[0].status}). `;
      
      // Asegurar que tiene estado pending
      const { data: updatePago, error: updatePagoError } = await supabase
        .from('bank_transactions')
        .update({ status: 'pending' })
        .eq('id', pagoProveedores[0].id);
        
      if (!updatePagoError) {
        results.message += `Estado actualizado a 'pending'. `;
      }
    }
    
    const { data: facturaRelevante, error: facturaError } = await supabase
      .from('accounting_entries')
      .select('id, status')
      .eq('company_id', bankAccount.company_id)
      .eq('amount', 11900000)
      .limit(5);
      
    if (facturaRelevante && facturaRelevante.length > 0) {
      results.message += `\nFactura de 11.900.000 encontrada: ${facturaRelevante[0].id} (estado: ${facturaRelevante[0].status}). `;
      
      // Asegurar que tiene estado pending
      const { data: updateFactura, error: updateFacturaError } = await supabase
        .from('accounting_entries')
        .update({ status: 'pending' })
        .eq('id', facturaRelevante[0].id);
        
      if (!updateFacturaError) {
        results.message += `Estado actualizado a 'pending'. `;
      }
    }
    
    return NextResponse.json({
      success: true,
      results
    });
  } catch (error: any) {
    console.error('❌ Error en fix-status:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar estados' },
      { status: 500 }
    );
  }
} 