'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { importService } from '@/services/import';
import { formatDate } from '@/utils/format';
import Link from 'next/link';
import { 
  HomeIcon, ArrowLeftIcon, TrashIcon, DocumentTextIcon, 
  CheckCircleIcon, XCircleIcon, PencilIcon 
} from '@heroicons/react/24/outline';

export default function ImportManagerPage() {
  const searchParams = useSearchParams();
  const importId = searchParams.get('id');
  const importType = searchParams.get('type') as 'bank' | 'accounting';
  
  const router = useRouter();
  const { session } = useSession();
  
  const [importInfo, setImportInfo] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteImportModalOpen, setIsDeleteImportModalOpen] = useState(false);
  const [deleteWithRecords, setDeleteWithRecords] = useState(true);
  
  const pageSize = 50;
  
  useEffect(() => {
    if (!importId || !importType) {
      router.push('/dashboard/reconciliation');
      return;
    }
    
    loadImportInfo();
    loadRecords(1);
  }, [importId, importType]);
  
  const loadImportInfo = async () => {
    try {
      const info = await importService.getImport(importId || '');
      setImportInfo(info);
    } catch (error) {
      console.error('Error al cargar información de importación:', error);
    }
  };
  
  const loadRecords = async (page: number) => {
    if (!importId || !importType) return;
    
    setLoading(true);
    try {
      const result = await importService.getImportRecords(importId, importType, page, pageSize);
      setRecords(result.data);
      setTotalRecords(result.total);
      setTotalPages(Math.ceil(result.total / pageSize));
      setCurrentPage(page);
    } catch (error) {
      console.error('Error al cargar registros:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSelectRecord = (recordId: string) => {
    setSelectedRecords(prevSelected => {
      if (prevSelected.includes(recordId)) {
        return prevSelected.filter(id => id !== recordId);
      } else {
        return [...prevSelected, recordId];
      }
    });
  };
  
  const handleSelectAll = () => {
    if (selectedRecords.length === records.length) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(records.map(record => record.id));
    }
  };
  
  const handleDeleteSelected = async () => {
    if (selectedRecords.length === 0) return;
    
    try {
      await importService.deleteSelectedRecords(importId || '', selectedRecords, importType);
      setSelectedRecords([]);
      loadRecords(currentPage);
      loadImportInfo();
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error('Error al eliminar registros:', error);
    }
  };
  
  const handleDeleteImport = async () => {
    if (!importId) return;
    
    try {
      await importService.deleteImportAndRelatedRecords(importId, deleteWithRecords);
      router.push('/dashboard/reconciliation');
    } catch (error) {
      console.error('Error al eliminar importación:', error);
    }
  };
  
  const renderPagination = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    // Calcular rango de páginas visibles
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Agregar botón para primera página
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
    
    // Agregar páginas numeradas
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
    
    // Agregar botón para última página
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
  
  const renderRecordTable = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      );
    }
    
    if (records.length === 0) {
      return (
        <div className="text-center py-10">
          <p className="text-gray-500 font-medium">No hay registros para mostrar</p>
        </div>
      );
    }
    
    // Determinar campos a mostrar según el tipo de registro
    const isBankTransaction = importType === 'bank';
    
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={selectedRecords.length === records.length && records.length > 0}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descripción
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Monto
              </th>
              {isBankTransaction && (
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Referencia
                </th>
              )}
              {!isBankTransaction && (
                <>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nº Documento
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                </>
              )}
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {records.map(record => (
              <tr key={record.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedRecords.includes(record.id)}
                    onChange={() => handleSelectRecord(record.id)}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {record.id.substring(0, 8)}...
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(isBankTransaction ? record.transaction_date : record.date)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                  {record.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(record.amount)}
                </td>
                {isBankTransaction && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {record.reference_number || '-'}
                  </td>
                )}
                {!isBankTransaction && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.document_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.document_type || '-'}
                    </td>
                  </>
                )}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    record.reconciled || record.status === 'reconciled'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {record.reconciled || record.status === 'reconciled' ? 'Conciliado' : 'Pendiente'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
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
                className="flex items-center px-2 py-2 text-sm font-medium rounded-md bg-indigo-50 text-indigo-600"
              >
                <DocumentTextIcon className="mr-3 h-5 w-5 text-indigo-500" />
                Conciliación
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* Contenido principal con margen para la barra lateral */}
      <div className="pl-64">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <button 
                onClick={() => router.back()}
                className="mr-4 p-1 rounded-full hover:bg-gray-200"
              >
                <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                Gestión de Importación
              </h1>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setIsDeleteImportModalOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                disabled={!importInfo}
              >
                <TrashIcon className="mr-2 h-5 w-5" />
                Eliminar Importación
              </button>
            </div>
          </div>
          
          {importInfo && (
            <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
              <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Información de la importación</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">Detalles del archivo importado</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  importInfo.status === 'processed' ? 'bg-green-100 text-green-800' :
                  importInfo.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                  importInfo.status === 'error' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {importInfo.status === 'processed' ? 'Procesado' :
                   importInfo.status === 'processing' ? 'Procesando' :
                   importInfo.status === 'error' ? 'Error' :
                   'Pendiente'}
                </span>
              </div>
              <div className="border-t border-gray-200">
                <dl>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Nombre del archivo</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{importInfo.file_name}</dd>
                  </div>
                  <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Tipo</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {importInfo.file_type === 'bank' ? 'Extracto bancario' : 'Registros contables'}
                    </dd>
                  </div>
                  <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                    <dt className="text-sm font-medium text-gray-500">Fecha de importación</dt>
                    <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                      {formatDate(importInfo.import_date)}
                    </dd>
                  </div>
                  {importInfo.error_message && (
                    <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt className="text-sm font-medium text-gray-500">Mensaje de error</dt>
                      <dd className="mt-1 text-sm text-red-600 sm:mt-0 sm:col-span-2">{importInfo.error_message}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          )}
          
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">Registros importados</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  {totalRecords} registros en total • Página {currentPage} de {totalPages}
                </p>
              </div>
              <div>
                {selectedRecords.length > 0 && (
                  <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <TrashIcon className="mr-1 h-4 w-4" />
                    Eliminar seleccionados ({selectedRecords.length})
                  </button>
                )}
              </div>
            </div>
            
            {renderRecordTable()}
            
            {totalPages > 1 && renderPagination()}
          </div>
          
          {/* Modal para eliminar registros seleccionados */}
          {isDeleteModalOpen && (
            <div className="fixed z-10 inset-0 overflow-y-auto">
              <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                  <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start">
                      <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                        <XCircleIcon className="h-6 w-6 text-red-600" />
                      </div>
                      <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                          Eliminar registros seleccionados
                        </h3>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            ¿Estás seguro de que deseas eliminar los {selectedRecords.length} registros seleccionados? Esta acción no se puede deshacer.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                      onClick={handleDeleteSelected}
                    >
                      Eliminar
                    </button>
                    <button
                      type="button"
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                      onClick={() => setIsDeleteModalOpen(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Modal para eliminar importación */}
          {isDeleteImportModalOpen && (
            <div className="fixed z-10 inset-0 overflow-y-auto">
              <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                  <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>
                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                  <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start">
                      <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                        <XCircleIcon className="h-6 w-6 text-red-600" />
                      </div>
                      <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                          Eliminar importación
                        </h3>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            ¿Estás seguro de que deseas eliminar esta importación? Esta acción no se puede deshacer.
                          </p>
                          <div className="mt-4">
                            <label className="inline-flex items-center">
                              <input
                                type="checkbox"
                                className="form-checkbox h-4 w-4 text-indigo-600"
                                checked={deleteWithRecords}
                                onChange={() => setDeleteWithRecords(!deleteWithRecords)}
                              />
                              <span className="ml-2 text-sm text-gray-700">Eliminar también los registros importados</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                      onClick={handleDeleteImport}
                    >
                      Eliminar
                    </button>
                    <button
                      type="button"
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                      onClick={() => setIsDeleteImportModalOpen(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 