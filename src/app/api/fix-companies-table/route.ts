import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    // Crear un cliente de Supabase con las credenciales
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials in environment variables' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Obtener la estructura actual de la tabla companies
    const { data, error } = await supabase
      .from('companies')
      .select()
      .limit(1);
    
    if (error) {
      return NextResponse.json(
        { error: 'Error getting companies structure', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: 'Current companies structure',
      data
    }, { status: 200 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Server error', details: errorMessage },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    // Verificar que la contraseña proporcionada sea correcta
    if (password !== '45DW1zVlj4wgAjLa') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Intentar crear la función RPC para ejecutar SQL si no existe
    const createFunctionResult = await supabase.rpc('pg_rpc', {
      query: `
        CREATE OR REPLACE FUNCTION execute_sql(sql_command TEXT) 
        RETURNS TEXT AS $$
        BEGIN
          EXECUTE sql_command;
          RETURN 'SQL executed successfully';
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    }).catch(err => {
      console.log('Error creating function:', err);
      return { error: err };
    });
    
    // Ejecutar SQL para modificar la tabla companies
    const result = await supabase.rpc('execute_sql', {
      sql_command: `
        ALTER TABLE companies 
        ADD COLUMN IF NOT EXISTS rut TEXT,
        ADD COLUMN IF NOT EXISTS address TEXT,
        ADD COLUMN IF NOT EXISTS phone TEXT,
        ADD COLUMN IF NOT EXISTS email TEXT;
      `
    }).catch(err => {
      console.log('Error executing SQL:', err);
      return { error: err };
    });
    
    if (result.error) {
      // Plan B: intentar obtener el resumen de la estructura de la tabla
      const { data: tableInfo, error: tableError } = await supabase
        .from('companies')
        .select()
        .limit(1);
      
      return NextResponse.json({
        success: false,
        error: 'Failed to alter table',
        functionCreation: createFunctionResult.error ? 'Failed' : 'Success',
        sqlExecution: result.error ? result.error.message : 'Success',
        currentTableStructure: tableInfo || null,
        tableError: tableError ? tableError.message : null
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Companies table structure fixed successfully'
    });
  } catch (err) {
    console.error('Error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: 'Unexpected error',
      details: errorMessage
    }, { status: 500 });
  }
} 