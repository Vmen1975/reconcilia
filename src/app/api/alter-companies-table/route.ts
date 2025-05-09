import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // Construir la URL de conexión PostgreSQL directa
    const postgresUrl = `postgresql://postgres.txctbngxizudxwjzgdef:45DW1zVlj4wgAjLa@aws-0-sa-east-1.pooler.supabase.com:5432/postgres.txctbngxizudxwjzgdef`;
    
    // Crear un cliente de Supabase con las credenciales desde variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials in environment variables' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Ejecutar SQL para modificar la tabla companies usando pg_rpc
    const { data, error } = await supabase.rpc('pg_rpc', {
      query: `
        ALTER TABLE companies 
        ADD COLUMN IF NOT EXISTS rut TEXT,
        ADD COLUMN IF NOT EXISTS address TEXT,
        ADD COLUMN IF NOT EXISTS phone TEXT,
        ADD COLUMN IF NOT EXISTS email TEXT;
        
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'companies' 
        ORDER BY ordinal_position;
      `
    });
    
    // Si hay error, intentar con la API Supabase directa
    if (error) {
      console.error('Error usando pg_rpc:', error);
      
      // Verificar si el usuario está autenticado
      const { data: { session } } = await supabase.auth.getSession();
      
      // Obtener la estructura actual de la tabla companies
      const { data: tableStructure, error: tableError } = await supabase
        .from('companies')
        .select('*')
        .limit(1);
      
      return NextResponse.json({
        error: 'Failed to alter table with pg_rpc',
        details: error.message,
        authenticated: !!session,
        tableStructure: tableStructure || null,
        tableError: tableError ? tableError.message : null
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Companies table altered successfully',
      data
    }, { status: 200 });
  } catch (err) {
    console.error('Error in alter-companies-table API:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    
    return NextResponse.json({
      error: 'Server error',
      details: errorMessage
    }, { status: 500 });
  }
} 