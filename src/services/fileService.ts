import { supabase } from '@/lib/supabase';
import { ImportedFile, BankTransaction, AccountingEntry } from '@/types';

/**
 * Servicio para manejar archivos importados y sus registros asociados
 */
export const fileService = {
  /**
   * Obtiene todos los archivos importados para una empresa
   */
  async getImportedFiles(companyId: string): Promise<ImportedFile[]> {
    const { data, error } = await supabase
      .from('imported_files')
      .select('*')
      .eq('company_id', companyId)
      .order('import_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Obtiene un archivo importado por su ID
   */
  async getImportedFile(id: string): Promise<ImportedFile> {
    const { data, error } = await supabase
      .from('imported_files')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Obtiene las transacciones bancarias asociadas a un archivo importado
   */
  async getBankTransactionsByImportedFile(importedFileId: string): Promise<BankTransaction[]> {
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('imported_file_id', importedFileId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Obtiene los registros contables asociados a un archivo importado
   */
  async getAccountingEntriesByImportedFile(importedFileId: string): Promise<AccountingEntry[]> {
    const { data, error } = await supabase
      .from('accounting_entries')
      .select('*')
      .eq('imported_file_id', importedFileId)
      .order('date', { ascending: false });

    if (error) throw error;
    return data;
  },

  /**
   * Elimina un archivo importado y opcionalmente sus registros asociados
   */
  async deleteImportedFile(importedFileId: string, deleteRelatedRecords: boolean = false): Promise<void> {
    // Si se solicita eliminar registros relacionados
    if (deleteRelatedRecords) {
      // Eliminar transacciones bancarias relacionadas
      const { error: bankError } = await supabase
        .from('bank_transactions')
        .delete()
        .eq('imported_file_id', importedFileId);

      if (bankError) throw bankError;

      // Eliminar registros contables relacionados
      const { error: accountingError } = await supabase
        .from('accounting_entries')
        .delete()
        .eq('imported_file_id', importedFileId);

      if (accountingError) throw accountingError;
    }

    // Obtener la ruta del archivo para eliminar del storage
    const { data: fileData, error: fileError } = await supabase
      .from('imported_files')
      .select('file_path')
      .eq('id', importedFileId)
      .single();

    if (fileError) throw fileError;

    // Eliminar el registro de la tabla imported_files
    const { error: deleteError } = await supabase
      .from('imported_files')
      .delete()
      .eq('id', importedFileId);

    if (deleteError) throw deleteError;

    // Eliminar el archivo físico del storage
    if (fileData?.file_path) {
      const { error: storageError } = await supabase.storage
        .from('imports')
        .remove([fileData.file_path]);

      if (storageError) {
        console.error('Error al eliminar archivo de Storage:', storageError);
        // No lanzamos error aquí para no revertir la eliminación del registro
      }
    }
  },

  /**
   * Obtiene un resumen de los registros importados por archivo
   */
  async getImportSummary(importedFileId: string): Promise<{
    totalBankTransactions: number;
    totalAccountingEntries: number;
    fileInfo: ImportedFile | null;
  }> {
    // Obtener información del archivo
    const { data: fileInfo, error: fileError } = await supabase
      .from('imported_files')
      .select('*')
      .eq('id', importedFileId)
      .single();

    if (fileError) {
      console.error('Error al obtener información del archivo:', fileError);
      return {
        totalBankTransactions: 0,
        totalAccountingEntries: 0,
        fileInfo: null
      };
    }

    // Contar transacciones bancarias
    const { count: bankCount, error: bankError } = await supabase
      .from('bank_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('imported_file_id', importedFileId);

    if (bankError) {
      console.error('Error al contar transacciones bancarias:', bankError);
    }

    // Contar registros contables
    const { count: accountingCount, error: accountingError } = await supabase
      .from('accounting_entries')
      .select('*', { count: 'exact', head: true })
      .eq('imported_file_id', importedFileId);

    if (accountingError) {
      console.error('Error al contar registros contables:', accountingError);
    }

    return {
      totalBankTransactions: bankCount || 0,
      totalAccountingEntries: accountingCount || 0,
      fileInfo
    };
  }
}; 