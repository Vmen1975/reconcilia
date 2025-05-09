'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { CpuChipIcon, ArrowUpTrayIcon, DocumentIcon, HomeIcon, CalculatorIcon, BuildingOfficeIcon, BanknotesIcon } from '@heroicons/react/24/outline';
import { importService } from '@/services/import';
import Link from 'next/link';
import { initStorage } from '@/lib/supabase';

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'bank' | 'accounting'>('bank');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>('');
  const [period, setPeriod] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(true);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    date: '',
    description: '',
    amount: '',
    reference: '',
    debit: '',
    credit: '',
    document_number: '',
    vendor_name: '',
    vendor_rut: '',
    document_type: ''
  });
  const [columns, setColumns] = useState<string[]>([]);
  const [documentDirection, setDocumentDirection] = useState<'emitida' | 'recibida' | ''>('');
  const [showDuplicateWarning, setShowDuplicateWarning] = useState<boolean>(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [pendingImportId, setPendingImportId] = useState<string | null>(null);
  
  const supabase = createClientComponentClient();

  // Cargar cuentas bancarias al iniciar
  useEffect(() => {
    const initialize = async () => {
      try {
        // Inicializar bucket de storage
        console.log('🔄 Inicializando storage...');
        const storageInitialized = await initStorage();
        if (!storageInitialized) {
          console.log('⚠️ No se pudo inicializar el bucket de storage');
          setError('Error al inicializar el almacenamiento de archivos. Por favor, contacte al administrador.');
        }
      } catch (error) {
        console.error('Error al inicializar:', error);
      }
    };
    
    initialize();
    
    const fetchBankAccounts = async () => {
      setLoadingAccounts(true);
      setError(null);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login');
          return;
        }
        
        // Obtener las empresas asociadas al usuario
        const { data: userCompanies, error: userCompaniesError } = await supabase
          .from('user_companies')
          .select('company_id')
          .eq('user_id', session.user.id)
          .eq('is_active', true);
        
        if (userCompaniesError) throw userCompaniesError;
        
        if (!userCompanies || userCompanies.length === 0) {
          setError('No se encontraron empresas asociadas al usuario. Debe crear y asociar una empresa para continuar.');
          setLoadingAccounts(false);
          return;
        }
        
        // Obtener los IDs de todas las empresas asociadas
        const companyIds = userCompanies.map(uc => uc.company_id);
        
        // Obtener todas las cuentas bancarias junto con la información de la empresa
        const { data: accounts, error: accountsError } = await supabase
          .from('bank_accounts')
          .select(`
            *,
            companies:company_id (
              id,
              name
            )
          `)
          .in('company_id', companyIds);
          
        if (accountsError) throw accountsError;
        
        // Transformar los datos para facilitar su uso
        const transformedAccounts = accounts?.map(account => ({
          ...account,
          company_name: account.companies?.name || 'Empresa desconocida'
        })) || [];
        
        setBankAccounts(transformedAccounts);
        if (transformedAccounts.length > 0) {
          setSelectedBankAccount(transformedAccounts[0].id);
        }
      } catch (error: any) {
        console.error('Error al cargar cuentas bancarias:', error);
        setError('Error al cargar cuentas bancarias: ' + (error.message || 'Error desconocido'));
      } finally {
        setLoadingAccounts(false);
      }
    };
    
    fetchBankAccounts();
  }, [router, supabase]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setError(null);
    
    try {
      // Generar vista previa del archivo
      const preview = await importService.generatePreview(selectedFile, fileType);
      setPreview(preview.data);
      setColumns(preview.columns);
      
      // Intentar mapeo automático de columnas
      const mapping = importService.guessColumnMapping(preview.columns, fileType);
      setColumnMapping(mapping);
    } catch (error: any) {
      console.error('Error al generar vista previa:', error);
      setError('Error al procesar el archivo. Verifique que el formato sea correcto.');
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    
    // Simular el cambio en el input para reutilizar la lógica
    const event = {
      target: {
        files: [droppedFile]
      }
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    
    handleFileChange(event);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Agregar una función de validación de tipos de documento
  const validateDocumentType = (docType: string): string => {
    if (!docType) return 'other';
    
    const type = docType.toLowerCase().trim();
    
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
  };

  const handleImport = async () => {
    setError('');
    setLoading(true);
    
    try {
      // Obtener la sesión del usuario
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('❌ No hay sesión activa');
        setError('No se ha iniciado sesión. Por favor, inicie sesión para continuar.');
        setLoading(false);
        return;
      }
      
      // Validaciones iniciales
      if (!file) {
        setError('Por favor seleccione un archivo para importar');
        setLoading(false);
        return;
      }
      
      if (fileType === 'bank' && !selectedBankAccount) {
        setError('Por favor seleccione una cuenta bancaria');
        setLoading(false);
        return;
      }
      
      if (fileType === 'accounting' && !documentDirection) {
        setError('Por favor seleccione el tipo de documento (emitido o recibido)');
        setLoading(false);
        return;
      }
      
      // Verificar mapeo de columnas para archivos bancarios
      if (fileType === 'bank') {
        const requiredFields = ['date', 'description'];
        const hasRequiredFields = requiredFields.every(field => columnMapping[field]);
        
        // Se necesita al menos un campo de monto (amount, o la combinación de debit y credit)
        const hasAmountField = columnMapping.amount || (columnMapping.debit && columnMapping.credit);
        
        if (!hasRequiredFields || !hasAmountField) {
          setError('Por favor complete el mapeo de columnas. Se requieren fecha, descripción y monto.');
          setLoading(false);
          return;
        }
      }
      
      // Verificar existencia de cuenta bancaria
      console.log('🔄 Obteniendo información de la cuenta bancaria:', selectedBankAccount);
      const { data: bankAccount, error: bankAccountError } = await supabase
        .from('bank_accounts')
        .select('*, companies:company_id(name)')
        .eq('id', selectedBankAccount)
        .single();
      
      if (bankAccountError || !bankAccount) {
        console.error('❌ Error al obtener información de la cuenta bancaria:', bankAccountError);
        setError('Error al obtener información de la cuenta bancaria');
        return;
      }
      
      if (!bankAccount.company_id) {
        console.error('❌ La cuenta bancaria no tiene empresa asociada');
        setError('No se encontró información de la empresa asociada a esta cuenta bancaria');
        return;
      }
      
      console.log('🔄 Verificando permiso del usuario para la empresa:', bankAccount.company_id);
      // Comprobar que el usuario tenga acceso a esta empresa
      const { data: userCompany, error: userCompanyError } = await supabase
        .from('user_companies')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('company_id', bankAccount.company_id)
        .single();
      
      if (userCompanyError || !userCompany) {
        console.error('❌ Error de permisos:', userCompanyError);
        setError('No tiene permiso para acceder a esta empresa');
        return;
      }
      
      // VERIFICACIÓN RADICAL: Verificar explícitamente si ya hay datos de este período para esta cuenta
      if (fileType === 'bank' && period) {
        // Extraer año y mes del período
        const [year, month] = period.split('-');
        
        if (year && month) {
          const startDate = `${year}-${month}-01`;
          const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
          const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
          const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
          
          // Consultar si hay registros de ese período
          const { count, error: countError } = await supabase
            .from('bank_transactions')
            .select('*', { count: 'exact', head: true })
            .eq('bank_account_id', selectedBankAccount)
            .gte('transaction_date', startDate)
            .lt('transaction_date', endDate);
          
          console.log(`🚨 VERIFICACIÓN EXPLÍCITA: ${count} registros encontrados para el período ${period}`);
          
          if (countError) {
            console.error('❌ Error al verificar registros existentes:', countError);
          } else if (count && count > 0) {
            // IMPORTANTE: Aquí ya hay registros, mostrar alerta al usuario
            console.log('🚨 SE DETECTARON REGISTROS EXISTENTES PARA ESTE PERÍODO');
            
            // Configurar información de duplicados para mostrar alerta
            setDuplicateInfo({
              hasDuplicates: true,
              duplicateCount: count,
              sampleDuplicates: [],
              totalRecords: 21, // Asumimos que hay 21 en promedio
              messageOverride: `Se encontraron ${count} registros ya cargados para el período ${period}. Si continúa con la importación, podría duplicar estos datos.`
            });
            setPendingImportId('verificación-manual'); // Valor temporal
            setShowDuplicateWarning(true);
            setLoading(false);
            return;
          }
        }
      }
      
      // VERIFICACIÓN RADICAL para registros contables
      if (fileType === 'accounting' && period) {
        // Extraer año y mes del período
        const [year, month] = period.split('-');
        
        if (year && month) {
          const startDate = `${year}-${month}-01`;
          const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
          const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
          const endDate = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;
          
          // Consultar si hay registros de ese período
          const { count, error: countError } = await supabase
            .from('accounting_entries')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', bankAccount.company_id)
            .eq('document_direction', documentDirection || 'emitida')
            .gte('date', startDate)
            .lt('date', endDate);
          
          console.log(`🚨 VERIFICACIÓN EXPLÍCITA CONTABLE: ${count} registros encontrados para el período ${period}`);
          
          if (countError) {
            console.error('❌ Error al verificar registros contables existentes:', countError);
          } else if (count && count > 0) {
            // IMPORTANTE: Aquí ya hay registros, mostrar alerta al usuario
            console.log('🚨 SE DETECTARON REGISTROS CONTABLES EXISTENTES PARA ESTE PERÍODO');
            
            // Configurar información de duplicados para mostrar alerta
            setDuplicateInfo({
              hasDuplicates: true,
              duplicateCount: count,
              sampleDuplicates: [],
              totalRecords: 21, // Asumimos que hay 21 en promedio
              messageOverride: `Se encontraron ${count} registros contables ya cargados para el período ${period} con dirección "${documentDirection}". Si continúa con la importación, podría duplicar estos datos.`
            });
            setPendingImportId('verificación-manual'); // Valor temporal
            setShowDuplicateWarning(true);
            setLoading(false);
            return;
          }
        }
      }
      
      console.log('🔄 Subiendo archivo para importación');
      // Subir archivo con verificación de duplicados activada por defecto
      const importResult = await importService.uploadFile(file, {
        fileType,
        bankAccountId: selectedBankAccount,
        columnMapping,
        period,
        ...(fileType === 'accounting' && documentDirection ? { documentDirection } : {}),
        companyId: bankAccount.company_id,
        checkDuplicates: true // Activar verificación de duplicados siempre
      });
      
      console.log('🔄 Resultado de importación:', typeof importResult === 'string' ? 'ID simple' : 'Objeto complejo con duplicados');
      
      // Si llegamos aquí y es un objeto con duplicateCheck, aún verificamos para mayor seguridad
      if (typeof importResult !== 'string' && importResult.duplicateCheck) {
        console.log('🔄 Duplicados detectados:', importResult.duplicateCheck);
        
        // Verificar explícitamente si hay duplicados
        const hasDuplicates = importResult.duplicateCheck.hasDuplicates === true || 
                            (importResult.duplicateCheck.duplicateCount && importResult.duplicateCheck.duplicateCount > 0);
        
        if (hasDuplicates) {
          // Guardar la información de duplicados y mostrar alerta
          console.log('🔄 Mostrando alerta de duplicados para confirmación de usuario');
          // Si hay un mensaje personalizado, usarlo
          if (importResult.duplicateCheck.messageOverride) {
            setDuplicateInfo({
              ...importResult.duplicateCheck,
              messageOverride: importResult.duplicateCheck.messageOverride
            });
          } else {
            setDuplicateInfo(importResult.duplicateCheck);
          }
          setPendingImportId(importResult.id);
          setShowDuplicateWarning(true);
          setLoading(false);
          return;
        } else {
          console.log('🔄 No se encontraron duplicados a pesar de recibir objeto duplicateCheck');
        }
      }
      
      // Si no hay duplicados, proceder con el procesamiento normal
      const fileId = typeof importResult === 'string' ? importResult : importResult.id;
      
      console.log('✅ Archivo subido exitosamente, ID:', fileId);
      
      console.log('🔄 Procesando archivo para importación');
      // Procesar archivo
      await importService.processFile(fileId, fileType === 'accounting' && documentDirection ? documentDirection : undefined);
      
      console.log('✅ Archivo procesado exitosamente, redirigiendo a conciliación');
      router.push('/dashboard/reconciliation');
    } catch (error: any) {
      console.error('❌ Error general en importación:', error);
      // Manejar el error específico de la columna company_id
      if (error.message && error.message.includes('company_id')) {
        setError('Error de estructura en la base de datos: La tabla de registros contables requiere actualización. Por favor, contacte al administrador del sistema para ejecutar la migración necesaria.');
      } else {
        setError('Error al importar el archivo: ' + (error.message || 'Error desconocido'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Función para procesar el archivo pendiente cuando el usuario decide continuar a pesar de duplicados
  const handleProceedWithDuplicates = async () => {
    setLoading(true);
    try {
      // Caso especial para nuestra verificación manual
      if (pendingImportId === 'verificación-manual') {
        console.log('🔄 Procediendo con importación después de verificación manual de duplicados');
        
        // Subir el archivo directamente aquí, sin verificación adicional de duplicados
        // ya que el usuario ha confirmado que quiere continuar a pesar de la advertencia
        if (file && selectedBankAccount) {
          // Obtener info de la cuenta bancaria para el company_id
          const { data: bankAccount } = await supabase
            .from('bank_accounts')
            .select('company_id')
            .eq('id', selectedBankAccount)
            .single();
          
          if (!bankAccount || !bankAccount.company_id) {
            throw new Error('No se pudo obtener la información de la cuenta bancaria');
          }
          
          // Subir archivo sin verificación de duplicados
          const importResult = await importService.uploadFile(file, {
            fileType,
            bankAccountId: selectedBankAccount,
            columnMapping,
            period,
            ...(fileType === 'accounting' && documentDirection ? { documentDirection } : {}),
            companyId: bankAccount.company_id,
            skipDuplicateCheck: true // Usar el nuevo flag para saltar completamente la verificación
          });
          
          const fileId = typeof importResult === 'string' ? importResult : importResult.id;
          
          // Procesar archivo
          await importService.processFile(
            fileId, 
            fileType === 'accounting' && documentDirection ? documentDirection : undefined
          );
          
          console.log('✅ Archivo procesado exitosamente a pesar de posibles duplicados');
          router.push('/dashboard/reconciliation');
        } else {
          throw new Error('Faltan datos para proceder con la importación');
        }
      } else if (!pendingImportId) {
        setError('ID de importación no válido');
        setLoading(false);
        return;
      } else {
        // Caso normal, hay un ID de importación pendiente que procesar
        await importService.processFile(
          pendingImportId, 
          fileType === 'accounting' && documentDirection ? documentDirection : undefined
        );
        
        console.log('✅ Archivo procesado exitosamente a pesar de duplicados, redirigiendo a conciliación');
        router.push('/dashboard/reconciliation');
      }
    } catch (error: any) {
      console.error('❌ Error al procesar archivo con duplicados:', error);
      setError('Error al procesar el archivo: ' + (error.message || 'Error desconocido'));
    } finally {
      setLoading(false);
      setShowDuplicateWarning(false);
    }
  };

  // Función para cancelar la importación de archivos con duplicados
  const handleCancelDuplicateImport = async () => {
    // Solo intentar eliminar si hay un ID válido (que no sea nuestro marcador especial)
    if (pendingImportId && pendingImportId !== 'verificación-manual') {
      try {
        // Eliminar el registro de importación pendiente
        await importService.deleteImport(pendingImportId);
        console.log('✅ Importación cancelada y archivo eliminado');
      } catch (error) {
        console.error('❌ Error al eliminar importación pendiente:', error);
      }
    } else {
      console.log('✅ Cancelación de verificación de duplicados (sin registro a eliminar)');
    }
    
    // Limpiar el estado independientemente de si se eliminó el registro o no
    setPendingImportId(null);
    setDuplicateInfo(null);
    setShowDuplicateWarning(false);
  };

  // En el componente o función que maneja el mapeo de columnas, agregar una ayuda especial para document_type
  const renderColumnMappingHelp = (columnKey: string) => {
    if (columnKey === 'document_type') {
      return (
        <div className="mt-1 text-xs text-blue-600">
          <p>Importante: Mapee la columna que indica si el documento es Factura o Nota de Crédito.</p>
          <p>Valores comunes: "Factura", "NC", "Nota de Crédito", etc.</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Barra de navegación lateral */}
      <div className="fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-10 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-indigo-600">Reconcilia</h2>
        </div>
        <nav className="mt-4">
          <ul className="space-y-2 px-4">
            <li>
              <Link 
                href="/dashboard" 
                className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 hover:text-indigo-600"
              >
                <HomeIcon className="mr-3 h-5 w-5 text-gray-400" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link 
                href="/dashboard/reconciliation" 
                className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-indigo-600 bg-indigo-50"
              >
                <CalculatorIcon className="mr-3 h-5 w-5 text-indigo-500" />
                Conciliación
              </Link>
            </li>
            <li>
              <Link 
                href="/dashboard/companies" 
                className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 hover:text-indigo-600"
              >
                <BuildingOfficeIcon className="mr-3 h-5 w-5 text-gray-400" />
                Empresas
              </Link>
            </li>
            <li>
              <Link 
                href="/dashboard/bank-accounts" 
                className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 hover:text-indigo-600"
              >
                <BanknotesIcon className="mr-3 h-5 w-5 text-gray-400" />
                Cuentas Bancarias
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* Contenido principal con margen para la barra lateral */}
      <div className="pl-64">
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Importar Archivo
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Sube un archivo de extracto bancario o registros contables para iniciar la conciliación
              </p>
            </div>
            <button
              onClick={() => router.push('/dashboard/reconciliation')}
              className="mt-4 md:mt-0 ml-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Volver a conciliación
            </button>
            <Link
              href="/dashboard/reconciliation/gestion-imports"
              className="mt-4 md:mt-0 ml-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Gestión de Imports
            </Link>
            {fileType === 'bank' && (
              <Link
                href="/dashboard/reconciliation/bank"
                className="mt-4 md:mt-0 ml-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Ver extractos bancarios
              </Link>
            )}
            {fileType === 'accounting' && (
              <Link
                href="/dashboard/reconciliation/accounting"
                className="mt-4 md:mt-0 ml-3 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Ver registros contables
              </Link>
            )}
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="space-y-8">
                {/* Tipo de archivo */}
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Tipo de archivo</h3>
                  <div className="mt-4 space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        className="form-radio"
                        name="fileType"
                        value="bank"
                        checked={fileType === 'bank'}
                        onChange={() => setFileType('bank')}
                      />
                      <span className="ml-2">Extracto bancario</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        className="form-radio"
                        name="fileType"
                        value="accounting"
                        checked={fileType === 'accounting'}
                        onChange={() => setFileType('accounting')}
                      />
                      <span className="ml-2">Registros contables</span>
                    </label>
                  </div>
                </div>

                {/* Cuenta bancaria y período */}
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="bank-account" className="block text-sm font-medium text-gray-700">
                      Cuenta bancaria
                    </label>
                    {loadingAccounts ? (
                      <div className="mt-1 flex items-center text-sm text-gray-500">
                        <CpuChipIcon className="animate-spin h-4 w-4 mr-2" />
                        Cargando cuentas...
                      </div>
                    ) : (
                      <select
                        id="bank-account"
                        name="bank-account"
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        value={selectedBankAccount}
                        onChange={(e) => setSelectedBankAccount(e.target.value)}
                        disabled={bankAccounts.length === 0}
                      >
                        {bankAccounts.length === 0 ? (
                          <option>No hay cuentas disponibles</option>
                        ) : (
                          bankAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.company_name}: {account.name ? `${account.name} - ` : ''}{account.bank_name} - {account.account_number}
                            </option>
                          ))
                        )}
                      </select>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="period" className="block text-sm font-medium text-gray-700">
                      Período
                    </label>
                    <input
                      type="month"
                      id="period"
                      name="period"
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                    />
                  </div>
                </div>

                {/* Justo después de la selección de tipo de archivo y antes del input de archivo, mostrar el selector si fileType === 'accounting' */}
                {fileType === 'accounting' && (
                  <div className="mt-4">
                    <label htmlFor="documentDirection" className="block text-sm font-medium text-gray-700">
                      Tipo de Documento
                    </label>
                    <select
                      id="documentDirection"
                      name="documentDirection"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      value={documentDirection}
                      onChange={e => setDocumentDirection(e.target.value as 'emitida' | 'recibida' | '')}
                      required
                    >
                      <option value="">Selecciona tipo de documento</option>
                      <option value="emitida">Documentos Emitidos (Ventas)</option>
                      <option value="recibida">Documentos Recibidos (Compras)</option>
                    </select>
                  </div>
                )}

                {/* Área de carga de archivos */}
                <div
                  className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="space-y-1 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                      >
                        <span>Seleccionar archivo</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          accept=".csv,.xls,.xlsx"
                          onChange={handleFileChange}
                          ref={fileInputRef}
                        />
                      </label>
                      <p className="pl-1">o arrastre y suelte</p>
                    </div>
                    <p className="text-xs text-gray-500">CSV, Excel (.xls, .xlsx)</p>
                    {file && (
                      <p className="text-sm text-indigo-600 mt-2">
                        <DocumentIcon className="inline-block h-5 w-5 mr-1" />
                        {file.name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Vista previa */}
                {preview && preview.length > 0 && (
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Vista previa</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            {columns.map((column, index) => (
                              <th
                                key={index}
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                              >
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {preview.slice(0, 5).map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {columns.map((column, colIndex) => (
                                <td
                                  key={colIndex}
                                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                >
                                  {row[column]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Mapeo de columnas (extractos bancarios) */}
                {file && fileType === 'bank' && columns.length > 0 && (
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Mapeo de columnas</h3>
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="date-column" className="block text-sm font-medium text-gray-700">
                          Fecha
                        </label>
                        <select
                          id="date-column"
                          name="date-column"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          value={columnMapping.date}
                          onChange={(e) => setColumnMapping({...columnMapping, date: e.target.value})}
                        >
                          <option value="">Seleccionar columna</option>
                          {columns.map((column, index) => (
                            <option key={index} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="description-column" className="block text-sm font-medium text-gray-700">
                          Descripción
                        </label>
                        <select
                          id="description-column"
                          name="description-column"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          value={columnMapping.description}
                          onChange={(e) => setColumnMapping({...columnMapping, description: e.target.value})}
                        >
                          <option value="">Seleccionar columna</option>
                          {columns.map((column, index) => (
                            <option key={index} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="amount-column" className="block text-sm font-medium text-gray-700">
                          Monto
                        </label>
                        <select
                          id="amount-column"
                          name="amount-column"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          value={columnMapping.amount}
                          onChange={(e) => setColumnMapping({...columnMapping, amount: e.target.value})}
                        >
                          <option value="">Seleccionar columna</option>
                          {columns.map((column, index) => (
                            <option key={index} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="debit-column" className="block text-sm font-medium text-gray-700">
                          Cargos (Débito)
                        </label>
                        <select
                          id="debit-column"
                          name="debit-column"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          value={columnMapping.debit}
                          onChange={(e) => setColumnMapping({...columnMapping, debit: e.target.value})}
                        >
                          <option value="">Seleccionar columna</option>
                          {columns.map((column, index) => (
                            <option key={index} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">Campo para valores de cargo/débito (e.g. "Cargos (CLP)")</p>
                      </div>

                      <div>
                        <label htmlFor="credit-column" className="block text-sm font-medium text-gray-700">
                          Abonos (Crédito)
                        </label>
                        <select
                          id="credit-column"
                          name="credit-column"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          value={columnMapping.credit}
                          onChange={(e) => setColumnMapping({...columnMapping, credit: e.target.value})}
                        >
                          <option value="">Seleccionar columna</option>
                          {columns.map((column, index) => (
                            <option key={index} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">Campo para valores de abono/crédito (e.g. "Abonos (CLP)")</p>
                      </div>
                      
                      <div>
                        <label htmlFor="reference-column" className="block text-sm font-medium text-gray-700">
                          Referencia
                        </label>
                        <select
                          id="reference-column"
                          name="reference-column"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          value={columnMapping.reference}
                          onChange={(e) => setColumnMapping({...columnMapping, reference: e.target.value})}
                        >
                          <option value="">Seleccionar columna</option>
                          {columns.map((column, index) => (
                            <option key={index} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mapeo de columnas para registros contables */}
                {file && fileType === 'accounting' && columns.length > 0 && (
                  <div>
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Mapeo de columnas</h3>
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="date-column-acc" className="block text-sm font-medium text-gray-700">
                          Fecha
                        </label>
                        <select
                          id="date-column-acc"
                          name="date-column-acc"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          value={columnMapping.date}
                          onChange={(e) => setColumnMapping({...columnMapping, date: e.target.value})}
                        >
                          <option value="">Seleccionar columna</option>
                          {columns.map((column, index) => (
                            <option key={index} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="description-column-acc" className="block text-sm font-medium text-gray-700">
                          Descripción
                        </label>
                        <select
                          id="description-column-acc"
                          name="description-column-acc"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          value={columnMapping.description}
                          onChange={(e) => setColumnMapping({...columnMapping, description: e.target.value})}
                        >
                          <option value="">Seleccionar columna</option>
                          {columns.map((column, index) => (
                            <option key={index} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="amount-column-acc" className="block text-sm font-medium text-gray-700">
                          Monto
                        </label>
                        <select
                          id="amount-column-acc"
                          name="amount-column-acc"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          value={columnMapping.amount}
                          onChange={(e) => setColumnMapping({...columnMapping, amount: e.target.value})}
                        >
                          <option value="">Seleccionar columna</option>
                          {columns.map((column, index) => (
                            <option key={index} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="document-number-column" className="block text-sm font-medium text-gray-700">
                          Número de Documento
                        </label>
                        <select
                          id="document-number-column"
                          name="document-number-column"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          value={columnMapping.document_number}
                          onChange={(e) => setColumnMapping({...columnMapping, document_number: e.target.value})}
                        >
                          <option value="">Seleccionar columna</option>
                          {columns.map((column, index) => (
                            <option key={index} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="vendor-name-column" className="block text-sm font-medium text-gray-700">
                          Nombre del Proveedor
                        </label>
                        <select
                          id="vendor-name-column"
                          name="vendor-name-column"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          value={columnMapping.vendor_name}
                          onChange={(e) => setColumnMapping({...columnMapping, vendor_name: e.target.value})}
                        >
                          <option value="">Seleccionar columna</option>
                          {columns.map((column, index) => (
                            <option key={index} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="vendor-rut-column" className="block text-sm font-medium text-gray-700">
                          RUT del Proveedor
                        </label>
                        <select
                          id="vendor-rut-column"
                          name="vendor-rut-column"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          value={columnMapping.vendor_rut}
                          onChange={(e) => setColumnMapping({...columnMapping, vendor_rut: e.target.value})}
                        >
                          <option value="">Seleccionar columna</option>
                          {columns.map((column, index) => (
                            <option key={index} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="document-type-column" className="block text-sm font-medium text-gray-700">
                          Tipo de Documento
                        </label>
                        <select
                          id="document-type-column"
                          name="document-type-column"
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                          value={columnMapping.document_type}
                          onChange={(e) => setColumnMapping({...columnMapping, document_type: e.target.value})}
                        >
                          <option value="">Seleccionar columna</option>
                          {columns.map((column, index) => (
                            <option key={index} value={column}>
                              {column}
                            </option>
                          ))}
                        </select>
                        {renderColumnMappingHelp('document_type')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Alerta de duplicados */}
                {showDuplicateWarning && duplicateInfo && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                      <h3 className="text-lg font-bold text-red-600 mb-4">
                        ⚠️ Advertencia: Se detectaron posibles duplicados
                      </h3>
                      
                      {duplicateInfo.messageOverride ? (
                        <p className="mb-4 text-red-600 font-semibold">{duplicateInfo.messageOverride}</p>
                      ) : (
                        <p className="mb-4">
                          Se han detectado <strong className="text-red-600">{duplicateInfo.duplicateCount}</strong> registros que parecen estar duplicados 
                          de {duplicateInfo.totalRecords} en total.
                        </p>
                      )}
                      
                      <p className="mb-4">
                        Estos registros pueden ya existir en la base de datos. Continuar con la importación 
                        podría resultar en datos duplicados.
                      </p>
                      
                      {duplicateInfo.sampleDuplicates && duplicateInfo.sampleDuplicates.length > 0 && (
                        <div className="mb-4">
                          <h4 className="font-bold mb-2">Ejemplos de posibles duplicados:</h4>
                          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md p-3 bg-gray-50">
                            {duplicateInfo.sampleDuplicates.map((duplicate: any, index: number) => (
                              <div key={index} className="mb-3 pb-3 border-b border-gray-200 last:border-0">
                                <p className="text-sm"><strong>Registro #{duplicate.index + 1}:</strong></p>
                                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto my-1">
                                  {JSON.stringify(duplicate.record, null, 2)}
                                </pre>
                                {duplicate.existing && (
                                  <>
                                    <p className="text-sm mt-2"><strong>Coincide con registro existente:</strong></p>
                                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto my-1">
                                      {JSON.stringify(duplicate.existing, null, 2)}
                                    </pre>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex justify-end space-x-4 mt-6">
                        <button
                          onClick={handleCancelDuplicateImport}
                          className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
                        >
                          Cancelar importación
                        </button>
                        <button
                          onClick={handleProceedWithDuplicates}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                          Continuar de todos modos
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mensaje de error */}
                {error && (
                  <div className="rounded-md bg-red-50 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-5 w-5 text-red-400"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">{error}</h3>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botones de acción */}
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    onClick={() => router.push('/dashboard/reconciliation')}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    onClick={handleImport}
                    disabled={loading || !file || bankAccounts.length === 0}
                  >
                    {loading ? (
                      <>
                        <CpuChipIcon className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <ArrowUpTrayIcon className="-ml-1 mr-2 h-5 w-5" />
                        Importar datos
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 