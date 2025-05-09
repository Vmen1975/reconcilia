-- Script para añadir la columna document_type a la tabla accounting_entries

-- Verificar si la columna existe e imprimirla
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    -- Comprobar si existe la columna
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'accounting_entries'
        AND column_name = 'document_type'
    ) INTO column_exists;

    IF column_exists THEN
        RAISE NOTICE 'La columna document_type ya existe en la tabla accounting_entries.';
    ELSE
        RAISE NOTICE 'La columna document_type no existe en la tabla accounting_entries. Se creará.';
        
        -- Añadir la columna
        ALTER TABLE public.accounting_entries 
        ADD COLUMN document_type TEXT;
        
        RAISE NOTICE 'Columna document_type añadida con éxito.';
    END IF;
END
$$;

-- Añadir la restricción CHECK a la columna
ALTER TABLE public.accounting_entries 
DROP CONSTRAINT IF EXISTS accounting_entries_document_type_check;

ALTER TABLE public.accounting_entries 
ADD CONSTRAINT accounting_entries_document_type_check 
CHECK (document_type IS NULL OR document_type IN ('invoice', 'credit_note', 'debit_note', 'other'));

-- Actualizar los valores existentes basándonos en información disponible
UPDATE public.accounting_entries 
SET document_type = 
    CASE 
        WHEN description ILIKE '%factura%' THEN 'invoice'
        WHEN description ILIKE '%nota de crédito%' OR description ILIKE '%nc%' THEN 'credit_note'
        WHEN description ILIKE '%nota de débito%' OR description ILIKE '%nd%' THEN 'debit_note'
        ELSE 'invoice' -- Por defecto asumimos que son facturas
    END
WHERE document_type IS NULL;

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