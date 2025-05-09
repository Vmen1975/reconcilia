import { supabase } from '@/lib/supabase';

// Tipo para la configuración de conciliación
export interface ReconciliationConfig {
  exactMatchConfidence: number;
  dateAmountMatchConfidence: number;
  minConfidenceThreshold: number;
  amountWeight: number;
  dateWeight: number;
  descriptionWeight: number;
  amountTolerancePercent: number;
  dateTolerance: number;
  prioritizeExactMatches: boolean;
  autoReconcileAboveThreshold: number;
}

// Configuración predeterminada
const DEFAULT_CONFIG: ReconciliationConfig = {
  exactMatchConfidence: 100,       // Confianza para coincidencias exactas
  dateAmountMatchConfidence: 95,   // Confianza para coincidencias de fecha y monto
  minConfidenceThreshold: 70,      // Confianza mínima para considerar una coincidencia válida
  amountWeight: 50,                // Peso del monto en el cálculo (max 50%)
  dateWeight: 30,                  // Peso de la fecha en el cálculo (max 30%)
  descriptionWeight: 20,           // Peso de la descripción en el cálculo (max 20%)
  amountTolerancePercent: 1,       // Tolerancia de diferencia en monto (1%)
  dateTolerance: 3,                // Tolerancia de días para coincidencia de fecha
  prioritizeExactMatches: true,    // Priorizar coincidencias exactas
  autoReconcileAboveThreshold: 90, // Conciliar automáticamente si la confianza supera este umbral
};

// Servicio para manejar la configuración de conciliación
export const reconciliationConfigService = {
  /**
   * Obtiene la configuración de parámetros de conciliación
   */
  async getConfig(): Promise<ReconciliationConfig> {
    try {
      // Obtener configuración desde la base de datos
      const { data, error } = await supabase
        .from('system_config')
        .select('config_value')
        .eq('config_key', 'reconciliation_params')
        .single();
      
      if (error) {
        console.warn('No se pudo cargar la configuración de conciliación:', error);
        return DEFAULT_CONFIG;
      }
      
      // Si se encontró configuración personalizada, devolverla
      if (data?.config_value) {
        return data.config_value as ReconciliationConfig;
      }
      
      // Si no hay configuración, devolver valores predeterminados
      return DEFAULT_CONFIG;
    } catch (error) {
      console.error('Error al cargar configuración de conciliación:', error);
      return DEFAULT_CONFIG;
    }
  },
  
  /**
   * Guarda la configuración de parámetros de conciliación
   */
  async saveConfig(config: ReconciliationConfig): Promise<void> {
    try {
      // Validar que los pesos sumen 100%
      const totalWeight = config.amountWeight + config.dateWeight + config.descriptionWeight;
      if (totalWeight !== 100) {
        throw new Error(`La suma de los pesos debe ser 100%. Actualmente es ${totalWeight}%`);
      }
      
      // Guardar configuración en la base de datos
      const { error } = await supabase
        .from('system_config')
        .upsert({
          config_key: 'reconciliation_params',
          config_value: config,
          updated_at: new Date().toISOString()
        }, { onConflict: 'config_key' });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error al guardar configuración de conciliación:', error);
      throw error;
    }
  },
  
  /**
   * Restablece la configuración a los valores predeterminados
   */
  async resetToDefaults(): Promise<ReconciliationConfig> {
    try {
      await this.saveConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    } catch (error) {
      console.error('Error al restablecer configuración de conciliación:', error);
      throw error;
    }
  },
  
  /**
   * Calcula la confianza de una coincidencia de conciliación basada en la configuración
   */
  async calculateConfidence(
    transaction: any,
    entry: any,
    config?: ReconciliationConfig
  ): Promise<number> {
    // Si no se proporciona configuración, cargarla
    if (!config) {
      config = await this.getConfig();
    }
    
    let confidence = 0;
    
    // Coincidencia por monto (usando el peso configurado)
    if (Math.abs(transaction.amount) === Math.abs(entry.amount)) {
      confidence += config.amountWeight;
    } else {
      const amountDiff = Math.abs(
        (Math.abs(transaction.amount) - Math.abs(entry.amount)) / Math.abs(transaction.amount)
      );
      // Si la diferencia está dentro de la tolerancia
      if (amountDiff <= config.amountTolerancePercent / 100) {
        // Proporcional a qué tan cercanos están
        const amountScore = config.amountWeight * (1 - (amountDiff / (config.amountTolerancePercent / 100)));
        confidence += amountScore;
      }
    }
    
    // Coincidencia por fecha (usando el peso configurado)
    const txnDate = transaction.transaction_date || transaction.date;
    const entryDate = entry.date;
    
    if (!txnDate || !entryDate) {
      console.warn('Advertencia: Fecha faltante', { 
        transactionDate: txnDate, 
        entryDate: entryDate 
      });
    } else {
      const dateDiff = Math.abs(
        (new Date(txnDate).getTime() - new Date(entryDate).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      
      if (dateDiff === 0) {
        confidence += config.dateWeight;
      } else if (dateDiff <= config.dateTolerance) {
        // Proporcional a qué tan cercanas están las fechas
        const dateScore = config.dateWeight * (1 - (dateDiff / config.dateTolerance));
        confidence += dateScore;
      }
    }
    
    // Coincidencia por descripción (usando el peso configurado)
    if (
      entry.reference && transaction.description?.toLowerCase().includes(entry.reference.toLowerCase()) ||
      transaction.reference && entry.description?.toLowerCase().includes(transaction.reference.toLowerCase())
    ) {
      confidence += config.descriptionWeight;
    } else if (entry.description && transaction.description) {
      // Cálculo simple de similitud de texto
      const transDesc = transaction.description.toLowerCase();
      const entryDesc = entry.description.toLowerCase();
      
      // Si hay palabras en común, dar puntuación parcial
      const transWords = transDesc.split(/\s+/).filter((w: string) => w.length > 3);
      const entryWords = entryDesc.split(/\s+/).filter((w: string) => w.length > 3);
      
      let matchingWords = 0;
      for (const word of transWords) {
        if (entryWords.some((w: string) => w.includes(word) || word.includes(w))) {
          matchingWords++;
        }
      }
      
      if (transWords.length > 0 && matchingWords > 0) {
        const descScore = config.descriptionWeight * (matchingWords / transWords.length);
        confidence += descScore;
      }
    }
    
    return Math.min(confidence, 100);
  }
}; 