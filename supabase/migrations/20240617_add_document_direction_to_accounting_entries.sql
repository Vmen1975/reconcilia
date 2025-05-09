ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS document_direction TEXT CHECK (document_direction IN ('emitida', 'recibida'));

-- Opcional: crear un índice para mejorar el filtrado
CREATE INDEX IF NOT EXISTS idx_accounting_entries_document_direction ON public.accounting_entries(document_direction); 