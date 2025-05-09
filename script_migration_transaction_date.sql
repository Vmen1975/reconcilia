-- Script para corregir problemas con la tabla bank_transactions
-- Este script verifica la existencia de columnas y realiza los cambios necesarios

-- Actualizar bank_transactions: Gestionar columnas date y transaction_date
DO $$
BEGIN
  -- Verificar si 'date' existe y 'transaction_date' no existe
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'bank_transactions' AND column_name = 'date'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'bank_transactions' AND column_name = 'transaction_date'
  ) THEN
    -- Renombrar la columna de date a transaction_date
    ALTER TABLE public.bank_transactions RENAME COLUMN date TO transaction_date;
    RAISE NOTICE 'Columna date renombrada a transaction_date';
  END IF;

  -- Si transaction_date no existe, crearla
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'bank_transactions' AND column_name = 'transaction_date'
  ) THEN
    -- Añadir la columna transaction_date
    ALTER TABLE public.bank_transactions ADD COLUMN transaction_date DATE NOT NULL DEFAULT CURRENT_DATE;
    RAISE NOTICE 'Columna transaction_date creada';
  END IF;
  
  -- Verificar que el campo reference_number existe, si no, crearlo a partir de reference
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'bank_transactions' AND column_name = 'reference_number'
  ) AND EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'bank_transactions' AND column_name = 'reference'
  ) THEN
    -- Añadir columna reference_number copiando datos de reference
    ALTER TABLE public.bank_transactions ADD COLUMN reference_number TEXT;
    UPDATE public.bank_transactions SET reference_number = reference;
    RAISE NOTICE 'Columna reference_number añadida copiando valores de reference';
  END IF;
  
  -- Si reference_number no existe y reference tampoco, crear reference_number
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'bank_transactions' AND column_name = 'reference_number'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'bank_transactions' AND column_name = 'reference'
  ) THEN
    -- Añadir la columna reference_number
    ALTER TABLE public.bank_transactions ADD COLUMN reference_number TEXT;
    RAISE NOTICE 'Columna reference_number creada';
  END IF;
END
$$;

-- Verificar y actualizar los registros para garantizar valores de status válidos
UPDATE public.bank_transactions 
SET status = 'pending' 
WHERE status IS NULL OR status NOT IN ('pending', 'reconciled', 'manual');

-- Actualizar o crear la restricción de status
DO $$
BEGIN
  -- Eliminar la restricción anterior si existe
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bank_transactions_status_check'
  ) THEN
    ALTER TABLE public.bank_transactions 
      DROP CONSTRAINT bank_transactions_status_check;
    
    RAISE NOTICE 'Restricción bank_transactions_status_check eliminada';
  END IF;
  
  -- Añadir la nueva restricción
  ALTER TABLE public.bank_transactions 
    ADD CONSTRAINT bank_transactions_status_check 
    CHECK (status IN ('pending', 'reconciled', 'manual'));
    
  RAISE NOTICE 'Restricción bank_transactions_status_check creada/actualizada';
END
$$;

-- Añadir índice para mejorar rendimiento de búsquedas por transaction_date
DO $$
BEGIN
  -- Verificar si el índice ya existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_bank_transactions_transaction_date'
  ) THEN
    CREATE INDEX idx_bank_transactions_transaction_date 
    ON public.bank_transactions(transaction_date);
    
    RAISE NOTICE 'Índice idx_bank_transactions_transaction_date creado';
  END IF;
END
$$;

-- Añadir el campo imported_file_id si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'bank_transactions' AND column_name = 'imported_file_id'
  ) THEN
    ALTER TABLE public.bank_transactions 
    ADD COLUMN imported_file_id UUID REFERENCES public.imported_files(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Columna imported_file_id añadida a bank_transactions';
    
    -- Crear índice para mejorar rendimiento
    CREATE INDEX IF NOT EXISTS idx_bank_transactions_imported_file_id 
    ON public.bank_transactions(imported_file_id);
    
    RAISE NOTICE 'Índice idx_bank_transactions_imported_file_id creado';
  END IF;
END
$$;

-- Añadir comentario a la tabla
COMMENT ON TABLE public.bank_transactions IS 'Tabla de transacciones bancarias con columnas transaction_date y reference_number'; 