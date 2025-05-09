import React from 'react';
import { formatDate } from '@/utils/format';
import { useRouter } from 'next/navigation';
import { EyeIcon, TrashIcon, DocumentIcon } from '@heroicons/react/24/outline';

interface ImportCardProps {
  importFile: any;
  onDelete: (id: string, deleteRecords: boolean) => void;
}

export default function ImportCard({ importFile, onDelete }: ImportCardProps) {
  const router = useRouter();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
            Pendiente
          </span>
        );
      case 'processing':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
            Procesando
          </span>
        );
      case 'processed':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
            Procesado
          </span>
        );
      case 'error':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
            Error
          </span>
        );
      default:
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };
  
  const handleViewRecords = () => {
    router.push(`/dashboard/import-manager?id=${importFile.id}&type=${importFile.file_type}`);
  };
  
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-gray-900 truncate">
              {importFile.file_name}
            </h3>
            <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:mt-0 sm:space-x-6">
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <DocumentIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                {importFile.file_type === 'bank' ? 'Extracto bancario' : 'Registros contables'}
              </div>
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <span className="mr-1.5">Importado:</span>
                {formatDate(importFile.import_date || importFile.created_at)}
              </div>
              <div className="mt-2 flex items-center text-sm text-gray-500">
                {getStatusBadge(importFile.status)}
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="flex justify-between items-center text-sm">
            <div>
              <span className="font-medium">Registros: </span>
              <span className="text-gray-600">{importFile.row_count || 0}</span>
            </div>
            
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleViewRecords}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <EyeIcon className="mr-1.5 h-4 w-4 text-gray-500" />
                Ver registros
              </button>
              
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                <TrashIcon className="mr-1.5 h-4 w-4 text-white" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de confirmación para eliminar */}
      {isDeleteModalOpen && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div>
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <TrashIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-5">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Eliminar importación
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      ¿Estás seguro de que deseas eliminar esta importación? 
                      Puedes eliminar solo el registro de importación o también 
                      los datos importados.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:col-start-2 sm:text-sm"
                  onClick={() => {
                    onDelete(importFile.id, true);
                    setIsDeleteModalOpen(false);
                  }}
                >
                  Eliminar todo
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                  onClick={() => {
                    onDelete(importFile.id, false);
                    setIsDeleteModalOpen(false);
                  }}
                >
                  Solo registro
                </button>
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-span-2 sm:text-sm"
                  onClick={() => setIsDeleteModalOpen(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 