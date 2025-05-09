import { createClient, getAuthenticatedUser } from '@/lib/supabase/client';
import type { Company } from '@/types';

// Función auxiliar para asociar un usuario con una empresa
async function associateUserWithCompany(companyId: string) {
  try {
    const supabase = createClient();
    // Usar la nueva función de utilidad para obtener el usuario
    const user = await getAuthenticatedUser();
    
    if (!user) {
      console.error('No hay usuario autenticado para asociar con la empresa');
      return { success: false, error: 'No hay usuario autenticado' };
    }
    
    console.log('Asociando usuario', user.id, 'con empresa', companyId);
    
    // Verificar si el usuario ya tiene alguna empresa asociada
    const { data: existingCompanies, error: checkError } = await supabase
      .from('user_companies')
      .select('id, is_primary')
      .eq('user_id', user.id);
    
    if (checkError) {
      console.error('Error al verificar empresas existentes:', checkError);
    }
    
    // Determinar si esta debe ser la empresa principal
    const isPrimary = !existingCompanies || existingCompanies.length === 0;
    
    // Insertar en la tabla user_companies
    const { error } = await supabase
      .from('user_companies')
      .upsert({
        user_id: user.id,
        company_id: companyId,
        is_primary: isPrimary,
        is_active: true,
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id,company_id'
      });
    
    if (error) {
      console.error('Error al asociar usuario con empresa:', error);
      throw error;
    }

    console.log('Usuario asociado correctamente con empresa');
    return { success: true };
  } catch (error) {
    console.error('Excepción al asociar usuario con empresa:', error);
    return { success: false, error };
  }
}

export const companyService = {
  async getCompanies() {
    try {
      // Usar nuestro endpoint API en lugar del cliente Supabase
      const response = await fetch('/api/companies', {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error al obtener empresas:', errorData);
        throw new Error(errorData.error || 'Error al obtener empresas');
      }
      
      const data = await response.json();
      return data as Company[];
    } catch (error) {
      console.error('Excepción al obtener empresas:', error);
      return [];
    }
  },

  async getCompany(id: string) {
    try {
      // Usar nuestro endpoint API específico por ID
      const response = await fetch(`/api/companies/${id}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Error al obtener empresa ${id}:`, errorData);
        throw new Error(errorData.error || 'Error al obtener empresa');
      }
      
      const data = await response.json();
      return data as Company;
    } catch (error) {
      console.error(`Excepción al obtener empresa ${id}:`, error);
      throw error;
    }
  },

  async createCompany(company: Omit<Company, 'id' | 'created_at' | 'updated_at'>) {
    console.log('Intentando crear empresa con datos:', JSON.stringify(company));
    
    try {
      // En lugar de usar el cliente Supabase directamente, usar nuestra API proxy
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(company),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error al crear empresa:', errorData);
        throw new Error(errorData.error || 'Error al crear empresa');
      }
      
      const data = await response.json();
      console.log('Empresa creada exitosamente:', data);
      
      return data as Company;
    } catch (error) {
      console.error('Excepción al crear empresa:', error);
      throw error;
    }
  },

  async updateCompany(id: string, company: Partial<Company>) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('companies')
      .update(company)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as Company;
  },

  async deleteCompany(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Nuevas funciones para gestionar la relación usuario-empresa
  
  async getUserCompanies() {
    try {
      // Usar nuestro endpoint API en lugar del cliente Supabase
      const response = await fetch('/api/user-companies', {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error al obtener empresas del usuario:', errorData);
        throw new Error(errorData.error || 'Error al obtener empresas del usuario');
      }
      
      const data = await response.json();
      console.log('Empresas obtenidas para el usuario:', data?.length || 0);
      
      return data as Array<Company & { is_primary: boolean, is_active: boolean }>;
    } catch (error) {
      console.error('Excepción al obtener empresas del usuario:', error);
      return [];
    }
  },
  
  // Exponemos la función auxiliar como parte del servicio
  associateUserWithCompany,
  
  async setPrimaryCompany(companyId: string) {
    try {
      // Usar la nueva función de utilidad para obtener el usuario
      const user = await getAuthenticatedUser();
      
      if (!user) {
        console.error('No hay usuario autenticado para establecer empresa principal');
        return { success: false, error: 'No hay usuario autenticado' };
      }
      
      const supabase = createClient();
      
      // 1. Desmarcar todas las empresas del usuario como no primarias
      const { error: updateError } = await supabase
        .from('user_companies')
        .update({ is_primary: false })
        .eq('user_id', user.id);
      
      if (updateError) {
        console.error('Error al actualizar empresas existentes:', updateError);
        return { success: false, error: updateError };
      }
      
      // 2. Marcar la empresa seleccionada como primaria
      const { error } = await supabase
        .from('user_companies')
        .update({ is_primary: true })
        .eq('user_id', user.id)
        .eq('company_id', companyId);
      
      if (error) {
        console.error('Error al establecer empresa principal:', error);
        return { success: false, error };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Excepción al establecer empresa principal:', error);
      return { success: false, error };
    }
  }
}; 