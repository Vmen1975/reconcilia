// Script para insertar directamente en la base de datos la relación entre usuario y empresa
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://txctbngxizudxwjzgdef.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4Y3Ribmd4aXp1ZHh3anpnZGVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjAyOTEzMywiZXhwIjoyMDYxNjA1MTMzfQ.Uv4r8Q92b8RPBSc-xNwe1bsw3A_TU4aj2xEAuxAtamQ';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

// DATOS A MODIFICAR - IDs correctos
const EMAIL = 'vmena@itglobal.cl';
const COMPANY_ID = 'd2c3a65b-b118-4909-a62e-15e10be19e16'; // Dammaq Ltda.

async function setUserCompanyRelation() {
  // Crear cliente Supabase con rol de servicio para tener más permisos
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  console.log('Script de configuración de relación usuario-empresa');
  
  try {
    // Paso 1: Obtener todos los usuarios para encontrar el correcto
    console.log('Buscando usuario con email:', EMAIL);
    
    // Buscar en la tabla de usuarios directamente con SQL
    const { data: userData, error: userError } = await supabase
      .from('auth.users')
      .select('id, email')
      .eq('email', EMAIL)
      .limit(1);
    
    if (userError) {
      console.error('Error al buscar usuario:', userError);
      
      // Intento alternativo: usar RPC o buscar en otra tabla
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email')
        .limit(10);
      
      console.log('Usuarios encontrados (tabla alternativa):', usersData);
      process.exit(1);
    }
    
    if (!userData || userData.length === 0) {
      // Mostrar todos los usuarios en la base de datos
      const { data: allUsers } = await supabase
        .from('auth.users')
        .select('id, email')
        .limit(100);
      
      console.log('No se encontró el usuario con el email especificado.');
      console.log('Usuarios disponibles:', allUsers);
      
      // Insertar manualmente con IDs fijos para la tabla user_companies
      await insertManualRelation(supabase);
      return;
    }
    
    const userId = userData[0].id;
    console.log(`Usuario encontrado: ${userId} (${EMAIL})`);
    
    // Paso 2: Verificar que la empresa existe
    console.log('Verificando empresa:', COMPANY_ID);
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', COMPANY_ID)
      .single();
    
    if (companyError) {
      console.error('Error al verificar empresa:', companyError);
      
      // Obtener todas las empresas
      const { data: allCompanies } = await supabase
        .from('companies')
        .select('id, name')
        .limit(100);
      
      console.log('Empresas disponibles:', allCompanies);
      
      // Insertar manualmente con IDs fijos
      await insertManualRelation(supabase);
      return;
    }
    
    console.log(`Empresa encontrada: ${companyData.name} (${COMPANY_ID})`);
    
    // Paso 3: Crear o actualizar la relación
    console.log('Creando/actualizando relación usuario-empresa...');
    
    // Primero verificar si ya existe
    const { data: existingRelation } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', COMPANY_ID);
    
    if (existingRelation && existingRelation.length > 0) {
      console.log('La relación ya existe. Actualizando...');
      
      // Actualizar la relación existente
      const { error: updateError } = await supabase
        .from('user_companies')
        .update({
          is_active: true,
          is_primary: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('company_id', COMPANY_ID);
      
      if (updateError) {
        console.error('Error al actualizar la relación:', updateError);
        process.exit(1);
      }
      
      console.log('✅ Relación actualizada correctamente');
    } else {
      console.log('Creando nueva relación...');
      
      // Crear nueva relación
      const { error: insertError } = await supabase
        .from('user_companies')
        .insert({
          user_id: userId,
          company_id: COMPANY_ID,
          is_active: true,
          is_primary: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('Error al crear la relación:', insertError);
        process.exit(1);
      }
      
      console.log('✅ Relación creada correctamente');
    }
  } catch (error) {
    console.error('Error inesperado:', error);
    process.exit(1);
  }
}

// Función para insertar la relación manualmente usando IDs fijos
async function insertManualRelation(supabase) {
  console.log('Insertando relación manualmente con IDs fijos...');
  
  // IMPORTANTE: REEMPLAZAR ESTOS IDs CON LOS CORRECTOS DE TU BASE DE DATOS
  const USER_ID = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'; // Reemplazar con el ID correcto
  
  try {
    // Insertar directamente en la tabla usando SQL para evitar restricciones
    const { error } = await supabase.rpc('insert_user_company_relation', {
      p_user_id: USER_ID,
      p_company_id: COMPANY_ID
    });
    
    if (error) {
      console.error('Error al insertar manualmente:', error);
      
      // Intento directo con SQL
      console.log('Intentando SQL directo...');
      
      // Mostrar la estructura de la tabla para debugging
      const { data: tableInfo } = await supabase
        .from('user_companies')
        .select('*')
        .limit(1);
      
      console.log('Estructura de la tabla:', tableInfo);
      
      process.exit(1);
    }
    
    console.log('✅ Relación insertada manualmente con éxito');
  } catch (error) {
    console.error('Error en inserción manual:', error);
    process.exit(1);
  }
}

// Ejecutar el script
setUserCompanyRelation()
  .then(() => {
    console.log('Script completado');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error en el script:', err);
    process.exit(1);
  }); 