import { supabase } from '@/lib/supabase';
import { ImportedFile } from '@/types';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export type ImportStatus = 'pending' | 'processing' | 'processed' | 'error';

export interface CreateImportDTO {
  company_id: string;
  user_id?: string;
  file_name: string;
  file_type: 'bank' | 'accounting';
  file_path: string;
  bank_account_id?: string;
}

interface ImportOptions {
  fileType: 'bank' | 'accounting';
  bankAccountId?: string;
  columnMapping?: Record<string, string>;
  period?: string;
  companyId: string;
  documentDirection?: 'emitida' | 'recibida';
}

/**
 * Normaliza los tipos de documento de diversas fuentes a valores estándar
 * asegurando que el valor devuelto sea uno de los permitidos por la restricción CHECK
 * @param documentType Texto del tipo de documento (ej: 'NC', 'Factura', etc)
 * @returns Tipo normalizado: 'invoice', 'credit_note', 'debit_note', 'other'
 */
function normalizeDocumentType(documentType: string): string {
  // Lista de valores permitidos por la restricción CHECK
  const allowedTypes = ['invoice', 'credit_note', 'debit_note', 'other'];
  
  // Si es null o undefined, devolver 'other'
  if (!documentType) return 'other';
  
  const type = documentType.toLowerCase().trim();
  
  // Normalizar facturas
  if (type.includes('factura') || type === 'f' || type === 'fac' || type === 'invoice') {
    return 'invoice';
  }
  
  // Normalizar notas de crédito
  if (type.includes('credito') || type.includes('crédito') || type === 'nc' || 
      type.includes('nota c') || type === 'credit note' || type === 'credit') {
    return 'credit_note';
  }
  
  // Normalizar notas de débito
  if (type.includes('debito') || type.includes('débito') || type === 'nd' || 
      type.includes('nota d') || type === 'debit note' || type === 'debit') {
    return 'debit_note';
  }
  
  // Si no coincide con ninguna categoría conocida, devolver 'other'
  return 'other';
}

/**
 * Normaliza diversos formatos de fecha a formato ISO YYYY-MM-DD
 * Mejorado para detectar correctamente fechas con año de 2 dígitos: DD-MM-YY, DD/MM/YY
 * Ajustado para manejar zona horaria de Chile correctamente
 * @param dateValue Valor de fecha en diferentes formatos posibles
 * @returns Fecha como string en formato YYYY-MM-DD (no como objeto Date)
 */
function normalizeDate(dateValue: any): string {
  // Si no hay valor, devolver fecha actual
  if (!dateValue) {
    const today = new Date().toISOString().split('T')[0];
    console.log(`⚠️ Valor de fecha vacío, usando fecha actual: "${today}"`);
    return today;
  }
  
  // Para depuración
  const original = dateValue;
  console.log(`🔄 Normalizando fecha original: "${original}" (tipo: ${typeof original})`);
  
  try {
    // Si ya es un objeto Date, asegurar que se interpreta correctamente para zona horaria Chile
    if (dateValue instanceof Date) {
      // Convertir a fecha ISO sin ajuste de zona horaria
      const isoDate = dateValue.toISOString().split('T')[0];
      console.log(`🔄 Date object: "${dateValue}" -> ISO: "${isoDate}"`);
      // Devolver la fecha como string para evitar ajustes de zona horaria
      return isoDate;
    }
    
    // Si es string, intentar diferentes formatos comunes
    if (typeof dateValue === 'string') {
      // Limpiar el valor
      dateValue = dateValue.trim();
      
      console.log(`🔄 Procesando fecha como string: "${dateValue}"`);
      
      // Formato DD-MM-YY o DD/MM/YY con 2 dígitos para el año (formato común en Excel)
      if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2}$/.test(dateValue)) {
        const parts = dateValue.split(/[\/\-\.]/);
        const day = parseInt(parts[0].padStart(2, '0'), 10);
        const month = parseInt(parts[1].padStart(2, '0'), 10);
        const year = parseInt(parts[2], 10);
        
        // Validar componentes de fecha
        if (day < 1 || day > 31 || month < 1 || month > 12) {
          console.warn(`⚠️ Componentes de fecha inválidos: día=${day}, mes=${month}, año=${year}`);
          throw new Error(`Fecha inválida: ${dateValue}`);
        }
        
        // Asumir que años menores a 50 son del siglo 21 (20xx)
        // y años mayores o iguales a 50 son del siglo 20 (19xx)
        const fullYear = year < 50 ? 2000 + year : 1900 + year;
        
        // Crear fecha ISO sin tiempo para evitar ajustes por zona horaria
        const isoDate = `${fullYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        console.log(`🔄 Detectado formato DD-MM-YY: "${dateValue}" -> "${isoDate}"`);
        
        // Devolver directamente el string en formato ISO para evitar problemas de zona horaria
        return isoDate;
      }
      
      // Formato DD/MM/YYYY o DD-MM-YYYY con 4 dígitos para el año
      if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(dateValue)) {
        const parts = dateValue.split(/[\/\-\.]/);
        const day = parseInt(parts[0].padStart(2, '0'), 10);
        const month = parseInt(parts[1].padStart(2, '0'), 10);
        const year = parseInt(parts[2], 10);
        
        // Validar componentes de fecha
        if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
          console.warn(`⚠️ Componentes de fecha inválidos: día=${day}, mes=${month}, año=${year}`);
          throw new Error(`Fecha inválida: ${dateValue}`);
        }
        
        // Crear fecha ISO sin tiempo para evitar ajustes por zona horaria
        const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        console.log(`🔄 Detectado formato DD-MM-YYYY: "${dateValue}" -> "${isoDate}"`);
        
        // Devolver directamente el string en formato ISO para evitar problemas de zona horaria
        return isoDate;
      }
      
      // Formato YYYY/MM/DD o YYYY-MM-DD (ISO)
      if (/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(dateValue)) {
        const parts = dateValue.split(/[\/\-\.]/);
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1].padStart(2, '0'), 10);
        const day = parseInt(parts[2].padStart(2, '0'), 10);
        
        // Validar componentes de fecha
        if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
          console.warn(`⚠️ Componentes de fecha inválidos: día=${day}, mes=${month}, año=${year}`);
          throw new Error(`Fecha inválida: ${dateValue}`);
        }
        
        // Crear fecha ISO sin tiempo para evitar ajustes por zona horaria
        const isoDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        console.log(`🔄 Detectado formato YYYY-MM-DD: "${dateValue}" -> "${isoDate}"`);
        
        // Devolver directamente el string en formato ISO para evitar problemas de zona horaria
        return isoDate;
      }
      
      // Caso especial para Excel o Banco: formato sin separadores DD/MM (Ejemplo: "15/04")
      if (/^\d{1,2}\/\d{1,2}$/.test(dateValue)) {
        const parts = dateValue.split('/');
        const day = parseInt(parts[0].padStart(2, '0'), 10);
        const month = parseInt(parts[1].padStart(2, '0'), 10);
        // Usar el año actual para completar
        const currentYear = new Date().getFullYear();
        
        // Validar componentes de fecha
        if (day < 1 || day > 31 || month < 1 || month > 12) {
          console.warn(`⚠️ Componentes de fecha incompletos inválidos: día=${day}, mes=${month}`);
          throw new Error(`Fecha inválida: ${dateValue}`);
        }
        
        // Crear fecha ISO sin tiempo
        const isoDate = `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        console.log(`🔄 Detectado formato especial DD/MM: "${dateValue}" -> "${isoDate}" (complementado con año actual)`);
        
        return isoDate;
      }
      
      // Formato numérico (posible timestamp o número de Excel)
      if (/^\d+$/.test(dateValue) && !isNaN(Number(dateValue))) {
        const num = Number(dateValue);
        // Si es un timestamp de Unix (segundos desde 1970)
        if (num > 10000000) { // Evitar confundir con número de serie de Excel
          // Convertir segundos a milisegundos y ajustar a zona horaria local
          const date = new Date(num * 1000);
          console.log(`🔄 Detectado timestamp: ${num} -> ${date.toISOString()}`);
          // Extraer solo la fecha para evitar problemas de zona horaria
          const isoDate = date.toISOString().split('T')[0];
          return isoDate;
        }
      }
      
      // Intentar con Date.parse como última opción
      const parsedTimestamp = Date.parse(dateValue);
      if (!isNaN(parsedTimestamp)) {
        const parsedDate = new Date(parsedTimestamp);
        console.log(`🔄 Parseado con Date: "${dateValue}" -> "${parsedDate.toISOString()}"`);
        // Extraer solo la fecha para evitar problemas de zona horaria
        const isoDate = parsedDate.toISOString().split('T')[0];
        return isoDate;
      }
    }
    
    // Intentar convertir directamente
    const directDate = new Date(dateValue);
    if (!isNaN(directDate.getTime())) {
      // Extraer solo la fecha para evitar problemas de zona horaria
      const isoDate = directDate.toISOString().split('T')[0];
      console.log(`🔄 Conversión directa: "${dateValue}" -> "${isoDate}"`);
      return isoDate;
    }
    
    // Si llegamos aquí, no pudimos convertir la fecha
    console.warn(`⚠️ No se pudo normalizar la fecha: "${original}" de tipo ${typeof original}. Usando fecha actual.`);
    return new Date().toISOString().split('T')[0];
  } catch (error) {
    console.error(`❌ Error al normalizar fecha "${original}":`, error);
    return new Date().toISOString().split('T')[0];
  }
}

export const importService = {
  async uploadFile(file: File, options: ImportOptions): Promise<string> {
    console.log('📤 Iniciando carga de archivo:', file.name, 'tipo:', options.fileType);
    
    try {
      // Verificar si el bucket 'imports' existe y crearlo si no
      const { data: buckets } = await supabase.storage.listBuckets();
      const importsBucket = buckets?.find(bucket => bucket.name === 'imports');
      
      if (!importsBucket) {
        console.log('📤 El bucket "imports" no existe. Creándolo...');
        const { data, error: bucketError } = await supabase.storage.createBucket('imports', {
          public: false, // Ajusta esto según tus necesidades de seguridad
          fileSizeLimit: 52428800, // 50MB
        });
        
        if (bucketError) {
          console.error('❌ Error al crear bucket "imports":', bucketError);
          throw new Error(`No se pudo crear el bucket: ${bucketError.message}`);
        }
        
        console.log('✅ Bucket "imports" creado exitosamente');
      }
      
      // Continuar con la carga del archivo
      // Obtener el companyId de las opciones
      const companyId = options.companyId;
      console.log('📤 ID de empresa para carga:', companyId);
      
      // Generar un nombre de archivo único con menos caracteres y sin espacios ni caracteres especiales
      const timestamp = new Date().getTime();
      const fileExtension = file.name.split('.').pop() || '';
      const simplifiedName = `${options.fileType}_${timestamp}.${fileExtension}`.replace(/\s+/g, '_');
      
      // Asegúrate de que la ruta sea simple y sin caracteres especiales
      const filePath = `${companyId}/${simplifiedName}`;
      
      console.log('📤 Ruta generada para el archivo:', filePath);
      
      // Crear un objeto Blob a partir del archivo para asegurar compatibilidad
      const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type });
      
      // Subir archivo a Supabase Storage - asegúrate de que el bucket "imports" existe
      console.log('📤 Subiendo archivo a Supabase Storage...');
      const { data: fileData, error: uploadError } = await supabase.storage
        .from('imports')
        .upload(filePath, fileBlob, {
          cacheControl: '3600',
          upsert: true // Sobrescribir si existe
        });
        
      if (uploadError) {
        console.error('❌ Error al subir archivo a Storage:', uploadError);
        throw uploadError;
      }
      
      console.log('📤 Archivo subido exitosamente a Storage:', fileData);
      
      // Crear registro en la tabla de importaciones
      console.log('📤 Creando registro en la tabla imported_files...');
      
      // Preparar los datos para la inserción
      const importRecord = {
        company_id: companyId,
        file_name: file.name,
        file_type: options.fileType,
        file_path: filePath,
        status: 'pending',
        bank_account_id: options.bankAccountId,
        row_count: 0, // Se actualizará después del procesamiento
        import_date: new Date().toISOString() // Asegurarnos de incluir este campo si es requerido
      };
      
      console.log('📤 Datos a insertar:', importRecord);
      
      // Verificar si la tabla existe
      const { data: tableInfo, error: tableError } = await supabase
        .from('imported_files')
        .select('*')
        .limit(1);
      
      if (tableError) {
        console.error('❌ Error al verificar la tabla imported_files:', tableError);
        console.log('⚠️ Eliminando archivo subido debido al error...');
        await supabase.storage.from('imports').remove([filePath]);
        throw new Error(`Error al verificar la tabla imported_files: ${tableError.message}`);
      }
      
      // Insertar el registro
      const { data: importData, error: importError } = await supabase
        .from('imported_files')
        .insert([importRecord])
        .select()
        .single();
        
      if (importError) {
        // Si hay error, eliminar el archivo subido
        console.error('❌ Error al crear registro de importación:', importError);
        console.log('📤 Eliminando archivo subido debido al error...');
        await supabase.storage.from('imports').remove([filePath]);
        throw new Error(`No se pudo crear el registro de importación: ${importError.message}`);
      }
      
      console.log('📤 Registro de importación creado exitosamente:', importData?.id);
      
      // Guardar mapeo de columnas en metadatos
      if (options.columnMapping) {
        console.log('📤 Guardando metadatos de mapeo de columnas...');
        const { error: metadataError } = await supabase
          .from('import_metadata')
          .insert([{
            import_id: importData.id,
            metadata: {
              column_mapping: options.columnMapping,
              period: options.period
            }
          }]);
          
        if (metadataError) {
          console.error('❌ Error al guardar metadatos:', metadataError);
          throw metadataError;
        }
        
        console.log('📤 Metadatos guardados exitosamente');
      }
      
      console.log('📤 Proceso de carga completado exitosamente');
      return importData.id;
    } catch (error) {
      console.error('❌ Error general en carga de archivo:', error);
      throw error;
    }
  },
  
  async generatePreview(file: File, fileType: 'bank' | 'accounting'): Promise<{ columns: string[], data: any[] }> {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      
      fileReader.onload = async (e) => {
        try {
          const result = e.target?.result;
          if (!result) {
            reject(new Error('No se pudo leer el archivo'));
            return;
          }
          
          // Determinar el tipo de archivo por su extensión
          const fileExtension = file.name.split('.').pop()?.toLowerCase();
          
          if (fileExtension === 'csv') {
            // Procesar CSV con PapaParse
            Papa.parse(result as string, {
              header: true,
              skipEmptyLines: true,
              complete: (results) => {
                console.log('Columnas CSV detectadas:', results.meta.fields);
                console.log('Datos CSV de muestra:', results.data.slice(0, 5));
                resolve({
                  columns: results.meta.fields || [],
                  data: results.data.slice(0, 10) // Limitar a 10 registros para la vista previa
                });
              },
              error: (parseError: Error) => {
                reject(parseError);
              }
            });
          } else if (['xls', 'xlsx'].includes(fileExtension || '')) {
            try {
              // Procesar Excel con SheetJS
              const workbook = XLSX.read(result, { type: 'binary' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
              
              // Obtener las columnas del primer objeto (si existe)
              let columns: string[] = [];
              if (jsonData.length > 0) {
                // Asegurar que el objeto es tratable como Record<string, unknown>
                const firstRow = jsonData[0] as Record<string, unknown>;
                columns = Object.keys(firstRow);
              }

              console.log('Columnas Excel detectadas:', columns);
              console.log('Datos Excel de muestra (primeros 5 registros):', jsonData.slice(0, 5));
              
              resolve({
                columns,
                data: jsonData.slice(0, 10) // Limitar a 10 registros para la vista previa
              });
            } catch (excelError) {
              console.error('Error al procesar archivo Excel:', excelError);
              reject(new Error('Error al procesar el archivo Excel. Verifique el formato.'));
            }
          } else {
            reject(new Error('Formato de archivo no soportado'));
          }
        } catch (error) {
          console.error('Error en generatePreview:', error);
          reject(error);
        }
      };
      
      fileReader.onerror = () => {
        reject(new Error('Error al leer el archivo'));
      };
      
      if (['xls', 'xlsx'].includes(file.name.split('.').pop() || '')) {
        fileReader.readAsBinaryString(file);
      } else {
        fileReader.readAsText(file);
      }
    });
  },
  
  guessColumnMapping(columns: string[], fileType: 'bank' | 'accounting'): Record<string, string> {
    const mapping: Record<string, string> = {
      date: '',
      description: '',
      amount: '',
      reference: '',
      debit: '',
      credit: ''
    };
    
    // Patrones comunes para diferentes campos según diversos bancos
    const patterns = {
      date: [
        /fecha/i, 
        /date/i, 
        /dia/i, 
        /día/i, 
        /fch/i,
        /data/i
      ],
      description: [
        /descrip/i, 
        /concepto/i, 
        /glosa/i, 
        /detalle/i, 
        /movimiento/i, 
        /transacción/i, 
        /transaccion/i, 
        /detail/i,
        /comentario/i,
        /concept/i
      ],
      debit: [
        /cargo/i, 
        /cargos/i, 
        /débito/i, 
        /debito/i, 
        /debe/i, 
        /retiro/i, 
        /salida/i, 
        /debit/i,
        /gasto/i,
        /out/i,
        /egreso/i,
        /salida/i
      ],
      credit: [
        /abono/i, 
        /abonos/i, 
        /crédito/i, 
        /credito/i, 
        /haber/i, 
        /depósito/i, 
        /deposito/i, 
        /credit/i,
        /ingreso/i,
        /entrada/i,
        /in/i
      ],
      amount: [
        /monto/i, 
        /amount/i, 
        /valor/i, 
        /importe/i, 
        /saldo/i, 
        /balance/i, 
        /total/i,
        /suma/i
      ],
      reference: [
        /ref/i, 
        /document/i, 
        /folio/i, 
        /nro/i, 
        /número/i, 
        /numero/i, 
        /canal/i, 
        /sucursal/i,
        /medio/i,
        /cod/i,
        /código/i,
        /codigo/i
      ]
    };
    
    // Buscar matches directos para "Cargos (CLP)" y "Abonos (CLP)" que son comunes en bancos chilenos
    for (const column of columns) {
      if (column.match(/cargos\s*\(?clp\)?/i) || column === 'Cargos (CLP)') {
        mapping.debit = column;
        console.log('Detectada columna de cargos:', column);
      }
      
      if (column.match(/abonos\s*\(?clp\)?/i) || column === 'Abonos (CLP)') {
        mapping.credit = column;
        console.log('Detectada columna de abonos:', column);
      }
    }
    
    // Analizar todas las columnas para encontrar coincidencias con los patrones
    for (const column of columns) {
      // Saltarse las columnas ya asignadas
      if (Object.values(mapping).includes(column)) continue;
      
      // Buscar patrones comunes en cada categoría
      for (const [field, fieldPatterns] of Object.entries(patterns)) {
        if (!mapping[field] && fieldPatterns.some(pattern => pattern.test(column))) {
          mapping[field] = column;
          console.log(`Columna "${column}" asignada a campo "${field}"`);
          break;
        }
      }
    }
    
    // Si después de la asignación aún hay campos faltantes, intentar detectar por posición o heurísticas adicionales
    if (!mapping.date && columns.length > 0) {
      // La primera columna suele ser la fecha en muchos extractos
      mapping.date = columns[0];
      console.log(`Columna "${columns[0]}" asignada a fecha por posición`);
    }
    
    if (!mapping.description && columns.length > 1) {
      // La segunda columna suele ser la descripción en muchos extractos
      mapping.description = columns[1];
      console.log(`Columna "${columns[1]}" asignada a descripción por posición`);
    }
    
    // Detectar automáticamente si hay columnas con montos positivos y negativos
    // en lugar de columnas separadas para débito y crédito
    if (!mapping.debit && !mapping.credit && mapping.amount) {
      console.log('Usando una sola columna para montos (positivos=créditos, negativos=débitos)');
    }
    
    console.log('Mapeo final de columnas:', mapping);
    return mapping;
  },
  
  async processFile(importId: string, documentDirection?: 'emitida' | 'recibida'): Promise<void> {
    console.log('🔄 Iniciando procesamiento de archivo:', importId);
    
    try {
      // Actualizar estado a "processing"
      console.log('🔄 Actualizando estado a "processing"...');
      await this.updateStatus(importId, 'processing');
      
      // Obtener información del archivo
      console.log('🔄 Obteniendo información del archivo...');
      const importFile = await this.getImport(importId);
      if (!importFile) {
        throw new Error('No se encontró el archivo de importación');
      }
      
      // Validar que el archivo exista en el bucket
      if (!importFile.file_path) {
        throw new Error('No se encontró la ruta del archivo');
      }
      
      console.log('🔄 Información del archivo:', {
        id: importFile.id,
        file_name: importFile.file_name,
        file_type: importFile.file_type,
        file_path: importFile.file_path,
        status: importFile.status
      });
      
      // Descargar archivo desde Storage
      console.log('🔄 Descargando archivo desde Storage...');
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('imports')
        .download(importFile.file_path);
        
      if (downloadError) {
        console.error('Error al descargar archivo:', downloadError);
        throw new Error(`Error al descargar archivo: ${downloadError.message}`);
      }
      
      if (!fileData) {
        throw new Error('No se pudo descargar el archivo');
      }
      
      console.log('✅ Archivo descargado exitosamente, tamaño:', fileData.size);
      
      // Procesar el archivo según su tipo
      const fileExtension = importFile.file_name.split('.').pop()?.toLowerCase();
      let records: any[] = [];
      
      console.log('🔄 Procesando archivo con extensión:', fileExtension);
      if (fileExtension === 'csv') {
        // Procesar CSV
        const text = await fileData.text();
        console.log('🔄 Analizando CSV con PapaParse...');
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        records = result.data;
      } else if (['xls', 'xlsx'].includes(fileExtension || '')) {
        // Procesar Excel
        const arrayBuffer = await fileData.arrayBuffer();
        console.log('🔄 Analizando Excel con SheetJS...');
        
        // Configuración especial para manejar fechas correctamente
        const options = {
          type: 'array',
          cellDates: true, // Intentar convertir valores numéricos de Excel a objetos Date
          dateNF: 'yyyy-mm-dd', // Formato de fecha preferido
          raw: false, // Para obtener valores formateados en lugar de valores brutos
          // Ajustes de zona horaria para Chile (UTC-4 o UTC-3)
          WTF: true, // Habilitar depuración
          timezoneOffset: -240 // UTC-4 para Chile (en minutos, puede ser -180 en horario de verano)
        };
        
        const workbook = XLSX.read(arrayBuffer, options as any);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Intentar extraer con fechas convertidas a Date objects
        records = XLSX.utils.sheet_to_json(worksheet, { 
          raw: false, 
          dateNF: 'yyyy-mm-dd',
          defval: ''
        });
        
        // Analizar algunos registros para diagnóstico
        console.log('🔄 Muestra de datos Excel procesados:');
        records.slice(0, 3).forEach((record, index) => {
          console.log(`📊 Registro ${index + 1}:`, JSON.stringify(record));
        });
      } else {
        throw new Error(`Formato de archivo no soportado: ${fileExtension}`);
      }
      
      console.log(`🔄 Archivo analizado correctamente. Registros encontrados: ${records.length}`);
      
      // Obtener metadatos de mapeo de columnas
      console.log('🔄 Obteniendo mapeo de columnas...');
      const columnMapping = importFile.metadata?.column_mapping || {};
      console.log('🔄 Mapeo de columnas:', columnMapping);
      
      // Procesar registros según el tipo de archivo
      console.log('🔄 Procesando registros según tipo de archivo:', importFile.file_type);
      if (importFile.file_type === 'bank') {
        await this.processBankTransactions(records, importFile, columnMapping);
      } else {
        await this.processAccountingEntries(records, importFile, columnMapping, documentDirection);
      }
      
      // Actualizar estado a procesado y contar filas
      console.log('🔄 Actualizando estado a "processed"...');
      const rowCount = records.length;
      await this.updateStatus(importId, 'processed', undefined, rowCount);
      
      console.log('✅ Procesamiento completado exitosamente');
    } catch (error) {
      console.error('❌ Error en el procesamiento del archivo:', error);
      
      try {
        // Actualizar estado a error
        await this.updateStatus(
          importId,
          'error',
          error instanceof Error ? error.message : 'Error desconocido'
        );
      } catch (updateError) {
        console.error('❌ Error adicional al actualizar estado:', updateError);
      }
      
      throw error;
    }
  },
  
  async processBankTransactions(records: any[], importFile: ImportedFile, columnMapping: Record<string, string>): Promise<void> {
    console.log('🔍 Iniciando procesamiento de transacciones bancarias');
    
    try {
      console.log(`📄 Procesando ${records.length} registros de transacciones bancarias`);
      console.log('🔄 Mapeo de columnas:', JSON.stringify(columnMapping));
      
      // Verificar existencia de campos en la tabla
      const { data: tableInfo, error: tableInfoError } = await supabase
        .from('bank_transactions')
        .select('*')
        .limit(1);
      
      if (tableInfoError) {
        console.error('❌ Error al verificar estructura de tabla bank_transactions:', tableInfoError);
        throw new Error(`Error al verificar estructura de tabla: ${tableInfoError.message}`);
      }
      
      console.log('🔍 Estructura de la tabla bank_transactions verificada');
      
      // Mapear registros a transacciones
      const transactions = records.map((record, index) => {
        if (index < 3) {
          console.log(`🔍 Muestra - Registro ${index + 1}:`, JSON.stringify(record).substring(0, 200));
        }

        // Extraer valores del registro usando mapeo de columnas
        const dateValue = columnMapping.date ? record[columnMapping.date] : null;
        const descValue = columnMapping.description ? record[columnMapping.description] : null;
        const amountValue = columnMapping.amount ? record[columnMapping.amount] : null;
        const refValue = columnMapping.reference ? record[columnMapping.reference] : null;
        const debitValue = columnMapping.debit ? record[columnMapping.debit] : undefined;
        const creditValue = columnMapping.credit ? record[columnMapping.credit] : undefined;
        
        if (index < 3) {
          console.log(`🔍 Valores extraídos - Registro ${index + 1}:`);
          console.log(`  Fecha: ${dateValue}`);
          console.log(`  Descripción: ${descValue}`);
          console.log(`  Monto: ${amountValue}`);
          console.log(`  Referencia: ${refValue}`);
          console.log(`  Débito: ${debitValue}`);
          console.log(`  Crédito: ${creditValue}`);
        }
        
        // Procesar la fecha (normalizar a formato ISO)
        let formattedDate;
        try {
          formattedDate = normalizeDate(dateValue);
          if (index < 3) {
            console.log(`📅 Fecha normalizada para registro ${index + 1}: ${formattedDate} (original: ${dateValue})`);
          }
        } catch (error) {
          console.error(`❌ Error al normalizar fecha para el registro ${index + 1}:`, error);
          formattedDate = new Date().toISOString().split('T')[0]; // Usar fecha actual como fallback
        }
        
        // Procesar el monto
        let amount: number;
        
        if (columnMapping.debit && columnMapping.credit && 
            (debitValue !== undefined || creditValue !== undefined)) {
          // Si tenemos débito y crédito, usamos esos valores
          const debitAmount = debitValue ? this.parseNumberValue(debitValue) : 0;
          const creditAmount = creditValue ? this.parseNumberValue(creditValue) : 0;
          
          if (index < 3) {
            console.log(`🔍 Montos procesados para registro ${index + 1}: Débito=${debitAmount}, Crédito=${creditAmount}`);
          }
          
          // El monto es la diferencia entre crédito (positivo) y débito (negativo)
          if (debitAmount > 0) {
            amount = -debitAmount; // Los débitos son valores negativos
          } else if (creditAmount > 0) {
            amount = creditAmount; // Los créditos son valores positivos
          } else {
            amount = 0;
          }
        } else {
          // Si no tenemos débito y crédito separados, usamos el monto genérico
          amount = this.parseNumberValue(amountValue);
        }
        
        if (index < 3) {
          console.log(`🔍 Monto final calculado para registro ${index + 1}: ${amount}`);
        }
        
        // Determinar el tipo de transacción para usarlo como status si es necesario
        const transactionType = this.determineTransactionType(amount, descValue);
        
        // Crear el objeto de transacción acorde a la estructura exacta de la tabla bank_transactions
        return {
          bank_account_id: importFile.bank_account_id,
          imported_file_id: importFile.id,
          transaction_date: formattedDate, // Nombre correcto según la migración
          description: descValue || 'Sin descripción',
          amount: amount,
          reference_number: refValue || '', // Nombre correcto según la migración
          status: transactionType, // Usar el tipo de transacción como status
          // No incluir reconciliation_id, created_at ni updated_at ya que se generan automáticamente
        };
      });
      
      // Filtrar transacciones inválidas o con monto cero
      const validTransactions = transactions.filter(t => 
        t.description && t.amount !== undefined && t.amount !== null
      );
      
      console.log(`🔍 Transacciones válidas: ${validTransactions.length} de ${transactions.length} totales`);
      
      if (validTransactions.length > 0) {
        console.log('🔍 Muestra de la primera transacción a importar:', JSON.stringify(validTransactions[0], null, 2));
      }
      
      if (validTransactions.length === 0) {
        console.warn('⚠️ No se encontraron transacciones válidas para importar.');
        return;
      }
      
      // Insertar transacciones en lotes para evitar límites de tamaño de petición
      const batchSize = 50; // Reducir tamaño del lote para evitar problemas
      
      for (let i = 0; i < validTransactions.length; i += batchSize) {
        console.log(`🔍 Importando lote ${Math.floor(i / batchSize) + 1} de ${Math.ceil(validTransactions.length / batchSize)}`);
        
        const batch = validTransactions.slice(i, i + batchSize);
        
        try {
          const { data, error } = await supabase
            .from('bank_transactions')
            .insert(batch)
            .select();
          
          if (error) {
            console.error('❌ Error al insertar transacciones:', error);
            
            // Si hay un error por conflicto de nombres de columnas, intentar insertar con columnas explícitas
            if (error.message && (error.message.includes('column') || error.message.includes('does not exist'))) {
              console.log('🔄 Reintentando inserción con ajuste de nombres de columnas...');
              
              // Ajustar nombres de columnas si es necesario
              const adjustedBatch = batch.map(transaction => ({
                bank_account_id: transaction.bank_account_id,
                imported_file_id: transaction.imported_file_id,
                transaction_date: transaction.transaction_date, // Asegurar que se usa el nombre correcto
                description: transaction.description,
                amount: transaction.amount,
                reference_number: transaction.reference_number, // Asegurar que se usa el nombre correcto
                status: transaction.status
              }));
              
              console.log('🔄 Primer registro ajustado:', JSON.stringify(adjustedBatch[0], null, 2));
              
              const { data: adjustedData, error: adjustedError } = await supabase
                .from('bank_transactions')
                .insert(adjustedBatch)
                .select();
                
              if (adjustedError) {
                console.error('❌ Error en segundo intento de inserción:', adjustedError);
                throw adjustedError;
              }
              
              console.log(`✅ Lote ${Math.floor(i / batchSize) + 1} importado exitosamente en segundo intento. Registros insertados: ${adjustedData?.length || 0}`);
            } else {
              throw error;
            }
          } else {
            console.log(`✅ Lote ${Math.floor(i / batchSize) + 1} importado exitosamente. Registros insertados: ${data?.length || 0}`);
          }
        } catch (batchError) {
          console.error(`❌ Error en lote ${Math.floor(i / batchSize) + 1}:`, batchError);
          
          // Si estamos en el primer lote y hay un error, detenemos todo el proceso
          if (i === 0) {
            throw batchError;
          } else {
            console.warn(`⚠️ Continuando con el siguiente lote a pesar del error en el lote ${Math.floor(i / batchSize) + 1}`);
          }
        }
      }
      
      console.log('✅ Todas las transacciones importadas exitosamente.');
    } catch (mainError) {
      console.error('❌ Error general en procesamiento de transacciones:', mainError);
      throw mainError;
    }
  },
  
  // Función auxiliar para analizar valores numéricos de diferentes formatos
  parseNumberValue(value: any): number {
    if (value === undefined || value === null || value === '') return 0;
    
    // Si ya es un número, retornarlo
    if (typeof value === 'number') return value;
    
    // Si es string, intentar convertirlo
    if (typeof value === 'string') {
      // Eliminar caracteres no numéricos excepto punto, coma y signo menos
      const cleanedValue = value.replace(/[^\d.,\-]/g, '')
        // Reemplazar coma por punto si es separador decimal
        .replace(/,(\d{1,2})(?!\d)/g, '.$1')
        // Eliminar todas las demás comas
        .replace(/,/g, '');
      
      return parseFloat(cleanedValue) || 0;
    }
    
    return 0;
  },
  
  async processAccountingEntries(records: any[], importFile: ImportedFile, columnMapping?: Record<string, string>, documentDirection?: 'emitida' | 'recibida'): Promise<void> {
    console.log('🔍 Iniciando procesamiento de registros contables');
    console.log('🔍 Total de registros a procesar:', records.length);
    console.log('🔍 Mapeo de columnas:', columnMapping);
    console.log('🔍 Cuenta bancaria asignada:', importFile.bank_account_id);
    console.log('🔍 ID del archivo importado:', importFile.id);
    console.log('🔍 Dirección de documento:', documentDirection);
    
    try {
      const entries = records.map((record, index) => {
        console.log(`🔍 Procesando registro contable ${index + 1}:`, JSON.stringify(record).substring(0, 200));
        
        // Procesar fecha con manejo de errores mejorado
        // Usar el mapeo de columnas si está disponible, de lo contrario buscar en campos comunes
        const dateColumn = columnMapping?.date;
        const dateValue = dateColumn ? record[dateColumn] : (record.date || record.fecha || record.entry_date);
        
        // IMPORTANTE: Mostrar el valor original tal como viene para diagnóstico
        console.log(`[Reg ${index + 1}] Valor original de fecha: "${dateValue}" (${typeof dateValue})`);
        
        // Usar la función normalizeDate para obtener una fecha consistente
        // Ahora normalizeDate devuelve directamente un string en formato ISO (YYYY-MM-DD)
        const fixedDateString = normalizeDate(dateValue);
        
        console.log(`📅 [Reg ${index + 1}] Fecha normalizada: ${fixedDateString}, original: ${dateValue}`);
        
        // Extraer campos según el mapeo de columnas si está disponible, o usar nombres comunes
        const documentNumber = columnMapping?.document_number ? record[columnMapping.document_number] : 
                              (record.document || record.invoice || record.folio || record.documento || '');
                              
        const vendorRut = columnMapping?.vendor_rut ? record[columnMapping.vendor_rut] : 
                          (record.rut || record.tax_id || record.identifier || '');
                          
        const vendorName = columnMapping?.vendor_name ? record[columnMapping.vendor_name] : 
                          (record.vendor || record.supplier || record.proveedor || '');
                          
        const description = columnMapping?.description ? record[columnMapping.description] : 
                            (record.description || record.concept || record.detalle || record.glosa || 'Sin descripción');
                            
        const amount = this.parseNumberValue(columnMapping?.amount ? record[columnMapping.amount] : 
                                            (record.amount || record.monto || 0));
        
        // Obtener y normalizar el tipo de documento
        const documentType = columnMapping?.document_type ? record[columnMapping.document_type] : 
                             (record.document_type || record.tipo_documento || record.tipo || 'invoice');
        
        // Asegurarse de que fixedDateString sea siempre un string
        const dateStringToUse = typeof fixedDateString === 'string' 
          ? fixedDateString 
          : new Date().toISOString().split('T')[0]; // Fallback a fecha actual
        
        // Crear objeto que coincida con la estructura real de la tabla
        return {
          company_id: importFile.company_id,
          imported_file_id: importFile.id,
          date: dateStringToUse,
          description: `${description} ${documentNumber ? `(Doc: ${documentNumber})` : ''} ${vendorName ? `(Proveedor: ${vendorName})` : ''} ${vendorRut ? `(RUT: ${vendorRut})` : ''}`,
          amount: amount,
          reference: documentNumber || '',
          status: 'pending',
          bank_account_id: importFile.bank_account_id,
          document_direction: documentDirection || 'emitida',
          document_type: normalizeDocumentType(documentType || 'invoice'),
        };
      });
      
      // Filtrar entradas inválidas
      const validEntries = entries.filter(entry => 
        entry.description && entry.amount !== undefined && entry.amount !== null
      );
      
      console.log(`🔍 Entradas contables válidas: ${validEntries.length} de ${entries.length} totales`);
      console.log('🔍 Muestra de datos a importar:', JSON.stringify(validEntries.slice(0, 2), null, 2));
      
      if (validEntries.length === 0) {
        console.warn('⚠️ No se encontraron registros contables válidos para importar.');
        return;
      }
      
      // Insertar registros en lotes
      const batchSize = 100;
      for (let i = 0; i < validEntries.length; i += batchSize) {
        console.log(`🔍 Importando lote ${Math.floor(i / batchSize) + 1} de ${Math.ceil(validEntries.length / batchSize)}`);
        
        const batch = validEntries.slice(i, i + batchSize);
        
        // Imprimir el primer registro antes de la inserción para verificar todos los campos
        if (i === 0) {
          console.log('🔍 Primer registro a insertar (completo):', JSON.stringify(batch[0], null, 2));
        }
        
        console.log('🔍 Datos del primer registro del lote:', JSON.stringify(batch[0]));
        
        const { error } = await supabase
          .from('accounting_entries')
          .insert(batch);
          
        if (error) {
          console.error('❌ Error al insertar registros contables:', error);
          throw error;
        }
        
        console.log(`✅ Lote ${Math.floor(i / batchSize) + 1} importado exitosamente.`);
      }
      
      console.log('✅ Todos los registros contables importados exitosamente.');
    } catch (error) {
      console.error('❌ Error general en procesamiento de registros contables:', error);
      throw error;
    }
  },
  
  determineTransactionType(amount: number, description: string): string {
    // Lista de valores permitidos por la restricción CHECK en la tabla bank_transactions
    const allowedTypes = ['pending', 'reconciled', 'manual', 'deposit', 'withdrawal'];
    
    // Determinar tipo basado en el monto y descripción
    let transactionType;
    
    if (amount > 0) {
      // Para montos positivos (ingresos)
      if (description.toLowerCase().includes('transferencia')) {
        transactionType = 'deposit'; 
      } else if (description.toLowerCase().includes('depósito') || description.toLowerCase().includes('deposito')) {
        transactionType = 'deposit';
      } else {
        transactionType = 'deposit'; // Por defecto, entrada positiva es un depósito
      }
    } else {
      // Para montos negativos (egresos)
      if (description.toLowerCase().includes('transferencia')) {
        transactionType = 'withdrawal';
      } else if (description.toLowerCase().includes('comisión') || description.toLowerCase().includes('comision')) {
        transactionType = 'withdrawal';
      } else if (description.toLowerCase().includes('pago')) {
        transactionType = 'withdrawal';
      } else {
        transactionType = 'withdrawal'; // Por defecto, entrada negativa es un retiro
      }
    }
    
    // Verificar que el tipo esté permitido, si no, usar 'pending'
    return allowedTypes.includes(transactionType) ? transactionType : 'pending';
  },
  
  determineDocumentType(record: any): 'invoice' | 'credit_note' | 'debit_note' | 'other' {
    const type = (record.type || record.document_type || '').toLowerCase();
    
    if (type.includes('factura') || type.includes('invoice')) return 'invoice';
    if (type.includes('nota de crédito') || type.includes('credit')) return 'credit_note';
    if (type.includes('nota de débito') || type.includes('debit')) return 'debit_note';
    
    return 'other';
  },
  
  async updateStatus(importId: string, status: ImportStatus, errorMessage?: string, rowCount?: number): Promise<void> {
    const updates: { status: ImportStatus; error_message?: string; row_count?: number } = { 
      status 
    };
    
    if (errorMessage) {
      updates.error_message = errorMessage;
    }
    
    if (rowCount !== undefined) {
      updates.row_count = rowCount;
    }
    
    const { error } = await supabase
      .from('imported_files')
      .update(updates)
      .eq('id', importId);
      
    if (error) throw error;
  },
  
  async getImports(companyId: string): Promise<ImportedFile[]> {
    const { data, error } = await supabase
      .from('imported_files')
      .select('*')
      .eq('company_id', companyId)
      .order('import_date', { ascending: false });
      
    if (error) throw error;
    return data;
  },
  
  async getImport(id: string): Promise<ImportedFile> {
    // Obtener la información básica del archivo
    const { data: importFile, error } = await supabase
      .from('imported_files')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) throw error;
    
    // Obtener los metadatos (mapeo de columnas y otros) si existen
    const { data: metadataList, error: metadataError } = await supabase
      .from('import_metadata')
      .select('metadata')
      .eq('import_id', id);
      
    // Si hay error al obtener los metadatos, registrar pero continuar
    if (metadataError) {
      console.warn('Advertencia: No se pudieron obtener los metadatos para la importación:', metadataError);
    } else if (metadataList && metadataList.length > 0) {
      // Incorporar metadatos al objeto ImportedFile
      importFile.metadata = metadataList[0].metadata;
    }
    
    console.log('🔍 Información completa del archivo recuperada:', {
      id: importFile.id,
      file_name: importFile.file_name,
      status: importFile.status,
      metadata: importFile.metadata || 'No hay metadatos disponibles'
    });
    
    return importFile;
  },
  
  async deleteImport(id: string): Promise<void> {
    // Obtener la información del archivo para eliminar también de Storage
    const { data: importFile, error: getError } = await supabase
      .from('imported_files')
      .select('file_path')
      .eq('id', id)
      .single();
      
    if (getError) throw getError;
    
    // Eliminar el registro de la base de datos
    const { error: deleteError } = await supabase
      .from('imported_files')
      .delete()
      .eq('id', id);
      
    if (deleteError) throw deleteError;
    
    // Eliminar el archivo de Storage
    if (importFile?.file_path) {
      const { error: storageError } = await supabase.storage
        .from('imports')
        .remove([importFile.file_path]);
        
      if (storageError) {
        console.error('Error al eliminar archivo de Storage:', storageError);
        // No lanzamos error aquí para no revertir la eliminación del registro
      }
    }
  },
  
  /**
   * Verifica si un registro está conciliado
   * @param recordId ID del registro
   * @param recordType Tipo de registro ('bank' o 'accounting')
   * @param importId ID opcional de la importación a la que debe pertenecer el registro
   * @returns true si está conciliado, false en caso contrario
   */
  async isRecordReconciled(recordId: string, recordType: 'bank' | 'accounting', importId?: string): Promise<boolean> {
    try {
      // Primero verificamos si el registro está realmente conciliado
      console.log(`🔍 Verificando si el registro ${recordId} está conciliado`);
      
      // Verificamos primero en la tabla de conciliaciones
      const { data: reconciliations, error: reconciliationsError } = await supabase
        .from('reconciliations')
        .select('id')
        .or(`${recordType === 'bank' ? 'bank_transaction_id' : 'accounting_entry_id'}.eq.${recordId}`)
        .limit(1);
        
      if (reconciliationsError) {
        console.error('Error al verificar conciliaciones:', reconciliationsError);
        throw reconciliationsError;
      }
      
      if (reconciliations && reconciliations.length > 0) {
        console.log(`✅ El registro ${recordId} está en una conciliación`);
        
        // Si tenemos un importId, necesitamos verificar también si el registro pertenece a esa importación
        if (importId) {
          return await this.recordBelongsToImport(recordId, recordType, importId);
        }
        
        return true;
      }
      
      // También verificamos el estado del registro
      const tableName = recordType === 'bank' ? 'bank_transactions' : 'accounting_entries';
      
      const { data: record, error: recordError } = await supabase
        .from(tableName)
        .select('status, reconciled, imported_file_id')
        .eq('id', recordId)
        .single();
        
      if (recordError) {
        console.error(`Error al verificar estado del registro ${recordType}:`, recordError);
        throw recordError;
      }
      
      if (record) {
        // Verificamos si está conciliado por el campo status o reconciled
        const isReconciled = 
          (record.status && record.status === 'reconciled') || 
          (record.reconciled === true);
          
        console.log(`${isReconciled ? '✅' : '❌'} Estado de conciliación del registro ${recordId}: ${isReconciled ? 'Conciliado' : 'No conciliado'}`);
        
        // Si está conciliado y tenemos un importId, verificar si pertenece a esa importación
        if (isReconciled && importId) {
          return record.imported_file_id === importId;
        }
        
        return isReconciled;
      }
      
      return false;
    } catch (error) {
      console.error('Error general al verificar si el registro está conciliado:', error);
      // En caso de duda, prevenimos la eliminación
      return true;
    }
  },
  
  /**
   * Verifica si un registro pertenece a una importación específica
   * @private
   */
  async recordBelongsToImport(recordId: string, recordType: 'bank' | 'accounting', importId: string): Promise<boolean> {
    console.log(`🔍 Verificando si el registro ${recordId} pertenece a la importación ${importId}`);
    const tableName = recordType === 'bank' ? 'bank_transactions' : 'accounting_entries';
    
    const { data: recordData, error: recordDataError } = await supabase
      .from(tableName)
      .select('id, imported_file_id')
      .eq('id', recordId)
      .single();
      
    if (recordDataError) {
      console.error(`Error al verificar la importación del registro ${recordId}:`, recordDataError);
      throw recordDataError;
    }
    
    const belongsToImport = !!(recordData && recordData.imported_file_id === importId);
    console.log(`${belongsToImport ? '✅' : '⚠️'} El registro ${recordId} ${belongsToImport ? 'sí' : 'no'} pertenece a la importación ${importId}${!belongsToImport && recordData ? `, pertenece a ${recordData.imported_file_id || 'ninguna'}` : ''}`);
    
    return belongsToImport;
  }
}; 