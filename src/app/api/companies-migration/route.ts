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
    const { error } = await supabase.rpc('pg_rpc', {
      query: `
        ALTER TABLE companies 
        ADD COLUMN IF NOT EXISTS rut TEXT,
        ADD COLUMN IF NOT EXISTS address TEXT,
        ADD COLUMN IF NOT EXISTS phone TEXT,
        ADD COLUMN IF NOT EXISTS email TEXT;
      `
    });
    
    if (error) {
      console.error('Error ejecutando SQL migration:', error);
      
      // Plan B: Si la RPC da error, intentar crear una empresa directamente
      const { data: userData } = await supabase.auth.getUser();
      console.log("Usuario actual:", userData?.user?.id);

      // Intentar ver la estructura actual de la tabla companies
      const { data: tableInfo, error: tableError } = await supabase
        .from('companies')
        .select()
        .limit(1);
      
      if (tableError) {
        console.error('Error obteniendo info de la tabla:', tableError);
      } else {
        console.log('Estructura de tabla companies:', tableInfo);
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to execute SQL migration', 
          details: error.message,
          tableInfo: tableInfo || null
        },
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