-- Script para añadir tablas faltantes según la definición inicial del proyecto
-- Fecha: 16/06/2024

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

-- Políticas de seguridad basadas en RLS (Row Level Security)

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