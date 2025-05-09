import { createClient } from '@/lib/supabase/client';

export interface ActivityLog {
  id: string;
  user_id: string | null;
  company_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
  ip_address: string | null;
  // Campos calculados que agregaremos con joins
  user_email?: string;
  user_name?: string;
}

export interface ActivityFilter {
  companyId: string;
  userId?: string;
  entityType?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

const supabase = createClient();

export const activityService = {
  /**
   * Obtiene el registro de actividades con filtros
   */
  async getActivityLogs(filter: ActivityFilter): Promise<{
    data: ActivityLog[];
    count: number;
  }> {
    let query = supabase
      .from('activity_logs')
      .select('*, auth.users!activity_logs_user_id_fkey(email, raw_user_meta_data)', {
        count: 'exact',
      })
      .eq('company_id', filter.companyId)
      .order('created_at', { ascending: false });

    // Aplicar filtros opcionales
    if (filter.userId) {
      query = query.eq('user_id', filter.userId);
    }

    if (filter.entityType) {
      query = query.eq('entity_type', filter.entityType);
    }

    if (filter.action) {
      query = query.eq('action', filter.action);
    }

    if (filter.startDate) {
      query = query.gte('created_at', filter.startDate.toISOString());
    }

    if (filter.endDate) {
      const endDate = new Date(filter.endDate);
      endDate.setDate(endDate.getDate() + 1); // Incluir todo el día final
      query = query.lt('created_at', endDate.toISOString());
    }

    // Paginación
    if (filter.limit) {
      query = query.limit(filter.limit);
    }

    if (filter.offset) {
      query = query.range(filter.offset, filter.offset + (filter.limit || 10) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error al obtener logs de actividad:', error);
      throw error;
    }

    // Procesar los datos para extraer la información del usuario
    const processedData = data?.map(log => {
      const user = log.users || {};
      return {
        ...log,
        users: undefined, // Eliminar el objeto anidado
        user_email: user.email,
        user_name: user.raw_user_meta_data?.name || user.email?.split('@')[0] || 'Usuario desconocido'
      };
    });

    return {
      data: processedData || [],
      count: count || 0
    };
  },

  /**
   * Obtiene un detalle específico de actividad
   */
  async getActivityDetail(activityId: string): Promise<ActivityLog | null> {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*, auth.users!activity_logs_user_id_fkey(email, raw_user_meta_data)')
      .eq('id', activityId)
      .single();

    if (error) {
      console.error('Error al obtener detalle de actividad:', error);
      throw error;
    }

    // Procesar el dato para extraer información del usuario
    if (data) {
      const user = data.users || {};
      return {
        ...data,
        users: undefined,
        user_email: user.email,
        user_name: user.raw_user_meta_data?.name || user.email?.split('@')[0] || 'Usuario desconocido'
      };
    }

    return null;
  },

  /**
   * Obtiene resumen de actividad por tipo de entidad para una empresa
   */
  async getActivitySummary(companyId: string): Promise<{
    entity_type: string;
    count: number;
  }[]> {
    const { data, error } = await supabase
      .rpc('get_activity_summary', {
        p_company_id: companyId
      });

    if (error) {
      console.error('Error al obtener resumen de actividad:', error);
      throw error;
    }

    return data || [];
  }
}; 