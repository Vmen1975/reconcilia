import { PencilIcon, TrashIcon, EyeIcon, ChevronUpIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { BankAccount } from '@/types';
import { useState, useMemo } from 'react';
import { Dialog } from '@headlessui/react';

interface BankAccountListProps {
  accounts: BankAccount[];
  onEdit: (account: BankAccount) => void;
  onDelete: (account: BankAccount) => void;
}

export default function BankAccountList({ accounts, onEdit, onDelete }: BankAccountListProps) {
  const [viewAccount, setViewAccount] = useState<BankAccount | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof BankAccount>('bank_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const formatAccountType = (type: string): string => {
    const types: Record<string, string> = {
      'corriente': 'Cuenta Corriente',
      'ahorro': 'Cuenta de Ahorro',
      'vista': 'Cuenta Vista'
    };
    return types[type] || type;
  };

  // Función para ordenar la lista de cuentas
  const handleSort = (field: keyof BankAccount) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Renderizar icono de ordenamiento
  const renderSortIcon = (field: keyof BankAccount) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? 
      <ChevronUpIcon className="h-4 w-4 inline-block ml-1" /> : 
      <ChevronDownIcon className="h-4 w-4 inline-block ml-1" />;
  };

  // Filtrado y ordenamiento de cuentas
  const filteredAndSortedAccounts = useMemo(() => {
    // Filtrar cuentas por término de búsqueda
    let result = [...accounts];
    
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      result = result.filter(account => 
        account.bank_name?.toLowerCase().includes(lowerSearchTerm) ||
        account.name?.toLowerCase().includes(lowerSearchTerm) ||
        account.account_number?.toLowerCase().includes(lowerSearchTerm) ||
        account.currency?.toLowerCase().includes(lowerSearchTerm) ||
        account.account_type?.toLowerCase().includes(lowerSearchTerm) ||
        account.description?.toLowerCase().includes(lowerSearchTerm)
      );
    }
    
    // Ordenar cuentas
    result.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      // Si los valores son iguales, no cambiar el orden
      if (aValue === bValue) return 0;
      
      // Si algún valor es undefined o null, colocarlo al final
      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;
      
      // Comparar los valores como strings
      const comparison = String(aValue).localeCompare(String(bValue));
      
      // Aplicar la dirección de ordenamiento
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [accounts, searchTerm, sortField, sortDirection]);

  return (
    <>
      {/* Barra de búsqueda */}
      <div className="mb-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Buscar en cuentas bancarias..."
          />
        </div>
      </div>

      <div className="flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      scope="col" 
                      className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('bank_name')}
                    >
                      Banco {renderSortIcon('bank_name')}
                    </th>
                    <th 
                      scope="col" 
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('name')}
                    >
                      Nombre de la Cuenta {renderSortIcon('name')}
                    </th>
                    <th 
                      scope="col" 
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('account_number')}
                    >
                      Número de Cuenta {renderSortIcon('account_number')}
                    </th>
                    <th 
                      scope="col" 
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('account_type')}
                    >
                      Tipo {renderSortIcon('account_type')}
                    </th>
                    <th 
                      scope="col" 
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('currency')}
                    >
                      Moneda {renderSortIcon('currency')}
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredAndSortedAccounts.map((account) => (
                    <tr key={account.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        {account.bank_name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {account.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {account.account_number}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {account.account_type === 'corriente' && 'Cuenta Corriente'}
                        {account.account_type === 'ahorro' && 'Cuenta de Ahorro'}
                        {account.account_type === 'vista' && 'Cuenta Vista'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {account.currency}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          onClick={() => setViewAccount(account)}
                          className="text-blue-600 hover:text-blue-900 mr-4"
                          title="Ver detalles"
                        >
                          <EyeIcon className="h-5 w-5" aria-hidden="true" />
                          <span className="sr-only">Ver detalles de la cuenta {account.account_number}</span>
                        </button>
                        <button
                          onClick={() => onEdit(account)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                          title="Editar cuenta"
                        >
                          <PencilIcon className="h-5 w-5" aria-hidden="true" />
                          <span className="sr-only">Editar cuenta {account.account_number}</span>
                        </button>
                        <button
                          onClick={() => onDelete(account)}
                          className="text-red-600 hover:text-red-900"
                          title="Eliminar cuenta"
                        >
                          <TrashIcon className="h-5 w-5" aria-hidden="true" />
                          <span className="sr-only">Eliminar cuenta {account.account_number}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAndSortedAccounts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-sm text-gray-500 text-center">
                        {searchTerm ? 'No se encontraron cuentas bancarias con ese criterio de búsqueda' : 'No hay cuentas bancarias registradas'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de detalles de cuenta */}
      <Dialog open={viewAccount !== null} onClose={() => setViewAccount(null)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-lg w-full rounded-lg bg-white p-6">
            <Dialog.Title className="text-lg font-medium leading-6 text-gray-900 mb-4">
              Detalles de la cuenta
            </Dialog.Title>
            
            {viewAccount && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-sm font-medium text-gray-500">Banco</span>
                    <span className="block mt-1 text-sm text-gray-900">{viewAccount.bank_name}</span>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-gray-500">Nombre de cuenta</span>
                    <span className="block mt-1 text-sm text-gray-900">{viewAccount.name}</span>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-gray-500">Número de cuenta</span>
                    <span className="block mt-1 text-sm text-gray-900">{viewAccount.account_number}</span>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-gray-500">Tipo de cuenta</span>
                    <span className="block mt-1 text-sm text-gray-900">{formatAccountType(viewAccount.account_type)}</span>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-gray-500">Moneda</span>
                    <span className="block mt-1 text-sm text-gray-900">{viewAccount.currency}</span>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-gray-500">Saldo actual</span>
                    <span className="block mt-1 text-sm text-gray-900">{viewAccount.current_balance?.toLocaleString() || '0'}</span>
                  </div>
                  {viewAccount.description && (
                    <div className="col-span-2">
                      <span className="block text-sm font-medium text-gray-500">Descripción</span>
                      <span className="block mt-1 text-sm text-gray-900">{viewAccount.description}</span>
                    </div>
                  )}
                  <div>
                    <span className="block text-sm font-medium text-gray-500">Fecha de creación</span>
                    <span className="block mt-1 text-sm text-gray-900">
                      {new Date(viewAccount.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-gray-500">Última actualización</span>
                    <span className="block mt-1 text-sm text-gray-900">
                      {new Date(viewAccount.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4 mt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => onEdit(viewAccount)}
                    className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewAccount(null)}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
} 