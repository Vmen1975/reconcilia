'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, HomeIcon } from '@heroicons/react/24/outline';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useSession } from '@/hooks/useSession';
import ReconciliationPanel from '@/components/reconciliation/ReconciliationPanel';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

export default function ManualReconciliationPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const { session, userCompanies } = useSession();
  
  const [selectedAccount, setSelectedAccount] = useState('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  
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
  
  // Establecer fechas por defecto (últimos 30 días)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    
    setDateRange({ start, end });
  }, []);
  
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
                Conciliación Manual
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Concilia manualmente transacciones bancarias con registros contables
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
          
          {/* Selector de cuenta y filtros */}
          <div className="bg-white shadow rounded-lg mb-6 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bankAccount" className="block text-sm font-medium text-gray-700 mb-1">
                  Cuenta Bancaria
                </label>
                <select
                  id="bankAccount"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  disabled={loading}
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
                    value={dateRange?.start ? dateRange.start.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const newStartDate = e.target.value ? new Date(e.target.value) : undefined;
                      if (newStartDate) {
                        setDateRange((prev) => ({
                          start: newStartDate,
                          end: prev?.end || new Date()
                        }));
                      }
                    }}
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
                    value={dateRange?.end ? dateRange.end.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const newEndDate = e.target.value ? new Date(e.target.value) : undefined;
                      if (newEndDate) {
                        setDateRange((prev) => ({
                          start: prev?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                          end: newEndDate
                        }));
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Panel de conciliación */}
          {selectedAccount ? (
            <DndProvider backend={HTML5Backend}>
              <ReconciliationPanel 
                bankAccountId={selectedAccount} 
                dateRange={dateRange}
              />
            </DndProvider>
          ) : (
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <p className="text-gray-500">Selecciona una cuenta bancaria para comenzar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 