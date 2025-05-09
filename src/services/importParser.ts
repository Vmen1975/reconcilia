/**
 * Convierte las fechas correctamente desde Excel a formato ISO
 * @param value Valor original de fecha de Excel
 * @returns Fecha en formato ISO
 */
export const parseExcelDate = (value: any): string => {
  if (!value) return '';
  
  console.log(`🔍 Procesando valor de fecha: "${value}" (${typeof value})`);
  
  try {
    // Si es un número (número de serie de Excel)
    if (typeof value === 'number') {
      // Fecha base de Excel (para Excel moderno, desde 1900)
      // Excel almacena fechas como días desde el 1 de enero de 1900
      // Nota: Excel tiene un error histórico donde considera que 1900 fue bisiesto (no lo fue)
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      console.log(`🔍 Fecha convertida desde número Excel ${value} -> ${date.toISOString()}`);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    
    // Si Excel ya lo convirtió a un objeto de fecha
    if (value instanceof Date) {
      console.log(`🔍 Valor ya es objeto Date: ${value.toISOString()}`);
      return value.toISOString().split('T')[0];
    }
    
    // Si es una string en formato DD-MM-YY o DD/MM/YY
    if (typeof value === 'string') {
      // Primero normalizar la fecha si tiene formato DD-MM-YY o DD/MM/YY
      if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2}$/.test(value)) {
        const parts = value.split(/[\/\-\.]/);
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        
        // Asumir que años menores a 50 son del siglo 21 (20xx)
        // y años mayores o iguales a 50 son del siglo 20 (19xx)
        const fullYear = year < 50 ? 2000 + year : 1900 + year;
        
        console.log(`🔍 Fecha en formato DD-MM-YY: "${value}" -> ${fullYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
        return `${fullYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
      
      // Si es una string en formato DD-MM-YYYY o DD/MM/YYYY
      if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(value)) {
        const parts = value.split(/[\/\-\.]/);
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        
        console.log(`🔍 Fecha en formato DD-MM-YYYY: "${value}" -> ${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`);
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }
      
      // Si ya tiene formato YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        console.log(`🔍 Fecha ya en formato ISO: "${value}"`);
        return value;
      }
      
      // Intentar analizar la fecha con Date.parse como último recurso
      const timestamp = Date.parse(value);
      if (!isNaN(timestamp)) {
        const date = new Date(timestamp);
        console.log(`🔍 Fecha analizada con Date.parse: "${value}" -> ${date.toISOString()}`);
        return date.toISOString().split('T')[0];
      }
    }
    
    // Si llegamos aquí, no pudimos analizar la fecha
    console.warn(`⚠️ No se pudo analizar la fecha: "${value}"`);
    return '';
  } catch (error) {
    console.error(`❌ Error al analizar fecha: "${value}"`, error);
    return '';
  }
} 