import { createClient } from '@/lib/supabase/client';

export interface ReconciliationRule {
  id: string;
  company_id: string;
  rule_name: string;
  description_pattern: string | null;
  amount_pattern: string | null;
  transaction_type: string | null;
  rule_priority: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReconciliationParams {
  company_id: string;
  tolerance_days: number;
  amount_tolerance: number;
  // Parámetros avanzados
  dateWeight?: number;
  amountWeight?: number;
  descriptionWeight?: number;
  minMatchScore?: number;
  enableAutoReconciliation?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateRuleParams {
  company_id: string;
  rule_name: string;
  description_pattern?: string | undefined;
  amount_pattern?: string | undefined;
  transaction_type?: string | undefined;
  rule_priority?: number;
  is_active?: boolean;
}

export interface UpdateRuleParams extends Partial<CreateRuleParams> {
  id: string;
}

export const rulesService = {
  /**
   * Obtiene todas las reglas de conciliación para una empresa
   */
  async getRules(companyId: string): Promise<ReconciliationRule[]> {
    try {
      const response = await fetch(`/api/reconciliation/rules?companyId=${encodeURIComponent(companyId)}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error al obtener reglas de conciliación:', errorData);
        throw new Error(errorData.error || 'Error al obtener reglas de conciliación');
      }
      
      const data = await response.json();
      return data as ReconciliationRule[];
    } catch (error) {
      console.error('Excepción al obtener reglas de conciliación:', error);
      throw error;
    }
  },

  /**
   * Obtiene una regla de conciliación específica
   */
  async getRule(ruleId: string): Promise<ReconciliationRule | null> {
    try {
      const response = await fetch(`/api/reconciliation/rules/${ruleId}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorData = await response.json();
        console.error(`Error al obtener regla de conciliación ${ruleId}:`, errorData);
        throw new Error(errorData.error || 'Error al obtener regla de conciliación');
      }
      
      const data = await response.json();
      return data as ReconciliationRule;
    } catch (error) {
      console.error(`Excepción al obtener regla de conciliación ${ruleId}:`, error);
      throw error;
    }
  },

  /**
   * Crea una nueva regla de conciliación
   */
  async createRule(params: CreateRuleParams): Promise<ReconciliationRule> {
    try {
      const response = await fetch('/api/reconciliation/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error al crear regla de conciliación:', errorData);
        throw new Error(errorData.error || 'Error al crear regla de conciliación');
      }
      
      const data = await response.json();
      return data as ReconciliationRule;
    } catch (error) {
      console.error('Excepción al crear regla de conciliación:', error);
      throw error;
    }
  },

  /**
   * Actualiza una regla de conciliación existente
   */
  async updateRule(params: UpdateRuleParams): Promise<ReconciliationRule> {
    const { id, ...updateData } = params;
    
    try {
      const response = await fetch(`/api/reconciliation/rules/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Error al actualizar regla de conciliación ${id}:`, errorData);
        throw new Error(errorData.error || 'Error al actualizar regla de conciliación');
      }
      
      const data = await response.json();
      return data as ReconciliationRule;
    } catch (error) {
      console.error(`Excepción al actualizar regla de conciliación ${id}:`, error);
      throw error;
    }
  },

  /**
   * Elimina una regla de conciliación
   */
  async deleteRule(ruleId: string): Promise<void> {
    try {
      const response = await fetch(`/api/reconciliation/rules/${ruleId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Error al eliminar regla de conciliación ${ruleId}:`, errorData);
        throw new Error(errorData.error || 'Error al eliminar regla de conciliación');
      }
    } catch (error) {
      console.error(`Excepción al eliminar regla de conciliación ${ruleId}:`, error);
      throw error;
    }
  },

  /**
   * Cambia el estado activo/inactivo de una regla
   */
  async toggleRuleStatus(ruleId: string, isActive: boolean): Promise<ReconciliationRule> {
    try {
      const response = await fetch(`/api/reconciliation/rules/${ruleId}/toggle-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: isActive }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Error al cambiar estado de la regla ${ruleId}:`, errorData);
        throw new Error(errorData.error || 'Error al cambiar estado de la regla');
      }
      
      const data = await response.json();
      return data as ReconciliationRule;
    } catch (error) {
      console.error(`Excepción al cambiar estado de la regla ${ruleId}:`, error);
      throw error;
    }
  },

  /**
   * Cambia la prioridad de una regla
   */
  async updateRulePriority(ruleId: string, priority: number): Promise<ReconciliationRule> {
    try {
      const response = await fetch(`/api/reconciliation/rules/${ruleId}/priority`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rule_priority: priority }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Error al cambiar prioridad de la regla ${ruleId}:`, errorData);
        throw new Error(errorData.error || 'Error al cambiar prioridad de la regla');
      }
      
      const data = await response.json();
      return data as ReconciliationRule;
    } catch (error) {
      console.error(`Excepción al cambiar prioridad de la regla ${ruleId}:`, error);
      throw error;
    }
  },

  /**
   * Obtiene los parámetros de conciliación de una empresa
   */
  async getReconciliationParams(companyId: string): Promise<ReconciliationParams | null> {
    try {
      const response = await fetch(`/api/reconciliation/params?companyId=${encodeURIComponent(companyId)}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Si no se encuentran parámetros, retornamos valores por defecto
          return {
            company_id: companyId,
            tolerance_days: 7,
            amount_tolerance: 1
          };
        }
        const errorData = await response.json();
        console.error('Error al obtener parámetros de conciliación:', errorData);
        throw new Error(errorData.error || 'Error al obtener parámetros de conciliación');
      }
      
      const data = await response.json();
      return data as ReconciliationParams;
    } catch (error) {
      console.error('Excepción al obtener parámetros de conciliación:', error);
      // En caso de error, retornamos valores por defecto
      return {
        company_id: companyId,
        tolerance_days: 7,
        amount_tolerance: 1
      };
    }
  },

  /**
   * Guarda los parámetros de conciliación de una empresa
   */
  async saveReconciliationParams(params: ReconciliationParams): Promise<ReconciliationParams> {
    try {
      const response = await fetch('/api/reconciliation/params', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error al guardar parámetros de conciliación:', errorData);
        throw new Error(errorData.error || 'Error al guardar parámetros de conciliación');
      }
      
      const data = await response.json();
      return data as ReconciliationParams;
    } catch (error) {
      console.error('Excepción al guardar parámetros de conciliación:', error);
      throw error;
    }
  }
}; 