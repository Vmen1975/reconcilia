/**
 * INSTRUCCIONES DE CORRECCIÓN
 * 
 * Este código debe reemplazar la función calculateMatchConfidence en src/services/reconciliation.ts
 * 
 * El cambio principal es que añade una validación estricta de diferencia de monto
 * que rechaza automáticamente cualquier coincidencia si la diferencia porcentual
 * supera la tolerancia configurada (finalAmountTolerance).
 * 
 * Para aplicar esta corrección:
 * 1. Busca la función calculateMatchConfidence en src/services/reconciliation.ts
 * 2. Reemplázala con esta versión
 * 3. Reinicia el servidor
 */

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
  
  // INICIO DE CAMBIOS: Usar valor fijo de tolerancia de 1% para estar seguros
  const configuredAmountTolerance = 0.01; // 1% como tolerancia segura y conservadora
  
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
  
  // CAMBIO CLAVE: Rechazar automáticamente si la diferencia supera la tolerancia
  if (absAmountDiff > configuredAmountTolerance) {
    console.log(`❌ DESCARTADO AUTOMÁTICAMENTE: Diferencia de monto (${(absAmountDiff * 100).toFixed(2)}%) supera la tolerancia máxima (${(configuredAmountTolerance * 100).toFixed(2)}%)`);
    return 0; // Retornar confianza 0 para rechazar esta coincidencia
  }
  
  // A partir de aquí solo llegamos si la diferencia está dentro de la tolerancia
  if (absAmountDiff === 0) {
    // Coincidencia exacta de montos, mayor confianza
    confidence += 50;
    detailedReason.push("✅ Montos exactamente iguales: +50");
    console.log(`💰 Montos exactamente iguales: ${Math.abs(txAmount)} = ${Math.abs(entryAmount)}`);
  } else {
    // Diferencia dentro de tolerancia, asignar puntos proporcionales
    const puntos = Math.round(50 * (1 - (absAmountDiff / configuredAmountTolerance)));
    confidence += puntos;
    detailedReason.push(`✅ Diferencia de monto (${(absAmountDiff * 100).toFixed(2)}%) dentro de tolerancia: +${puntos}`);
    console.log(`💰 Diferencia de monto (${(absAmountDiff * 100).toFixed(2)}%): +${puntos} puntos`);
  }
  // FIN DE CAMBIOS
  
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
    const txNumbers = this.extractNumbers(txDesc + " " + txRef);
    const entryNumbers = this.extractNumbers(entryRef + " " + entryDesc);
    
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