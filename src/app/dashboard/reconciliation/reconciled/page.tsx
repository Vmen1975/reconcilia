'use client';

import { useState, useEffect, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { formatDate, formatMoney } from '@/utils/format';
import Link from 'next/link';
import { ArrowLeftIcon, ArrowDownTrayIcon, HomeIcon, CalculatorIcon, ArrowUpTrayIcon, BuildingOfficeIcon, BanknotesIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Interfaz para los datos de conciliación
interface ReconciliationData {
  id: string;
  bank_transaction_id: string;
  accounting_entry_id: string;
  bank_account_id: string;
  company_id: string;
  status: string;
  confidence_score: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  reconciliation_method?: string;
  // Datos expandidos
  bank_transaction?: {
    description: string;
    amount: number;
    transaction_date: string;
    reference_number?: string;
    status?: string;
  };
  accounting_entry?: {
    description: string;
    amount: number;
    date: string;
    reference?: string;
    document_type?: string;
    document_direction?: string;
    status?: string;
  };
  bank_account?: {
    name: string;
    bank_name: string;
    account_number: string;
  };
}

// Definir la interfaz para el mapa
interface BankAccountMap {
  [key: string]: {
    id: string;
    name: string;
    bank_name: string;
    account_number: string;
  }
}

// Interfaz para cuenta bancaria con compañía
interface BankAccountWithCompany {
  id: string;
  name: string;
  bank_name: string;
  account_number: string;
  company_id: string;
  companies: {
    id: string;
    name: string;
  }
}

export default function ReconciledItemsPage() {
  const [reconciliations, setReconciliations] = useState<ReconciliationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterAmount, setFilterAmount] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<boolean>(false);
  const tableRef = useRef<HTMLTableElement>(null);
  
  // Modificar los estados para el filtro combinado
  const [bankAccountsOptions, setBankAccountsOptions] = useState<{id: string, display: string, company_id: string}[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const supabase = createClientComponentClient();
  
  // Cargar cuentas bancarias con información de empresa
  useEffect(() => {
    async function loadBankAccountOptions() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
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
          
        if (accountsError) throw accountsError;
        
        if (accounts && accounts.length > 0) {
          // Formatear las opciones para el selector
          const options = (accounts as BankAccountWithCompany[]).map(account => ({
            id: account.id,
            company_id: account.company_id,
            display: `${account.companies.name}: ${account.name} - ${account.bank_name} (${account.account_number})`
          }));
          
          setBankAccountsOptions(options);
        }
      } catch (error) {
        console.error('Error al cargar cuentas bancarias:', error);
      }
    }
    
    loadBankAccountOptions();
  }, [supabase]);
  
  // Cargar datos de conciliaciones
  useEffect(() => {
    async function loadReconciliations() {
      try {
        setLoading(true);
        
        // Primero obtenemos las conciliaciones con todos los datos necesarios
        const query = supabase
          .from('reconciliations')
          .select(`
            *,
            bank_transaction:bank_transactions(id, description, amount, transaction_date, reference_number, status, bank_account_id),
            accounting_entry:accounting_entries(id, description, amount, date, reference, document_type, document_direction, status)
          `)
          .order(sortColumn, { ascending: sortDirection === 'asc' });
          
        // Aplicar filtro de cuenta bancaria si está seleccionada
        if (selectedBankAccountId) {
          query.eq('bank_account_id', selectedBankAccountId);
        }
          
        const { data: reconciliationsData, error: reconciliationsError } = await query;
          
        if (reconciliationsError) {
          throw reconciliationsError;
        }
        
        console.log('Datos de conciliaciones obtenidos:', reconciliationsData);
        
        // Para cada conciliación sin bank_account_id, intentaremos actualizarla
        const reconciliationsToUpdate = reconciliationsData.filter(
          rec => !rec.bank_account_id && rec.bank_transaction?.bank_account_id
        );
        
        console.log(`Encontradas ${reconciliationsToUpdate.length} conciliaciones sin bank_account_id`);
        
        // Actualizar las conciliaciones que no tienen bank_account_id
        for (const rec of reconciliationsToUpdate) {
          if (rec.bank_transaction?.bank_account_id) {
            console.log(`Actualizando conciliación ${rec.id} con bank_account_id ${rec.bank_transaction.bank_account_id}`);
            
            const { error: updateError } = await supabase
              .from('reconciliations')
              .update({ bank_account_id: rec.bank_transaction.bank_account_id })
              .eq('id', rec.id);
              
            if (updateError) {
              console.error(`Error al actualizar conciliación ${rec.id}:`, updateError);
            }
          }
        }
        
        // Procesar datos para extraer el método desde las notas
        const processedData = reconciliationsData.map(rec => {
          let reconciliationMethod = 'manual'; // valor por defecto
          
          // Intentar extraer el método desde el campo notes
          if (rec.notes) {
            if (rec.notes.includes('Conciliación auto')) {
              reconciliationMethod = 'auto';
            }
          }
          
          // Si la conciliación no tiene bank_account_id pero la transacción sí
          const bankAccountId = rec.bank_account_id || 
            (rec.bank_transaction && rec.bank_transaction.bank_account_id) || 
            null;
          
          return {
            ...rec,
            bank_account_id: bankAccountId,
            reconciliation_method: reconciliationMethod
          };
        });
        
        // Ahora necesitamos obtener la información de las cuentas bancarias
        // Primero extraemos todos los IDs de cuentas bancarias
        const bankAccountIds = processedData
          .filter(rec => rec.bank_account_id || (rec.bank_transaction && rec.bank_transaction.bank_account_id))
          .map(rec => rec.bank_account_id || rec.bank_transaction?.bank_account_id)
          .filter(id => id !== null && id !== undefined) as string[];
        
        // Eliminamos duplicados
        const uniqueBankAccountIds = [...new Set(bankAccountIds)];
        
        console.log('IDs de cuentas bancarias a consultar:', uniqueBankAccountIds);
        
        if (uniqueBankAccountIds.length > 0) {
          // Obtenemos los datos de las cuentas bancarias
          const { data: bankAccountsData, error: bankAccountsError } = await supabase
            .from('bank_accounts')
            .select('id, name, bank_name, account_number')
            .in('id', uniqueBankAccountIds);
            
          if (bankAccountsError) {
            console.error('Error al obtener cuentas bancarias:', bankAccountsError);
          } else {
            console.log('Datos de cuentas bancarias obtenidos:', bankAccountsData);
            
            // Creamos un mapa de cuentas bancarias por ID para acceso rápido
            const bankAccountsMap: BankAccountMap = bankAccountsData.reduce((map: BankAccountMap, account) => {
              map[account.id] = account;
              return map;
            }, {});
            
            // Asociamos las cuentas bancarias con cada conciliación
            const dataWithBankAccounts = processedData.map(rec => {
              const accountId = rec.bank_account_id || 
                (rec.bank_transaction && rec.bank_transaction.bank_account_id);
              
              if (accountId && bankAccountsMap[accountId]) {
                return {
                  ...rec,
                  bank_account: bankAccountsMap[accountId]
                };
              }
              return rec;
            });
            
            setReconciliations(dataWithBankAccounts as ReconciliationData[]);
          }
        } else {
          setReconciliations(processedData as ReconciliationData[]);
        }
      } catch (err: any) {
        console.error('Error al cargar conciliaciones:', err);
        setError(err.message || 'Error al cargar conciliaciones');
      } finally {
        setLoading(false);
      }
    }
    
    loadReconciliations();
  }, [supabase, selectedBankAccountId, sortColumn, sortDirection]);

  // Función para cambiar ordenamiento
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Si ya estamos ordenando por esta columna, invertir dirección
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Si es una nueva columna, establecerla y ordenar descendentemente
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Filtrar reconciliaciones
  const filteredReconciliations = reconciliations.filter(rec => {
    // Filtrar por fecha
    if (filterDate && (!rec.created_at || !rec.created_at.includes(filterDate))) {
      return false;
    }
    
    // Filtrar por monto
    if (filterAmount && rec.bank_transaction?.amount) {
      const amount = Math.abs(rec.bank_transaction.amount).toString();
      if (!amount.includes(filterAmount)) {
        return false;
      }
    }
    
    // Filtrar por búsqueda general
    if (filterSearch) {
      const searchLower = filterSearch.toLowerCase();
      const bankDesc = rec.bank_transaction?.description?.toLowerCase() || '';
      const accountDesc = rec.accounting_entry?.description?.toLowerCase() || '';
      const bankRef = rec.bank_transaction?.reference_number?.toLowerCase() || '';
      const accountRef = rec.accounting_entry?.reference?.toLowerCase() || '';
      
      if (!bankDesc.includes(searchLower) && 
          !accountDesc.includes(searchLower) && 
          !bankRef.includes(searchLower) &&
          !accountRef.includes(searchLower)) {
        return false;
      }
    }
    
    return true;
  });
  
  // Función para exportar a CSV
  const exportToCSV = () => {
    if (reconciliations.length === 0) return;
    
    // Crear cabeceras
    const headers = [
      'Fecha',
      'Cuenta Bancaria',
      'Transacción',
      'Monto',
      'Registro Contable',
      'Tipo',
      'Confianza',
      'Método',
      'Fechas Originales'
    ].join(',');
    
    // Crear filas
    const rows = filteredReconciliations.map(rec => {
      // Utilizar formatDate directamente desde la utilidad importada
      const fecha = formatDate(rec.created_at);
      const txFecha = rec.bank_transaction ? formatDate(rec.bank_transaction.transaction_date) : '';
      const entryFecha = rec.accounting_entry ? formatDate(rec.accounting_entry.date) : '';
      
      const cuenta = rec.bank_account ? `${rec.bank_account.name} (${rec.bank_account.bank_name})` : '';
      const transaccion = rec.bank_transaction ? `${rec.bank_transaction.description.replace(/,/g, ' ')} (${txFecha})` : '';
      const monto = rec.accounting_entry ? rec.accounting_entry.amount : 0;
      const registro = rec.accounting_entry ? `${rec.accounting_entry.description?.replace(/,/g, ' ') || ''} (${entryFecha})` : '';
      const tipo = rec.accounting_entry?.document_type || '';
      const confianza = rec.confidence_score || 0;
      const metodo = rec.reconciliation_method || rec.status || '';
      
      return [
        fecha, 
        `"${cuenta}"`, 
        `"${transaccion}"`, 
        monto,
        `"${registro}"`,
        tipo,
        confianza,
        metodo,
        `"${txFecha},${entryFecha}"`
      ].join(',');
    }).join('\n');
    
    // Combinar cabeceras y filas
    const csv = `${headers}\n${rows}`;
    
    // Crear blob y descargarlo
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `conciliaciones_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Función para exportar a Excel
  const exportToExcel = () => {
    if (reconciliations.length === 0) return;
    
    // Preparar los datos para Excel
    const excelData = filteredReconciliations.map(rec => {
      const txFecha = rec.bank_transaction ? formatDate(rec.bank_transaction.transaction_date) : '';
      const entryFecha = rec.accounting_entry ? formatDate(rec.accounting_entry.date) : '';
      
      return {
        'Fecha': formatDate(rec.created_at),
        'Cuenta Bancaria': rec.bank_account ? `${rec.bank_account.name} (${rec.bank_account.bank_name})` : 'Sin información',
        'Transacción': rec.bank_transaction ? rec.bank_transaction.description : '',
        'Monto': rec.accounting_entry ? rec.accounting_entry.amount : 0,
        'Registro Contable': rec.accounting_entry ? rec.accounting_entry.description || '' : '',
        'Tipo': rec.accounting_entry?.document_type || '',
        'Confianza': rec.confidence_score || 0,
        'Método': rec.reconciliation_method || rec.status || '',
        'Fecha Transacción': txFecha,
        'Fecha Registro': entryFecha
      };
    });
    
    // Crear una hoja de trabajo
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Crear un libro de trabajo
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Conciliaciones');
    
    // Guardar el archivo
    XLSX.writeFile(workbook, `conciliaciones_${new Date().toISOString().split('T')[0]}.xlsx`);
  };
  
  // Función para exportar a PDF
  const exportToPDF = () => {
    if (reconciliations.length === 0) return;
    
    // Crear el documento PDF
    const doc = new jsPDF('landscape');
    
    // Agregar título
    doc.setFontSize(18);
    doc.text('Conciliaciones Realizadas', 14, 20);
    doc.setFontSize(12);
    doc.text(`Fecha de exportación: ${formatDate(new Date().toISOString())}`, 14, 28);
    
    // Preparar los datos para la tabla
    const tableData = filteredReconciliations.map(rec => [
      formatDate(rec.created_at),
      rec.bank_account ? `${rec.bank_account.name}` : 'Sin información',
      rec.bank_transaction ? rec.bank_transaction.description.substring(0, 30) + '...' : '',
      rec.accounting_entry ? rec.accounting_entry.description?.substring(0, 30) + '...' || '' : '',
      rec.accounting_entry ? formatMoney(rec.accounting_entry.amount) : 'N/A',
      `${Math.round(rec.confidence_score || 0)}%`,
      rec.reconciliation_method === 'manual' ? 'Manual' : 'Automática',
    ]);
    
    // Definir las columnas
    const tableColumns = [
      'Fecha', 
      'Cuenta', 
      'Transacción', 
      'Registro Contable', 
      'Monto', 
      'Confianza', 
      'Método'
    ];
    
    // Generar la tabla
    autoTable(doc, {
      head: [tableColumns],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [75, 85, 165] }
    });
    
    // Guardar el archivo
    doc.save(`conciliaciones_${new Date().toISOString().split('T')[0]}.pdf`);
  };
  
  // Añadir una función para deshacer conciliaciones
  const undoReconciliation = async (reconciliationId: string) => {
    try {
      setDeletingId(reconciliationId);
      setDeleteError(null);
      setDeleteSuccess(false);
      
      // Llamada a la API para deshacer la conciliación
      const response = await fetch(`/api/reconciliation/${reconciliationId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al deshacer la conciliación');
      }
      
      // Eliminar la conciliación de la lista en UI
      setReconciliations(prev => prev.filter(r => r.id !== reconciliationId));
      setDeleteSuccess(true);
      
      // Mostrar mensaje de éxito brevemente
      setTimeout(() => {
        setDeleteSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error('Error al deshacer la conciliación:', err);
      setDeleteError(err.message);
    } finally {
      setDeletingId(null);
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
            <li>
              <Link 
                href="/dashboard/configuration/rules" 
                className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 hover:text-indigo-600"
              >
                <AdjustmentsHorizontalIcon className="mr-3 h-5 w-5 text-gray-400" />
                Parámetros
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      {/* Contenido principal con margen para la barra lateral */}
      <div className="pl-64">
        <div className="max-w-7xl mx-auto">
          {/* Encabezado fijo */}
          <div className="sticky top-0 z-20 bg-white shadow-md">
            <div className="px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
              <div className="flex items-center">
                <Link 
                  href="/dashboard/reconciliation/bank" 
                  className="inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                >
                  <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
                </Link>
                <h1 className="ml-3 text-2xl font-bold text-gray-900">Conciliaciones Realizadas</h1>
              </div>
              
              {/* Opciones de exportación */}
              <div className="flex space-x-2">
                <button
                  onClick={exportToCSV}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                >
                  <ArrowDownTrayIcon className="-ml-1 mr-1 h-5 w-5 text-gray-500" aria-hidden="true" />
                  CSV
                </button>
                <button
                  onClick={exportToExcel}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                >
                  <ArrowDownTrayIcon className="-ml-1 mr-1 h-5 w-5" aria-hidden="true" />
                  Excel
                </button>
                <button
                  onClick={exportToPDF}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
                >
                  <ArrowDownTrayIcon className="-ml-1 mr-1 h-5 w-5" aria-hidden="true" />
                  PDF
                </button>
              </div>
            </div>
            
            {/* Filtros */}
            <div className="px-4 sm:px-6 lg:px-8 pb-4 bg-white border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Selector combinado de empresa-cuenta bancaria */}
                <div>
                  <label htmlFor="bank-account-filter" className="block text-sm font-medium text-gray-700 mb-1">
                    Empresa - Cuenta bancaria
                  </label>
                  <div className="relative">
                    <select
                      id="bank-account-filter"
                      value={selectedBankAccountId}
                      onChange={(e) => setSelectedBankAccountId(e.target.value)}
                      className="appearance-none w-full px-3 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 pr-10"
                    >
                      <option value="">Todas las cuentas</option>
                      {bankAccountsOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.display}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Campo de búsqueda general */}
                <div>
                  <label htmlFor="search-filter" className="block text-sm font-medium text-gray-700 mb-1">
                    Búsqueda general
                  </label>
                  <input
                    type="text"
                    id="search-filter"
                    placeholder="Buscar en descripciones, referencias..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                
                {/* Filtros existentes (fecha y monto) */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha
                    </label>
                    <input
                      type="text"
                      id="date-filter"
                      placeholder="YYYY-MM-DD"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="amount-filter" className="block text-sm font-medium text-gray-700 mb-1">
                      Monto
                    </label>
                    <input
                      type="text"
                      id="amount-filter"
                      placeholder="Valor"
                      value={filterAmount}
                      onChange={(e) => setFilterAmount(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Resumen siempre visible */}
            <div className="px-4 sm:px-6 lg:px-8 py-3 border-b border-gray-200">
              <div className="flex flex-wrap gap-4">
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="text-xl font-bold text-indigo-600">
                    {filteredReconciliations.length}
                  </div>
                  <div className="text-xs text-gray-600">Total conciliaciones</div>
                </div>
                
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="text-xl font-bold text-green-600">
                    {formatMoney(filteredReconciliations.reduce((sum, rec) => {
                      return sum + (rec.accounting_entry?.amount ? Math.abs(rec.accounting_entry.amount) : 0);
                    }, 0))}
                  </div>
                  <div className="text-xs text-gray-600">Monto Conciliado</div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Contenido de la tabla */}
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            {/* Contenido */}
            {loading ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-4 text-lg text-gray-600">Cargando conciliaciones...</p>
              </div>
            ) : error ? (
              <div className="p-6 bg-red-50 text-red-700 rounded-lg shadow">
                <h3 className="text-lg font-medium">Error al cargar conciliaciones</h3>
                <p className="mt-1">{error}</p>
              </div>
            ) : filteredReconciliations.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <p className="text-lg text-gray-500">No se encontraron conciliaciones</p>
                {reconciliations.length > 0 && (
                  <p className="mt-2 text-sm text-gray-500">Prueba ajustando los filtros</p>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="relative overflow-x-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                  <table className="min-w-full divide-y divide-gray-200" ref={tableRef}>
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th 
                          scope="col" 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('created_at')}
                        >
                          <div className="flex items-center">
                            Fecha
                            {sortColumn === 'created_at' && (
                              <span className="ml-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          scope="col" 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('bank_account_id')}
                        >
                          <div className="flex items-center">
                            Cuenta Bancaria
                            {sortColumn === 'bank_account_id' && (
                              <span className="ml-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Transacción Bancaria
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Registro Contable
                        </th>
                        <th 
                          scope="col" 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('amount')}
                        >
                          <div className="flex items-center">
                            Monto
                            {sortColumn === 'amount' && (
                              <span className="ml-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          scope="col" 
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('confidence_score')}
                        >
                          <div className="flex items-center justify-center">
                            Confianza
                            {sortColumn === 'confidence_score' && (
                              <span className="ml-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th 
                          scope="col" 
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => handleSort('reconciliation_method')}
                        >
                          <div className="flex items-center justify-center">
                            Método
                            {sortColumn === 'reconciliation_method' && (
                              <span className="ml-1">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </div>
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fechas Originales
                        </th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredReconciliations.map((reconciliation) => {
                        // Obtener la información de la cuenta bancaria directamente
                        const bankAccountInfo = reconciliation.bank_account ? 
                          `${reconciliation.bank_account.name} (${reconciliation.bank_account.bank_name})` : 
                          'Sin información';
                        
                        return (
                          <tr key={reconciliation.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(reconciliation.created_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {reconciliation.bank_account ? (
                                <div>
                                  <div className="font-medium">{reconciliation.bank_account.name}</div>
                                  <div className="text-xs text-gray-500">
                                    {reconciliation.bank_account.bank_name} - {reconciliation.bank_account.account_number}
                                  </div>
                                </div>
                              ) : (
                                // Información adicional para diagnóstico
                                <div className="text-xs text-red-500">
                                  <div>Sin dato de cuenta bancaria</div>
                                  <div>ID Transacción: {reconciliation.bank_transaction_id}</div>
                                  <div>ID Cuenta: {reconciliation.bank_account_id}</div>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {reconciliation.bank_transaction ? (
                                <div>
                                  <div className="font-medium truncate max-w-xs">
                                    {reconciliation.bank_transaction.description}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {formatDate(reconciliation.bank_transaction.transaction_date)}
                                    {reconciliation.bank_transaction.status === 'reconciled' && (
                                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        Conciliado
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : 'Sin información'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {reconciliation.accounting_entry ? (
                                <div>
                                  <div className="font-medium truncate max-w-xs">
                                    {reconciliation.accounting_entry.description || 'Sin descripción'}
                                  </div>
                                  <div className="text-xs text-gray-500 flex items-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                      reconciliation.accounting_entry.document_direction === 'emitida' 
                                        ? 'bg-teal-100 text-teal-800' 
                                        : 'bg-orange-100 text-orange-800'
                                    }`}>
                                      {reconciliation.accounting_entry.document_direction === 'emitida' ? 'Emitida' : 'Recibida'}
                                    </span>
                                    <span className="mx-1">•</span>
                                    {reconciliation.accounting_entry.document_type} {reconciliation.accounting_entry.reference}
                                  </div>
                                </div>
                              ) : 'Sin información'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {reconciliation.accounting_entry ? (
                                <div className={`${reconciliation.accounting_entry.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatMoney(reconciliation.accounting_entry.amount)}
                                </div>
                              ) : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex items-center justify-center">
                                <div className="w-16 bg-gray-200 rounded-full h-2.5">
                                  <div 
                                    className={`h-2.5 rounded-full ${
                                      reconciliation.confidence_score >= 90 ? 'bg-green-500' :
                                      reconciliation.confidence_score >= 70 ? 'bg-yellow-400' : 'bg-red-500'
                                    }`}
                                    style={{ width: `${reconciliation.confidence_score}%` }}
                                  ></div>
                                </div>
                                <span className="ml-2">{Math.round(reconciliation.confidence_score)}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                reconciliation.reconciliation_method === 'manual' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {reconciliation.reconciliation_method === 'manual' 
                                  ? 'Manual' 
                                  : 'Automática'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div className="text-xs">
                                <div className="mb-1">
                                  <span className="font-semibold">Transacción:</span> {formatDate(reconciliation.bank_transaction?.transaction_date || '')}
                                </div>
                                <div>
                                  <span className="font-semibold">Registro:</span> {formatDate(reconciliation.accounting_entry?.date || '')}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                              <button
                                onClick={() => undoReconciliation(reconciliation.id)}
                                disabled={deletingId === reconciliation.id}
                                className={`px-3 py-1 rounded-md text-xs font-medium ${
                                  deletingId === reconciliation.id 
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                                }`}
                              >
                                {deletingId === reconciliation.id ? (
                                  <span className="flex items-center">
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Procesando...
                                  </span>
                                ) : (
                                  <span className="flex items-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Deshacer
                                  </span>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Notificaciones de error y éxito */}
      {deleteError && (
        <div className="fixed bottom-4 right-4 bg-red-100 text-red-700 p-4 rounded-md shadow-lg border border-red-200 max-w-md">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{deleteError}</p>
          </div>
          <button 
            onClick={() => setDeleteError(null)} 
            className="absolute top-2 right-2 text-red-700 hover:text-red-900"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {deleteSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-100 text-green-700 p-4 rounded-md shadow-lg border border-green-200 max-w-md">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p>Conciliación deshecha correctamente</p>
          </div>
        </div>
      )}
    </div>
  );
} 