import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // 1. Verificar sesión de usuario
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'No se encontró una sesión activa' },
        { status: 401 }
      );
    }
    
    // 2. Limpiar registros existentes para evitar conflictos
    console.log('🧹 Limpiando registros de conciliación existentes...');
    
    // Actualizar primero las transacciones y entradas para quitar referencias
    await supabase
      .from('bank_transactions')
      .update({ 
        status: 'pending',
        reconciliation_id: null
      })
      .neq('status', 'pending');
      
    await supabase
      .from('accounting_entries')
      .update({ 
        status: 'pending',
        reconciliation_id: null
      })
      .neq('status', 'pending');
    
    // Eliminar registros existentes
    const { error: deleteError } = await supabase
      .from('reconciliations')
      .delete()
      .gt('id', '0');
      
    if (deleteError) {
      console.error('❌ Error al limpiar reconciliaciones:', deleteError);
      return NextResponse.json(
        { error: 'Error al limpiar las conciliaciones existentes', details: deleteError },
        { status: 500 }
      );
    }
    
    // 3. Crear registros de prueba para validar
    console.log('🧪 Creando conciliación de prueba...');
    
    // 3.1 Obtener una transacción bancaria para prueba
    const { data: sampleTx, error: txError } = await supabase
      .from('bank_transactions')
      .select('id')
      .limit(1)
      .single();
    
    if (txError) {
      console.error('❌ Error al obtener una transacción de prueba:', txError);
      return NextResponse.json(
        { error: 'No se pudo obtener una transacción para prueba', details: txError },
        { status: 500 }
      );
    }
    
    // 3.2 Obtener un registro contable para prueba
    const { data: sampleEntry, error: entryError } = await supabase
      .from('accounting_entries')
      .select('id')
      .limit(1)
      .single();
      
    if (entryError) {
      console.error('❌ Error al obtener un registro contable de prueba:', entryError);
      return NextResponse.json(
        { error: 'No se pudo obtener un registro contable para prueba', details: entryError },
        { status: 500 }
      );
    }
    
    // 3.3 Crear una conciliación de prueba
    const { data: testMatch, error: testError } = await supabase
      .from('reconciliations')
      .insert([{
        bank_transaction_id: sampleTx.id,
        accounting_entry_id: sampleEntry.id,
        reconciliation_method: 'auto',
        confidence_score: 100,
        status: 'exact'
      }])
      .select();
      
    if (testError) {
      console.error('❌ Error al crear conciliación de prueba:', testError);
      if (testError.message.includes('company_id')) {
        // Si el error está relacionado con company_id, intentamos ejecutar una SQL directa
        // para agregar la columna faltante (esto requiere permisos elevados)
        try {
          console.log('🔧 Intentando corregir la estructura de la tabla...');
          const { error: alterError } = await supabase.rpc('fix_reconciliations_table');
          
          if (alterError) {
            console.error('❌ Error al modificar la tabla:', alterError);
            return NextResponse.json(
              { 
                error: 'No se pudo corregir la estructura de la tabla', 
                details: alterError,
                message: 'Esta operación requiere permisos de administrador en la base de datos'
              },
              { status: 500 }
            );
          }
          
          console.log('✅ Estructura de tabla corregida');
          
          // Intentar nuevamente la creación del registro
          const { data: testMatch2, error: testError2 } = await supabase
            .from('reconciliations')
            .insert([{
              bank_transaction_id: sampleTx.id,
              accounting_entry_id: sampleEntry.id,
              reconciliation_method: 'auto',
              confidence_score: 100,
              status: 'exact'
            }])
            .select();
            
          if (testError2) {
            console.error('❌ Error al crear conciliación después de corrección:', testError2);
            return NextResponse.json(
              { error: 'La corrección no resolvió el problema', details: testError2 },
              { status: 500 }
            );
          }
          
          console.log('✅ Corrección exitosa, la conciliación funciona correctamente');
          return NextResponse.json({
            success: true,
            message: 'Se corrigió la estructura de la tabla y la conciliación funciona correctamente',
            test_match: testMatch2
          });
        } catch (e) {
          console.error('❌ Error durante la corrección:', e);
          return NextResponse.json(
            { error: 'Error desconocido durante la corrección', details: e },
            { status: 500 }
          );
        }
      }
      
      return NextResponse.json(
        { error: 'Error al crear conciliación de prueba', details: testError },
        { status: 500 }
      );
    }
    
    console.log('✅ Conciliación de prueba creada con éxito');
    
    // 4. Actualizar estado de la transacción y registro usados para prueba
    await Promise.all([
      supabase
        .from('bank_transactions')
        .update({ status: 'reconciled', reconciliation_id: testMatch[0].id })
        .eq('id', sampleTx.id),
      supabase
        .from('accounting_entries')
        .update({ status: 'reconciled', reconciliation_id: testMatch[0].id })
        .eq('id', sampleEntry.id)
    ]);
    
    return NextResponse.json({
      success: true,
      message: 'Estructura de tabla validada y conciliación funcional',
      test_match: testMatch,
      instructions: 'Ahora puede ejecutar la conciliación automática normalmente'
    });
  } catch (error: any) {
    console.error('❌ Error general:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
} 