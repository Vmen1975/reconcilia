import { createClient } from '@/lib/supabase/client';
import { BankTransaction } from '@/types/bank';
import { AccountingEntry } from '@/types/accounting';
import { ReconciliationRule } from '@/services/rulesService';
import { reconciliationConfigService } from '@/services/reconciliationService';

// Cliente de Supabase
const supabase = createClient();

// Interfaz para representar una coincidencia entre transacción y registro contable
export interface ReconciliationMatch {
  bankTransactionId: string;
  accountingEntryId: string;
  confidence: number;
  matchMethod: 'exact' | 'amount_date' | 'rule' | 'manual';
  ruleId?: string | null;
}

/**
 * Verifica si una transacción coincide con un registro contable según una regla personalizada
 */
export const matchesByRule = (
  transaction: BankTransaction,
  entry: AccountingEntry,
  rule: ReconciliationRule
): boolean => {
  // Verificar patrones de descripción si existen
  if (rule.description_pattern) {
    const patterns = rule.description_pattern.split('|');
    const descLower = transaction.description?.toLowerCase() || '';
    
    // Debe coincidir al menos con uno de los patrones
    const matchesDescription = patterns.some(pattern => 
      descLower.includes(pattern.toLowerCase().trim())
    );
    
    if (!matchesDescription) return false;
  }
  
  // Verificar tipo de transacción si está especificado
  if (rule.transaction_type && transaction.type !== rule.transaction_type) {
    return false;
  }
  
  // Verificar patrones de monto si existen
  if (rule.amount_pattern) {
    const patterns = rule.amount_pattern.split('|');
    const amount = Math.abs(transaction.amount);
    
    const matchesAmount = patterns.some(pattern => {
      const trimmedPattern = pattern.trim();
      
      // Patrón para montos exactos: =1000
      if (trimmedPattern.startsWith('=')) {
        const exactAmount = parseFloat(trimmedPattern.substring(1));
        return amount === exactAmount;
      }
      
      // Patrón para montos mayores que: >1000
      if (trimmedPattern.startsWith('>')) {
        const minAmount = parseFloat(trimmedPattern.substring(1));
        return amount > minAmount;
      }
      
      // Patrón para montos menores que: <1000
      if (trimmedPattern.startsWith('<')) {
        const maxAmount = parseFloat(trimmedPattern.substring(1));
        return amount < maxAmount;
      }
      
      // Si no tiene operador, verificar si contiene el número
      return amount.toString().includes(trimmedPattern);
    });
    
    if (!matchesAmount) return false;
  }
  
  // Si pasó todas las verificaciones, se considera una coincidencia
  return true;
};

/**
 * Calcula el nivel de confianza (0-100) para una coincidencia potencial
 */
export const calculateConfidence = async (
  transaction: BankTransaction,
  entry: AccountingEntry
): Promise<number> => {
  // Usar la función del servicio de configuración para calcular la confianza
  return await reconciliationConfigService.calculateConfidence(transaction, entry);
};

/**
 * Aplica las reglas de conciliación a un conjunto de transacciones y registros
 */
export const applyReconciliationRules = async (
  transactions: BankTransaction[],
  entries: AccountingEntry[],
  companyId: string
): Promise<ReconciliationMatch[]> => {
  // Obtener las reglas activas para esta empresa, ordenadas por prioridad
  const { data: rules } = await supabase
    .from('reconciliation_rules')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('rule_priority', { ascending: true });
    
  if (!rules || rules.length === 0) {
    return []; // No hay reglas para aplicar
  }
  
  // Cargar la configuración de conciliación
  const config = await reconciliationConfigService.getConfig();
  
  const matches: ReconciliationMatch[] = [];
  
  // Mantener registro de las transacciones y entradas que ya han sido emparejadas
  const matchedTransactionIds = new Set<string>();
  const matchedEntryIds = new Set<string>();
  
  // Aplicar reglas en orden de prioridad
  for (const rule of rules) {
    // Para cada transacción que aún no ha sido emparejada
    for (const transaction of transactions) {
      if (matchedTransactionIds.has(transaction.id)) continue;
      
      // Para cada registro contable que aún no ha sido emparejado
      for (const entry of entries) {
        if (matchedEntryIds.has(entry.id)) continue;
        
        // Verificar si coinciden según la regla
        if (matchesByRule(transaction, entry, rule)) {
          const confidence = await reconciliationConfigService.calculateConfidence(transaction, entry, config);
          
          // Solo considerar coincidencias con confianza mínima configurada
          if (confidence >= config.minConfidenceThreshold) {
            matches.push({
              bankTransactionId: transaction.id,
              accountingEntryId: entry.id,
              confidence,
              matchMethod: 'rule',
              ruleId: rule.id
            });
            
            // Marcar como emparejados
            matchedTransactionIds.add(transaction.id);
            matchedEntryIds.add(entry.id);
            
            // Continuar con la siguiente transacción
            break;
          }
        }
      }
    }
  }
  
  return matches;
};

function isCreditNote(entry: any): boolean {
  const type = (entry.document_type || '').toLowerCase();
  return type === 'credit_note' || type === 'nc' || type.includes('nota de crédito');
}

function isMatchDirection(entry: any, transaction: any): boolean {
  // Normal: factura emitida/recibida
  if (
    (entry.document_direction === 'emitida' && !isCreditNote(entry) && transaction.amount > 0) ||
    (entry.document_direction === 'recibida' && !isCreditNote(entry) && transaction.amount < 0)
  ) {
    return true;
  }
  // Nota de crédito: sentido inverso
  if (
    (entry.document_direction === 'emitida' && isCreditNote(entry) && transaction.amount < 0) ||
    (entry.document_direction === 'recibida' && isCreditNote(entry) && transaction.amount > 0)
  ) {
    return true;
  }
  return false;
}

/**
 * Encuentra coincidencias exactas entre transacciones y registros contables
 * basadas en montos y fechas idénticas
 */
export const findExactMatches = async (
  transactions: BankTransaction[],
  entries: AccountingEntry[]
): Promise<ReconciliationMatch[]> {
  // Cargar la configuración de conciliación
  const config = await reconciliationConfigService.getConfig();
  
  const matches: ReconciliationMatch[] = [];
  const matchedTransactionIds = new Set<string>();
  const matchedEntryIds = new Set<string>();
  
  // Primero buscar coincidencias exactas por referencia
  for (const transaction of transactions) {
    if (matchedTransactionIds.has(transaction.id)) continue;
    
    // Si la transacción tiene referencia, buscar coincidencia exacta
    const matchingEntry = entries.find(entry => 
      !matchedEntryIds.has(entry.id) && 
      entry.reference === transaction.reference &&
      isMatchDirection(entry, transaction)
    );
    
    if (matchingEntry) {
      matches.push({
        bankTransactionId: transaction.id,
        accountingEntryId: matchingEntry.id,
        confidence: config.exactMatchConfidence, // Usar valor de configuración
        matchMethod: 'exact'
      });
      
      matchedTransactionIds.add(transaction.id);
      matchedEntryIds.add(matchingEntry.id);
    }
  }
  
  // Luego buscar coincidencias exactas por monto y fecha
  for (const transaction of transactions) {
    if (matchedTransactionIds.has(transaction.id)) continue;
    
    const matchingEntries = entries.filter(entry => 
      !matchedEntryIds.has(entry.id) && 
      Math.abs(entry.amount) === Math.abs(transaction.amount) &&
      new Date(entry.date).toISOString().split('T')[0] === new Date(transaction.date).toISOString().split('T')[0] &&
      isMatchDirection(entry, transaction)
    );
    
    if (matchingEntries.length === 1) {
      // Si hay una única coincidencia exacta, es una coincidencia de alta confianza
      matches.push({
        bankTransactionId: transaction.id,
        accountingEntryId: matchingEntries[0].id,
        confidence: config.dateAmountMatchConfidence, // Usar valor de configuración
        matchMethod: 'amount_date'
      });
      
      matchedTransactionIds.add(transaction.id);
      matchedEntryIds.add(matchingEntries[0].id);
    }
  }
  
  return matches;
};

/**
 * Encuentra todas las posibles coincidencias para conciliación
 */
export const findAllMatches = async (
  transactions: BankTransaction[],
  entries: AccountingEntry[],
  companyId: string
): Promise<ReconciliationMatch[]> => {
  // 1. Primero encontrar coincidencias exactas
  const exactMatches = await findExactMatches(transactions, entries);
  
  // Filtrar transacciones y registros ya emparejados
  const matchedTransactionIds = new Set(exactMatches.map(m => m.bankTransactionId));
  const matchedEntryIds = new Set(exactMatches.map(m => m.accountingEntryId));
  
  const remainingTransactions = transactions.filter(t => !matchedTransactionIds.has(t.id));
  const remainingEntries = entries.filter(e => !matchedEntryIds.has(e.id));
  
  // 2. Aplicar reglas de conciliación personalizadas a los elementos restantes
  const ruleMatches = await applyReconciliationRules(
    remainingTransactions,
    remainingEntries,
    companyId
  );
  
  // 3. Combinar los resultados
  return [...exactMatches, ...ruleMatches];
}; 