// Script para crear manualmente una relación entre usuario y empresa
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Datos específicos para la relación
const USER_EMAIL = 'vmena@itglobal.cl';
const COMPANY_ID = 'd2c3a65b-b118-4909-a62e-15e10be19e16'; // ID de Dammaq Ltda.

async function createUserCompanyRelation() {
  // Crear cliente Supabase
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Faltan las variables de entorno de Supabase');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // 1. Primero, obtener el ID del usuario por su email
    console.log(`Buscando usuario con email: ${USER_EMAIL}`);
    const { data: userData, error: userError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', USER_EMAIL)
      .single();
    
    if (userError) {
      // Si hay error, intentar buscar en profiles o directamente en auth.users
      console.log('Error al buscar en auth.users, intentando con auth API...');
      
      // Esta es una alternativa para buscar el usuario
      const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.error('Error al buscar usuario:', authError);
        process.exit(1);
      }
      
      const foundUser = authUser.users.find(u => u.email === USER_EMAIL);
      if (!foundUser) {
        console.error(`No se encontró el usuario con email ${USER_EMAIL}`);
        process.exit(1);
      }
      
      userId = foundUser.id;
    } else {
      userId = userData.id;
    }
    
    console.log(`Usuario encontrado con ID: ${userId}`);
    
    // 2. Verificar que la empresa existe
    console.log(`Verificando que la empresa con ID ${COMPANY_ID} existe`);
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('name')
      .eq('id', COMPANY_ID)
      .single();
    
    if (companyError) {
      console.error('Error al verificar la empresa:', companyError);
      process.exit(1);
    }
    
    console.log(`Empresa encontrada: ${companyData.name}`);
    
    // 3. Verificar si ya existe una relación
    console.log('Verificando si ya existe una relación...');
    const { data: existingRelation, error: relationError } = await supabase
      .from('user_companies')
      .select('*')
      .eq('user_id', userId)
      .eq('company_id', COMPANY_ID);
    
    if (relationError) {
      console.error('Error al verificar relación existente:', relationError);
    }
    
    if (existingRelation && existingRelation.length > 0) {
      console.log('Ya existe una relación. Actualizando...');
      
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
        console.error('Error al actualizar relación:', updateError);
        process.exit(1);
      }
      
      console.log('Relación actualizada correctamente');
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
        console.error('Error al crear relación:', insertError);
        process.exit(1);
      }
      
      console.log('Relación creada correctamente');
    }
    
    console.log('Operación completada con éxito');
  } catch (error) {
    console.error('Error inesperado:', error);
    process.exit(1);
  }
}

// Ejecutar la función
createUserCompanyRelation().then(() => {
  console.log('Script finalizado');
  process.exit(0);
}); 