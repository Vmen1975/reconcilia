'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, HomeIcon } from '@heroicons/react/24/outline';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useSession } from '@/hooks/useSession';
import { reconciliationService } from '@/services/reconciliation';

export default function AutoReconciliationPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { session, userCompanies } = useSession();
  
  const [selectedAccount, setSelectedAccount] = useState('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 días atrás
    end: new Date() // Hoy
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{
    success: boolean;
    message: string;
    matchCount?: number;
    error?: string;
  } | null>(null);
  
  // Definir el tipo para las cuentas bancarias
  type BankAccountWithCompany = {
    id: string;
    name: string;
    bank_name: string;
    account_number: string;
    company_id: string;
    companies: {
      id: string;
      name: string;
    };
    company_name?: string;
  };
  
  // Cargar las cuentas bancarias disponibles
  useEffect(() => {
    async function loadBankAccounts() {
      if (!session) {
        console.log('⚠️ No hay sesión activa');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // Obtener la información del usuario actual
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!currentSession) {
          console.error('⚠️ No se pudo obtener la sesión actual');
          setLoading(false);
          return;
        }
        
        // Obtener las empresas asociadas al usuario
        const { data: userCompanies, error: userCompaniesError } = await supabase
          .from('user_companies')
          .select('company_id')
          .eq('user_id', currentSession.user.id)
          .eq('is_active', true);
        
        if (userCompaniesError) {
          console.error('❌ Error al obtener empresas del usuario:', userCompaniesError);
          setLoading(false);
          return;
        }
        
        if (!userCompanies || userCompanies.length === 0) {
          console.log('⚠️ El usuario no tiene empresas asociadas');
          setLoading(false);
          return;
        }
        
        // Obtener los IDs de todas las empresas asociadas
        const companyIds = userCompanies.map(uc => uc.company_id);
        
        // Obtener todas las cuentas bancarias junto con la información de la empresa
        const { data: accounts, error: accountsError } = await supabase
          .from('bank_accounts')
          .select(`
            id, 
            name, 
            bank_name, 
            account_number,
            company_id,
            companies:company_id (
              id,
              name
            )
          `)
          .in('company_id', companyIds);
          
        if (accountsError) {
          console.error('❌ Error al cargar cuentas bancarias:', accountsError);
          setLoading(false);
          return;
        }
        
        // Transformar los datos para facilitar su uso
        const transformedAccounts = accounts?.map((account: any) => ({
          id: account.id,
          name: account.name,
          bank_name: account.bank_name,
          account_number: account.account_number,
          company_id: account.company_id,
          companies: account.companies,
          company_name: account.companies ? account.companies.name : 'Empresa desconocida'
        })) || [];
        
        console.log('✅ Cuentas bancarias cargadas:', transformedAccounts.length);
        
        setBankAccounts(transformedAccounts);
        if (transformedAccounts.length > 0) {
          setSelectedAccount(transformedAccounts[0].id);
        }
      } catch (error) {
        console.error('❌ Error al cargar cuentas bancarias:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadBankAccounts();
  }, [session, supabase]);
  
  // Función para ejecutar la conciliación automática
  const runAutoReconciliation = async () => {
    if (!selectedAccount) {
      setResults({
        success: false,
        message: 'Por favor selecciona una cuenta bancaria',
        matchCount: 0,
        error: 'No se seleccionó cuenta bancaria'
      });
      return;
    }
    
    try {
      setProcessing(true);
      setResults(null);
      
      console.log('Iniciando conciliación automática con parámetros:', {
        bankAccountId: selectedAccount,
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString()
        }
      });
      
      // Llamar al servicio de conciliación
      const matches = await reconciliationService.autoReconcile(
        selectedAccount,
        dateRange
      );
      
      setResults({
        success: true,
        message: '¡Conciliación automática completada con éxito!',
        matchCount: matches.length
      });
      
      console.log('Conciliación automática completada:', matches);
    } catch (error) {
      console.error('Error en conciliación automática:', error);
      setResults({
        success: false,
        message: 'Error al realizar la conciliación automática',
        matchCount: 0,
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    } finally {
      setProcessing(false);
    }
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
                <svg className="mr-3 h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                Conciliación
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      
      {/* Contenido principal */}
      <div className="pl-64">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Conciliación Automática
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                El sistema buscará y conciliará automáticamente transacciones bancarias y registros contables
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex space-x-3">
              <button
                onClick={() => router.push('/dashboard/reconciliation')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowLeftIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Volver a conciliación
              </button>
            </div>
          </div>
          
          {/* Configuración de conciliación */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Configuración de conciliación automática
              </h3>
              
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="bankAccount" className="block text-sm font-medium text-gray-700 mb-1">
                    Cuenta Bancaria
                  </label>
                  <select
                    id="bankAccount"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    disabled={loading || processing}
                  >
                    {loading ? (
                      <option>Cargando cuentas...</option>
                    ) : bankAccounts.length === 0 ? (
                      <option>No hay cuentas disponibles</option>
                    ) : (
                      bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.company_name}: {account.name} - {account.bank_name} ({account.account_number})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha Inicio
                    </label>
                    <input
                      type="date"
                      id="startDate"
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      value={dateRange.start.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newStartDate = e.target.value ? new Date(e.target.value) : new Date();
                        setDateRange({ ...dateRange, start: newStartDate });
                      }}
                      disabled={processing}
                    />
                  </div>
                  <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha Fin
                    </label>
                    <input
                      type="date"
                      id="endDate"
                      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                      value={dateRange.end.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newEndDate = e.target.value ? new Date(e.target.value) : new Date();
                        setDateRange({ ...dateRange, end: newEndDate });
                      }}
                      disabled={processing}
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-6">
                <button
                  type="button"
                  onClick={runAutoReconciliation}
                  disabled={loading || processing || !selectedAccount}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Procesando...
                    </>
                  ) : (
                    'Iniciar conciliación automática'
                  )}
                </button>
              </div>
              
              {results && (
                <div className={`mt-6 p-4 rounded-md ${results.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex">
                    <div className="flex-shrink-0">
                      {results.success ? (
                        <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3">
                      <h3 className={`text-sm font-medium ${results.success ? 'text-green-800' : 'text-red-800'}`}>
                        {results.message}
                      </h3>
                      {results.success && results.matchCount !== undefined && (
                        <div className="mt-2 text-sm text-green-700">
                          <p>Se encontraron y conciliaron {results.matchCount} registros.</p>
                        </div>
                      )}
                      {!results.success && results.error && (
                        <div className="mt-2 text-sm text-red-700">
                          <p>{results.error}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {results && results.success && (
            <div className="mt-6 flex space-x-4">
              <button
                type="button"
                onClick={() => router.push('/dashboard/reconciliation/reconciled')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Ver conciliaciones realizadas
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/reconciliation/manual')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Ir a conciliación manual
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 