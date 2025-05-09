'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog } from '@headlessui/react';
import { PlusIcon } from '@heroicons/react/24/outline';
import BankAccountList from '@/components/companies/BankAccountList';
import BankAccountForm from '@/components/companies/BankAccountForm';
import { companyService } from '@/services/company';
import { getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount } from '@/services/bankAccount';
import type { BankAccount } from '@/types';

interface CompanyDetailsContentProps {
  id: string;
}

export default function CompanyDetailsContent({ id }: CompanyDetailsContentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: company, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['company', id],
    queryFn: () => companyService.getCompany(id),
  });

  const { data: accounts = [], isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['bank-accounts', id],
    queryFn: () => getBankAccounts(id),
  });

  const createMutation = useMutation({
    mutationFn: createBankAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts', id] });
      setIsOpen(false);
      setErrorMessage(null);
    },
    onError: (error: any) => {
      console.error('Error al crear cuenta bancaria:', error);
      setErrorMessage(error?.message || 'Error al crear cuenta bancaria. Por favor, intente nuevamente.');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BankAccount> }) =>
      updateBankAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts', id] });
      setIsOpen(false);
      setSelectedAccount(null);
      setErrorMessage(null);
    },
    onError: (error: any) => {
      console.error('Error al actualizar cuenta bancaria:', error);
      setErrorMessage(error?.message || 'Error al actualizar cuenta bancaria. Por favor, intente nuevamente.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBankAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-accounts', id] });
      setErrorMessage(null);
    },
    onError: (error: any) => {
      console.error('Error al eliminar cuenta bancaria:', error);
      setErrorMessage(error?.message || 'Error al eliminar cuenta bancaria. Por favor, intente nuevamente.');
    }
  });

  const handleSubmit = async (data: Omit<BankAccount, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setErrorMessage(null);
      
      if (selectedAccount) {
        await updateMutation.mutateAsync({ id: selectedAccount.id, data });
      } else {
        // Asegurarse de que company_id está definido
        if (!id) {
          throw new Error('ID de empresa no definido');
        }
        
        // Crear objeto completo con todos los campos requeridos
        const newAccount = {
          ...data,
          company_id: id
        };
        
        console.log('Enviando datos para nueva cuenta:', newAccount);
        await createMutation.mutateAsync(newAccount);
      }
    } catch (error: any) {
      console.error('Error en handleSubmit:', error);
      setErrorMessage(error?.message || 'Error al procesar la operación. Por favor, intente nuevamente.');
    }
  };

  const handleEdit = (account: BankAccount) => {
    setSelectedAccount(account);
    setErrorMessage(null);
    setIsOpen(true);
  };

  const handleDelete = async (account: BankAccount) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar la cuenta ${account.account_number}?`)) {
      await deleteMutation.mutateAsync(account.id);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedAccount(null);
    setErrorMessage(null);
  };

  if (isLoadingCompany) {
    return <div className="text-center">Cargando...</div>;
  }

  if (!company) {
    return <div className="text-center">Empresa no encontrada</div>;
  }

  return (
    <>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-base font-semibold leading-6 text-gray-900">
            {company.name}
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Gestión de cuentas bancarias
          </p>
          <p className="mt-1 text-sm text-indigo-600">
            Esta página permite gestionar las cuentas bancarias específicas de esta empresa.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <PlusIcon className="h-5 w-5 inline-block -mt-1 mr-1" />
            Agregar cuenta
          </button>
        </div>
      </div>

      {/* Mostrar errores */}
      {errorMessage && (
        <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
          <p className="font-medium">Error</p>
          <p>{errorMessage}</p>
        </div>
      )}

      <div className="mt-8">
        {isLoadingAccounts ? (
          <div className="text-center">Cargando cuentas...</div>
        ) : (
          <BankAccountList
            accounts={accounts}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </div>

      <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full rounded-lg bg-white p-8">
            <Dialog.Title className="text-xl font-medium leading-6 text-gray-900 mb-6">
              {selectedAccount ? 'Editar cuenta' : 'Nueva cuenta'}
            </Dialog.Title>
            {/* Mostrar errores en el diálogo */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                <p>{errorMessage}</p>
              </div>
            )}
            <BankAccountForm
              initialData={selectedAccount || undefined}
              companyId={id}
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