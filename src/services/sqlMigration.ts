import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const sqlMigrationService = {
  async alterCompaniesTable() {
    try {
      const supabase = createClientComponentClient();
      
      // Primero debemos obtener el token de sesión actual
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No se ha iniciado sesión');
      }
      
      // Ejecutar la consulta SQL directamente desde el cliente
      // Usar RPC si está disponible o usar la API REST directamente
      const { data, error } = await supabase.rpc('execute_sql', {
        sql: `
          ALTER TABLE companies 
          ADD COLUMN IF NOT EXISTS rut TEXT,
          ADD COLUMN IF NOT EXISTS address TEXT,
          ADD COLUMN IF NOT EXISTS phone TEXT,
          ADD COLUMN IF NOT EXISTS email TEXT;
        `
      });
      
      if (error) {
        console.error('Error alterando la tabla companies:', error);
        throw error;
      }
      
      return { success: true, data };
    } catch (error) {
      console.error('Error en alterCompaniesTable:', error);
      return { success: false, error };
    }
  }
}; 