# Solución al problema de reconciliación automática

Para evitar que la reconciliación automática concilie registros con montos muy diferentes (fuera de la tolerancia configurada), se deben realizar las siguientes modificaciones al archivo `src/services/reconciliation.ts`:

## 1. Eliminar la "QUINTA PASADA ESPECIAL"

Eliminar completamente el bloque de código que comienza con:

```typescript
// 5. QUINTA PASADA ESPECIAL: Montos iguales en valor absoluto pero con signos contrarios
// Esta pasada está específicamente diseñada para detectar casos como el pago a proveedores
console.log('🔍 PASADA ESPECIAL: Buscando coincidencias con valores absolutos iguales...');
```

y termina justo antes de:

```typescript
// Al finalizar
console.log(`🏁 Conciliación automática completada. Total de coincidencias: ${matches.length}`);
```

Este bloque completo debe ser eliminado ya que está permitiendo conciliaciones con diferencias de monto superiores a la tolerancia configurada.

## 2. Simplificar la función `isCompatibleType`

Reemplazar la función `isCompatibleType` con esta versión simplificada:

```typescript
isCompatibleType(transaction: BankTransaction, entry: AccountingEntry): boolean {
  // Para transacciones bancarias: signo positivo = ingreso, signo negativo = egreso
  const txAmount = typeof transaction.amount === 'number' ? transaction.amount : 0;
  const isIncomeTransaction = txAmount >= 0; // Ingreso/abono bancario (positivo)
  
  // Para entradas contables: analizamos tipo de documento y signo
  const entryAmount = typeof entry.amount === 'number' 
    ? entry.amount 
    : parseFloat(String(entry.amount || '0'));
  
  // Extraer información del tipo de documento y su dirección
  const docType = (entry.document_type || '').toLowerCase();
  const docDirection = (entry.document_direction || '').toLowerCase();
  
  // Determinar el tipo específico de documento
  const isInvoice = docType.includes('factura');
  const isCreditNote = docType.includes('nota') && docType.includes('credito');
  const isEmitted = docDirection === 'emitida' || docType.includes('emitida') || docType.includes('venta');
  const isReceived = docDirection === 'recibida' || docType.includes('recibida') || docType.includes('compra');
  
  // Determinar si este documento debería representar un ingreso o egreso según su naturaleza
  let shouldBeIncome = false;
  
  if (isInvoice && isEmitted) {
    // Factura emitida (venta) → Ingreso (positivo)
    shouldBeIncome = true;
  } else if (isInvoice && isReceived) {
    // Factura recibida (compra) → Egreso (negativo)
    shouldBeIncome = false;
  } else if (isCreditNote && isEmitted) {
    // Nota de crédito emitida → Egreso (negativo)
    shouldBeIncome = false;
  } else if (isCreditNote && isReceived) {
    // Nota de crédito recibida → Ingreso (positivo)
    shouldBeIncome = true;
  } else {
    // Si no podemos determinar por el tipo de documento, usamos el signo
    shouldBeIncome = entryAmount >= 0;
  }
  
  // Comparar la naturaleza de la transacción bancaria con la naturaleza del documento contable
  const isCompatible = isIncomeTransaction === shouldBeIncome;
  
  // Log para diagnóstico
  console.log(`Compatibilidad: TX=${transaction.id.substring(0,8)}... (${isIncomeTransaction ? '+' : '-'}) y Entry=${entry.id.substring(0,8)}... (${shouldBeIncome ? '+' : '-'}) = ${isCompatible ? 'COMPATIBLE ✅' : 'NO COMPATIBLE ❌'}`);
  
  return isCompatible;
}
```

## 3. Reiniciar el servidor después de aplicar los cambios

Una vez realizados los cambios, ejecutar:

```bash
cd /Users/victor_mena/Documents/Reconcilia && killall -9 node && npm run dev
```

Estas modificaciones garantizarán que la reconciliación automática respete estrictamente los parámetros de tolerancia configurados y no aplique reglas especiales que podrían permitir conciliaciones incorrectas. 