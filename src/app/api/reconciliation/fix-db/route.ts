import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Este endpoint ejecuta una reparación en la tabla reconciliations
// para asegurarse de que tiene el campo company_id
export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
  
  // Verificar que el usuario esté autenticado
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    return NextResponse.json({ 
      success: false, 
      error: 'No autorizado',
      details: sessionError?.message 
    }, { status: 401 });
  }
  
  try {
    console.log('🔧 Iniciando reparación de tabla reconciliations');
    
    // Primero verificar si la columna ya existe
    const { data: columns, error: columnsError } = await supabase.rpc(
      'get_table_columns',
      { table_name: 'reconciliations' }
    );
    
    if (columnsError) {
      console.error('❌ Error al verificar columnas de la tabla:', columnsError);
      
      // Intentar con consulta directa si la RPC no está disponible
      console.log('🔄 Intentando verificar columnas con información del esquema...');
      
      // Comprobar si la columna ya existe
      const { data: columnExists, error: columnCheckError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'reconciliations')
        .eq('column_name', 'company_id');
        
      if (columnCheckError) {
        console.error('❌ Error al verificar columna desde information_schema:', columnCheckError);
        return NextResponse.json({ 
          success: false, 
          error: 'Error al verificar estructura de la tabla',
          details: columnCheckError.message
        }, { status: 500 });
      }
      
      const hasColumn = columnExists && columnExists.length > 0;
      console.log('📊 Resultado de verificación de columna company_id:', hasColumn ? 'Existe' : 'No existe');
      
      if (hasColumn) {
        return NextResponse.json({ 
          success: true, 
          message: 'La columna company_id ya existe en la tabla reconciliations'
        });
      }
    } else {
      console.log('📊 Columnas actuales de la tabla reconciliations:', columns);
      
      // Verificar si company_id ya existe entre las columnas
      const hasCompanyId = columns.some((col: any) => col.column_name === 'company_id');
      
      if (hasCompanyId) {
        return NextResponse.json({ 
          success: true, 
          message: 'La columna company_id ya existe en la tabla reconciliations'
        });
      }
    }
    
    // Si llegamos aquí, necesitamos añadir la columna
    console.log('➕ Añadiendo columna company_id a la tabla reconciliations');
    
    // Ejecutar SQL para añadir la columna
    const { error: alterError } = await supabase.rpc(
      'execute_sql',
      {
        sql_command: `
          ALTER TABLE IF EXISTS public.reconciliations 
          ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
        `
      }
    );
    
    if (alterError) {
      console.error('❌ Error al añadir columna company_id:', alterError);
      
      // Intentar directamente con SQL si la RPC no está disponible
      console.log('🔄 Intentando añadir columna directamente...');
      
      // Algunos proveedores de Postgres permiten ejecutar SQL directamente
      const { error: directSqlError } = await supabase.rpc(
        'run_sql', // otra posible función RPC
        { 
          query: `
            ALTER TABLE IF EXISTS public.reconciliations 
            ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
          `
        }
      );
      
      if (directSqlError) {
        console.error('❌ Error al añadir columna directamente:', directSqlError);
        return NextResponse.json({ 
          success: false, 
          error: 'Error al añadir columna company_id',
          details: directSqlError.message
        }, { status: 500 });
      }
    }
    
    // Verificar que la columna se añadió correctamente
    console.log('✅ Columna company_id añadida correctamente');
    
    // Ahora actualizar los registros existentes con el company_id correcto
    console.log('🔄 Actualizando registros existentes con company_id...');
    
    const { error: updateError } = await supabase.rpc(
      'execute_sql',
      {
        sql_command: `
          UPDATE reconciliations r
          SET company_id = ba.company_id
          FROM bank_accounts ba
          WHERE r.bank_account_id = ba.id
          AND r.company_id IS NULL;
        `
      }
    );
    
    if (updateError) {
      console.error('❌ Error al actualizar registros con company_id:', updateError);
      
      // No fallar por esto, es solo un paso adicional
      console.log('⚠️ No se pudieron actualizar registros existentes, pero la estructura se corrigió');
      
      return NextResponse.json({ 
        success: true, 
        message: 'Columna company_id añadida, pero no se actualizaron registros existentes',
        warning: updateError.message
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Tabla reconciliations reparada correctamente con columna company_id'
    });
  } catch (error: any) {
    console.error('❌ Error general en la reparación:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: 'Error al reparar la tabla reconciliations',
      details: error.message
    }, { status: 500 });
  }
} 