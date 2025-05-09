-- Tabla para almacenar parámetros configurables del sistema 
-- (como parámetros de conciliación, límites, etc.)
CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  description TEXT
);

-- Añadir índice para búsquedas por config_key
CREATE INDEX IF NOT EXISTS idx_system_config_key ON public.system_config(config_key);

-- Añadir comentario a la tabla
COMMENT ON TABLE public.system_config IS 'Almacena configuraciones de sistema en formato JSON';

-- Trigger para actualizar la fecha de modificación
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.system_config
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- Insertar configuración inicial para los parámetros de conciliación
INSERT INTO public.system_config (config_key, config_value, description) 
VALUES (
  'reconciliation_params',
  '{
    "exactMatchConfidence": 100,
    "dateAmountMatchConfidence": 95,
    "minConfidenceThreshold": 70,
    "amountWeight": 50,
    "dateWeight": 30,
    "descriptionWeight": 20,
    "amountTolerancePercent": 1,
    "dateTolerance": 3,
    "prioritizeExactMatches": true,
    "autoReconcileAboveThreshold": 90
  }'::jsonb,
  'Parámetros de configuración para el algoritmo de conciliación automática'
)
ON CONFLICT (config_key) DO NOTHING;

-- Insertar configuración para tratamiento de notas de crédito
INSERT INTO public.system_config (config_key, config_value, description) 
VALUES (
  'credit_note_matching',
  '{
    "invertDirection": true,
    "creditNoteKeywords": ["nota de credito", "nc", "credit note", "abono"]
  }'::jsonb,
  'Configuración para el tratamiento de notas de crédito en la conciliación'
)
ON CONFLICT (config_key) DO NOTHING; 