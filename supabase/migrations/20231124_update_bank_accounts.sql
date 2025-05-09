-- Añadir campos faltantes a la tabla bank_accounts
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'corriente';
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CLP';
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS rut TEXT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS description TEXT; 