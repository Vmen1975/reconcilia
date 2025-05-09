import { User as SupabaseUser } from '@supabase/supabase-js';

export interface User extends SupabaseUser {
  full_name?: string;
}

export interface Company {
  id: string;
  name: string;
  rut: string;
  address: string;
  phone: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  id: string;
  company_id: string;
  bank_name: string;
  name: string;
  account_number: string;
  account_type: string;
  currency: string;
  description?: string;
  current_balance?: number;
  created_at: string;
  updated_at: string;
  company_name?: string;
  companies?: {
    id: string;
    name: string;
  };
}

export type CreateBankAccountDTO = Omit<BankAccount, 'id' | 'created_at' | 'updated_at'>;
export type UpdateBankAccountDTO = Partial<CreateBankAccountDTO>;

export interface BankTransaction {
  id: string;
  bank_account_id: string;
  imported_file_id?: string;
  transaction_date: string;
  description: string;
  amount: number;
  balance?: number;
  transaction_type: 'deposit' | 'withdrawal' | 'transfer' | 'payment' | 'fee' | 'other';
  reference_number?: string;
  status?: 'pending' | 'reconciled' | 'manual';
  reconciliation_id?: string;
  reconciled?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface AccountingEntry {
  id: string;
  company_id?: string;
  bank_account_id?: string;
  date: string;
  description: string;
  amount: number;
  reference?: string;
  status?: string;
  reconciliation_id?: string;
  reconciled?: boolean;
  created_at?: string;
  updated_at?: string;
  document_type?: string;
  document_direction?: 'emitida' | 'recibida';
  imported_file_id?: string;
}

export interface Reconciliation {
  id: string;
  bank_transaction_id: string;
  accounting_entry_id: string;
  status?: string;
  confidence_score?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReconciliationMatch extends Reconciliation {
  confidence?: number;
  reconciled_at?: string;
  match_type?: string;
  reconciliation_method?: 'auto' | 'manual';
}

export interface ImportedFile {
  id: string;
  company_id: string;
  user_id?: string;
  file_name: string;
  file_type: 'bank' | 'accounting';
  file_path: string;
  import_date: string;
  status: 'pending' | 'processing' | 'processed' | 'error';
  bank_account_id?: string;
  row_count: number;
  error_message?: string;
  metadata?: {
    column_mapping?: Record<string, string>;
    document_direction?: 'emitida' | 'recibida';
    [key: string]: any;
  };
}

export interface ReconciliationRule {
  id: string;
  company_id: string;
  rule_name: string;
  description_pattern?: string;
  amount_pattern?: string;
  transaction_type?: string;
  rule_priority: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
} 