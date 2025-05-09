# Implementación de Funcionalidades Faltantes en Reconcilia

Este documento describe la implementación de funcionalidades que estaban pendientes según la definición inicial del proyecto:

1. Reglas de conciliación personalizadas (`reconciliation_rules`)
2. Registro de actividades para auditoría (`activity_logs`)

## 1. Estructura de Base de Datos

### 1.1 Tablas SQL a Crear

Para implementar estas funcionalidades, deben crearse las siguientes tablas en la base de datos de Supabase:

```sql
-- Tabla de reglas de conciliación personalizadas
CREATE TABLE IF NOT EXISTS reconciliation_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  description_pattern TEXT,
  amount_pattern TEXT,
  transaction_type TEXT,
  rule_priority INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

COMMENT ON TABLE reconciliation_rules IS 'Reglas personalizadas para la conciliación automática';

-- Tabla de registro de actividades para auditoría
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  ip_address TEXT
);

COMMENT ON TABLE activity_logs IS 'Registro de actividades de usuarios para auditoría y trazabilidad';
```

### 1.2 Función de Registro de Actividad

Para automatizar el registro de actividades, se creará la siguiente función y triggers:

```sql
-- Crear función para registrar actividad
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
DECLARE
  current_user_id UUID;
  company_id_val UUID;
BEGIN
  -- Obtener el ID del usuario actual
  current_user_id := auth.uid();
  
  -- Determinar la compañía según la tabla
  IF TG_TABLE_NAME = 'companies' THEN
    company_id_val := NEW.id;
  ELSIF TG_TABLE_NAME IN ('bank_accounts', 'reconciliations', 'reconciliation_rules') THEN
    company_id_val := NEW.company_id;
  ELSIF TG_TABLE_NAME = 'bank_transactions' THEN
    SELECT company_id INTO company_id_val FROM bank_accounts WHERE id = NEW.bank_account_id;
  ELSIF TG_TABLE_NAME = 'accounting_entries' THEN
    SELECT company_id INTO company_id_val FROM bank_accounts WHERE id = NEW.bank_account_id;
  END IF;
  
  -- Registrar la actividad
  INSERT INTO activity_logs (
    user_id, 
    company_id,
    action,
    entity_type,
    entity_id,
    details,
    ip_address
  ) VALUES (
    current_user_id,
    company_id_val,
    TG_OP,                       -- INSERT, UPDATE, DELETE
    TG_TABLE_NAME,               -- Nombre de la tabla
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,  -- ID de la entidad
    CASE 
      WHEN TG_OP = 'INSERT' THEN jsonb_build_object('new', row_to_json(NEW)::jsonb)
      WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('old', row_to_json(OLD)::jsonb, 'new', row_to_json(NEW)::jsonb)
      WHEN TG_OP = 'DELETE' THEN jsonb_build_object('old', row_to_json(OLD)::jsonb)
    END,
    current_setting('request.headers', true)::json->>'x-forwarded-for'
  );
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers para registrar actividad en las tablas principales
CREATE TRIGGER log_companies_activity
AFTER INSERT OR UPDATE OR DELETE ON companies
FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER log_bank_accounts_activity
AFTER INSERT OR UPDATE OR DELETE ON bank_accounts
FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER log_bank_transactions_activity
AFTER INSERT OR UPDATE OR DELETE ON bank_transactions
FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER log_accounting_entries_activity
AFTER INSERT OR UPDATE OR DELETE ON accounting_entries
FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER log_reconciliations_activity
AFTER INSERT OR UPDATE OR DELETE ON reconciliations
FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER log_reconciliation_rules_activity
AFTER INSERT OR UPDATE OR DELETE ON reconciliation_rules
FOR EACH ROW EXECUTE FUNCTION log_activity();
```

### 1.3 Políticas de Seguridad (RLS)

```sql
-- Habilitar RLS en las tablas
ALTER TABLE reconciliation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Política para reglas de conciliación
CREATE POLICY reconciliation_rules_policy ON reconciliation_rules
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Política para logs de actividad
CREATE POLICY activity_logs_policy ON activity_logs
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM user_companies 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
```

## 2. Implementación en Frontend

### 2.1 Servicios

Crear los siguientes archivos de servicio para manejar las operaciones con las nuevas tablas:

#### `src/services/rulesService.ts`
```typescript
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

export interface CreateRuleParams {
  company_id: string;
  rule_name: string;
  description_pattern?: string;
  amount_pattern?: string;
  transaction_type?: string;
  rule_priority?: number;
  is_active?: boolean;
}

export interface UpdateRuleParams extends Partial<CreateRuleParams> {
  id: string;
}

const supabase = createClient();

export const rulesService = {
  // Métodos para gestionar reglas de conciliación
  async getRules(companyId: string): Promise<ReconciliationRule[]> {
    const { data, error } = await supabase
      .from('reconciliation_rules')
      .select('*')
      .eq('company_id', companyId)
      .order('rule_priority', { ascending: true });

    if (error) {
      console.error('Error al obtener reglas de conciliación:', error);
      throw error;
    }

    return data as ReconciliationRule[] || [];
  },

  async getRule(ruleId: string): Promise<ReconciliationRule | null> {
    const { data, error } = await supabase
      .from('reconciliation_rules')
      .select('*')
      .eq('id', ruleId)
      .single();

    if (error) {
      console.error('Error al obtener regla de conciliación:', error);
      throw error;
    }

    return data as ReconciliationRule;
  },

  async createRule(params: CreateRuleParams): Promise<ReconciliationRule> {
    const { data, error } = await supabase
      .from('reconciliation_rules')
      .insert(params)
      .select()
      .single();

    if (error) {
      console.error('Error al crear regla de conciliación:', error);
      throw error;
    }

    return data as ReconciliationRule;
  },

  async updateRule(params: UpdateRuleParams): Promise<ReconciliationRule> {
    const { id, ...updateData } = params;
    
    const { data, error } = await supabase
      .from('reconciliation_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar regla de conciliación:', error);
      throw error;
    }

    return data as ReconciliationRule;
  },

  async deleteRule(ruleId: string): Promise<void> {
    const { error } = await supabase
      .from('reconciliation_rules')
      .delete()
      .eq('id', ruleId);

    if (error) {
      console.error('Error al eliminar regla de conciliación:', error);
      throw error;
    }
  },

  async toggleRuleStatus(ruleId: string, isActive: boolean): Promise<ReconciliationRule> {
    const { data, error } = await supabase
      .from('reconciliation_rules')
      .update({ is_active: isActive })
      .eq('id', ruleId)
      .select()
      .single();

    if (error) {
      console.error('Error al cambiar estado de la regla:', error);
      throw error;
    }

    return data as ReconciliationRule;
  }
};
```

#### `src/services/activityService.ts`
```typescript
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
    }) as ActivityLog[];

    return {
      data: processedData || [],
      count: count || 0
    };
  },

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
      } as ActivityLog;
    }

    return null;
  }
};
```

### 2.2 Algoritmo de Conciliación con Reglas

Crear el siguiente archivo para implementar la lógica de coincidencia usando las reglas de conciliación:

#### `src/lib/reconciliation/matching.ts`
```typescript
import { createClient } from '@/lib/supabase/client';
import { BankTransaction } from '@/types/bank';
import { AccountingEntry } from '@/types/accounting';
import { ReconciliationRule } from '@/services/rulesService';

// Cliente de Supabase
const supabase = createClient();

// Interfaz para representar una coincidencia entre transacción y registro contable
export interface ReconciliationMatch {
  bankTransactionId: string;
  accountingEntryId: string;
  confidence: number;
  matchMethod: 'exact' | 'amount_date' | 'rule' | 'manual';
  ruleId?: string | null;
}

/**
 * Verifica si una transacción coincide con un registro contable según una regla personalizada
 */
export const matchesByRule = (
  transaction: BankTransaction,
  entry: AccountingEntry,
  rule: ReconciliationRule
): boolean => {
  // Implementación de la verificación de reglas
  // ...
  
  return true;
};

/**
 * Calcula el nivel de confianza (0-100) para una coincidencia potencial
 */
export const calculateConfidence = (
  transaction: BankTransaction,
  entry: AccountingEntry
): number => {
  // Implementación del cálculo de confianza
  // ...
  
  return 100;
};

/**
 * Aplica las reglas de conciliación a un conjunto de transacciones y registros
 */
export const applyReconciliationRules = async (
  transactions: BankTransaction[],
  entries: AccountingEntry[],
  companyId: string
): Promise<ReconciliationMatch[]> => {
  // Implementación de la aplicación de reglas
  // ...
  
  return [];
};

/**
 * Encuentra coincidencias exactas entre transacciones y registros contables
 */
export const findExactMatches = (
  transactions: BankTransaction[],
  entries: AccountingEntry[]
): ReconciliationMatch[] => {
  // Implementación de la búsqueda de coincidencias exactas
  // ...
  
  return [];
};

/**
 * Encuentra todas las posibles coincidencias para conciliación
 */
export const findAllMatches = async (
  transactions: BankTransaction[],
  entries: AccountingEntry[],
  companyId: string
): Promise<ReconciliationMatch[]> => {
  // Implementación de la búsqueda de todas las coincidencias
  // ...
  
  return [];
};
```

### 2.3 Rutas de API para Reglas de Conciliación

#### `src/app/api/reconciliation/rules/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Database } from '@/lib/database.types';

// GET /api/reconciliation/rules?companyId=xxx
export async function GET(request: NextRequest) {
  // Implementación del endpoint GET
  // ...
}

// POST /api/reconciliation/rules
export async function POST(request: NextRequest) {
  // Implementación del endpoint POST
  // ...
}

// PATCH /api/reconciliation/rules?id=xxx
export async function PATCH(request: NextRequest) {
  // Implementación del endpoint PATCH
  // ...
}

// DELETE /api/reconciliation/rules?id=xxx
export async function DELETE(request: NextRequest) {
  // Implementación del endpoint DELETE
  // ...
}
```

### 2.4 Componentes de UI para las Nuevas Funcionalidades

#### Gestión de Reglas de Conciliación: `src/app/dashboard/configuration/rules/page.tsx`
```tsx
'use client';

import { useState, useEffect } from 'react';
// Importaciones de componentes UI y servicios
// ...

export default function ReconciliationRulesPage() {
  // Implementación del componente
  // ...
}
```

#### Visualización de Actividades: `src/app/dashboard/configuration/activity/page.tsx`
```tsx
'use client';

import { useState, useEffect } from 'react';
// Importaciones de componentes UI y servicios
// ...

export default function ActivityLogsPage() {
  // Implementación del componente
  // ...
}
```

## 3. Instrucciones de Despliegue

1. **Supabase SQL Editor**:
   - Accede al panel de Supabase
   - Navega a SQL Editor
   - Ejecuta el script SQL que crea las tablas y funciones

2. **Implementación de Servicios y Componentes Frontend**:
   - Copia los archivos de servicios en `src/services/`
   - Copia los archivos de componentes en las rutas correspondientes
   - Copia la lógica de conciliación en `src/lib/reconciliation/`
   - Copia las rutas de API en `src/app/api/reconciliation/rules/`

3. **Compilación y Despliegue**:
   - Ejecuta `npm run build` para compilar la aplicación
   - Despliega la aplicación actualizada en el entorno de producción

## 4. Pruebas y Verificación

1. **Verificar Creación de Reglas**:
   - Accede a la sección de configuración
   - Crea una nueva regla de conciliación
   - Verifica que se guarde correctamente

2. **Verificar Registro de Actividad**:
   - Realiza diversas acciones en la aplicación
   - Accede a la sección de registro de actividades
   - Verifica que las acciones realizadas se hayan registrado

3. **Verificar Conciliación con Reglas**:
   - Importa datos de transacciones y registros contables
   - Ejecuta el proceso de conciliación
   - Verifica que las reglas se apliquen correctamente 