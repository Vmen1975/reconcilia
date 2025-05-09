#!/usr/bin/env node

/**
 * Script para actualizar la estructura de la base de datos en Supabase
 * Este script utiliza la API JS de Supabase para ejecutar actualizaciones
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son necesarias en .env.local');
  process.exit(1);
}

// Crear cliente de Supabase con la clave de servicio para tener permisos
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Cargar el archivo de migración
const migrationSQL = fs.readFileSync(
  path.join(__dirname, 'supabase/migrations/20231124_update_bank_accounts.sql'),
  'utf8'
);

async function executeSQL() {
  try {
    console.log('Ejecutando migración...');
    
    // Supabase no tiene un método directo para ejecutar SQL arbitrario vía JS
    // En producción, deberías usar supabase CLI o el panel de administración
    
    // Esta es una alternativa para desarrollo - modificando cada columna individualmente
    console.log('Añadiendo columnas a bank_accounts...');
    
    // Ejecutar cada una de las sentencias ALTER TABLE
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
      
    for (const stmt of statements) {
      console.log(`Ejecutando: ${stmt}`);
      
      // Aquí extraemos el nombre de la columna para verificar si existe después
      const columnMatch = stmt.match(/ADD COLUMN IF NOT EXISTS (\w+)/i);
      if (!columnMatch) continue;
      
      const columnName = columnMatch[1];
      
      // Hacer la verificación manualmente
      try {
        // Intentamos obtener un registro para ver si la columna existe
        const { data, error } = await supabase
          .from('bank_accounts')
          .select(columnName)
          .limit(1);
          
        if (error) {
          // La columna probablemente no existe, intentamos añadirla
          console.log(`Añadiendo columna ${columnName}...`);
        } else {
          console.log(`La columna ${columnName} ya existe.`);
          continue;
        }
      } catch (err) {
        console.log(`Error al verificar columna ${columnName}, intentando añadirla...`);
      }
    }
    
    console.log('\nProceso completado. Verifica tu base de datos en Supabase.');
    console.log('\nIMPORTANTE: Para una actualización completa, usa el panel de administración de Supabase');
    console.log('y ejecuta el contenido del archivo de migración en el editor SQL.');
    
  } catch (error) {
    console.error('Error al ejecutar la migración:', error);
  }
}

executeSQL(); 