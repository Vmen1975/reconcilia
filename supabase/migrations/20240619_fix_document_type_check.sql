-- Script para actualizar la restricción CHECK en document_type
-- de la tabla accounting_entries

-- Verificar si la restricción existe e imprimirla
DO $$
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    -- Comprobar si existe la restricción
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint pc
        JOIN pg_class c ON c.oid = pc.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND c.relname = 'accounting_entries' 
        AND pc.conname = 'accounting_entries_document_type_check'
    ) INTO constraint_exists;

    IF constraint_exists THEN
        RAISE NOTICE 'La restricción accounting_entries_document_type_check existe.';
    ELSE
        RAISE NOTICE 'La restricción accounting_entries_document_type_check no existe.';
    END IF;
END
$$;

-- Primero, eliminar la restricción existente si hay alguna
ALTER TABLE public.accounting_entries 
    DROP CONSTRAINT IF EXISTS accounting_entries_document_type_check;

-- Luego, añadir la nueva restricción más flexible
ALTER TABLE public.accounting_entries 
    ADD CONSTRAINT accounting_entries_document_type_check 
    CHECK (document_type IS NULL OR document_type IN ('invoice', 'credit_note', 'debit_note', 'other'));

-- Limpiar los registros existentes
UPDATE public.accounting_entries 
SET document_type = 
    CASE 
        WHEN document_type IS NULL THEN 'other'
        WHEN document_type ILIKE '%factura%' OR document_type ILIKE '%invoice%' THEN 'invoice'
        WHEN document_type ILIKE '%credito%' OR document_type ILIKE '%crédito%' OR document_type ILIKE '%nc%' THEN 'credit_note'
        WHEN document_type ILIKE '%debito%' OR document_type ILIKE '%débito%' OR document_type ILIKE '%nd%' THEN 'debit_note'
        ELSE 'other'
    END
WHERE document_type IS NULL OR 
      document_type NOT IN ('invoice', 'credit_note', 'debit_note', 'other');

-- Verificar el resultado
SELECT 
    document_type, 
    COUNT(*) as count
FROM 
    public.accounting_entries
GROUP BY 
    document_type
ORDER BY 
    count DESC; 