import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Cargar variables de entorno desde .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  console.log('🔍 Cargando variables de entorno desde:', envPath);
  dotenv.config({ path: envPath });
} else {
  console.warn('⚠️ No se encontró el archivo .env.local');
  dotenv.config();
}

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Variables de entorno faltantes. Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY configurados.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});

async function runMigration() {
  try {
    console.log('🔄 Ejecutando migración de accounting_entries...');
    
    // Leer el archivo SQL
    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', 'create_accounting_entries.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Verificar si la tabla ya existe usando RPC
    console.log('🔍 Verificando si la tabla accounting_entries existe...');
    const { data: tableCheck, error: tableCheckError } = await supabase.rpc('pg_query', {
      query: `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'accounting_entries'
      )`
    });
    
    if (tableCheckError) {
      console.error('❌ Error al verificar si la tabla existe:', tableCheckError);
      return;
    }
    
    const tableExists = tableCheck && tableCheck.length > 0 && tableCheck[0].exists;
    
    if (tableExists) {
      console.log('⚠️ La tabla accounting_entries ya existe. Verificando estructura...');
      
      // Verificar si la columna company_id existe
      console.log('🔍 Verificando si existe la columna company_id...');
      const { data: columnCheck, error: columnCheckError } = await supabase.rpc('pg_query', {
        query: `SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'accounting_entries' 
          AND column_name = 'company_id'
        )`
      });
      
      if (columnCheckError) {
        console.error('❌ Error al verificar columna company_id:', columnCheckError);
        return;
      }
      
      const columnExists = columnCheck && columnCheck.length > 0 && columnCheck[0].exists;
      
      if (columnExists) {
        console.log('✅ La columna company_id ya existe en la tabla.');
      } else {
        console.log('⚠️ No se encontró la columna company_id. Agregándola...');
        
        // Agregar la columna company_id
        const { error: alterError } = await supabase.rpc('pg_query', {
          query: 'ALTER TABLE public.accounting_entries ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;'
        });
        
        if (alterError) {
          console.error('❌ Error al agregar la columna company_id:', alterError);
          return;
        }
        
        console.log('✅ Columna company_id agregada correctamente.');
        
        // Crear índice para la columna company_id
        const { error: indexError } = await supabase.rpc('pg_query', {
          query: 'CREATE INDEX IF NOT EXISTS accounting_entries_company_id_idx ON accounting_entries(company_id);'
        });
        
        if (indexError) {
          console.error('❌ Error al crear el índice para company_id:', indexError);
          return;
        }
        
        console.log('✅ Índice para company_id creado correctamente.');
      }
    } else {
      console.log('🔄 La tabla accounting_entries no existe. Creándola desde cero...');
      
      // Ejecutar la migración completa
      const { error: migrationError } = await supabase.rpc('pg_query', {
        query: sql
      });
      
      if (migrationError) {
        console.error('❌ Error al ejecutar la migración completa:', migrationError);
        return;
      }
      
      console.log('✅ Tabla accounting_entries creada correctamente.');
    }
    
    console.log('✅ Migración completada con éxito.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error general al ejecutar la migración:', error);
    process.exit(1);
  }
}

runMigration(); 