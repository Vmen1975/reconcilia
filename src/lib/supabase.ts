import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Tipos para las tablas de Supabase
export interface Company {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  id: string;
  company_id: string;
  name: string;
  account_number: string;
  bank_name: string;
  current_balance: number;
  created_at: string;
  updated_at: string;
}

export interface BankTransaction {
  id: string;
  bank_account_id: string;
  date: string;
  description: string;
  amount: number;
  reference: string;
  status: 'pending' | 'reconciled';
  reconciliation_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AccountingEntry {
  id: string;
  bank_account_id: string;
  date: string;
  description: string;
  amount: number;
  reference: string;
  status: 'pending' | 'reconciled';
  reconciliation_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Reconciliation {
  id: string;
  bank_account_id: string;
  bank_transaction_id: string;
  accounting_entry_id: string;
  status: 'pending' | 'completed';
  confidence_score: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ImportedFile {
  id: string;
  company_id: string;
  user_id?: string;
  bank_account_id?: string;
  file_name: string;
  file_type: 'bank' | 'accounting';
  file_path?: string;
  import_date?: string;
  status: 'pending' | 'processing' | 'processed' | 'error';
  row_count?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// Función para inicializar el bucket de storage si no existe
export const initStorage = async () => {
  try {
    // Verificar si el bucket 'imports' existe
    const { data: buckets } = await supabase.storage.listBuckets();
    const importsBucket = buckets?.find(bucket => bucket.name === 'imports');
    
    // Si no existe, crearlo
    if (!importsBucket) {
      console.log('🔧 Inicializando bucket de Storage "imports"...');
      const { data, error } = await supabase.storage.createBucket('imports', {
        public: false,
        fileSizeLimit: 52428800, // 50MB
      });
      
      if (error) {
        console.error('❌ Error al crear bucket "imports":', error);
        return false;
      }
      
      console.log('✅ Bucket "imports" creado exitosamente');
      return true;
    }
    
    console.log('✅ Bucket "imports" ya existe');
    return true;
  } catch (error) {
    console.error('❌ Error al inicializar Storage:', error);
    return false;
  }
}; 