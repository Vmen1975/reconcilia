'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { formatDate } from '@/utils/format';
import Link from 'next/link';
import { 
  HomeIcon, 
  ArrowLeftIcon, 
  TrashIcon, 
  DocumentTextIcon,
  ExclamationCircleIcon,
  FolderIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalculatorIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
import { importService } from '@/services/import';

export default function GestionImportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const importId = searchParams?.get('id');
  const importType = searchParams?.get('type') as 'bank' | 'accounting';
  
  // Estado para la lista de importaciones
  const [importedFiles, setImportedFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  
  // Estado para los detalles de una importación específica
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Estado para la eliminación
  const [showDeleteFileModal, setShowDeleteFileModal] = useState(false);
  const [deleteWithRecords, setDeleteWithRecords] = useState(true);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [deleteResults, setDeleteResults] = useState<{
    deleted: string[],
    notDeleted: {id: string, reason: string}[]
  } | null>(null);
  const [reconciledRecordsError, setReconciledRecordsError] = useState<{message: string, recordIds: string[]} | null>(null);
  
  // Estado para rastrear las importaciones con registros conciliados
  const [importsWithReconciledRecords, setImportsWithReconciledRecords] = useState<Set<string>>(new Set());
  
  const pageSize = 50;
  const supabase = createClientComponentClient();
  
  // Cargar empresas cuando se monta el componente
  useEffect(() => {
    loadCompanies();
  }, []);
  
  // Cargar importaciones cuando se selecciona una empresa
  useEffect(() => {
    if (selectedCompany) {
      loadImportedFiles(selectedCompany);
    }
  }, [selectedCompany]);
  
  // Cargar registros cuando se selecciona un archivo o cambia la página
  useEffect(() => {
    if (importId && importType) {
      loadRecords(1);
      loadImportInfo(importId);
    }
  }, [importId, importType]);
  
  const loadCompanies = async () => {
    try {
      // Obtener la sesión actual para validar el usuario
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;
      
      if (!session) {
        router.push('/login');
        return;
      }
      
      // Obtener empresas asociadas al usuario
      const { data: userCompanies, error: userCompaniesError } = await supabase
        .from('user_companies')
        .select(`
          *,
          companies:company_id (
            id,
            name,
            rut
          )
        `)
        .eq('user_id', session.user.id)
        .eq('is_active', true);
        
      if (userCompaniesError) throw userCompaniesError;
      
      if (!userCompanies || userCompanies.length === 0) {
        setError('No tienes empresas asociadas. Por favor, crea una empresa primero.');
        setLoading(false);
        return;
      }
      
      // Transformar los datos
      const transformedCompanies = userCompanies.map(uc => ({
        id: uc.company_id,
        name: uc.companies?.name || 'Empresa sin nombre',
        rut: uc.companies?.rut || ''
      }));
      
      setCompanies(transformedCompanies);
      
      // Seleccionar la primera empresa por defecto
      if (transformedCompanies.length > 0) {
        setSelectedCompany(transformedCompanies[0].id);
      }
    } catch (error: any) {
      console.error('Error al cargar empresas:', error);
      setError('Error al cargar empresas: ' + (error.message || 'Error desconocido'));
    }
  };
  
  const loadImportedFiles = async (companyId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Obtener todas las importaciones de la empresa
      const { data, error } = await supabase
        .from('imported_files')
        .select(`
          *,
          bank_accounts (
            name,
            bank_name,
            account_number
          )
        `)
        .eq('company_id', companyId)
        .order('import_date', { ascending: false });
      
      if (error) throw error;
      
      setImportedFiles(data || []);
      
      // Verificar qué imports tienen registros conciliados
      await checkImportsWithReconciledRecords(data || []);
    } catch (error: any) {
      console.error('Error al cargar archivos importados:', error);
      setError('Error al cargar archivos importados: ' + (error.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };
  
  // Función para verificar qué imports tienen registros conciliados
  const checkImportsWithReconciledRecords = async (imports: any[]) => {
    try {
      const reconciledSet = new Set<string>();
      
      for (const imp of imports) {
        const tableName = imp.file_type === 'bank' ? 'bank_transactions' : 'accounting_entries';
        
        // Verificar registros con status='reconciled'
        try {
          const { count: countStatus, error: errorStatus } = await supabase
            .from(tableName)
            .select('id', { count: 'exact' })
            .eq('imported_file_id', imp.id)
            .eq('status', 'reconciled');
            
          if (errorStatus) {
            console.error(`Error al verificar registros con status=reconciled para importación ${imp.id}:`, errorStatus);
          } else if (countStatus && countStatus > 0) {
            reconciledSet.add(imp.id);
            continue; // Si ya encontramos registros conciliados, no es necesario seguir verificando
          }
        } catch (err) {
          console.error(`Error al consultar status=reconciled en ${tableName}:`, err);
        }
        
        // Solo verificar reconciled=true para bank_transactions (porque accounting_entries no tiene esta columna)
        if (imp.file_type === 'bank') {
          try {
            const { count: countReconciled, error: errorReconciled } = await supabase
              .from(tableName)
              .select('id', { count: 'exact' })
              .eq('imported_file_id', imp.id)
              .eq('reconciled', true);
              
            if (errorReconciled) {
              console.error(`Error al verificar registros con reconciled=true para importación ${imp.id}:`, errorReconciled);
            } else if (countReconciled && countReconciled > 0) {
              reconciledSet.add(imp.id);
            }
          } catch (err) {
            console.error(`Error al consultar reconciled=true en ${tableName}:`, err);
          }
        }
      }
      
      setImportsWithReconciledRecords(reconciledSet);
    } catch (error: any) {
      console.error('Error al verificar importaciones con registros conciliados:', error);
    }
  };
  
  const loadImportInfo = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('imported_files')
        .select(`
          *,
          bank_accounts (
            name,
            bank_name,
            account_number
          )
        `)
        .eq('id', id)
        .single();
        
      if (error) throw error;
      
      setSelectedFile(data);
    } catch (error: any) {
      console.error('Error al cargar información de importación:', error);
      setError('Error al cargar información de importación: ' + (error.message || 'Error desconocido'));
    }
  };
  
  const loadRecords = async (page: number) => {
    if (!importId || !importType) return;
    
    setLoadingRecords(true);
    setError(null);
    
    try {
      console.log(`Cargando registros de importación: ${importId}, página ${page}, tipo ${importType}`);
      
      const tableName = importType === 'bank' ? 'bank_transactions' : 'accounting_entries';
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      // Realizar consulta directa para evitar problemas de rendimiento
      const query = supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .eq('imported_file_id', importId)
        .range(from, to);
        
      // Ordenar según el tipo de registro
      if (importType === 'bank') {
        query.order('transaction_date', { ascending: false });
      } else {
        query.order('date', { ascending: false });
      }
      
      const { data, count, error } = await query;
      
      if (error) {
        console.error(`Error al cargar registros: ${error.message}`);
        throw error;
      }
      
      console.log(`Registros cargados: ${data?.length || 0} de ${count || 0}`);
      
      setRecords(data || []);
      setTotalRecords(count || 0);
      setTotalPages(Math.ceil((count || 0) / pageSize));
      setCurrentPage(page);
    } catch (error: any) {
      console.error('Error al cargar registros:', error);
      setError('Error al cargar registros: ' + (error.message || 'Error desconocido'));
    } finally {
      setLoadingRecords(false);
    }
  };
  
  const handleDeleteImport = async () => {
    if (!selectedFile) return;
    
    setError(null);
    setReconciledRecordsError(null);
    setDeleteInProgress(true);
    setShowDeleteFileModal(false); // Cerrar modal inmediatamente
    
    // Usar requestAnimationFrame para asegurar que la UI se actualice
    requestAnimationFrame(async () => {
      try {
        const importId = selectedFile.id;
        const fileType = selectedFile.file_type;
        
        if (deleteWithRecords) {
          console.log('🗑️ Verificando si hay registros conciliados antes de eliminar la importación:', importId);
          
          // Verificar si hay registros conciliados
          const tableName = fileType === 'bank' ? 'bank_transactions' : 'accounting_entries';
          
          let reconciledRecords: {id: string}[] = [];
          
          // Verificar por status = 'reconciled'
          try {
            const { data: reconciledByStatus, error: statusError } = await supabase
              .from(tableName)
              .select('id')
              .eq('imported_file_id', importId)
              .eq('status', 'reconciled');
              
            if (statusError) {
              console.error('❌ Error al verificar registros con status=reconciled:', statusError);
            } else if (reconciledByStatus && reconciledByStatus.length > 0) {
              reconciledRecords = [...reconciledByStatus];
            }
          } catch (err) {
            console.error('❌ Error al consultar status=reconciled:', err);
          }
          
          // Solo verificar reconciled=true para bank_transactions
          if (fileType === 'bank') {
            try {
              const { data: reconciledByFlag, error: reconciledError } = await supabase
                .from(tableName)
                .select('id')
                .eq('imported_file_id', importId)
                .eq('reconciled', true);
                
              if (reconciledError) {
                console.error('❌ Error al verificar registros con reconciled=true:', reconciledError);
              } else if (reconciledByFlag && reconciledByFlag.length > 0) {
                // Añadir los IDs que no estén ya en reconciledRecords
                const existingIds = new Set(reconciledRecords.map(r => r.id));
                for (const rec of reconciledByFlag) {
                  if (!existingIds.has(rec.id)) {
                    reconciledRecords.push(rec);
                  }
                }
              }
            } catch (err) {
              console.error('❌ Error al consultar reconciled=true:', err);
            }
          }
          
          // Si hay registros conciliados, no permitir eliminar
          if (reconciledRecords.length > 0) {
            console.error(`❌ No se puede eliminar una importación con registros conciliados (${reconciledRecords.length} registros)`);
            setReconciledRecordsError({
              message: `No se puede eliminar la importación porque contiene ${reconciledRecords.length} registros conciliados. Debe desconciliar estos registros primero.`,
              recordIds: reconciledRecords.map(r => r.id)
            });
            
            // Volver a mostrar el modal con el error
            setTimeout(() => {
              setShowDeleteFileModal(true);
            }, 500);
            
            return;
          }
          
          console.log('🗑️ Eliminando registros relacionados a la importación:', importId);
          
          // Eliminar registros relacionados (ahora sabemos que ninguno está conciliado)
          if (fileType === 'bank') {
            const { error: bankError } = await supabase
              .from('bank_transactions')
              .delete()
              .eq('imported_file_id', importId);
              
            if (bankError) {
              console.error('❌ Error al eliminar transacciones bancarias:', bankError);
              throw bankError;
            }
            console.log('✅ Transacciones bancarias eliminadas correctamente');
          } else if (fileType === 'accounting') {
            const { error: accountingError } = await supabase
              .from('accounting_entries')
              .delete()
              .eq('imported_file_id', importId);
              
            if (accountingError) {
              console.error('❌ Error al eliminar registros contables:', accountingError);
              throw accountingError;
            }
            console.log('✅ Registros contables eliminados correctamente');
          }
        }
        
        // Eliminar metadatos asociados
        const { error: metadataError } = await supabase
          .from('import_metadata')
          .delete()
          .eq('import_id', importId);
          
        if (metadataError) {
          console.warn('⚠️ Advertencia al eliminar metadatos:', metadataError);
        }
        
        // Obtener información del archivo para eliminarlo del storage
        const filePath = selectedFile.file_path;
        if (filePath) {
          const { error: storageError } = await supabase.storage
            .from('imports')
            .remove([filePath]);
            
          if (storageError) {
            console.warn('⚠️ Advertencia al eliminar archivo físico:', storageError);
          } else {
            console.log('✅ Archivo físico eliminado correctamente');
          }
        }
        
        // Por último, eliminar el registro de la importación
        const { error: importError } = await supabase
          .from('imported_files')
          .delete()
          .eq('id', importId);
          
        if (importError) {
          console.error('❌ Error al eliminar registro de importación:', importError);
          throw importError;
        }
        
        console.log('✅ Importación eliminada completamente');
        
        // Recargar la lista
        if (selectedCompany) {
          await loadImportedFiles(selectedCompany);
        }
        
        // Volver a la vista de lista
        router.push('/dashboard/reconciliation/gestion-imports');
        
        setSelectedFile(null);
      } catch (error: any) {
        console.error('Error al eliminar importación:', error);
        setError('Error al eliminar importación: ' + (error.message || 'Error desconocido'));
        
        // Si hay un error, volver a mostrar el diálogo con la información del error
        setTimeout(() => {
          setShowDeleteFileModal(true);
        }, 500);
      } finally {
        // Asegurar que deleteInProgress se restablezca incluso si hay un error
        setTimeout(() => {
          setDeleteInProgress(false);
        }, 300);
      }
    });
  };
  
  // Función para eliminar un registro individual
  const handleDeleteSingleRecord = async (recordId: string) => {
    if (!importId || !importType || deleteInProgress) return;
    
    try {
      setDeleteInProgress(true);
      setError(null);
      
      console.log(`%c🗑️ Eliminando registro individual: ${recordId}`, 'color: #ff5722; font-weight: bold;');
      
      const tableName = importType === 'bank' ? 'bank_transactions' : 'accounting_entries';
      
      // Verificar si el registro está conciliado
      let isReconciled = false;
      
      try {
        // Para accounting_entries solo verificamos el status
        if (importType === 'accounting') {
          const { data: recordData, error: recordError } = await supabase
            .from(tableName)
            .select('status')
            .eq('id', recordId)
            .single();
            
          if (recordError) {
            console.error(`%c❌ Error al verificar estado del registro: ${recordError.message}`, 'color: #f44336; font-weight: bold;');
            setError(`Error al verificar estado del registro: ${recordError.message}`);
            return;
          }
          
          isReconciled = recordData.status === 'reconciled';
        } 
        // Para bank_transactions verificamos tanto status como reconciled
        else {
          const { data: recordData, error: recordError } = await supabase
            .from(tableName)
            .select('status, reconciled')
            .eq('id', recordId)
            .single();
            
          if (recordError) {
            console.error(`%c❌ Error al verificar estado del registro: ${recordError.message}`, 'color: #f44336; font-weight: bold;');
            setError(`Error al verificar estado del registro: ${recordError.message}`);
            return;
          }
          
          // Manejar los casos donde los campos podrían ser null
          const status = recordData.status || 'pending';
          const reconciled = recordData.reconciled === true;
          isReconciled = status === 'reconciled' || reconciled;
        }
      } catch (err: any) {
        console.error(`%c❌ Error al verificar conciliación: ${err.message}`, 'color: #f44336; font-weight: bold;');
        setError(`Error al verificar estado del registro: ${err.message}`);
        return;
      }
      
      if (isReconciled) {
        console.error(`%c❌ No se puede eliminar un registro conciliado`, 'color: #f44336; font-weight: bold;');
        setError(`No se puede eliminar un registro conciliado. Debe desconciliar el registro primero.`);
        return;
      }
      
      // Eliminar el registro si no está conciliado
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .eq('id', recordId)
        .eq('imported_file_id', importId);
      
      if (deleteError) {
        console.error(`%c❌ Error al eliminar registro: ${deleteError.message}`, 'color: #f44336; font-weight: bold;');
        setError(`Error al eliminar: ${deleteError.message}`);
      } else {
        console.log(`%c✅ Registro eliminado exitosamente`, 'color: #4caf50; font-weight: bold;');
        
        // Actualizar la lista después de eliminar
        await loadRecords(currentPage);
        
        // Actualizar información de la importación
        if (importId) {
          await loadImportInfo(importId);
          
          // Actualizar contador de registros en la tabla de importaciones
          const { count } = await supabase
            .from(tableName)
            .select('id', { count: 'exact' })
            .eq('imported_file_id', importId);
          
          await supabase
            .from('imported_files')
            .update({ row_count: count || 0 })
            .eq('id', importId);
        }
      }
    } catch (error: any) {
      console.error('Error al eliminar registro individual:', error);
      setError(`Error al eliminar registro: ${error.message || 'Error desconocido'}`);
    } finally {
      // Asegurar que deleteInProgress se restablezca incluso si hay un error
      setTimeout(() => {
        setDeleteInProgress(false);
      }, 300); // Pequeño retraso para asegurar que la UI se actualice correctamente
    }
  };
  
  const navigateToRecords = (file: any) => {
    router.push(`/dashboard/reconciliation/gestion-imports?id=${file.id}&type=${file.file_type}`);
  };
  
  const returnToList = () => {
    router.push('/dashboard/reconciliation/gestion-imports');
    setSelectedFile(null);
  };
  
  // Función para generar un badge según el estado
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
            Procesado
          </span>
        );
      case 'processing':
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
            Procesando
          </span>
        );
      case 'error':
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
            Error
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
            Pendiente
          </span>
        );
    }
  };
  
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };
  
  const getReconciliationStatus = (record: any) => {
    if (record.reconciled || record.status === 'reconciled') {
      return (
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
          <CheckCircleIcon className="h-4 w-4 mr-1" />
          Conciliado
        </span>
      );
    } else {
      return (
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
          <XCircleIcon className="h-4 w-4 mr-1" />
          Pendiente
        </span>
      );
    }
  };
  
  const renderPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
      pages.push(
        <button
          key="first"
          onClick={() => loadRecords(1)}
          className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-100"
        >
          1
        </button>
      );
      
      if (startPage > 2) {
        pages.push(<span key="ellipsis1" className="px-2">...</span>);
      }
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => loadRecords(i)}
          className={`px-3 py-1 rounded ${
            i === currentPage
              ? 'bg-indigo-600 text-white'
              : 'border border-gray-300 hover:bg-gray-100'
          }`}
        >
          {i}
        </button>
      );
    }
    
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(<span key="ellipsis2" className="px-2">...</span>);
      }
      
      pages.push(
        <button
          key="last"
          onClick={() => loadRecords(totalPages)}
          className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-100"
        >
          {totalPages}
        </button>
      );
    }
    
    return (
      <div className="flex justify-center items-center space-x-2 mt-4">
        <button
          onClick={() => loadRecords(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className={`px-3 py-1 rounded border ${
            currentPage === 1
              ? 'border-gray-200 text-gray-400 cursor-not-allowed'
              : 'border-gray-300 hover:bg-gray-100'
          }`}
        >
          Anterior
        </button>
        
        <div className="flex space-x-1">{pages}</div>
        
        <button
          onClick={() => loadRecords(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className={`px-3 py-1 rounded border ${
            currentPage === totalPages
              ? 'border-gray-200 text-gray-400 cursor-not-allowed'
              : 'border-gray-300 hover:bg-gray-100'
          }`}
        >
          Siguiente
        </button>
      </div>
    );
  };
  
  // Renderizado principal
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
                className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 hover:text-indigo-600"
              >
                <CalculatorIcon className="mr-3 h-5 w-5 text-gray-400" />
                Conciliación
              </Link>
            </li>
            <li>
              <Link 
                href="/dashboard/reconciliation/import" 
                className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 hover:text-indigo-600"
              >
                <ArrowUpTrayIcon className="mr-3 h-5 w-5 text-gray-400" />
                Importar Archivos
              </Link>
            </li>
            <li>
              <Link 
                href="/dashboard/reconciliation/gestion-imports"
                className="flex items-center px-2 py-2 text-sm font-medium rounded-md bg-indigo-50 text-indigo-600"
              >
                <FolderIcon className="mr-3 h-5 w-5 text-indigo-500" />
                Gestión de Imports
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      
      {/* Contenido principal */}
      <div className="pl-64">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {importId && selectedFile ? (
            // Vista de detalles de importación
            <>
              {renderImportDetails()}
            </>
          ) : (
            // Vista de lista de importaciones
            <>
              {renderImportsList()}
            </>
          )}
        </div>
      </div>
      
      {/* Modales para eliminación */}
      {renderDeleteModals()}
    </div>
  );
  
  // Función para renderizar la lista de importaciones
  function renderImportsList() {
    return (
      <>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Archivos Importados</h1>
          <Link
            href="/dashboard/reconciliation/import"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ArrowUpTrayIcon className="-ml-1 mr-2 h-5 w-5" />
            Importar nuevo archivo
          </Link>
        </div>

        {/* Selector de empresa */}
        {companies.length > 0 && (
          <div className="mb-6">
            <label htmlFor="company-selector" className="block text-sm font-medium text-gray-700 mb-1">
              Empresa:
            </label>
            <select
              id="company-selector"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={selectedCompany || ''}
              onChange={(e) => setSelectedCompany(e.target.value)}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} {company.rut ? `(${company.rut})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Mensaje de error */}
        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Lista de archivos importados */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
          ) : importedFiles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No hay archivos importados para esta empresa</p>
              <Link
                href="/dashboard/reconciliation/import"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowUpTrayIcon className="-ml-1 mr-2 h-5 w-5" />
                Importar archivo
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nombre del archivo
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha de importación
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cuenta bancaria
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registros
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {importedFiles.map((importFile) => (
                    <tr key={importFile.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigateToRecords(importFile)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {importFile.file_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {importFile.file_type === 'bank' ? 'Extracto bancario' : 'Registros contables'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(importFile.import_date || importFile.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {importFile.bank_accounts?.name || importFile.bank_accounts?.bank_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(importFile.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {importFile.row_count || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setSelectedFile(importFile);
                            setShowDeleteFileModal(true);
                          }}
                          disabled={importsWithReconciledRecords.has(importFile.id)}
                          className={`p-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                            importsWithReconciledRecords.has(importFile.id)
                              ? 'opacity-50 cursor-not-allowed text-gray-400'
                              : 'text-red-600 hover:bg-red-100 hover:text-red-900'
                          }`}
                          title={importsWithReconciledRecords.has(importFile.id) 
                            ? "No se puede eliminar una importación con registros conciliados" 
                            : "Eliminar importación"}
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  }
  
  // Función para renderizar los detalles de una importación
  function renderImportDetails() {
    if (!selectedFile) return null;
    
    return (
      <>
        <div className="flex items-center mb-6">
          <button 
            onClick={returnToList}
            className="mr-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Detalles de Importación</h1>
        </div>

        {/* Información de la importación */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">{selectedFile.file_name}</h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                {selectedFile.file_type === 'bank' ? 'Extracto bancario' : 'Registros contables'}
              </p>
            </div>
            <div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedFile.status === 'processed' ? 'bg-green-100 text-green-800' :
                selectedFile.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                selectedFile.status === 'error' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {selectedFile.status === 'processed' ? 'Procesado' :
                 selectedFile.status === 'processing' ? 'Procesando' :
                 selectedFile.status === 'error' ? 'Error' :
                 'Pendiente'}
              </span>
            </div>
          </div>
          <div className="border-t border-gray-200">
            <dl>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Fecha de importación</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {formatDate(selectedFile.import_date || selectedFile.created_at)}
                </dd>
              </div>
              <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Cuenta bancaria</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {selectedFile.bank_accounts?.name || selectedFile.bank_accounts?.bank_name || '-'}
                </dd>
              </div>
              <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Total de registros</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {selectedFile.row_count || 0}
                </dd>
              </div>
              {selectedFile.error_message && (
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Error</dt>
                  <dd className="mt-1 text-sm text-red-600 sm:mt-0 sm:col-span-2">
                    {selectedFile.error_message}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Mensajes de error/resultado */}
        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {deleteResults && (
          <div className={`rounded-md ${deleteResults.notDeleted.length > 0 ? 'bg-yellow-50' : 'bg-green-50'} p-4 mb-6`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {deleteResults.notDeleted.length > 0 ? (
                  <ExclamationCircleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                ) : (
                  <CheckCircleIcon className="h-5 w-5 text-green-400" aria-hidden="true" />
                )}
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-gray-800">
                  Se eliminaron {deleteResults.deleted.length} registros
                </h3>
                {deleteResults.notDeleted.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-yellow-700">
                      {deleteResults.notDeleted.length} registros no pudieron ser eliminados:
                    </p>
                    <ul className="mt-1 text-sm text-yellow-700 list-disc list-inside">
                      {deleteResults.notDeleted.slice(0, 5).map((item, index) => (
                        <li key={index}>{item.reason}</li>
                      ))}
                      {deleteResults.notDeleted.length > 5 && (
                        <li>... y {deleteResults.notDeleted.length - 5} más</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Listado de registros */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {importType === 'bank' ? 'Transacciones Bancarias' : 'Registros Contables'}
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Registros {currentPage * pageSize - pageSize + 1} a {Math.min(currentPage * pageSize, totalRecords)} de {totalRecords}
              </p>
            </div>
          </div>
          
          {loadingRecords ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">No hay registros para mostrar</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Descripción
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Monto
                      </th>
                      {importType === 'bank' ? (
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Referencia
                        </th>
                      ) : (
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Documento
                        </th>
                      )}
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Estado
                      </th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {records.map((record) => (
                      <tr key={record.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(importType === 'bank' ? record.transaction_date : record.date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {record.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {formatAmount(record.amount)}
                        </td>
                        {importType === 'bank' ? (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.reference_number || '-'}
                          </td>
                        ) : (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {record.document_number ? `${record.document_type || ''} ${record.document_number}` : '-'}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getReconciliationStatus(record)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleDeleteSingleRecord(record.id)}
                            disabled={deleteInProgress || 
                              (importType === 'bank' ? 
                                (record.status === 'reconciled' || record.reconciled === true) : 
                                record.status === 'reconciled')}
                            className={`p-1.5 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                              deleteInProgress || 
                              (importType === 'bank' ? 
                                (record.status === 'reconciled' || record.reconciled === true) : 
                                record.status === 'reconciled')
                                ? 'opacity-50 cursor-not-allowed text-gray-400'
                                : 'text-red-600 hover:bg-red-100 hover:text-red-900'
                            }`}
                            title={
                              (importType === 'bank' ? 
                                (record.status === 'reconciled' || record.reconciled === true) : 
                                record.status === 'reconciled')
                                ? "No se puede eliminar un registro conciliado" 
                                : "Eliminar registro"
                            }
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {totalPages > 1 && (
                <div className="px-6 py-4">
                  {renderPagination()}
                </div>
              )}
            </>
          )}
        </div>
      </>
    );
  }
  
  // Función para renderizar los modales de eliminación
  function renderDeleteModals() {
    return (
      <>
        {/* Modal para eliminar importación completa */}
        {showDeleteFileModal && selectedFile && (
          <div className="fixed z-50 inset-0 overflow-y-auto" style={{ pointerEvents: 'auto' }}>
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <div className="inline-block align-middle bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full sm:p-6" style={{ position: 'relative', zIndex: 60, pointerEvents: 'auto' }}>
                <div>
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <TrashIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Eliminar importación
                    </h3>
                    <div className="mt-2">
                      {reconciledRecordsError ? (
                        <div className="rounded-md bg-red-50 p-4 mb-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                            </div>
                            <div className="ml-3 text-left">
                              <h3 className="text-sm font-medium text-red-800">{reconciledRecordsError.message}</h3>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">
                          ¿Estás seguro de que deseas eliminar <strong>{selectedFile.file_name}</strong>?
                        </p>
                      )}
                      
                      <div className="mt-4">
                        <label className={`inline-flex items-center ${reconciledRecordsError ? 'opacity-50' : ''}`}>
                          <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4 text-indigo-600"
                            checked={deleteWithRecords}
                            onChange={() => setDeleteWithRecords(!deleteWithRecords)}
                            disabled={!!reconciledRecordsError}
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Eliminar también los registros importados ({selectedFile.row_count || 0} registros)
                          </span>
                        </label>
                        {deleteWithRecords && !reconciledRecordsError && (
                          <p className="mt-2 text-xs text-amber-600">
                            Advertencia: Esta acción eliminará todos los registros asociados. Si hay registros conciliados, 
                            la operación será bloqueada.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="button"
                    className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:col-start-2 sm:text-sm 
                      ${reconciledRecordsError 
                        ? 'bg-gray-400 hover:bg-gray-500 cursor-not-allowed' 
                        : 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'}`}
                    onClick={handleDeleteImport}
                    disabled={!!reconciledRecordsError}
                  >
                    Eliminar
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                    onClick={() => {
                      setShowDeleteFileModal(false);
                      setReconciledRecordsError(null);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
} 