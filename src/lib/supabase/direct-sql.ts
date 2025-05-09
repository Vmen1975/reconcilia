import { createClient } from '@supabase/supabase-js';

// Obtener las credenciales de Supabase desde variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Faltan variables de entorno necesarias para conectar con Supabase');
}

// Crear un cliente con la llave de servicio (service role key) que tiene acceso privilegiado
const adminSupabase = createClient(
  supabaseUrl,
  supabaseServiceKey
);

/**
 * Ejecuta una consulta SQL directamente en Supabase
 * Esta función debe usarse con precaución y solo desde el servidor
 */
export async function executeDirectSQL(sql: string): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    console.log('Ejecutando SQL:', sql);
    
    const { data, error } = await adminSupabase.rpc('execute_sql', { sql });
    
    if (error) {
      console.error('Error al ejecutar SQL directo:', error);
      return { success: false, error };
    }
    
    return { success: true, data };
  } catch (err) {
    console.error('Excepción al ejecutar SQL directo:', err);
    return { success: false, error: err };
  }
}

/**
 * Modifica la estructura de la tabla companies para añadir las columnas necesarias
 */
export async function alterCompaniesTable() {
  const sql = `
    ALTER TABLE companies 
    ADD COLUMN IF NOT EXISTS rut TEXT,
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT;
  `;
  
  return executeDirectSQL(sql);
}

export default adminSupabase; 