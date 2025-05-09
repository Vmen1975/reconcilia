import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Verificar si el usuario está autenticado
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized. Must be logged in to perform this action.' },
        { status: 401 }
      );
    }

    // Ejecutar la migración para modificar la tabla companies
    const { error } = await supabase.rpc('execute_sql', {
      sql: `
        ALTER TABLE companies 
        ADD COLUMN IF NOT EXISTS rut TEXT,
        ADD COLUMN IF NOT EXISTS address TEXT,
        ADD COLUMN IF NOT EXISTS phone TEXT,
        ADD COLUMN IF NOT EXISTS email TEXT;
      `
    });
    
    if (error) {
      console.error('Error executing SQL migration:', error);
      return NextResponse.json(
        { error: 'Failed to execute SQL migration', details: error.message },
        { status: 500 }
      );
    }
    
    // Devolver una respuesta exitosa
    return NextResponse.json(
      { message: 'Database migration completed successfully.' },
      { status: 200 }
    );
  } catch (err) {
    console.error('Error in database migration:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error during migration', details: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const cookiesStore = cookies();
    // Verificar autenticación
    const supabase = createRouteHandlerClient({ cookies: () => cookiesStore });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Ejecutar migración para eliminar el campo rut de la tabla bank_accounts
    const { error } = await supabase.rpc('execute_sql', {
      sql: `
        ALTER TABLE bank_accounts 
        DROP COLUMN IF EXISTS rut;
      `
    });

    if (error) {
      console.error('Error ejecutando migración:', error);
      
      // Intentar obtener estructura actual de la tabla para debugging
      const { data: tableInfo, error: tableError } = await supabase
        .from('bank_accounts')
        .select('*')
        .limit(1);
      
      if (tableError) {
        return NextResponse.json({ 
          error: 'Error ejecutando migración y al obtener estructura de tabla', 
          details: error.message,
          tableError: tableError.message 
        }, { status: 500 });
      }
      
      return NextResponse.json({ 
        error: 'Error ejecutando migración', 
        details: error.message,
        currentStructure: tableInfo 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Migración completada exitosamente: campo rut eliminado de la tabla bank_accounts' 
    });
  } catch (error: any) {
    console.error('Error general:', error);
    return NextResponse.json({ 
      error: 'Error al procesar la solicitud', 
      details: error.message 
    }, { status: 500 });
  }
} 