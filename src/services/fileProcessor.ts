import { parse } from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { importService } from './import';
import type { BankTransaction, AccountingEntry } from '@/types';

interface ProcessorConfig {
  dateColumn: string;
  amountColumn: string;
  descriptionColumn: string;
  referenceColumn?: string;
  balanceColumn?: string;
}

const defaultBankConfig: ProcessorConfig = {
  dateColumn: 'Fecha',
  amountColumn: 'Monto',
  descriptionColumn: 'Descripción',
  referenceColumn: 'Referencia',
  balanceColumn: 'Saldo',
};

const defaultAccountingConfig: ProcessorConfig = {
  dateColumn: 'Fecha',
  amountColumn: 'Monto',
  descriptionColumn: 'Descripción',
  referenceColumn: 'Documento',
};

export const fileProcessor = {
  async processFile(importId: string): Promise<void> {
    try {
      // 1. Actualizar estado a "processing"
      await importService.updateStatus(importId, 'processing');

      // 2. Obtener información del archivo
      const importFile = await importService.getImport(importId);

      // 3. Descargar archivo desde Storage
      const { data, error } = await supabase.storage
        .from('imports')
        .download(importFile.file_path);

      if (error) throw error;

      // 4. Procesar archivo según su tipo
      const fileContent = await data.text();
      const fileExtension = importFile.file_name.split('.').pop()?.toLowerCase();
      
      let rows: any[] = [];
      
      if (fileExtension === 'csv') {
        rows = await this.processCSV(fileContent);
      } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
        rows = await this.processExcel(data);
      } else {
        throw new Error('Formato de archivo no soportado');
      }

      // 5. Procesar registros según el tipo de archivo
      if (importFile.file_type === 'bank') {
        await this.processBankTransactions(rows, importFile.bank_account_id!, defaultBankConfig);
      } else {
        await this.processAccountingEntries(rows, importFile.company_id, defaultAccountingConfig);
      }

      // 6. Actualizar estado a "processed"
      await importService.updateStatus(importId, 'processed');

    } catch (error) {
      // En caso de error, actualizar estado y guardar mensaje
      await importService.updateStatus(
        importId,
        'error',
        error instanceof Error ? error.message : 'Error desconocido'
      );
      throw error;
    }
  },

  async processCSV(content: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      parse(content, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (error) => reject(error),
      });
    });
  },

  async processExcel(buffer: ArrayBuffer): Promise<any[]> {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet);
  },

  async processBankTransactions(
    rows: any[],
    bankAccountId: string,
    config: ProcessorConfig
  ): Promise<void> {
    const transactions: Partial<BankTransaction>[] = rows.map(row => ({
      bank_account_id: bankAccountId,
      transaction_date: new Date(row[config.dateColumn]).toISOString(),
      description: row[config.descriptionColumn],
      amount: parseFloat(row[config.amountColumn]),
      balance: config.balanceColumn ? parseFloat(row[config.balanceColumn]) : undefined,
      reference_number: config.referenceColumn ? row[config.referenceColumn] : undefined,
      transaction_type: this.determineTransactionType(parseFloat(row[config.amountColumn])),
      reconciled: false,
    }));

    const { error } = await supabase
      .from('bank_transactions')
      .insert(transactions);

    if (error) throw error;
  },

  async processAccountingEntries(
    rows: any[],
    companyId: string,
    config: ProcessorConfig
  ): Promise<void> {
    const entries: Partial<AccountingEntry>[] = rows.map(row => ({
      company_id: companyId,
      entry_date: new Date(row[config.dateColumn]).toISOString(),
      description: row[config.descriptionColumn],
      amount: parseFloat(row[config.amountColumn]),
      document_number: config.referenceColumn ? row[config.referenceColumn] : undefined,
      reconciled: false,
    }));

    const { error } = await supabase
      .from('accounting_entries')
      .insert(entries);

    if (error) throw error;
  },

  determineTransactionType(amount: number): BankTransaction['transaction_type'] {
    if (amount > 0) return 'deposit';
    if (amount < 0) return 'withdrawal';
    return 'other';
  },
}; 