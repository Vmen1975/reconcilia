import { DocumentIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import type { ImportedFile } from '@/types';

interface ImportListProps {
  imports: ImportedFile[];
  onDelete: (importFile: ImportedFile) => void;
}

const statusIcons = {
  pending: ClockIcon,
  processing: ClockIcon,
  processed: CheckCircleIcon,
  error: XCircleIcon,
};

const statusColors = {
  pending: 'text-yellow-600',
  processing: 'text-blue-600',
  processed: 'text-green-600',
  error: 'text-red-600',
};

const statusLabels = {
  pending: 'Pendiente',
  processing: 'Procesando',
  processed: 'Procesado',
  error: 'Error',
};

export default function ImportList({ imports, onDelete }: ImportListProps) {
  return (
    <div className="flow-root">
      <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                    Archivo
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Tipo
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Estado
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                    Fecha
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {imports.map((importFile) => {
                  const StatusIcon = statusIcons[importFile.status];
                  return (
                    <tr key={importFile.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        <div className="flex items-center">
                          <DocumentIcon className="h-5 w-5 text-gray-400 mr-2" />
                          {importFile.file_name}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {importFile.file_type === 'bank' ? 'Extracto Bancario' : 'Registro Contable'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <div className="flex items-center">
                          <StatusIcon className={`h-5 w-5 mr-1.5 ${statusColors[importFile.status]}`} />
                          <span className={statusColors[importFile.status]}>
                            {statusLabels[importFile.status]}
                          </span>
                        </div>
                        {importFile.error_message && (
                          <p className="mt-1 text-xs text-red-600">{importFile.error_message}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {new Date(importFile.import_date).toLocaleString()}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          onClick={() => onDelete(importFile)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Eliminar
                          <span className="sr-only">, {importFile.file_name}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {imports.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-sm text-gray-500 text-center">
                      No hay archivos importados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 