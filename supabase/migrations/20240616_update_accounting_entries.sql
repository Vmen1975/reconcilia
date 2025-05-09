-- Añadir el campo imported_file_id a accounting_entries si no existe
ALTER TABLE IF EXISTS public.accounting_entries 
  ADD COLUMN IF NOT EXISTS imported_file_id UUID REFERENCES public.imported_files(id) ON DELETE SET NULL;

-- Asegurar que todos los registros tengan un valor adecuado para status
UPDATE public.accounting_entries 
  SET status = 'pending' 
  WHERE status IS NULL OR status NOT IN ('pending', 'reconciled', 'manual');

-- Eliminar la restricción anterior si existe
ALTER TABLE public.accounting_entries 
  DROP CONSTRAINT IF EXISTS accounting_entries_status_check;

-- Añadir la nueva restricción
ALTER TABLE public.accounting_entries 
  ADD CONSTRAINT accounting_entries_status_check CHECK (status IN ('pending', 'reconciled', 'manual'));

-- Crear un índice en el campo imported_file_id
CREATE INDEX IF NOT EXISTS idx_accounting_entries_imported_file_id ON public.accounting_entries(imported_file_id);

-- Actualizar el comentario de la tabla para documentar la relación
COMMENT ON TABLE public.accounting_entries IS 'Tabla de registros contables con relación a imported_files'; 