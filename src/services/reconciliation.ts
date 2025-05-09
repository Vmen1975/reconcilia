import { supabase } from '@/lib/supabase';
import type { BankTransaction, AccountingEntry, Reconciliation, ReconciliationMatch } from '@/types';
import { normalizeAmount } from '@/utils/format';

// Función utilitaria para calcular la diferencia en días entre dos fechas
function calculateDateDiffInDays(date1Str: string, date2Str: string): number {
  try {
    // Convertir a objetos Date, manteniéndolas como YYYY-MM-DD sin manipular zona horaria
    const date1 = new Date(date1Str.split('T')[0]);
    const date2 = new Date(date2Str.split('T')[0]);
    
    // Calcular diferencia en milisegundos y convertirla a días
    const diffMs = Math.abs(date1.getTime() - date2.getTime());
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  } catch (error) {
    console.error('Error al calcular diferencia de fechas:', error, { date1: date1Str, date2: date2Str });
    return 999; // Valor alto para indicar error o fechas muy diferentes
  }
}

interface MatchConfidence {
  bankTransaction: BankTransaction;
  accountingEntry: AccountingEntry;
  confidence: number;
  matchType: 'exact' | 'date_amount' | 'amount_range' | 'fuzzy';
}

// Extraer números de un texto (utilizado para buscar coincidencias)
function extractNumbers(text: string): string[] {
  const numbers: string[] = [];
  // Buscar secuencias de dígitos de 4 o más caracteres
  const matches = text.match(/\d{4,}/g);
  if (matches) {
    for (const match of matches) {
      numbers.push(match);
    }
  }
  return numbers;
}

export const reconciliationService = {
  async autoReconcile(
    bankAccountId: string,
    dateRange?: { start: Date; end: Date },
    toleranceDays: number = 7,
    amountTolerance: number = 0.01 // 1% de tolerancia
  ): Promise<ReconciliationMatch[]> {
    try {
      console.log('🔍 Iniciando conciliación automática para cuenta bancaria:', bankAccountId);
      
      if (!bankAccountId) {
        console.error('❌ Error: bankAccountId es undefined o vacío');
        throw new Error('Se requiere bankAccountId para la conciliación automática');
      }
      
      console.log('📅 Rango de fechas:', dateRange ? `${dateRange.start.toISOString()} a ${dateRange.end.toISOString()}` : 'No especificado');
      
      // 1. Primero obtenemos la company_id de la cuenta bancaria
      const { data: bankAccount, error: bankAccountError } = await supabase
        .from('bank_accounts')
        .select('company_id')
        .eq('id', bankAccountId)
        .single();

      if (bankAccountError) {
        console.error('❌ Error al obtener company_id de la cuenta bancaria:', bankAccountError);
        throw bankAccountError;
      }
      
      console.log('🏢 ID de empresa asociada a la cuenta bancaria:', bankAccount.company_id);
      
      // 2. Obtener transacciones bancarias no conciliadas
      let txQuery = supabase
        .from('bank_transactions')
        .select('*')
        .eq('bank_account_id', bankAccountId)
        .eq('status', 'pending');
        
      // Aplicar filtro de fecha si existe
      if (dateRange) {
        txQuery = txQuery
          .gte('transaction_date', dateRange.start.toISOString().split('T')[0])
          .lte('transaction_date', dateRange.end.toISOString().split('T')[0]);
      }
      
      const { data: bankTransactions, error: txError } = await txQuery;
      
      if (txError) {
        console.error('❌ Error al obtener transacciones bancarias:', txError);
        throw txError;
      }
      
      console.log(`📊 Se encontraron ${bankTransactions?.length || 0} transacciones bancarias sin conciliar`);
      
      if (!bankTransactions || bankTransactions.length === 0) {
        console.log('ℹ️ No hay transacciones bancarias para conciliar');
        return [];
      }

      // 3. Obtener registros contables no conciliados del mismo company_id
      let entryQuery = supabase
        .from('accounting_entries')
        .select('*')
        .eq('company_id', bankAccount.company_id)
        .eq('status', 'pending');
        
      // Aplicar filtro de fecha si existe
      if (dateRange) {
        entryQuery = entryQuery
          .gte('date', dateRange.start.toISOString().split('T')[0])
          .lte('date', dateRange.end.toISOString().split('T')[0]);
      }
      
      const { data: accountingEntries, error: entryError } = await entryQuery;
      
      if (entryError) {
        console.error('❌ Error al obtener registros contables:', entryError);
        throw entryError;
      }
      
      console.log(`📒 Se encontraron ${accountingEntries?.length || 0} registros contables sin conciliar`);

      if (!accountingEntries || accountingEntries.length === 0) {
        console.log('ℹ️ No hay registros contables para conciliar');
        return [];
      }

      const matches: ReconciliationMatch[] = [];
      const processedTransactions = new Set<string>();
      const processedEntries = new Set<string>();

      // 4. Primera pasada: Coincidencia exacta por referencia
      console.log('🔍 Iniciando primera pasada: Coincidencia exacta por referencia');
      let matchesFound = 0;
      
      for (const transaction of bankTransactions) {
        if (processedTransactions.has(transaction.id)) continue;

        const exactMatch = accountingEntries.find(entry => 
          !processedEntries.has(entry.id) &&
          entry.reference &&
          ((transaction.reference_number && 
           transaction.reference_number.trim() === entry.reference.trim()) ||
           (transaction.description && 
            entry.reference.trim() !== '' && 
            transaction.description.includes(entry.reference.trim())))
        );

        if (exactMatch) {
          console.log(`✅ Coincidencia exacta encontrada: TX=${transaction.reference_number || transaction.description} ~ ENTRY=${exactMatch.reference}`);
          matchesFound++;
          
          try {
            const match = await this.createMatch({
              bankTransactionId: transaction.id,
              accountingEntryId: exactMatch.id,
              reconciliationMethod: 'auto',
              confidence: 100,
              matchType: 'exact'
            });
            
            matches.push(match);
            processedTransactions.add(transaction.id);
            processedEntries.add(exactMatch.id);
          } catch (createError) {
            console.error('❌ Error al crear coincidencia exacta:', createError);
          }
        }
      }
      
      console.log(`📈 Primera pasada completada: ${matchesFound} coincidencias encontradas`);

      // 5. Segunda pasada: Coincidencia por fecha y monto exacto
      for (const transaction of bankTransactions) {
        if (processedTransactions.has(transaction.id)) continue;

        const dateAmountMatch = accountingEntries.find(entry =>
          !processedEntries.has(entry.id) &&
          Math.abs(transaction.amount) === Math.abs(entry.amount) &&
          new Date(transaction.transaction_date).toISOString().split('T')[0] === 
          new Date(entry.date).toISOString().split('T')[0]
        );

        if (dateAmountMatch) {
          matches.push(await this.createMatch({
            bankTransactionId: transaction.id,
            accountingEntryId: dateAmountMatch.id,
            reconciliationMethod: 'auto',
            confidence: 95,
            matchType: 'date_amount'
          }));
          processedTransactions.add(transaction.id);
          processedEntries.add(dateAmountMatch.id);
        }
      }

      // 6. Tercera pasada: Coincidencia por monto exacto dentro del rango de fechas
      for (const transaction of bankTransactions) {
        if (processedTransactions.has(transaction.id)) continue;

        const potentialMatches = accountingEntries
          .filter(entry => 
            !processedEntries.has(entry.id) &&
            Math.abs(transaction.amount) === Math.abs(entry.amount) &&
            Math.abs(
              new Date(transaction.transaction_date).getTime() - 
              new Date(entry.date).getTime()
            ) <= toleranceDays * 24 * 60 * 60 * 1000
          );

        if (potentialMatches.length > 0) {
          // Seleccionar la coincidencia más cercana en fecha
          const closestMatch = potentialMatches.reduce((prev, curr) => {
            const prevDiff = Math.abs(
              new Date(transaction.transaction_date).getTime() - 
              new Date(prev.date).getTime()
            );
            const currDiff = Math.abs(
              new Date(transaction.transaction_date).getTime() - 
              new Date(curr.date).getTime()
            );
            return prevDiff < currDiff ? prev : curr;
          });

          matches.push(await this.createMatch({
            bankTransactionId: transaction.id,
            accountingEntryId: closestMatch.id,
            reconciliationMethod: 'auto',
            confidence: 85,
            matchType: 'amount_range'
          }));
          processedTransactions.add(transaction.id);
          processedEntries.add(closestMatch.id);
        }
      }

      // 7. Cuarta pasada: Coincidencia por monto aproximado y descripción similar
      for (const transaction of bankTransactions) {
        if (processedTransactions.has(transaction.id)) continue;

        const fuzzyMatches: MatchConfidence[] = [];

        for (const entry of accountingEntries) {
          if (processedEntries.has(entry.id)) continue;

          const amountDiff = Math.abs(
            (Math.abs(transaction.amount) - Math.abs(entry.amount)) / 
            Math.abs(transaction.amount)
          );

          if (amountDiff <= amountTolerance) {
            const confidence = this.calculateMatchConfidence(transaction, entry);
            if (confidence >= 70) {
              fuzzyMatches.push({
                bankTransaction: transaction,
                accountingEntry: entry,
                confidence,
                matchType: 'fuzzy'
              });
            }
          }
        }

        // Seleccionar la coincidencia con mayor confianza
        if (fuzzyMatches.length > 0) {
          const bestMatch = fuzzyMatches.reduce((prev, curr) => 
            prev.confidence > curr.confidence ? prev : curr
          );

          matches.push(await this.createMatch({
            bankTransactionId: bestMatch.bankTransaction.id,
            accountingEntryId: bestMatch.accountingEntry.id,
            reconciliationMethod: 'auto',
            confidence: bestMatch.confidence,
            matchType: 'fuzzy'
          }));
          processedTransactions.add(bestMatch.bankTransaction.id);
          processedEntries.add(bestMatch.accountingEntry.id);
        }
      }

      // Al finalizar
      console.log(`🏁 Conciliación automática completada. Total de coincidencias: ${matches.length}`);
      return matches;
    } catch (error) {
      console.error('❌ Error en autoReconcile:', error);
      throw error;
    }
  },

  calculateMatchConfidence(transaction: BankTransaction, entry: AccountingEntry): number {
    let confidence = 0;
    let detailedReason = [];
    
    const txAmount = normalizeAmount(transaction.amount);
    const entryAmount = normalizeAmount(entry.amount);
    
    // Determinar si la transacción y la entrada son ingresos o egresos
    const isTxPositive = txAmount >= 0;
    const isEntryPositive = entryAmount >= 0;
    
    console.log('🔍 Comparando montos con signos preservados:', {
      tx: {
        id: transaction.id, 
        desc: transaction.description,
        monto_orig: transaction.amount,
        monto_norm: txAmount,
        es_positivo: isTxPositive
      },
      entry: {
        id: entry.id,
        ref: entry.reference,
        monto_orig: entry.amount,
        monto_norm: entryAmount,
        es_positivo: isEntryPositive
      }
    });
    
    // INICIO CAMBIO: Definir tolerancia fija de 1%
    const configuredAmountTolerance = 0.01; // 1% como tolerancia fija y conservadora
    
    // Compatibilidad de signos (hasta 20% adicional)
    // Regla: Ingresos bancarios deben coincidir con entradas contables positivas,
    // Egresos bancarios deben coincidir con entradas contables negativas
    const signsCompatible = (isTxPositive && isEntryPositive) || (!isTxPositive && !isEntryPositive);
    
    if (signsCompatible) {
      confidence += 20;
      detailedReason.push("✅ Signos compatibles: +20");
    } else {
      detailedReason.push("❌ Signos incompatibles (debería ser positivo-positivo o negativo-negativo)");
      // Si los signos no son compatibles, bajamos la confianza
      confidence -= 40;
      detailedReason.push("❌ Penalización por signos incompatibles: -40");
    }
    
    // Coincidencia por monto absoluto (hasta 50%) - Aumentamos el peso de la coincidencia por monto
    const absAmountDiff = Math.abs(
      (Math.abs(txAmount) - Math.abs(entryAmount)) / (Math.abs(txAmount) || 1) // Evitar división por cero
    );
    
    // CAMBIO CRÍTICO: Rechazar automáticamente si la diferencia supera la tolerancia
    if (absAmountDiff > configuredAmountTolerance) {
      console.log(`❌ DESCARTADO AUTOMÁTICAMENTE: Diferencia de monto (${(absAmountDiff * 100).toFixed(2)}%) supera la tolerancia máxima (${(configuredAmountTolerance * 100).toFixed(2)}%)`);
      return 0; // Retornar confianza 0 para rechazar esta coincidencia
    }
    // FIN CAMBIO
    
    if (absAmountDiff === 0) {
      // Coincidencia exacta de montos, mayor confianza
      confidence += 50;
      detailedReason.push("✅ Montos exactamente iguales: +50");
      console.log(`💰 Montos exactamente iguales: ${Math.abs(txAmount)} = ${Math.abs(entryAmount)}`);
    } else if (absAmountDiff <= 0.01) {
      // Diferencia menor al 1%
      confidence += 45;
      detailedReason.push(`✅ Diferencia de monto mínima (${(absAmountDiff * 100).toFixed(2)}%): +45`);
      console.log(`💰 Diferencia de monto mínima: ${Math.abs(txAmount)} vs ${Math.abs(entryAmount)} (${(absAmountDiff * 100).toFixed(2)}%): +45`);
    } else if (absAmountDiff <= 0.03) {
      // Diferencia hasta 3%
      confidence += 40;
      detailedReason.push(`✅ Diferencia de monto pequeña (${(absAmountDiff * 100).toFixed(2)}%): +40`);
      console.log(`💰 Diferencia de monto pequeña: ${Math.abs(txAmount)} vs ${Math.abs(entryAmount)} (${(absAmountDiff * 100).toFixed(2)}%): +40`);
    } else if (absAmountDiff <= 0.05) {
      // Diferencia hasta 5%
      confidence += 35;
      detailedReason.push(`✅ Diferencia de monto aceptable (${(absAmountDiff * 100).toFixed(2)}%): +35`);
      console.log(`💰 Diferencia de monto aceptable: ${Math.abs(txAmount)} vs ${Math.abs(entryAmount)} (${(absAmountDiff * 100).toFixed(2)}%): +35`);
    } else if (absAmountDiff <= 0.1) {
      // Diferencia hasta 10%
      confidence += 25;
      detailedReason.push(`✅ Diferencia de monto significativa (${(absAmountDiff * 100).toFixed(2)}%): +25`);
      console.log(`💰 Diferencia de monto significativa: ${Math.abs(txAmount)} vs ${Math.abs(entryAmount)} (${(absAmountDiff * 100).toFixed(2)}%): +25`);
    } else if (absAmountDiff <= 0.2) {
      // Diferencia hasta 20%
      confidence += 15;
      detailedReason.push(`✅ Diferencia de monto grande (${(absAmountDiff * 100).toFixed(2)}%): +15`);
      console.log(`💰 Diferencia de monto grande: ${Math.abs(txAmount)} vs ${Math.abs(entryAmount)} (${(absAmountDiff * 100).toFixed(2)}%): +15`);
    } else {
      // Montos muy diferentes
      detailedReason.push(`❌ Montos muy diferentes: ${Math.abs(txAmount)} vs ${Math.abs(entryAmount)} (${(absAmountDiff * 100).toFixed(2)}%)`);
      console.log(`💰 Montos muy diferentes: ${Math.abs(txAmount)} vs ${Math.abs(entryAmount)} (${(absAmountDiff * 100).toFixed(2)}%)`);
    }
    
    // Coincidencia por fecha (hasta 30%)
    // Usar fechas en formato string para evitar problemas de zona horaria
    const dateDiff = calculateDateDiffInDays(transaction.transaction_date, entry.date);
    
    // Variable para almacenar la confianza basada en la diferencia de fechas
    let dateConfidence = 0;

    if (dateDiff === 0) {
      dateConfidence = 30;
      console.log(`📅 Fechas exactamente iguales: +30% confianza`);
      detailedReason.push("✅ Misma fecha: +30");
    } else if (dateDiff <= 3) {
      // Menor penalización para diferencias de hasta 3 días
      dateConfidence = 25;
      console.log(`📅 Fechas cercanas (${dateDiff} días): +25% confianza`);
      detailedReason.push(`✅ Diferencia de ${dateDiff} días: +25`);
    } else if (dateDiff <= 7) {
      // Diferencia de hasta una semana
      dateConfidence = 20;
      console.log(`📅 Fechas dentro de la semana (${dateDiff} días): +20% confianza`);
      detailedReason.push(`✅ Diferencia de ${dateDiff} días: +20`);
    } else if (dateDiff <= 14) {
      // Diferencia de hasta dos semanas
      dateConfidence = 15;
      console.log(`📅 Fechas dentro de dos semanas (${dateDiff} días): +15% confianza`);
      detailedReason.push(`✅ Diferencia de ${dateDiff} días: +15`);
    } else if (dateDiff <= 30) {
      // Diferencia de hasta un mes
      dateConfidence = 10;
      console.log(`📅 Fechas dentro del mes (${dateDiff} días): +10% confianza`);
      detailedReason.push(`✅ Diferencia de ${dateDiff} días: +10`);
    } else {
      // Más de un mes, confianza mínima por fecha
      dateConfidence = 5;
      console.log(`📅 Fechas distantes (${dateDiff} días): +5% confianza`);
      detailedReason.push(`✅ Fechas distantes (${dateDiff} días): +5`);
    }
    
    confidence += dateConfidence;
    
    // Coincidencia por descripción y referencia (hasta 20%)
    let descriptionScore = 0;
    const txDesc = (transaction.description || '').toLowerCase();
    const txRef = (transaction.reference_number || '').toLowerCase();
    const entryRef = (entry.reference || '').toLowerCase();
    const entryDesc = (entry.description || '').toLowerCase();
    
    // Coincidencia exacta de referencias
    if (txRef && entryRef && txRef === entryRef) {
      descriptionScore = 20;
      detailedReason.push("✅ Referencias idénticas: +20");
    }
    // Inclusión de referencias
    else if (
      (txRef && entryRef && (txRef.includes(entryRef) || entryRef.includes(txRef))) ||
      (txDesc && entryRef && txDesc.includes(entryRef)) ||
      (txRef && entryDesc && txRef.includes(entryDesc))
    ) {
      descriptionScore = 15;
      detailedReason.push("✅ Referencias/descripciones coinciden parcialmente: +15");
    }
    // Búsqueda de números comunes (posibles facturas, órdenes, etc.)
    else {
      // Extraer números de la descripción y referencia
      const txNumbers = extractNumbers(txDesc + " " + txRef);
      const entryNumbers = extractNumbers(entryRef + " " + entryDesc);
      
      // Verificar si hay números coincidentes
      for (const txNum of txNumbers) {
        if (entryNumbers.includes(txNum) && txNum.length >= 4) {
          descriptionScore = 10;
          detailedReason.push(`✅ Número común encontrado (${txNum}): +10`);
          break;
        }
      }
      
      // Si no hay coincidencia numérica, buscar palabras clave
      if (descriptionScore === 0) {
        const keywords = ['factura', 'pago', 'transferencia', 'abono', 'cargo', 'compra', 'venta'];
        for (const keyword of keywords) {
          if ((txDesc.includes(keyword) && entryDesc.includes(keyword)) || 
              (txDesc.includes(keyword) && entryRef.includes(keyword)) || 
              (txRef.includes(keyword) && entryDesc.includes(keyword))) {
            descriptionScore = 5;
            detailedReason.push(`✅ Palabra clave común (${keyword}): +5`);
            break;
          }
        }
      }
    }
    
    confidence += descriptionScore;
    
    // Si la confianza es negativa por las penalizaciones, establecerla en 0
    confidence = Math.max(0, confidence);
    
    // Limitar la confianza máxima a 100%
    const finalConfidence = Math.min(confidence, 100);

    // Verificar si la confianza está por encima del umbral mínimo (esto es solo para información)
    // El umbral mínimo se verifica en la función autoReconcile antes de crear la conciliación
    const configConfidenceThreshold = 70; // Umbral predeterminado para información
    const isAboveThreshold = finalConfidence >= configConfidenceThreshold;

    console.log(`🔍 Evaluación de confianza: ${finalConfidence}% ${isAboveThreshold ? '✅ SUFICIENTE' : '❌ INSUFICIENTE'}`);
    console.log(`🔍 Razones detalladas:`, detailedReason);

    return finalConfidence;
  },

  async createMatch(match: {
    bankTransactionId: string;
    accountingEntryId: string;
    reconciliationMethod: 'auto' | 'manual';
    confidence: number;
    matchType: string;
  }): Promise<ReconciliationMatch> {
    // Primero obtenemos el bank_account_id de la transacción bancaria
    const { data: transaction, error: transactionError } = await supabase
      .from('bank_transactions')
      .select('bank_account_id')
      .eq('id', match.bankTransactionId)
      .single();
    
    if (transactionError) {
      console.error('❌ Error al obtener información de la transacción bancaria:', transactionError);
      throw transactionError;
    }
    
    if (!transaction || !transaction.bank_account_id) {
      console.error('❌ La transacción bancaria no tiene bank_account_id:', match.bankTransactionId);
      throw new Error('La transacción bancaria no tiene un ID de cuenta bancaria asociado');
    }
    
    console.log(`Creando conciliación con bank_account_id: ${transaction.bank_account_id}`);
    
    // Ahora insertamos la conciliación con el bank_account_id
    const { data, error } = await supabase
      .from('reconciliations')
      .insert([{
        bank_transaction_id: match.bankTransactionId,
        accounting_entry_id: match.accountingEntryId,
        bank_account_id: transaction.bank_account_id, // Agregamos el ID de la cuenta bancaria
        status: match.matchType,
        confidence_score: match.confidence,
        notes: `Conciliación ${match.reconciliationMethod} con confianza ${match.confidence}%`
      }])
      .select()
      .single();

    if (error) throw error;

    // Actualizar el estado de conciliación en ambas tablas usando status en lugar de reconciled
    await Promise.all([
      supabase
        .from('bank_transactions')
        .update({ status: 'reconciled' })
        .eq('id', match.bankTransactionId),
      supabase
        .from('accounting_entries')
        .update({ status: 'reconciled' })
        .eq('id', match.accountingEntryId)
    ]);

    // Adaptar la respuesta al formato esperado por ReconciliationMatch
    return {
      ...data,
      confidence: data.confidence_score,
      reconciled_at: data.created_at,
      match_type: data.status,
      reconciliation_method: match.reconciliationMethod
    };
  },

  async deleteMatch(matchId: string): Promise<void> {
    const { data: match, error: fetchError } = await supabase
      .from('reconciliations')
      .select('bank_transaction_id, accounting_entry_id')
      .eq('id', matchId)
      .single();

    if (fetchError) throw fetchError;

    const { error: deleteError } = await supabase
      .from('reconciliations')
      .delete()
      .eq('id', matchId);

    if (deleteError) throw deleteError;

    // Actualizar el estado de conciliación en ambas tablas usando status en lugar de reconciled
    await Promise.all([
      supabase
        .from('bank_transactions')
        .update({ status: 'pending' })
        .eq('id', match.bank_transaction_id),
      supabase
        .from('accounting_entries')
        .update({ status: 'pending' })
        .eq('id', match.accounting_entry_id)
    ]);
  },

  async getBankTransactions(
    bankAccountId: string,
    filters?: {
      dateRange?: { start: Date; end: Date };
      amountRange?: { min: number; max: number };
      status?: 'all' | 'pending' | 'reconciled';
      searchTerm?: string;
    }
  ): Promise<BankTransaction[]> {
    console.log('🔍 Buscando transacciones bancarias para cuenta:', bankAccountId);
    console.log('🔍 Filtros aplicados:', JSON.stringify(filters, null, 2));
    
    try {
      let query = supabase
        .from('bank_transactions')
        .select('*')
        .eq('bank_account_id', bankAccountId);

      // Aplicar filtros
      if (filters) {
        if (filters.dateRange) {
          try {
            // Verificar que las fechas son válidas
            if (!(filters.dateRange.start instanceof Date) || isNaN(filters.dateRange.start.getTime())) {
              console.error('❌ La fecha de inicio no es válida:', filters.dateRange.start);
              throw new Error('Fecha de inicio no válida');
            }
            
            if (!(filters.dateRange.end instanceof Date) || isNaN(filters.dateRange.end.getTime())) {
              console.error('❌ La fecha de fin no es válida:', filters.dateRange.end);
              throw new Error('Fecha de fin no válida');
            }
            
            // Asegurar que las fechas estén en formato ISO (YYYY-MM-DD)
            const startDate = filters.dateRange.start.toISOString().split('T')[0];
            const endDate = filters.dateRange.end.toISOString().split('T')[0];
            
            console.log(`🔍 Filtrando por rango de fechas: ${startDate} hasta ${endDate}`);
            console.log(`🔍 Fechas originales: inicio=${filters.dateRange.start}, fin=${filters.dateRange.end}`);
            
            // Intentar con transaction_date primero (campo correcto según esquema actual)
            try {
              query = query
                .gte('transaction_date', startDate)
                .lte('transaction_date', endDate);
            } catch (columnError) {
              console.error('❌ Error al filtrar por transaction_date, intentando con date:', columnError);
              // Fallback para compatibilidad con versiones anteriores
              query = query
                .gte('date', startDate)
                .lte('date', endDate);
            }
          } catch (dateError) {
            console.error('❌ Error al formatear o aplicar filtro de fechas:', dateError);
            // En caso de error, continuamos sin filtro de fecha
          }
        }

        if (filters.amountRange) {
          query = query
            .gte('amount', filters.amountRange.min)
            .lte('amount', filters.amountRange.max);
        }

        if (filters.status && filters.status !== 'all') {
          // Usar status en lugar de reconciled
          query = query.eq('status', filters.status === 'reconciled' ? 'reconciled' : 'pending');
        }

        if (filters.searchTerm) {
          query = query.ilike('description', `%${filters.searchTerm}%`);
        }
      }

      // Ejecutar consulta
      console.log('🔍 Ejecutando consulta con filtros aplicados');
      // Intentar ordenar por transaction_date
      let result;
      try {
        result = await query.order('transaction_date', { ascending: false });
      } catch (orderError) {
        console.error('❌ Error al ordenar por transaction_date, intentando con date:', orderError);
        // Fallback para compatibilidad
        result = await query.order('date', { ascending: false });
      }
      
      const { data, error } = result;
      
      if (error) {
        console.error('❌ Error al obtener transacciones bancarias:', error);
        throw error;
      }
      
      console.log(`✅ Se encontraron ${data?.length || 0} transacciones bancarias con los filtros aplicados`);
      
      // Muestra de los primeros registros para diagnóstico
      if (data && data.length > 0) {
        console.log('🧾 Muestra de transacciones bancarias:');
        data.slice(0, 2).forEach((tx, index) => {
          console.log(`Transacción ${index + 1}: ID=${tx.id}, Fecha=${tx.transaction_date || tx.date}, Monto=${tx.amount}, Status=${tx.status}`);
        });
      } else {
        console.log('⚠️ No se encontraron transacciones bancarias con los filtros aplicados');
      }
      
      return data || [];
    } catch (error) {
      console.error('❌ Error general en getBankTransactions:', error);
      throw error;
    }
  },

  async getAccountingEntries(
    bankAccountId: string,
    filters?: {
      dateRange?: { start: Date; end: Date };
      amountRange?: { min: number; max: number };
      status?: 'all' | 'pending' | 'reconciled';
      searchTerm?: string;
    }
  ): Promise<AccountingEntry[]> {
    console.log('🔍 Buscando registros contables para cuenta bancaria:', bankAccountId);
    console.log('🔍 Filtros aplicados:', JSON.stringify(filters, null, 2));
    
    try {
      // Primero obtenemos la company_id de la cuenta bancaria
      const { data: bankAccount, error: bankAccountError } = await supabase
        .from('bank_accounts')
        .select('company_id')
        .eq('id', bankAccountId)
        .single();

      if (bankAccountError) {
        console.error('❌ Error al obtener company_id de la cuenta bancaria:', bankAccountError);
        throw bankAccountError;
      }
      
      console.log('🏢 ID de empresa asociada a la cuenta bancaria:', bankAccount.company_id);

      let query = supabase
        .from('accounting_entries')
        .select('*')
        .eq('company_id', bankAccount.company_id);

      // Aplicar filtros
      if (filters) {
        if (filters.dateRange) {
          try {
            // Verificar que las fechas son válidas
            if (!(filters.dateRange.start instanceof Date) || isNaN(filters.dateRange.start.getTime())) {
              console.error('❌ La fecha de inicio no es válida:', filters.dateRange.start);
              throw new Error('Fecha de inicio no válida');
            }
            
            if (!(filters.dateRange.end instanceof Date) || isNaN(filters.dateRange.end.getTime())) {
              console.error('❌ La fecha de fin no es válida:', filters.dateRange.end);
              throw new Error('Fecha de fin no válida');
            }
            
            // Asegurar que las fechas estén en formato ISO (YYYY-MM-DD)
            const startDate = filters.dateRange.start.toISOString().split('T')[0];
            const endDate = filters.dateRange.end.toISOString().split('T')[0];
            
            console.log(`🔍 Filtrando registros contables por fecha: ${startDate} hasta ${endDate}`);
            console.log(`🔍 Fechas originales: inicio=${filters.dateRange.start}, fin=${filters.dateRange.end}`);
            
            // Intentar con 'date' primero (nombre correcto actual)
            try {
              query = query
                .gte('date', startDate)
                .lte('date', endDate);
            } catch (columnError) {
              console.error('❌ Error al filtrar por date, intentando con entry_date:', columnError);
              // Fallback por si la columna tiene otro nombre
              query = query
                .gte('entry_date', startDate)
                .lte('entry_date', endDate);
            }
          } catch (dateError) {
            console.error('❌ Error al formatear o aplicar filtro de fechas:', dateError);
            // En caso de error, continuamos sin filtro de fecha
          }
        }

        if (filters.amountRange) {
          query = query
            .gte('amount', filters.amountRange.min)
            .lte('amount', filters.amountRange.max);
        }

        if (filters.status && filters.status !== 'all') {
          // Intentar con el campo 'status' primero
          try {
            query = query.eq('status', filters.status);
          } catch (statusError) {
            console.error('❌ Error al filtrar por status, intentando con reconciled:', statusError);
            // Fallback usando el campo reconciled como boolean
            query = query.eq('reconciled', filters.status === 'reconciled');
          }
        }

        if (filters.searchTerm) {
          query = query.or(`description.ilike.%${filters.searchTerm}%,reference.ilike.%${filters.searchTerm}%`);
        }
      }

      // Ejecutar consulta
      console.log('🔍 Ejecutando consulta para registros contables');
      // Intentar ordenar por 'date'
      let result;
      try {
        result = await query.order('date', { ascending: false });
      } catch (orderError) {
        console.error('❌ Error al ordenar por date, intentando con entry_date:', orderError);
        // Fallback para compatibilidad
        result = await query.order('entry_date', { ascending: false });
      }
      
      const { data, error } = result;
      
      if (error) {
        console.error('❌ Error al obtener registros contables:', error);
        throw error;
      }
      
      console.log(`✅ Se encontraron ${data?.length || 0} registros contables con los filtros aplicados`);
      
      // Mostrar muestra de los primeros registros para diagnóstico
      if (data && data.length > 0) {
        console.log('📄 Muestra de registros contables:');
        data.slice(0, 2).forEach((entry, index) => {
          console.log(`Registro ${index + 1}: ID=${entry.id}, Fecha=${entry.date || entry.entry_date}, Tipo=${entry.document_type}, Monto=${entry.amount}`);
        });
      } else {
        console.log('⚠️ No se encontraron registros contables con los filtros aplicados');
      }
      
      return data || [];
    } catch (error) {
      console.error('❌ Error general en getAccountingEntries:', error);
      throw error;
    }
  },

  async getMatches(bankAccountId: string): Promise<ReconciliationMatch[]> {
    try {
      console.log('🔍 Buscando conciliaciones para la cuenta bancaria:', bankAccountId);
      
      // Primero obtenemos las IDs de las transacciones bancarias de esta cuenta
      const { data: bankTransactions, error: txError } = await supabase
        .from('bank_transactions')
        .select('id')
        .eq('bank_account_id', bankAccountId);
      
      if (txError) {
        console.error('❌ Error al obtener IDs de transacciones bancarias:', txError);
        throw txError;
      }
      
      if (!bankTransactions || bankTransactions.length === 0) {
        console.log('ℹ️ No hay transacciones bancarias para esta cuenta');
        return [];
      }
      
      const transactionIds = bankTransactions.map(tx => tx.id);
      console.log(`📊 Se encontraron ${transactionIds.length} transacciones bancarias`);
      
      // Ahora consultamos las conciliaciones para estas transacciones
      const { data, error } = await supabase
        .from('reconciliations')
        .select(`
          id,
          bank_transaction_id,
          accounting_entry_id,
          status,
          confidence_score,
          notes,
          created_at,
          updated_at
        `)
        .in('bank_transaction_id', transactionIds);

      if (error) {
        console.error('❌ Error al obtener conciliaciones:', error);
        throw error;
      }
      
      // Convertir los datos al formato esperado por ReconciliationMatch
      const matches: ReconciliationMatch[] = (data || []).map(match => ({
        ...match,
        confidence: match.confidence_score || 100, // Usar confidence_score en lugar de confidence
        reconciled_at: match.created_at, // Usar created_at como reconciled_at
        match_type: match.status || 'manual' // Usar status como match_type si no existe
      }));
      
      console.log(`✅ Se encontraron ${matches.length} conciliaciones para esta cuenta bancaria`);
      return matches;
    } catch (error) {
      console.error('❌ Error general en getMatches:', error);
      throw error;
    }
  }
}; 