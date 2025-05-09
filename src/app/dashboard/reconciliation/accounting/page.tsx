'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { HomeIcon, CalculatorIcon, BuildingOfficeIcon, BanknotesIcon, ArrowLeftIcon, ArrowUpTrayIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { formatDate as utilFormatDate, formatMoney } from '@/utils/format';
import { DocumentTypeTag } from '@/components/ui/DocumentTypeTag';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AccountingEntriesPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'reconciled'>('all');
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0], // Primer día del mes actual
    end: new Date().toISOString().split('T')[0] // Hoy
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'emitida' | 'recibida'>('all');
  
  const supabase = createClientComponentClient();

  // Cargar las empresas del usuario
  useEffect(() => {
    const fetchCompanies = async () => {
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
          return;
        }
        
        // Obtener los IDs de todas las empresas asociadas
        const companyIds = userCompanies.map(uc => uc.company_id);
        
        // Obtener detalles de las empresas
        const { data: companiesData, error: companiesError } = await supabase
          .from('companies')
          .select('*')
          .in('id', companyIds);
          
        if (companiesError) throw companiesError;
        
        setCompanies(companiesData || []);
        
        // Si hay empresas, seleccionar la primera por defecto
        if (companiesData && companiesData.length > 0) {
          setSelectedCompany(companiesData[0].id);
        }
      } catch (error) {
        console.error('Error al cargar empresas:', error);
        setError('Error al cargar empresas');
      }
    };
    
    fetchCompanies();
  }, [router, supabase]);

  useEffect(() => {
    const fetchAccountingEntries = async () => {
      setLoading(true);
      try {
        const { searchParams } = new URL(window.location.href);
        const importId = searchParams.get('importId');
        
        // Consultar las entradas contables con los filtros adecuados
        let query = supabase
          .from('accounting_entries')
          .select('*')
          .in('company_id', companies.map(c => c.id));
          
        // Filtrar por archivo importado si se proporciona el parámetro
        if (importId) {
          query = query.eq('imported_file_id', importId);
        } else {
          // Aplicar filtro de fecha solo si no estamos buscando por archivo importado
          query = query
            .gte('date', dateRange.start)
            .lte('date', dateRange.end);
        }
        
        // Aplicar filtro por estado si está seleccionado
        if (statusFilter !== 'all') {
          query = query.eq('status', statusFilter);
        }
        
        // Aplicar filtro por dirección si está seleccionado
        if (directionFilter !== 'all') {
          query = query.eq('document_direction', directionFilter);
        }
        
        // Aplicar orden
        query = query.order('date', { ascending: false });
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        let filteredEntries = data || [];
        
        // Aplicar filtro de búsqueda de texto si existe
        if (searchTerm) {
          filteredEntries = filteredEntries.filter(entry => 
            entry.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.reference?.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
        
        setEntries(filteredEntries);
      } catch (error) {
        console.error('Error al cargar registros contables:', error);
        setError('No se pudieron cargar los registros contables');
      } finally {
        setLoading(false);
      }
    };
    
    if (companies.length > 0) {
      fetchAccountingEntries();
    }
  }, [dateRange, statusFilter, searchTerm, companies, directionFilter]);

  // Función para formatear la fecha usando la utilidad global
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return utilFormatDate(dateString);
    } catch (e) {
      console.error('Error al formatear fecha:', e, dateString);
      return dateString;
    }
  };

  // Función para formatear el monto
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  // Función para exportar a Excel
  const exportToExcel = () => {
    if (entries.length === 0) return;
    
    // Preparar los datos para Excel
    const excelData = entries.map(entry => {
      // Extraer información de proveedor y RUT desde la descripción
      const providerMatch = entry.description?.match(/\(Proveedor: ([^)]+)\)/);
      const rutMatch = entry.description?.match(/\(RUT: ([^)]+)\)/);
      const provider = providerMatch ? providerMatch[1] : '-';
      const rut = rutMatch ? rutMatch[1] : '-';
      const cleanDescription = entry.description 
        ? entry.description.replace(/\(Proveedor: [^)]+\)|\(RUT: [^)]+\)|\(Doc: [^)]+\)/g, '').trim() 
        : '-';
        
      return {
        'Fecha': formatDate(entry.date),
        'Documento': entry.reference || '-',
        'Proveedor': provider,
        'RUT': rut,
        'Descripción': cleanDescription,
        'Monto': formatAmount(entry.amount).replace(/\./g, ''),
        'Estado': entry.status === 'reconciled' ? 'Conciliado' : 'Pendiente',
        'Tipo': entry.document_type || '-',
        'Dirección': entry.document_direction === 'emitida' ? 'Emitida' : 'Recibida'
      };
    });
    
    // Crear una hoja de trabajo
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    
    // Crear un libro de trabajo
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros Contables');
    
    // Guardar el archivo
    XLSX.writeFile(workbook, `registros_contables_${new Date().toISOString().split('T')[0]}.xlsx`);
  };
  
  // Función para exportar a PDF
  const exportToPDF = () => {
    if (entries.length === 0) return;
    
    // Crear el documento PDF
    const doc = new jsPDF('landscape');
    
    // Agregar título
    doc.setFontSize(18);
    doc.text('Registros Contables', 14, 20);
    doc.setFontSize(12);
    doc.text(`Fecha de exportación: ${formatDate(new Date().toISOString())}`, 14, 28);
    
    // Seleccionar empresa actual
    const currentCompany = companies.find(comp => comp.id === selectedCompany);
    if (currentCompany) {
      doc.text(`Empresa: ${currentCompany.name}`, 14, 36);
    }
    
    // Preparar los datos para la tabla
    const tableData = entries.map(entry => {
      // Extraer información de proveedor y RUT desde la descripción
      const providerMatch = entry.description?.match(/\(Proveedor: ([^)]+)\)/);
      const rutMatch = entry.description?.match(/\(RUT: ([^)]+)\)/);
      const provider = providerMatch ? providerMatch[1] : '-';
      const rut = rutMatch ? rutMatch[1] : '-';
      const cleanDescription = entry.description 
        ? entry.description.replace(/\(Proveedor: [^)]+\)|\(RUT: [^)]+\)|\(Doc: [^)]+\)/g, '').trim() 
        : '-';
        
      return [
        formatDate(entry.date),
        entry.reference || '-',
        provider.length > 15 ? provider.substring(0, 15) + '...' : provider,
        rut,
        cleanDescription.length > 20 ? cleanDescription.substring(0, 20) + '...' : cleanDescription,
        formatAmount(entry.amount),
        entry.status === 'reconciled' ? 'Conciliado' : 'Pendiente',
        entry.document_type || '-',
        entry.document_direction === 'emitida' ? 'Emitida' : 'Recibida'
      ];
    });
    
    // Definir las columnas
    const tableColumns = ['Fecha', 'Documento', 'Proveedor', 'RUT', 'Descripción', 'Monto', 'Estado', 'Tipo', 'Dirección'];
    
    // Generar la tabla
    autoTable(doc, {
      head: [tableColumns],
      body: tableData,
      startY: 44,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [75, 85, 165] }
    });
    
    // Guardar el archivo
    doc.save(`registros_contables_${new Date().toISOString().split('T')[0]}.pdf`);
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
                Registros Contables
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Visualiza los registros contables importados en el sistema
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
              <Link
                href="/dashboard/reconciliation/import"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Importar nuevos datos
              </Link>
            </div>
          </div>

          {/* Botones de exportación */}
          <div className="flex space-x-2 mb-4">
            <button
              onClick={exportToExcel}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none"
              disabled={entries.length === 0}
            >
              <ArrowDownTrayIcon className="-ml-1 mr-1 h-5 w-5" aria-hidden="true" />
              Exportar a Excel
            </button>
            <button
              onClick={exportToPDF}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none"
              disabled={entries.length === 0}
            >
              <ArrowDownTrayIcon className="-ml-1 mr-1 h-5 w-5" aria-hidden="true" />
              Exportar a PDF
            </button>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-5">
                <div>
                  <label htmlFor="company" className="block text-sm font-medium text-gray-700">
                    Empresa
                  </label>
                  <select
                    id="company"
                    name="company"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    value={selectedCompany || ''}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    disabled={companies.length === 0}
                  >
                    {companies.length === 0 ? (
                      <option>No hay empresas disponibles</option>
                    ) : (
                      companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
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
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                    Estado
                  </label>
                  <select
                    id="status"
                    name="status"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'reconciled')}
                  >
                    <option value="all">Todos</option>
                    <option value="pending">Pendientes</option>
                    <option value="reconciled">Conciliados</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="direction" className="block text-sm font-medium text-gray-700">
                    Tipo de Documento
                  </label>
                  <select
                    id="direction"
                    name="direction"
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    value={directionFilter}
                    onChange={(e) => setDirectionFilter(e.target.value as 'all' | 'emitida' | 'recibida')}
                  >
                    <option value="all">Todos</option>
                    <option value="emitida">Documentos Emitidos (Ventas)</option>
                    <option value="recibida">Documentos Recibidos (Compras)</option>
                  </select>
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
                    placeholder="Buscar por descripción"
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
                          Documento
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Proveedor
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          RUT
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Descripción
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Monto
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tipo Doc.
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                            Cargando registros...
                          </td>
                        </tr>
                      ) : entries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                            No se encontraron registros contables para los filtros seleccionados.
                          </td>
                        </tr>
                      ) : (
                        entries.map((entry) => (
                          <tr key={entry.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(entry.date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {entry.reference || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {entry.description && entry.description.includes('Proveedor:') 
                                ? entry.description.match(/\(Proveedor: ([^)]+)\)/)?.[1] || '-' 
                                : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {entry.description && entry.description.includes('RUT:') 
                                ? entry.description.match(/\(RUT: ([^)]+)\)/)?.[1] || '-' 
                                : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {entry.description 
                                ? entry.description.replace(/\(Proveedor: [^)]+\)|\(RUT: [^)]+\)|\(Doc: [^)]+\)/g, '').trim() 
                                : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatAmount(entry.amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                entry.status === 'reconciled' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {entry.status === 'reconciled' ? 'Conciliado' : 'Pendiente'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <DocumentTypeTag documentType={entry.document_type} direction={entry.document_direction} />
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