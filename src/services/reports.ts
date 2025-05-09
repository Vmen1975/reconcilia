import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  bankAccountId?: string;
  status?: 'reconciled' | 'pending' | 'all';
}

export interface ReconciliationSummary {
  totalReconciled: number;
  totalPending: number;
  reconciledAmount: number;
  pendingAmount: number;
  lastReconciliationDate: Date;
}

export class ReportsService {
  async generateReconciliationReport(filters: ReportFilters) {
    const { startDate, endDate, bankAccountId, status } = filters;
    
    let query = supabase
      .from('reconciliations')
      .select(`
        *,
        bank_transactions(*),
        accounting_entries(*)
      `)
      .eq('bank_account_id', bankAccountId);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data;
  }

  async generateBankAccountStatusReport(bankAccountId: string): Promise<ReconciliationSummary> {
    const { data: reconciled, error: reconciledError } = await supabase
      .from('reconciliations')
      .select('amount')
      .eq('bank_account_id', bankAccountId)
      .eq('status', 'reconciled');

    const { data: pending, error: pendingError } = await supabase
      .from('bank_transactions')
      .select('amount')
      .eq('bank_account_id', bankAccountId)
      .is('reconciliation_id', null);

    if (reconciledError || pendingError) throw reconciledError || pendingError;

    const { data: lastReconciliation } = await supabase
      .from('reconciliations')
      .select('created_at')
      .eq('bank_account_id', bankAccountId)
      .eq('status', 'reconciled')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return {
      totalReconciled: reconciled?.length || 0,
      totalPending: pending?.length || 0,
      reconciledAmount: reconciled?.reduce((sum, item) => sum + item.amount, 0) || 0,
      pendingAmount: pending?.reduce((sum, item) => sum + item.amount, 0) || 0,
      lastReconciliationDate: lastReconciliation ? new Date(lastReconciliation.created_at) : new Date(),
    };
  }

  async exportToExcel(data: any[], filename: string) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    
    // Generar el archivo Excel
    XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  }

  async exportToPDF(data: any[], filename: string) {
    const doc = new jsPDF();
    
    doc.autoTable({
      head: [Object.keys(data[0])],
      body: data.map(item => Object.values(item)),
    });

    doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  }
} 