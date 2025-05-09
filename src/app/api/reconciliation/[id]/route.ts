import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Endpoint para eliminar una conciliación
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Verificar que el usuario esté autenticado
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'No autorizado', details: sessionError?.message },
        { status: 401 }
      );
    }
    
    const reconciliationId = params.id;
    
    if (!reconciliationId) {
      return NextResponse.json(
        { error: 'ID de conciliación no proporcionado' },
        { status: 400 }
      );
    }
    
    console.log(`🔄 Obteniendo información de la conciliación ID: ${reconciliationId}`);
    
    // Obtener datos de la conciliación antes de eliminarla
    const { data: reconciliation, error: fetchError } = await supabase
      .from('reconciliations')
      .select('bank_transaction_id, accounting_entry_id')
      .eq('id', reconciliationId)
      .single();
    
    if (fetchError || !reconciliation) {
      console.error('❌ Error al obtener la conciliación:', fetchError);
      return NextResponse.json(
        { error: 'No se pudo encontrar la conciliación', details: fetchError?.message },
        { status: 404 }
      );
    }
    
    // Iniciar transacción para deshacer la conciliación
    console.log('🔄 Deshaciendo conciliación:', {
      id: reconciliationId,
      transaction_id: reconciliation.bank_transaction_id,
      entry_id: reconciliation.accounting_entry_id
    });
    
    // 1. Actualizar el estado de la transacción bancaria a "pending"
    const { error: txUpdateError } = await supabase
      .from('bank_transactions')
      .update({ 
        status: 'pending',
        reconciliation_id: null
      })
      .eq('id', reconciliation.bank_transaction_id);
    
    if (txUpdateError) {
      console.error('❌ Error al actualizar el estado de la transacción bancaria:', txUpdateError);
    }
    
    // 2. Actualizar el estado del registro contable a "pending"
    const { error: entryUpdateError } = await supabase
      .from('accounting_entries')
      .update({ 
        status: 'pending',
        reconciliation_id: null
      })
      .eq('id', reconciliation.accounting_entry_id);
    
    if (entryUpdateError) {
      console.error('❌ Error al actualizar el estado del registro contable:', entryUpdateError);
    }
    
    // 3. Eliminar la conciliación
    const { error: deleteError } = await supabase
      .from('reconciliations')
      .delete()
      .eq('id', reconciliationId);
    
    if (deleteError) {
      console.error('❌ Error al eliminar la conciliación:', deleteError);
      return NextResponse.json(
        { error: 'Error al eliminar la conciliación', details: deleteError.message },
        { status: 500 }
      );
    }
    
    console.log('✅ Conciliación deshecha exitosamente:', reconciliationId);
    
    return NextResponse.json({
      success: true,
      message: 'Conciliación deshecha correctamente'
    });
  } catch (error: any) {
    console.error('❌ Error general al deshacer la conciliación:', error);
    return NextResponse.json(
      { error: 'Error al deshacer la conciliación', details: error.message },
      { status: 500 }
    );
  }
} 