'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@headlessui/react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { companyService } from '@/services/company';
import type { Company } from '@/types';
import Link from 'next/link';
import { PencilIcon, TrashIcon, BanknotesIcon, ChevronUpIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function CompaniesContent() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: companyService.getCompanies,
  });

  const createMutation = useMutation({
    mutationFn: companyService.createCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setIsOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Company> }) =>
      companyService.updateCompany(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setIsOpen(false);
      setSelectedCompany(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: companyService.deleteCompany,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  const handleSubmit = async (data: Omit<Company, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (selectedCompany) {
        await updateMutation.mutateAsync({ id: selectedCompany.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
    } catch (error) {
      console.error('Error al guardar empresa:', error);
      alert('Ocurrió un error al guardar la empresa. Por favor, intente de nuevo.');
    }
  };

  const handleEdit = (company: Company) => {
    setSelectedCompany(company);
    setIsOpen(true);
  };

  const handleDelete = async (company: Company) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar la empresa ${company.name}?`)) {
      try {
        await deleteMutation.mutateAsync(company.id);
      } catch (error) {
        console.error('Error al eliminar empresa:', error);
        alert('Ocurrió un error al eliminar la empresa. Por favor, intente de nuevo.');
      }
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedCompany(null);
  };

  // Componente interno para la lista de empresas
  function CompanyList({ companies, onEdit, onDelete }: { 
    companies: Company[];
    onEdit: (company: Company) => void;
    onDelete: (company: Company) => void;
  }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState<keyof Company>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Función para ordenar la lista de empresas
    const handleSort = (field: keyof Company) => {
      if (sortField === field) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    };

    // Renderizar icono de ordenamiento
    const renderSortIcon = (field: keyof Company) => {
      if (sortField !== field) {
        return null;
      }
      return sortDirection === 'asc' ? 
        <ChevronUpIcon className="h-4 w-4 inline-block ml-1" /> : 
        <ChevronDownIcon className="h-4 w-4 inline-block ml-1" />;
    };

    // Filtrado y ordenamiento de empresas
    const filteredAndSortedCompanies = useMemo(() => {
      // Filtrar empresas por término de búsqueda
      let result = [...companies];
      
      if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        result = result.filter(company => 
          company.name?.toLowerCase().includes(lowerSearchTerm) ||
          company.rut?.toLowerCase().includes(lowerSearchTerm) ||
          company.address?.toLowerCase().includes(lowerSearchTerm) ||
          company.phone?.toLowerCase().includes(lowerSearchTerm) ||
          company.email?.toLowerCase().includes(lowerSearchTerm)
        );
      }
      
      // Ordenar empresas
      result.sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];
        
        // Si los valores son iguales, no cambiar el orden
        if (aValue === bValue) return 0;
        
        // Si algún valor es undefined o null, colocarlo al final
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        
        // Si es una fecha, comparar como fechas
        if (sortField === 'created_at' || sortField === 'updated_at') {
          return sortDirection === 'asc' 
            ? new Date(aValue as string).getTime() - new Date(bValue as string).getTime()
            : new Date(bValue as string).getTime() - new Date(aValue as string).getTime();
        }
        
        // Comparar los valores como strings
        const comparison = String(aValue).localeCompare(String(bValue));
        
        // Aplicar la dirección de ordenamiento
        return sortDirection === 'asc' ? comparison : -comparison;
      });
      
      return result;
    }, [companies, searchTerm, sortField, sortDirection]);

    return (
      <div className="flow-root">
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
              placeholder="Buscar empresas..."
            />
          </div>
        </div>

        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      scope="col" 
                      className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('name')}
                    >
                      Nombre {renderSortIcon('name')}
                    </th>
                    <th 
                      scope="col" 
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('rut')}
                    >
                      RUT {renderSortIcon('rut')}
                    </th>
                    <th 
                      scope="col" 
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('created_at')}
                    >
                      Fecha de creación {renderSortIcon('created_at')}
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Cuentas bancarias
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredAndSortedCompanies.map((company) => (
                    <tr key={company.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                        <Link href={`/dashboard/companies/${company.id}`} className="hover:text-indigo-600">
                          {company.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{company.rut}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {new Date(company.created_at).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                        <Link
                          href={`/dashboard/companies/${company.id}`}
                          className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                          title="Gestionar cuentas bancarias"
                        >
                          <BanknotesIcon className="h-5 w-5 mr-1" aria-hidden="true" />
                          <span>Ver cuentas</span>
                        </Link>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          onClick={() => onEdit(company)}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          <PencilIcon className="h-5 w-5" aria-hidden="true" />
                          <span className="sr-only">Editar {company.name}</span>
                        </button>
                        <button
                          onClick={() => onDelete(company)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="h-5 w-5" aria-hidden="true" />
                          <span className="sr-only">Eliminar {company.name}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAndSortedCompanies.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-sm text-gray-500 text-center">
                        {searchTerm ? 'No se encontraron empresas con ese criterio de búsqueda' : 'No hay empresas registradas'}
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

  // Componente interno para el formulario de empresa
  function CompanyForm({ 
    initialData, 
    onSubmit, 
    onCancel, 
    isLoading 
  }: {
    initialData?: Partial<Company>;
    onSubmit: (data: Omit<Company, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
    onCancel: () => void;
    isLoading?: boolean;
  }) {
    const [formData, setFormData] = useState({
      name: initialData?.name || '',
      rut: initialData?.rut || '',
      address: initialData?.address || '',
      phone: initialData?.phone || '',
      email: initialData?.email || '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    };

    return (
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nombre
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="rut" className="block text-sm font-medium text-gray-700">
            RUT
          </label>
          <input
            type="text"
            id="rut"
            name="rut"
            required
            value={formData.rut}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            Dirección
          </label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Teléfono
          </label>
          <input
            type="text"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {isLoading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-base font-semibold leading-6 text-gray-900">Empresas</h1>
          <p className="mt-2 text-sm text-gray-700">
            Lista de empresas registradas en el sistema
          </p>
          <p className="mt-1 text-sm text-red-500">
            <strong>Nota importante:</strong> Debe crear una empresa y asociarla a su usuario para poder usar las funcionalidades del sistema.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <PlusIcon className="h-5 w-5 inline-block -mt-1 mr-1" />
            Agregar empresa
          </button>
        </div>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="text-center">Cargando...</div>
        ) : (
          <CompanyList
            companies={companies}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </div>

      <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-sm rounded-lg bg-white p-6">
            <Dialog.Title className="text-lg font-medium leading-6 text-gray-900 mb-4">
              {selectedCompany ? 'Editar empresa' : 'Nueva empresa'}
            </Dialog.Title>
            <CompanyForm
              initialData={selectedCompany || undefined}
              onSubmit={handleSubmit}
              onCancel={handleClose}
              isLoading={createMutation.isPending || updateMutation.isPending}
            />
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
} 