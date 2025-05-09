-- Añadir el campo imported_file_id a bank_transactions si no existe
ALTER TABLE IF EXISTS public.bank_transactions 
  ADD COLUMN IF NOT EXISTS imported_file_id UUID REFERENCES public.imported_files(id) ON DELETE SET NULL;

-- Crear índice para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_bank_transactions_imported_file_id ON public.bank_transactions(imported_file_id);

-- Verificar si la columna transaction_date existe y cambiar de date a transaction_date si es necesario
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
END
$$;

-- Primero actualizar todos los registros para asegurar que tengan valores válidos para status
UPDATE public.bank_transactions 
  SET status = 'pending' 
  WHERE status IS NULL OR status NOT IN ('pending', 'reconciled', 'manual');

-- Eliminar la restricción anterior si existe
ALTER TABLE public.bank_transactions 
  DROP CONSTRAINT IF EXISTS bank_transactions_status_check;

-- Añadir la nueva restricción
ALTER TABLE public.bank_transactions 
  ADD CONSTRAINT bank_transactions_status_check CHECK (status IN ('pending', 'reconciled', 'manual'));

-- Actualizar el servicio de importación para que establezca el imported_file_id
COMMENT ON TABLE public.bank_transactions IS 'Tabla de transacciones bancarias con relación a imported_files'; 