'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { HomeIcon, CalculatorIcon, BuildingOfficeIcon, BanknotesIcon, ArrowLeftIcon, ArrowUpTrayIcon, CheckCircleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { formatDate as utilFormatDate, formatMoney } from '@/utils/format';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function BankTransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0], // Primer día del mes actual
    end: new Date().toISOString().split('T')[0] // Hoy
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [importStatus, setImportStatus] = useState<{status: string, message: string, timestamp: string} | null>(null);
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login');
          return;
        }
        
        // Obtener las empresas asociadas al usuario
        const { data: userCompanies, error: userCompaniesError } = await supabase
          .from('user_companies')
          .select('company_id')
          .eq('user_id', session.user.id)
          .eq('is_active', true);
        
        if (userCompaniesError) throw userCompaniesError;
        if (!userCompanies || userCompanies.length === 0) {
          setError('No tienes empresas asociadas a tu cuenta.');
          setLoading(false);
          return;
        }
        
        // Obtener los IDs de todas las empresas asociadas
        const companyIds = userCompanies.map(uc => uc.company_id);
        
        // Obtener todas las cuentas bancarias de las empresas asociadas, incluyendo el nombre de la empresa
        const { data: accounts, error: accountsError } = await supabase
          .from('bank_accounts')
          .select(`
            *,
            companies:company_id (
              id,
              name
            )
          `)
          .in('company_id', companyIds);
          
        if (accountsError) throw accountsError;
        
        // Transformar los datos para incluir el nombre de la empresa
        const transformedAccounts = accounts?.map(account => ({
          ...account,
          company_name: account.companies?.name || 'Empresa desconocida'
        })) || [];
        
        setBankAccounts(transformedAccounts);
        if (transformedAccounts.length > 0) {
          setSelectedBankAccount(transformedAccounts[0].id);
        } else {
          setError('No hay cuentas bancarias disponibles.');
        }
      } catch (error) {
        console.error('Error al cargar cuentas bancarias:', error);
        setError('Error al cargar cuentas bancarias');
      }
    };
    
    fetchBankAccounts();
  }, [router, supabase]);

  // Efecto para cargar transacciones bancarias cuando se cambia la cuenta o el rango de fechas
  useEffect(() => {
    const fetchBankTransactions = async () => {
      setLoading(true);
      try {
        const { searchParams } = new URL(window.location.href);
        const importId = searchParams.get('importId');
        
        console.log('🔍 Iniciando búsqueda de transacciones bancarias:');
        console.log('- Cuenta bancaria seleccionada:', selectedBankAccount);
        
        if (!selectedBankAccount) {
          console.error('❌ No hay cuenta bancaria seleccionada');
          setTransactions([]);
          setError('Selecciona una cuenta bancaria para ver las transacciones');
          setLoading(false);
          return;
        }
        
        // Primero, obtener TODAS las transacciones de esta cuenta bancaria
        console.log('🔍 Obteniendo todas las transacciones para la cuenta bancaria');
        const { data: allTransactions, error: allError } = await supabase
          .from('bank_transactions')
          .select('*')
          .eq('bank_account_id', selectedBankAccount);
        
        if (allError) {
          console.error('❌ Error al obtener todas las transacciones:', allError);
          throw allError;
        }
        
        console.log(`✅ Total de transacciones encontradas: ${allTransactions?.length || 0}`);
        
        // Mostrar algunas transacciones para diagnóstico
        if (allTransactions && allTransactions.length > 0) {
          console.log('📊 Primeras 3 transacciones:', allTransactions.slice(0, 3));
          
          // Si hay filtros de fecha activos, filtrar en memoria
          if (dateRange.start || dateRange.end) {
            console.log('🔍 Aplicando filtros de fecha en memoria:', dateRange);
            
            const startDate = dateRange.start ? new Date(dateRange.start) : null;
            const endDate = dateRange.end ? new Date(dateRange.end) : null;
            
            const filteredByDate = allTransactions.filter(tx => {
              const txDate = new Date(tx.transaction_date || tx.date);
              
              if (startDate && endDate) {
                return txDate >= startDate && txDate <= endDate;
              } else if (startDate) {
                return txDate >= startDate;
              } else if (endDate) {
                return txDate <= endDate;
              }
              
              return true;
            });
            
            console.log(`📊 Transacciones después de filtrar por fecha: ${filteredByDate.length}`);
            setTransactions(filteredByDate);
          } else {
            // Si no hay filtros de fecha, mostrar todas
            setTransactions(allTransactions);
          }
        } else {
          console.log('⚠️ No se encontraron transacciones para esta cuenta bancaria');
          setTransactions([]);
        }
      } catch (error) {
        console.error('❌ Error al cargar transacciones:', error);
        setError('No se pudieron cargar las transacciones bancarias');
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };
    
    if (selectedBankAccount) {
      fetchBankTransactions();
    }
  }, [selectedBankAccount, dateRange]);
  
  // Filtrar transacciones según el término de búsqueda
  const filteredTransactions = transactions.filter(transaction => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      (transaction.description && transaction.description.toLowerCase().includes(searchLower)) ||
      (transaction.reference && transaction.reference.toLowerCase().includes(searchLower)) ||
      (transaction.status && transaction.status.toLowerCase().includes(searchLower))
    );
  });

  // Función para formatear la fecha de manera manual sin usar objetos Date
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return utilFormatDate(dateString);
    } catch (e) {
      console.error('Error al formatear fecha:', e, dateString);
      return 'Error';
    }
  };

  // Función para formatear el monto
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  // Función para determinar el estilo del monto según sea positivo o negativo
  const getAmountStyle = (amount: number) => {
    return amount >= 0 ? 'text-green-600' : 'text-red-600';
  };

  // Función para traducir el estado de la transacción
  const translateStatus = (status: string) => {
    switch (status) {
      case 'deposit': return 'Depósito';
      case 'withdrawal': return 'Retiro';
      case 'transfer': return 'Transferencia';
      case 'payment': return 'Pago';
      case 'fee': return 'Comisión';
      case 'pending': return 'Pendiente';
      case 'reconciled': return 'Conciliado';
      default: return status;
    }
  };

  // Función para exportar a Excel
  const exportToExcel = () => {
    if (filteredTransactions.length === 0) return;
    
    // Preparar los datos para Excel
    const excelData = filteredTransactions.map(transaction => {
      return {
        'Fecha': formatDate(transaction.transaction_date || transaction.date),
        'Descripción': transaction.description || '',
        'Referencia': transaction.reference_number || transaction.reference || '-',
        'Monto': formatAmount(transaction.amount).replace(/\./g, ''),
        'Tipo': translateStatus(transaction.status),
        'Estado': transaction.reconciliation_id ? 'Conciliado' : 'Pendiente'
      };
    });
    
    // Crear una hoja de trabajo
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Crear un libro de trabajo
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Extractos Bancarios');
    
    // Guardar el archivo
    XLSX.writeFile(workbook, `extractos_bancarios_${new Date().toISOString().split('T')[0]}.xlsx`);
  };
  
  // Función para exportar a PDF
  const exportToPDF = () => {
    if (filteredTransactions.length === 0) return;
    
    // Crear el documento PDF
    const doc = new jsPDF('landscape');
    
    // Agregar título
    doc.setFontSize(18);
    doc.text('Extractos Bancarios', 14, 20);
    doc.setFontSize(12);
    doc.text(`Fecha de exportación: ${formatDate(new Date().toISOString())}`, 14, 28);
    
    // Seleccionar cuenta bancaria actual
    const currentAccount = bankAccounts.find(acc => acc.id === selectedBankAccount);
    if (currentAccount) {
      doc.text(`Cuenta: ${currentAccount.company_name}: ${currentAccount.name} - ${currentAccount.bank_name} (${currentAccount.account_number})`, 14, 36);
    }
    
    // Preparar los datos para la tabla
    const tableData = filteredTransactions.map(transaction => [
      formatDate(transaction.transaction_date || transaction.date),
      transaction.description ? (transaction.description.length > 30 ? transaction.description.substring(0, 30) + '...' : transaction.description) : '',
      transaction.reference_number || transaction.reference || '-',
      formatAmount(transaction.amount),
      translateStatus(transaction.status),
      transaction.reconciliation_id ? 'Conciliado' : 'Pendiente'
    ]);
    
    // Definir las columnas
    const tableColumns = ['Fecha', 'Descripción', 'Referencia', 'Monto', 'Tipo', 'Estado'];
    
    // Generar la tabla
    autoTable(doc, {
      head: [tableColumns],
      body: tableData,
      startY: 44,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [75, 85, 165] }
    });
    
    // Guardar el archivo
    doc.save(`extractos_bancarios_${new Date().toISOString().split('T')[0]}.pdf`);
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
                <CalculatorIcon className="mr-3 h-5 w-5 text-indigo-500" />
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
                href="/dashboard/companies" 
                className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 hover:text-indigo-600"
              >
                <BuildingOfficeIcon className="mr-3 h-5 w-5 text-gray-400" />
                Empresas
              </Link>
            </li>
            <li>
              <Link 
                href="/dashboard/bank-accounts" 
                className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 hover:text-indigo-600"
              >
                <BanknotesIcon className="mr-3 h-5 w-5 text-gray-400" />
                Cuentas Bancarias
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* Contenido principal con margen para la barra lateral */}
      <div className="pl-64">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Extractos Bancarios
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Visualiza las transacciones bancarias importadas en el sistema
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
              <div className="flex space-x-4">
                <Link href="/dashboard/reconciliation/bank/import" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Importar datos
                </Link>
                <Link href="/dashboard/reconciliation/reconciled" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center">
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  Ver Conciliaciones Realizadas
                </Link>
              </div>
            </div>
          </div>

          {/* Botones de exportación */}
          <div className="flex space-x-2 mb-4">
            <button
              onClick={exportToExcel}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none"
              disabled={filteredTransactions.length === 0}
            >
              <ArrowDownTrayIcon className="-ml-1 mr-1 h-5 w-5" aria-hidden="true" />
              Exportar a Excel
            </button>
            <button
              onClick={exportToPDF}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
              disabled={filteredTransactions.length === 0}
            >
              <ArrowDownTrayIcon className="-ml-1 mr-1 h-5 w-5" aria-hidden="true" />
              Exportar a PDF
            </button>
          </div>

          {/* Estado de la última importación */}
          {importStatus && (
            <div className={`mb-4 p-4 rounded-md ${
              importStatus.status === 'processed' ? 'bg-green-50' :
              importStatus.status === 'error' ? 'bg-red-50' :
              importStatus.status === 'processing' ? 'bg-yellow-50' : 'bg-blue-50'
            }`}>
              <div className="flex">
                <div className="flex-1">
                  <h3 className={`text-sm font-medium ${
                    importStatus.status === 'processed' ? 'text-green-800' :
                    importStatus.status === 'error' ? 'text-red-800' :
                    importStatus.status === 'processing' ? 'text-yellow-800' : 'text-blue-800'
                  }`}>
                    {importStatus.status === 'processed' ? 'Última importación exitosa' :
                    importStatus.status === 'error' ? 'Error en la última importación' :
                    importStatus.status === 'processing' ? 'Importación en proceso' : 'Importación pendiente'}
                  </h3>
                  {importStatus.message && (
                    <p className="mt-1 text-sm text-gray-600">{importStatus.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">Fecha: {importStatus.timestamp}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-4">
                <div>
                  <label htmlFor="bank-account" className="block text-sm font-medium text-gray-700">
                    Cuenta bancaria
                  </label>
                  <select
                    id="bank-account"
                    name="bank-account"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    value={selectedBankAccount || ''}
                    onChange={(e) => setSelectedBankAccount(e.target.value)}
                    disabled={loading || bankAccounts.length === 0}
                  >
                    {loading ? (
                      <option>Cargando cuentas...</option>
                    ) : bankAccounts.length === 0 ? (
                      <option>No hay cuentas disponibles</option>
                    ) : (
                      bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.company_name}: {account.name ? `${account.name} - ` : ''}{account.bank_name} - {account.account_number}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                
                <div>
                  <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    id="start-date"
                    name="start-date"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  />
                </div>
                
                <div>
                  <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    id="end-date"
                    name="end-date"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  />
                </div>
                
                <div>
                  <label htmlFor="search" className="block text-sm font-medium text-gray-700">
                    Buscar
                  </label>
                  <input
                    type="text"
                    id="search"
                    name="search"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    placeholder="Buscar por descripción, referencia, etc."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col">
            <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
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
                          Referencia
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Monto
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                            Cargando transacciones...
                          </td>
                        </tr>
                      ) : filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                            No se encontraron transacciones bancarias para los filtros seleccionados.
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((transaction) => (
                          <tr key={transaction.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(transaction.transaction_date || transaction.date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {transaction.description}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {transaction.reference_number || transaction.reference || '-'}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${getAmountStyle(transaction.amount)}`}>
                              {formatAmount(transaction.amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                transaction.amount >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {translateStatus(transaction.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                transaction.reconciliation_id ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {transaction.reconciliation_id ? 'Conciliado' : 'Pendiente'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 