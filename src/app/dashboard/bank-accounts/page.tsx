'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

// Definición de tipos
interface BankAccount {
  id: string;
  company_id: string;
  bank_name?: string;
  name?: string;
  account_number: string;
  account_type?: string;
  currency?: string;
  rut?: string;
  description?: string;
  current_balance?: number;
  created_at?: string;
  updated_at?: string;
}

export default function BankAccountsPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  // Estados
  const [loading, setLoading] = useState(true);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'add' | 'edit'>('list');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Estado para nueva cuenta y cuenta seleccionada
  const [newAccount, setNewAccount] = useState<Omit<BankAccount, 'id' | 'company_id' | 'created_at' | 'updated_at'>>({
    bank_name: '',
    account_number: '',
    account_type: 'corriente',
    currency: 'CLP',
    rut: '',
    description: ''
  });
  
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  
  // Cargar datos al inicio
  useEffect(() => {
    loadBankAccounts();
  }, []);
  
  // Función para cargar cuentas bancarias
  const loadBankAccounts = async () => {
    setLoading(true);
    setErrorMessage(null);
    
    try {
      // Verificar sesión
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No hay sesión activa');
        router.push('/login');
        return;
      }
      
      // Obtener el ID de la empresa (simplificado para pruebas)
      let companyId = '11111111-1111-1111-1111-111111111111';
      
      try {
        // Intentar obtener cuentas bancarias
        const { data: accounts, error } = await supabase
          .from('bank_accounts')
          .select('*');
        
        if (error) {
          console.error('Error al obtener cuentas bancarias:', error);
          setErrorMessage('Error al cargar datos desde la base de datos.');
          setBankAccounts([]); // Array vacío - sin datos ficticios
        } else if (accounts && accounts.length > 0) {
          console.log('Cuentas bancarias obtenidas:', accounts.length);
          setBankAccounts(accounts);
        } else {
          console.log('No se encontraron cuentas bancarias.');
          setBankAccounts([]); // Array vacío - sin datos ficticios
        }
      } catch (error) {
        console.error('Error inesperado:', error);
        setErrorMessage('Error inesperado al conectar con la base de datos.');
        setBankAccounts([]); // Array vacío - sin datos ficticios
      }
    } catch (error) {
      console.error('Error general:', error);
      setErrorMessage('Error de conexión con el servicio.');
      setBankAccounts([]); // Array vacío - sin datos ficticios
    } finally {
      setLoading(false);
    }
  };
  
  // Manejadores de eventos
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (viewMode === 'add') {
      setNewAccount({
        ...newAccount,
        [name]: value
      });
    } else if (viewMode === 'edit' && selectedAccount) {
      setSelectedAccount({
        ...selectedAccount,
        [name]: value
      });
    }
  };
  
  // Función para guardar una nueva cuenta
  const handleSaveNewAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    
    try {
      // Enviamos a Supabase todos los campos necesarios
      const supabaseData = {
        company_id: '11111111-1111-1111-1111-111111111111',
        name: newAccount.bank_name,
        bank_name: newAccount.bank_name,
        account_number: newAccount.account_number,
        current_balance: 0,
        account_type: newAccount.account_type,
        currency: newAccount.currency,
        rut: newAccount.rut,
        description: newAccount.description
      };
      
      console.log('Datos a enviar a Supabase:', supabaseData);
      
      // Intentar guardar en Supabase todos los campos
      const { data, error } = await supabase
        .from('bank_accounts')
        .insert(supabaseData)
        .select();
      
      if (error) {
        console.error('Error en Supabase:', error);
        throw error;
      }
      
      if (data && data[0]) {
        console.log('Cuenta guardada exitosamente en Supabase:', data[0]);
        
        // Agregar a la lista local con todos los campos (incluyendo los no guardados en Supabase)
        const completeAccount: BankAccount = {
          ...data[0],
          account_type: newAccount.account_type,
          currency: newAccount.currency,
          rut: newAccount.rut,
          description: newAccount.description
        };
        
        console.log('Cuenta completa para UI:', completeAccount);
        setBankAccounts([...bankAccounts, completeAccount]);
      } else {
        throw new Error('No se recibieron datos de confirmación');
      }
      
      // Limpiar formulario y volver a la lista
      setNewAccount({
        bank_name: '',
        account_number: '',
        account_type: 'corriente',
        currency: 'CLP',
        rut: '',
        description: ''
      });
      
      setViewMode('list');
    } catch (error) {
      console.error('Error al guardar cuenta:', error);
      setErrorMessage('Error al guardar la cuenta. Por favor intente nuevamente.');
    }
  };

  // Función para actualizar una cuenta existente
  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    
    if (!selectedAccount) return;
    
    try {
      // Datos a actualizar en Supabase - Incluir todos los campos
      const supabaseUpdateData = {
        name: selectedAccount.bank_name,
        bank_name: selectedAccount.bank_name,
        account_number: selectedAccount.account_number,
        account_type: selectedAccount.account_type,
        currency: selectedAccount.currency,
        rut: selectedAccount.rut,
        description: selectedAccount.description
      };
      
      console.log('Intentando actualizar cuenta ID:', selectedAccount.id);
      console.log('Datos a enviar a Supabase:', supabaseUpdateData);
      
      // Enviar la actualización a Supabase solo con campos que existen
      const { error } = await supabase
        .from('bank_accounts')
        .update(supabaseUpdateData)
        .eq('id', selectedAccount.id);
      
      if (error) {
        console.error('Error en Supabase:', error);
        throw error;
      }
      
      console.log('Cuenta actualizada exitosamente en Supabase');
      
      // Para la UI local, actualizamos todos los campos
      const updatedAccount = {
        ...selectedAccount,
        updated_at: new Date().toISOString()
      };
      
      // Actualizar la lista localmente con todos los campos
      setBankAccounts(
        bankAccounts.map(account => 
          account.id === selectedAccount.id ? updatedAccount : account
        )
      );
      
      // Volver a la lista
      setViewMode('list');
      setSelectedAccount(null);
    } catch (error) {
      console.error('Error al actualizar:', error);
      setErrorMessage('Error al actualizar la cuenta. Por favor intente nuevamente.');
    }
  };
  
  // Función para eliminar una cuenta
  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm('¿Está seguro que desea eliminar esta cuenta?')) {
      return;
    }
    
    setErrorMessage(null);
    
    try {
      // Intentar eliminar de la base de datos
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Error al eliminar de la base de datos:', error);
        setErrorMessage('Error al eliminar de la base de datos. La cuenta se ha eliminado localmente.');
      }
      
      // Eliminar localmente de todas formas
      setBankAccounts(bankAccounts.filter(account => account.id !== id));
    } catch (error) {
      console.error('Error general al eliminar:', error);
      setErrorMessage('Error al eliminar. Intente nuevamente.');
    }
  };
  
  // Funciones auxiliares para formatear valores
  const formatAccountType = (type?: string): string => {
    if (!type) return 'No especificado';
    
    const types: Record<string, string> = {
      'corriente': 'Cuenta Corriente',
      'ahorro': 'Cuenta de Ahorro',
      'vista': 'Cuenta Vista'
    };
    
    return types[type] || type;
  };
  
  const formatCurrency = (currency?: string): string => {
    if (!currency) return 'No especificado';
    
    const currencies: Record<string, string> = {
      'CLP': 'Peso Chileno (CLP)',
      'USD': 'Dólar Estadounidense (USD)',
      'EUR': 'Euro (EUR)'
    };
    
    return currencies[currency] || currency;
  };
  
  // Renderizado
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Barra de navegación */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-indigo-600">Reconcilia</h1>
              </div>
              <nav className="ml-6 flex space-x-8">
                <Link href="/dashboard" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Dashboard
                </Link>
                <Link href="/dashboard/reconciliation" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Conciliación
                </Link>
                <Link href="/dashboard/bank-accounts" className="border-indigo-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Cuentas Bancarias
                </Link>
                <Link href="/dashboard/configuration/rules" className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Parámetros
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="py-10">
        <header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="md:flex md:items-center md:justify-between">
              <h1 className="text-3xl font-bold leading-tight text-gray-900">Cuentas Bancarias</h1>
              <div className="mt-4 md:mt-0">
                {viewMode === 'list' ? (
                  <button
                    onClick={() => setViewMode('add')}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Agregar Cuenta
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setViewMode('list');
                      setSelectedAccount(null);
                      setErrorMessage(null);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-700">
              Gestión de todas las cuentas bancarias registradas en el sistema.
            </p>
            <p className="mt-1 text-sm text-indigo-600">
              Esta página muestra todas las cuentas bancarias del sistema. Si desea gestionar las cuentas bancarias de una empresa específica, puede hacerlo desde la página "Empresas".
            </p>
          </div>
        </header>
        
        <main>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Mensajes de error */}
            {errorMessage && (
              <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">{errorMessage}</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Formulario para agregar nueva cuenta */}
            {viewMode === 'add' && (
              <div className="mt-5 bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Agregar Nueva Cuenta Bancaria</h2>
                <form onSubmit={handleSaveNewAccount}>
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                      <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700">
                        Banco
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="bank_name"
                          id="bank_name"
                          required
                          value={newAccount.bank_name}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="account_number" className="block text-sm font-medium text-gray-700">
                        Número de Cuenta
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="account_number"
                          id="account_number"
                          required
                          value={newAccount.account_number}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="rut" className="block text-sm font-medium text-gray-700">
                        RUT / Identificación
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="rut"
                          id="rut"
                          value={newAccount.rut}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    
                    <div className="sm:col-span-3">
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Descripción / Referencia
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="description"
                          id="description"
                          required
                          value={newAccount.description}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          placeholder="Ej: Cuenta principal, Gastos, etc."
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="account_type" className="block text-sm font-medium text-gray-700">
                        Tipo de Cuenta
                      </label>
                      <div className="mt-1">
                        <select
                          id="account_type"
                          name="account_type"
                          value={newAccount.account_type}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        >
                          <option value="corriente">Cuenta Corriente</option>
                          <option value="ahorro">Cuenta de Ahorro</option>
                          <option value="vista">Cuenta Vista</option>
                        </select>
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                        Moneda
                      </label>
                      <div className="mt-1">
                        <select
                          id="currency"
                          name="currency"
                          value={newAccount.currency}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        >
                          <option value="CLP">Peso Chileno (CLP)</option>
                          <option value="USD">Dólar Estadounidense (USD)</option>
                          <option value="EUR">Euro (EUR)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Formulario para editar cuenta existente */}
            {viewMode === 'edit' && selectedAccount && (
              <div className="mt-5 bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Editar Cuenta Bancaria</h2>
                <form onSubmit={handleUpdateAccount}>
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                      <label htmlFor="edit_bank_name" className="block text-sm font-medium text-gray-700">
                        Banco
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="bank_name"
                          id="edit_bank_name"
                          required
                          value={selectedAccount.bank_name}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="edit_account_number" className="block text-sm font-medium text-gray-700">
                        Número de Cuenta
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="account_number"
                          id="edit_account_number"
                          required
                          value={selectedAccount.account_number}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="edit_rut" className="block text-sm font-medium text-gray-700">
                        RUT / Identificación
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="rut"
                          id="edit_rut"
                          value={selectedAccount.rut || ''}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="edit_description" className="block text-sm font-medium text-gray-700">
                        Descripción / Referencia
                      </label>
                      <div className="mt-1">
                        <input
                          type="text"
                          name="description"
                          id="edit_description"
                          required
                          value={selectedAccount.description || ''}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                          placeholder="Ej: Cuenta principal, Gastos, etc."
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="edit_account_type" className="block text-sm font-medium text-gray-700">
                        Tipo de Cuenta
                      </label>
                      <div className="mt-1">
                        <select
                          id="edit_account_type"
                          name="account_type"
                          value={selectedAccount.account_type || 'corriente'}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        >
                          <option value="corriente">Cuenta Corriente</option>
                          <option value="ahorro">Cuenta de Ahorro</option>
                          <option value="vista">Cuenta Vista</option>
                        </select>
                      </div>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="edit_currency" className="block text-sm font-medium text-gray-700">
                        Moneda
                      </label>
                      <div className="mt-1">
                        <select
                          id="edit_currency"
                          name="currency"
                          value={selectedAccount.currency || 'CLP'}
                          onChange={handleInputChange}
                          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        >
                          <option value="CLP">Peso Chileno (CLP)</option>
                          <option value="USD">Dólar Estadounidense (USD)</option>
                          <option value="EUR">Euro (EUR)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="submit"
                      className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      Guardar Cambios
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode('list');
                        setSelectedAccount(null);
                      }}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Lista de cuentas bancarias */}
            {viewMode === 'list' && (
              <div className="mt-8 bg-white shadow overflow-hidden sm:rounded-md">
                {loading ? (
                  <div className="px-4 py-5 sm:p-6 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">Cargando cuentas bancarias...</p>
                  </div>
                ) : bankAccounts.length === 0 ? (
                  <div className="px-4 py-5 sm:p-6 text-center">
                    <p className="text-sm text-gray-500">No hay cuentas bancarias registradas.</p>
                    <button
                      onClick={() => setViewMode('add')}
                      className="mt-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Agregar cuenta
                    </button>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {bankAccounts.map((account) => (
                      <li key={account.id}>
                        <div className="px-4 py-4 sm:px-6 flex justify-between items-center">
                          <div>
                            {/* Si hay descripción, mostrarla destacada; si no, mostrar el banco */}
                            {account.description ? (
                              <>
                                <h3 className="text-lg font-medium text-gray-800">{account.description}</h3>
                                <p className="text-md text-gray-600">{account.bank_name || account.name}</p>
                              </>
                            ) : (
                              <h3 className="text-lg font-medium text-gray-800">{account.bank_name || account.name}</h3>
                            )}
                            
                            <div className="mt-2 space-y-1">
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Número:</span> {account.account_number}
                              </p>
                              {account.rut && (
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">RUT:</span> {account.rut}
                                </p>
                              )}
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Tipo:</span> {formatAccountType(account.account_type)}
                              </p>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Moneda:</span> {formatCurrency(account.currency)}
                              </p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => router.push(`/dashboard/reconciliation?account=${account.id}`)}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              Conciliar
                            </button>
                            <button
                              onClick={() => {
                                setSelectedAccount(account);
                                setViewMode('edit');
                              }}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(account.id)}
                              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
} 