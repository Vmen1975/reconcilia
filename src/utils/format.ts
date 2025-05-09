/**
 * Utilidades para formatear datos en la aplicación
 */

/**
 * Formatea un monto monetario de manera consistente
 * @param amount Monto a formatear
 * @param options Opciones adicionales de formato
 * @returns Cadena formateada
 */
export const formatMoney = (amount: number | string, options?: { 
  showDecimals?: boolean, 
  currencySymbol?: boolean 
}): string => {
  // Asegurar que amount sea un número
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Si no es un número válido, mostrar 0
  if (isNaN(numAmount)) return '$0';
  
  // Opciones por defecto
  const showDecimals = options?.showDecimals ?? false;
  const currencySymbol = options?.currencySymbol ?? true;
  
  // Formatear usando Intl
  return new Intl.NumberFormat('es-CL', { 
    style: currencySymbol ? 'currency' : 'decimal',
    currency: 'CLP',
    maximumFractionDigits: showDecimals ? 2 : 0,
    minimumFractionDigits: showDecimals ? 2 : 0
  }).format(numAmount);
};

/**
 * Formatea una fecha de manera consistente, preservando la fecha exacta como está en la base de datos
 * @param date Fecha a formatear (string, Date o timestamp)
 * @returns Fecha formateada en formato DD-MM-YYYY
 */
export const formatDate = (date: string | Date | number | undefined): string => {
  if (!date) return '';
  
  try {
    // Si es un string, mantener la fecha tal como viene de la base de datos
    if (typeof date === 'string') {
      // Extraer solo la parte de la fecha (YYYY-MM-DD)
      const parts = date.split('T')[0].split('-');
      if (parts.length === 3) {
        // Formatear en DD-MM-YYYY sin manipular la fecha original
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return date; // Devolver el string original si no se puede procesar
    } 
    
    // Si es un objeto Date, extraer sus componentes manualmente
    if (date instanceof Date) {
      // Usar toISOString para obtener un formato consistente, luego extraer solo la fecha
      const isoStr = date.toISOString();
      const parts = isoStr.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return isoStr; // Devolver la fecha en formato ISO si no se puede procesar
    }
    
    // Si es un timestamp (número), convertir a fecha ISO
    if (typeof date === 'number') {
      const dateObj = new Date(date);
      const isoStr = dateObj.toISOString();
      const parts = isoStr.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return isoStr;
    }
    
    // Fallback
    return String(date);
  } catch (error) {
    console.error('Error formateando fecha:', error, date);
    return String(date);
  }
};

/**
 * Normaliza un monto para comparaciones, eliminando separadores
 * y símbolos de moneda, preservando el signo original
 * @param amount Monto a normalizar
 * @param debug Mostrar información de depuración
 * @returns Número normalizado con su signo original
 */
export const normalizeAmount = (amount: number | string, debug: boolean = true): number => {
  // Registrar la entrada original para diagnóstico
  console.log(`💲💲 NORMALIZANDO MONTO: ${amount} (tipo: ${typeof amount})`);
  
  // Preservar el signo original - asegurar que detectamos correctamente si es negativo
  let isNegative = false;
  
  if (typeof amount === 'number') {
    isNegative = amount < 0;
    console.log(`  Valor numérico: ${amount}, Es negativo: ${isNegative}`);
  } else {
    // Si es string, necesitamos ser más cuidadosos
    const amountStr = amount.toString().trim();
    
    // Una manera más robusta de detectar si es negativo
    isNegative = amountStr.startsWith('-') || 
                 amountStr.toLowerCase().includes('menos') || 
                 amountStr.toLowerCase().includes('negativo');
                 
    console.log(`  Valor string: "${amountStr}", Es negativo: ${isNegative}`);
  }
  
  // Si es número, normalizar preservando el signo
  if (typeof amount === 'number') {
    const absValue = Math.abs(amount);
    const result = isNegative ? -absValue : absValue;
    
    console.log(`  Resultado (número): ${amount} → ${result}`);
    return result;
  }
  
  // Si es string, eliminar todo excepto dígitos
  let amountStr = amount.toString().trim();
  
  // Guardar el signo y eliminarlo para procesar solo dígitos
  if (amountStr.startsWith('-')) {
    amountStr = amountStr.substring(1);
  }
  
  // Eliminar todo excepto dígitos
  let digitsOnly = amountStr.replace(/\D/g, '');
  
  // Si está vacío después de eliminar no-dígitos, devolver 0
  if (!digitsOnly || digitsOnly === '') {
    console.log(`  ⚠️ No se encontraron dígitos en "${amount}", devolviendo 0`);
    return 0;
  }
  
  // Convertir a número
  const numericValue = Number(digitsOnly);
  
  // Aplicar el signo original
  const finalResult = isNegative ? -numericValue : numericValue;
  
  // Mostrar el proceso completo
  console.log(`  Proceso completo: "${amount}" → Dígitos: "${digitsOnly}" → Aplicar signo(${isNegative ? '-' : '+'}) → ${finalResult}`);
  
  // Detección de casos especiales para el pago de proveedores
  if (amount.toString().includes('11.900.000') || 
      amount.toString().includes('11900000') || 
      Math.abs(finalResult) === 11900000) {
    console.log(`  🚨 CASO ESPECIAL DETECTADO: Monto de 11.900.000`);
    console.log(`  💰 Resultado final: ${finalResult}`);
    console.log(`  💰 Valor absoluto: ${Math.abs(finalResult)}`);
  }
  
  return finalResult;
}; 