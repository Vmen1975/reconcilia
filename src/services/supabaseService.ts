import { supabase } from '@/lib/supabase';
import type { 
  Company, 
  BankAccount, 
  BankTransaction, 
  AccountingEntry, 
  Reconciliation,
  ImportedFile 
} from '@/lib/supabase';

export class SupabaseService {
  // Empresas
  async getCompanies() {
    const { data, error } = await supabase
      .from('companies')
      .select('*');
    
    if (error) throw error;
    return data as Company[];
  }

  // Cuentas Bancarias
  async getBankAccounts(companyId: string) {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('company_id', companyId);
    
    if (error) throw error;
    return data as BankAccount[];
  }

  // Transacciones Bancarias
  async getBankTransactions(bankAccountId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: string;
    searchTerm?: string;
  }) {
    let query = supabase
      .from('bank_transactions')
      .select('*')
      .eq('bank_account_id', bankAccountId);

    if (filters?.startDate) {
      query = query.gte('date', filters.startDate.toISOString());
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate.toISOString());
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.searchTerm) {
      query = query.ilike('description', `%${filters.searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as BankTransaction[];
  }

  // Registros Contables
  async getAccountingEntries(bankAccountId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: string;
    searchTerm?: string;
  }) {
    let query = supabase
      .from('accounting_entries')
      .select('*')
      .eq('bank_account_id', bankAccountId);

    if (filters?.startDate) {
      query = query.gte('date', filters.startDate.toISOString());
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate.toISOString());
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.searchTerm) {
      query = query.ilike('description', `%${filters.searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as AccountingEntry[];
  }

  // Conciliaciones
  async createReconciliation(reconciliation: Omit<Reconciliation, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('reconciliations')
      .insert([reconciliation])
      .select()
      .single();
    
    if (error) throw error;
    return data as Reconciliation;
  }

  async updateReconciliationStatus(reconciliationId: string, status: 'pending' | 'completed') {
    const { data, error } = await supabase
      .from('reconciliations')
      .update({ status })
      .eq('id', reconciliationId)
      .select()
      .single();
    
    if (error) throw error;
    return data as Reconciliation;
  }

  // Importaciones
  async createImport(importData: Omit<ImportedFile, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('imported_files')
      .insert([importData])
      .select()
      .single();
    
    if (error) throw error;
    return data as ImportedFile;
  }

  async updateImportStatus(
    importId: string, 
    status: 'pending' | 'processing' | 'processed' | 'error',
    errorMessage?: string
  ) {
    const { data, error } = await supabase
      .from('imported_files')
      .update({ 
        status,
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', importId)
      .select()
      .single();
    
    if (error) throw error;
    return data as ImportedFile;
  }
} 