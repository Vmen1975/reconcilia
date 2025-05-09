#!/usr/bin/env ts-node

import { alterCompaniesTable } from '@/lib/supabase/direct-sql';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });

async function main() {
  console.log('Iniciando script para modificar la tabla companies...');
  
  try {
    const result = await alterCompaniesTable();
    
    if (result.success) {
      console.log('✅ Tabla companies modificada exitosamente');
      console.log('Ahora la tabla tiene las columnas: rut, address, phone, email');
    } else {
      console.error('❌ Error al modificar la tabla companies:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Excepción al ejecutar el script:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Ejecutar el script
main(); 