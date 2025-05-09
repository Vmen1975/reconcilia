-- Asegurar que todos los campos necesarios existan en la tabla bank_accounts
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS current_balance DECIMAL(15,2) DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'corriente';
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CLP';
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS rut TEXT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS description TEXT;

-- Asegurar que ninguno de los campos importantes sea NULL
UPDATE bank_accounts SET 
  name = bank_name WHERE name IS NULL AND bank_name IS NOT NULL;
  
UPDATE bank_accounts SET 
  bank_name = name WHERE bank_name IS NULL AND name IS NOT NULL;

-- Hacer NOT NULL los campos críticos si aún no lo son
ALTER TABLE bank_accounts ALTER COLUMN account_number SET NOT NULL;
ALTER TABLE bank_accounts ALTER COLUMN bank_name SET NOT NULL; 