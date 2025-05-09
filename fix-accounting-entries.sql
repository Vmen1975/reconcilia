-- Verificar si la tabla accounting_entries existe
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'accounting_entries'
  ) THEN
    -- La tabla existe, verificar si la columna company_id existe
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'accounting_entries' 
      AND column_name = 'company_id'
    ) THEN
      -- La columna no existe, agregarla
      RAISE NOTICE 'Agregando columna company_id a la tabla accounting_entries';
      ALTER TABLE public.accounting_entries ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
      
      -- Crear índice para la columna
      CREATE INDEX IF NOT EXISTS accounting_entries_company_id_idx ON accounting_entries(company_id);
      
      RAISE NOTICE 'Columna company_id agregada correctamente';
    ELSE
      RAISE NOTICE 'La columna company_id ya existe en la tabla accounting_entries';
    END IF;
  ELSE
    -- La tabla no existe, crearla
    RAISE NOTICE 'La tabla accounting_entries no existe. Creándola...';
    
    CREATE TABLE IF NOT EXISTS accounting_entries (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
      imported_file_id UUID REFERENCES imported_files(id) ON DELETE SET NULL,
      entry_date DATE NOT NULL,
      document_number TEXT,
      document_type TEXT CHECK (document_type IN ('invoice', 'credit_note', 'debit_note', 'other')),
      vendor_rut TEXT,
      vendor_name TEXT,
      description TEXT NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      reconciled BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
    );
    
    -- Crear índices para búsquedas comunes
    CREATE INDEX IF NOT EXISTS accounting_entries_company_id_idx ON accounting_entries(company_id);
    CREATE INDEX IF NOT EXISTS accounting_entries_imported_file_id_idx ON accounting_entries(imported_file_id);
    CREATE INDEX IF NOT EXISTS accounting_entries_entry_date_idx ON accounting_entries(entry_date);
    CREATE INDEX IF NOT EXISTS accounting_entries_reconciled_idx ON accounting_entries(reconciled);
    
    -- Trigger para actualizar updated_at
    CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON accounting_entries
        FOR EACH ROW
        EXECUTE FUNCTION public.set_updated_at();
        
    RAISE NOTICE 'Tabla accounting_entries creada correctamente';
  END IF;
  
  RAISE NOTICE 'Proceso completado exitosamente';
END
$$; 