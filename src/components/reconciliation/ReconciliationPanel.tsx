import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { reconciliationService } from '@/services/reconciliation';
import type { BankTransaction, AccountingEntry, ReconciliationMatch } from '@/types';
import { supabase } from '@/lib/supabase';
import { formatDate, formatMoney } from '@/utils/format';
import Link from 'next/link';

// Definir la interfaz FilterState
interface FilterState {
  dateRange?: { start: Date; end: Date };
  amountRange?: { min: number; max: number };
  status?: 'all' | 'pending' | 'reconciled';
  searchTerm?: string;
}

interface ReconciliationPanelProps {
  bankAccountId: string;
  dateRange?: { start: Date; end: Date };
}

export default function ReconciliationPanel({ bankAccountId, dateRange }: ReconciliationPanelProps) {
  // Crear una instancia de QueryClient
  const queryClient = new QueryClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      <ReconciliationPanelContent bankAccountId={bankAccountId} dateRange={dateRange} />
    </QueryClientProvider>
  );
}

// Componente interno que usa hooks de React Query
function ReconciliationPanelContent({ bankAccountId, dateRange }: ReconciliationPanelProps): React.ReactNode {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<FilterState>({
    dateRange, // Aplicar directamente el rango de fechas desde props
    status: 'pending'
  });
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [autoReconciliationStatus, setAutoReconciliationStatus] = useState<{
    message: string;
    type: 'info' | 'success' | 'error' | 'loading';
  } | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [recentlyReconciledTxs, setRecentlyReconciledTxs] = useState<string[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  console.log('🔄 Renderizando ReconciliationPanel:', { 
    bankAccountId, 
    dateRange,
    filtrosActuales: filters
  });

  // Actualizar filtros cuando cambie dateRange en props
  useEffect(() => {
    console.log('📅 Actualizando dateRange desde props:', dateRange);
    setFilters(prev => ({
      ...prev,
      dateRange
    }));
  }, [dateRange]);

  // Obtener transacciones bancarias
  const { 
    data: bankTransactions = [], 
    isLoading: loadingTransactions,
    isError: bankTxError,
    error: bankTxErrorDetails
  } = useQuery({
    queryKey: ['bankTransactions', bankAccountId, filters],
    queryFn: async () => {
      console.log('🔄 Iniciando fetching de transacciones bancarias con ID:', bankAccountId);
      console.log('🔄 Filtros actuales:', JSON.stringify(filters, null, 2));
      
      try {
        // Verificar si el bankAccountId es válido
        if (!bankAccountId) {
          console.error('❌ Error: bankAccountId es null o undefined');
          return [];
        }
        
        // Diagnóstico de la cuenta bancaria
        console.log('🏦 Obteniendo detalles de la cuenta bancaria para diagnóstico');
        const { data: bankAccountDetails, error: bankDetailsError } = await supabase
          .from('bank_accounts')
          .select('*')
          .eq('id', bankAccountId)
          .single();
          
        if (bankDetailsError) {
          console.error('❌ Error al obtener detalles de la cuenta bancaria:', bankDetailsError);
        } else {
          console.log('✅ Detalles de la cuenta bancaria:', {
            id: bankAccountDetails.id,
            nombre: bankAccountDetails.name,
            banco: bankAccountDetails.bank_name,
            numero: bankAccountDetails.account_number,
            compañía: bankAccountDetails.company_id
          });
        }
        
        // Obtener TODAS las transacciones para la cuenta bancaria seleccionada
        console.log('🔍 Consultando todas las transacciones para la cuenta bancaria');
        const { data: allTransactions, error: allError } = await supabase
          .from('bank_transactions')
          .select('*')
          .eq('bank_account_id', bankAccountId);
        
        if (allError) {
          console.error('❌ Error al obtener las transacciones:', allError);
          throw allError;
        }
        
        console.log(`✅ Total de transacciones encontradas para la cuenta bancaria: ${allTransactions?.length || 0}`);
        
        // Si hay transacciones, aplicar los filtros
        if (allTransactions && allTransactions.length > 0) {
          console.log('🔬 Analizando fechas de las primeras 5 transacciones:');
          allTransactions.slice(0, 5).forEach((tx, i) => {
            console.log(`Transacción ${i+1}:`, {
              id: tx.id.substring(0, 8) + '...',
              transaction_date: tx.transaction_date,
              fecha_formateada: formatDate(tx.transaction_date)
            });
          });
          
          // Filtrar por fecha en memoria (similar a banco/page.tsx)
          let filteredResult = [...allTransactions];
          
          if (filters.dateRange && (filters.dateRange.start || filters.dateRange.end)) {
            console.log('🔄 Aplicando filtros de fecha:', {
              inicio: filters.dateRange.start ? filters.dateRange.start.toISOString().split('T')[0] : 'No especificado',
              fin: filters.dateRange.end ? filters.dateRange.end.toISOString().split('T')[0] : 'No especificado'
            });
            
            const startDate = filters.dateRange.start ? filters.dateRange.start : null;
            const endDate = filters.dateRange.end ? filters.dateRange.end : null;
            
            // Filtrar en memoria de forma segura
            const beforeCount = filteredResult.length;
            
            filteredResult = filteredResult.filter(tx => {
              // Convertir la fecha de la transacción a un objeto Date sin zone offset
              // Usamos split('T')[0] para asegurarnos de trabajar solo con la parte de la fecha
              const txDateStr = tx.transaction_date.split('T')[0];
              
              // Extraer solo la parte YYYY-MM-DD de las fechas de filtro
              const startDateStr = startDate ? startDate.toISOString().split('T')[0] : null;
              const endDateStr = endDate ? endDate.toISOString().split('T')[0] : null;
              
              // Comparar solo las partes de fecha sin time
              if (startDateStr && endDateStr) {
                return txDateStr >= startDateStr && txDateStr <= endDateStr;
              } else if (startDateStr) {
                return txDateStr >= startDateStr;
              } else if (endDateStr) {
                return txDateStr <= endDateStr;
              }
              
              return true;
            });
            
            console.log(`📊 Después de filtrar por fecha: ${filteredResult.length} transacciones (eliminadas: ${beforeCount - filteredResult.length})`);
            
            // Si no se encontraron registros en el rango de fechas, mostrar diagnóstico
            if (filteredResult.length === 0 && allTransactions.length > 0) {
              console.warn('⚠️ No se encontraron transacciones dentro del rango de fechas especificado');
              
              // Mostrar rango de fechas disponibles
              const allDates = allTransactions
                .map(tx => tx.transaction_date)
                .filter(date => date);
                
              if (allDates.length > 0) {
                const sortedDates = [...allDates].sort();
                console.log('📅 Rango de fechas disponibles en transacciones:', {
                  minima: sortedDates[0],
                  maxima: sortedDates[sortedDates.length - 1]
                });
              }
            }
          }
          
          // Filtrar por búsqueda
          if (filters.searchTerm) {
            const searchLower = filters.searchTerm.toLowerCase();
            console.log('🔍 Aplicando filtro de texto:', searchLower);
            
            filteredResult = filteredResult.filter(tx => {
              return (
                (tx.description && tx.description.toLowerCase().includes(searchLower)) ||
                (tx.reference && tx.reference.toLowerCase().includes(searchLower)) ||
                (tx.reference_number && tx.reference_number.toLowerCase().includes(searchLower))
              );
            });
            
            console.log(`📊 Después de filtrar por texto: ${filteredResult.length} transacciones`);
          }
          
          // Ordenar por fecha, más reciente primero
          filteredResult.sort((a, b) => {
            const dateA = new Date(a.transaction_date || 0);
            const dateB = new Date(b.transaction_date || 0);
            return dateB.getTime() - dateA.getTime();
          });
          
          return filteredResult;
        } else {
          console.log('⚠️ No se encontraron transacciones para esta cuenta bancaria');
          return [];
        }
      } catch (error) {
        console.error('❌ Error al cargar transacciones bancarias:', error);
        throw error;
      }
    },
    enabled: !!bankAccountId
  });

  // Obtener registros contables
  const { 
    data: accountingEntries = [], 
    isLoading: loadingEntries,
    isError: entriesError,
    error: entriesErrorDetails
  } = useQuery({
    queryKey: ['accountingEntries', bankAccountId, filters],
    queryFn: async () => {
      console.log('🔍 Iniciando fetching de registros contables con ID de cuenta:', bankAccountId);
      console.log('🔍 Filtros de registros contables:', JSON.stringify(filters, null, 2));
      
      try {
        // Primero necesitamos obtener la company_id asociada a la cuenta bancaria
        const { data: bankAccount, error: bankAccountError } = await supabase
          .from('bank_accounts')
          .select('company_id')
          .eq('id', bankAccountId)
          .single();
        
        if (bankAccountError) {
          console.error('❌ Error al obtener company_id de la cuenta bancaria:', bankAccountError);
          throw bankAccountError;
        }
        
        console.log('🏢 ID de empresa asociada a la cuenta bancaria:', bankAccount.company_id);
        
        // Ahora obtenemos TODOS los registros contables de esta empresa
        const { data: allEntries, error: allError } = await supabase
          .from('accounting_entries')
          .select('*')
          .eq('company_id', bankAccount.company_id);
        
        if (allError) {
          console.error('❌ Error al obtener todos los registros contables:', allError);
          throw allError;
        }
        
        console.log(`✅ Total de registros contables encontrados: ${allEntries?.length || 0}`);
        
        // Si hay registros, aplicar filtros en memoria
        if (allEntries && allEntries.length > 0) {
          console.log('🔬 Analizando fechas de los primeros 5 registros contables:');
          allEntries.slice(0, 5).forEach((entry, i) => {
            console.log(`Registro ${i+1}:`, {
              id: entry.id.substring(0, 8) + '...',
              fecha: entry.date,
              fecha_formateada: formatDate(entry.date)
            });
          });
          
          // Filtrar por fecha en memoria (similar a las transacciones bancarias)
          let filteredResult = [...allEntries];
          
          if (filters.dateRange && (filters.dateRange.start || filters.dateRange.end)) {
            console.log('🔄 Aplicando filtros de fecha a registros contables:', {
              inicio: filters.dateRange.start ? filters.dateRange.start.toISOString().split('T')[0] : 'No especificado',
              fin: filters.dateRange.end ? filters.dateRange.end.toISOString().split('T')[0] : 'No especificado'
            });
            
            const startDate = filters.dateRange.start ? filters.dateRange.start : null;
            const endDate = filters.dateRange.end ? filters.dateRange.end : null;
            
            // Filtrar en memoria de forma segura
            const beforeCount = filteredResult.length;
            
            filteredResult = filteredResult.filter(entry => {
              // Verificar que el registro tiene fecha
              if (!entry.date) {
                console.warn('⚠️ Registro contable sin fecha:', entry.id);
                return false;
              }
              
              // Convertir la fecha del registro a un string YYYY-MM-DD
              const entryDateStr = entry.date.split('T')[0];
              
              // Extraer solo la parte YYYY-MM-DD de las fechas de filtro
              const startDateStr = startDate ? startDate.toISOString().split('T')[0] : null;
              const endDateStr = endDate ? endDate.toISOString().split('T')[0] : null;
              
              // Comparar solo las partes de fecha sin time
              if (startDateStr && endDateStr) {
                return entryDateStr >= startDateStr && entryDateStr <= endDateStr;
              } else if (startDateStr) {
                return entryDateStr >= startDateStr;
              } else if (endDateStr) {
                return entryDateStr <= endDateStr;
              }
              
              return true;
            });
            
            console.log(`📊 Después de filtrar por fecha: ${filteredResult.length} registros contables (eliminados: ${beforeCount - filteredResult.length})`);
            
            // Si no se encontraron registros en el rango de fechas, mostrar diagnóstico
            if (filteredResult.length === 0 && allEntries.length > 0) {
              console.warn('⚠️ No se encontraron registros contables dentro del rango de fechas especificado');
              
              // Mostrar rango de fechas disponibles
              const allDates = allEntries
                .map(entry => entry.date)
                .filter(date => date);
                
              if (allDates.length > 0) {
                const sortedDates = [...allDates].sort();
                console.log('📅 Rango de fechas disponibles en registros contables:', {
                  minima: sortedDates[0],
                  maxima: sortedDates[sortedDates.length - 1]
                });
              }
            }
          }
          
          // Filtrar por status
          if (filters.status && filters.status !== 'all') {
            console.log('🔍 Aplicando filtro de estado a registros contables:', filters.status);
            filteredResult = filteredResult.filter(entry => entry.status === filters.status);
            console.log(`📊 Después de filtrar por estado: ${filteredResult.length} registros contables`);
          }
          
          // Filtrar por término de búsqueda
          if (filters.searchTerm) {
            console.log('🔍 Aplicando filtro de texto a registros contables:', filters.searchTerm);
            const searchLower = filters.searchTerm.toLowerCase();
            
            filteredResult = filteredResult.filter(entry => 
              (entry.description && entry.description.toLowerCase().includes(searchLower)) ||
              (entry.reference && entry.reference.toLowerCase().includes(searchLower))
            );
            
            console.log(`📊 Después de filtrar por texto: ${filteredResult.length} registros contables`);
          }
          
          // Ordenar por fecha, más reciente primero
          filteredResult.sort((a, b) => {
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);
            return dateB.getTime() - dateA.getTime();
          });
          
          return filteredResult;
        } else {
          console.log('⚠️ No se encontraron registros contables');
          return [];
        }
      } catch (error) {
        console.error('❌ Error al obtener registros contables:', error);
        throw error;
      }
    },
    retry: 1 // Limitar reintentos para evitar bucles infinitos
  });

  // Obtener conciliaciones existentes
  const { data: matches = [], isLoading: loadingMatches } = useQuery({
    queryKey: ['reconciliations', bankAccountId],
    queryFn: () => reconciliationService.getMatches(bankAccountId)
  });

  // Calcular el resumen usando useMemo para evitar cálculos innecesarios y ciclos infinitos
  const reconciliationSummary = useMemo(() => {
    if (!bankTransactions || !matches) {
      return {
        reconciledCount: 0,
        totalCount: 0,
        reconciledAmount: 0,
        pendingAmount: 0
      };
    }
    
    console.log('Calculando resumen de conciliación con useMemo');
    
    try {
      const reconciledTxs = bankTransactions.filter(tx => 
        matches.some(m => m.bank_transaction_id === tx.id) || tx.status === 'reconciled'
      );
      
      const reconciledCount = reconciledTxs.length;
      const totalCount = bankTransactions.length;
      
      // Calcular montos
      let reconciledAmount = 0;
      let pendingAmount = 0;
      
      // Una sola iteración a través de las transacciones
      bankTransactions.forEach(tx => {
        const isReconciled = matches.some(m => m.bank_transaction_id === tx.id) || 
                            tx.status === 'reconciled';
        
        if (isReconciled) {
          reconciledAmount += tx.amount;
        } else {
          pendingAmount += tx.amount;
        }
      });
      
      return {
        reconciledCount,
        totalCount,
        reconciledAmount,
        pendingAmount
      };
    } catch (error) {
      console.error('Error al calcular el resumen de conciliación:', error);
      return {
        reconciledCount: 0,
        totalCount: 0,
        reconciledAmount: 0,
        pendingAmount: 0
      };
    }
  }, [bankTransactions, matches]);

  // Mutación para crear conciliación
  const createMatchMutation = useMutation({
    mutationFn: reconciliationService.createMatch,
    onSuccess: (data, variables) => {
      // Marcar la transacción como recientemente conciliada
      setRecentlyReconciledTxs(prev => [...prev, variables.bankTransactionId]);
      
      // Mostrar notificación
      setNotificationMessage('¡Conciliación realizada con éxito!');
      setShowNotification(true);
      
      // Ocultar notificación después de 3 segundos
      setTimeout(() => {
        setShowNotification(false);
      }, 3000);
      
      // Invalidar consultas para actualizar los datos
      queryClient.invalidateQueries({ queryKey: ['reconciliations', bankAccountId] });
      queryClient.invalidateQueries({ queryKey: ['bankTransactions', bankAccountId] });
      queryClient.invalidateQueries({ queryKey: ['accountingEntries', bankAccountId] });
      
      // Forzar la actualización inmediata de los datos
      queryClient.refetchQueries({ queryKey: ['bankTransactions', bankAccountId] });
      queryClient.refetchQueries({ queryKey: ['accountingEntries', bankAccountId] });
      
      // Actualización local inmediata: Filtrar el registro contable conciliado
      // Esto garantiza que el panel se actualice visualmente incluso antes de que las consultas se completen
      const accountingEntryId = variables.accountingEntryId;
      queryClient.setQueryData(['accountingEntries', bankAccountId, filters], (old: AccountingEntry[] | undefined) => {
        if (!old) return [];
        return old.filter(entry => entry.id !== accountingEntryId);
      });
    },
    onError: (error) => {
      // Mostrar notificación de error
      setNotificationMessage('Error al realizar la conciliación. Intente nuevamente.');
      setShowNotification(true);
      
      // Ocultar notificación después de 3 segundos
      setTimeout(() => {
        setShowNotification(false);
      }, 3000);
      
      console.error('Error en conciliación manual:', error);
    }
  });

  // Mutación para eliminar conciliación
  const deleteMatchMutation = useMutation({
    mutationFn: reconciliationService.deleteMatch,
    onSuccess: (_, variables) => {
      // Buscar el match que se está eliminando para obtener el ID del registro contable
      const matchToDelete = matches.find(m => m.id === variables);
      
      // Invalidar las consultas
      queryClient.invalidateQueries({ queryKey: ['reconciliations', bankAccountId] });
      queryClient.invalidateQueries({ queryKey: ['bankTransactions', bankAccountId] });
      queryClient.invalidateQueries({ queryKey: ['accountingEntries', bankAccountId] });
      
      // Forzar la actualización inmediata de los datos para ambos paneles
      queryClient.refetchQueries({ queryKey: ['bankTransactions', bankAccountId] });
      queryClient.refetchQueries({ queryKey: ['accountingEntries', bankAccountId] });
      
      // Si encontramos la conciliación, actualizar localmente el registro contable para mostrarlo inmediatamente
      if (matchToDelete && matchToDelete.accounting_entry_id) {
        // Usamos una función asíncrona autoinvocada para manejar la promesa
        (async () => {
          try {
            // Buscar el registro contable actualizado para añadirlo nuevamente al estado
            const { data, error } = await supabase
              .from('accounting_entries')
              .select('*')
              .eq('id', matchToDelete.accounting_entry_id)
              .single();
            
            if (error) {
              throw error;
            }
            
            if (data) {
              // Actualizar el estado local añadiendo el registro contable nuevamente
              queryClient.setQueryData(['accountingEntries', bankAccountId, filters], (old: AccountingEntry[] | undefined) => {
                if (!old) return [data];
                // Verificar si ya existe para evitar duplicados
                if (!old.some(e => e.id === data.id)) {
                  return [...old, data];
                }
                return old;
              });
            }
          } catch (error) {
            console.error('Error al obtener registro contable después de eliminar conciliación:', error);
          }
        })();
      }
    }
  });

  // Mutación para conciliación automática
  const autoReconcileMutation = useMutation({
    mutationFn: () => {
      console.log('🔄 Iniciando conciliación automática:', { bankAccountId, dateRange });
      setAutoReconciliationStatus({
        message: 'Ejecutando conciliación automática...',
        type: 'loading'
      });
      return reconciliationService.autoReconcile(bankAccountId, filters.dateRange);
    },
    onSuccess: (data) => {
      console.log('✅ Conciliación automática completada:', data);
      
      // Invalidar las consultas
      queryClient.invalidateQueries({ queryKey: ['reconciliations', bankAccountId] });
      queryClient.invalidateQueries({ queryKey: ['bankTransactions', bankAccountId] });
      queryClient.invalidateQueries({ queryKey: ['accountingEntries', bankAccountId] });
      
      // Forzar la actualización inmediata sin recargar la página completa
      queryClient.refetchQueries({ queryKey: ['reconciliations', bankAccountId] });
      queryClient.refetchQueries({ queryKey: ['bankTransactions', bankAccountId] });
      queryClient.refetchQueries({ queryKey: ['accountingEntries', bankAccountId] });
      
      // Actualizar el mensaje de éxito sin reiniciar los filtros
      setAutoReconciliationStatus({
        message: `Conciliación automática completada. ${data.length} coincidencias encontradas.`,
        type: 'success'
      });
      
      // Mostrar una notificación temporal en lugar de una cuenta regresiva con recarga
      setNotificationMessage(`¡Conciliación automática completada! ${data.length} coincidencias encontradas.`);
      setShowNotification(true);
      
      // Ocultar notificación después de 5 segundos
      setTimeout(() => {
        setShowNotification(false);
        // Limpiar el mensaje de estado después de la notificación
        setAutoReconciliationStatus(null);
      }, 5000);
    },
    onError: (error: any) => {
      console.error('❌ Error en conciliación automática:', error);
      
      // Obtener detalles más específicos del error
      let errorMessage = 'Error desconocido';
      let details = '';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Si es un error de Supabase, podría tener más detalles
        if ('code' in error) {
          details = `Código: ${(error as any).code}`;
        }
        
        // Si hay una causa subyacente
        if ('cause' in error && error.cause) {
          details += ` Causa: ${String(error.cause)}`;
        }
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      }
      
      setErrorDetails(details);
      setAutoReconciliationStatus({
        message: `Error en conciliación automática: ${errorMessage}`,
        type: 'error'
      });
    }
  });

  // Logear errores para diagnóstico
  useEffect(() => {
    if (bankTxError) {
      console.error('❌ Error al cargar transacciones bancarias:', bankTxErrorDetails);
    }
    if (entriesError) {
      console.error('❌ Error al cargar registros contables:', entriesErrorDetails);
    }
  }, [bankTxError, entriesError, bankTxErrorDetails, entriesErrorDetails]);

  useEffect(() => {
    console.log('📊 Datos cargados:', {
      transactions: bankTransactions.length,
      entries: accountingEntries.length,
      matches: matches.length
    });
  }, [bankTransactions, accountingEntries, matches]);

  // Mostrar mensajes de error en la interfaz
  const ErrorMessage = ({ title, error }: { title: string, error: any }) => {
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === 'object' && error !== null 
        ? JSON.stringify(error) 
        : 'Error desconocido';
    
    return (
      <div className="p-4 mb-4 border rounded-md bg-red-50 border-red-200 text-red-800">
        <h4 className="font-medium mb-1">{title}</h4>
        <p className="text-sm">{errorMessage}</p>
      </div>
    );
  };

  // Componente para mostrar mensajes de estado
  const StatusMessage = () => {
    if (!autoReconciliationStatus) return null;
    
    const bgColorClass = {
      info: 'bg-blue-50 border-blue-200 text-blue-800',
      success: 'bg-green-50 border-green-200 text-green-800',
      error: 'bg-red-50 border-red-200 text-red-800',
      loading: 'bg-yellow-50 border-yellow-200 text-yellow-800'
    }[autoReconciliationStatus.type];
    
    return (
      <div className={`p-4 mb-4 rounded-md border ${bgColorClass} transition-all`}>
        {autoReconciliationStatus.type === 'loading' && (
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-yellow-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {autoReconciliationStatus.message}
          </div>
        )}
        {autoReconciliationStatus.type === 'success' && (
          <div className="flex items-center">
            <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {autoReconciliationStatus.message}
          </div>
        )}
        {autoReconciliationStatus.type === 'error' && (
          <div>
            <div className="flex items-center justify-between">
              <div>{autoReconciliationStatus.message}</div>
              <button 
                onClick={() => console.log('🔍 Abrir consola para más detalles')}
                className="text-xs underline text-red-700 hover:text-red-900"
              >
                Ver consola para más detalles
              </button>
            </div>
            {errorDetails && (
              <div className="mt-2 text-xs font-mono bg-red-100 p-2 rounded">
                {errorDetails}
              </div>
            )}
            <div className="mt-2 text-xs">
              <button 
                onClick={() => {
                  // Un enfoque alternativo para resolver problemas
                  fetch(`/api/reconciliation/fix-db`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ bankAccountId }),
                  })
                  .then(response => response.json())
                  .then(data => {
                    console.log('✅ Resultado de intento de corrección:', data);
                    if (data.success) {
                      setAutoReconciliationStatus({
                        message: 'Problema corregido. Intente la conciliación nuevamente.',
                        type: 'success'
                      });
                    }
                  })
                  .catch(err => {
                    console.error('Error al intentar corregir:', err);
                  });
                }}
                className="px-2 py-1 bg-red-700 text-white rounded hover:bg-red-800"
              >
                Intentar reparar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Componente para una transacción bancaria
  const BankTransactionItem = ({ transaction }: { transaction: BankTransaction }) => {
    const [{ isDragging }, drag] = useDrag(() => ({
      type: 'TRANSACTION',
      item: { id: transaction.id, type: 'bank' },
      collect: (monitor) => ({
        isDragging: monitor.isDragging()
      })
    }));

    const isReconciled = matches.some(m => m.bank_transaction_id === transaction.id) || transaction.status === 'reconciled';
    const isRecentlyReconciled = recentlyReconciledTxs.includes(transaction.id);
    const isSelected = selectedTransaction === transaction.id;

    // Añadir logs de diagnóstico para fechas en transacciones bancarias
    useEffect(() => {
      console.log('🏦 Diagnóstico de fecha en transacción bancaria:', {
        id: transaction.id.substring(0, 8) + '...',
        descripcion: transaction.description?.substring(0, 20) + '...',
        fecha_original: transaction.transaction_date,
        monto: transaction.amount,
        fecha_formateada: formatDate(transaction.transaction_date)
      });
    }, [transaction]);

    return (
      <div
        ref={drag as any}
        onClick={() => setSelectedTransaction(transaction.id)}
        className={`
          p-2 rounded cursor-pointer transition-all duration-300
          ${isDragging ? 'opacity-50' : 'opacity-100'}
          ${isRecentlyReconciled 
            ? 'bg-green-200 border-2 border-green-500 shadow-md' 
            : isReconciled 
              ? 'bg-green-100 border border-green-300' 
              : isSelected 
                ? 'bg-blue-100 border border-blue-300' 
                : 'bg-white hover:bg-gray-50 border border-gray-200'}
          ${(isRecentlyReconciled || isReconciled) ? 'transform scale-100' : ''}
        `}
      >
        <div className="flex justify-between items-start mb-1">
          <div className="text-xs font-medium text-gray-500">
            {formatDate(transaction.transaction_date)}
          </div>
          <div className={`text-sm font-semibold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatMoney(transaction.amount)}
          </div>
        </div>
        <div className="text-sm truncate" title={transaction.description}>
          {transaction.description}
        </div>
        {transaction.reference_number && (
          <div className="text-xs text-gray-500 truncate">
            Ref: {transaction.reference_number}
          </div>
        )}
        {(isReconciled || isRecentlyReconciled) && (
          <div className={`mt-1 text-xs font-medium flex items-center ${isRecentlyReconciled ? 'text-green-700' : 'text-green-600'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {isRecentlyReconciled ? '¡Conciliado exitosamente!' : 'Conciliado'}
          </div>
        )}
      </div>
    );
  };

  // Componente para un registro contable
  const AccountingEntryItem = ({ entry }: { entry: AccountingEntry }) => {
    const [{ isOver }, drop] = useDrop(() => ({
      accept: 'TRANSACTION',
      drop: (item: { id: string; type: string }) => {
        if (item.type === 'bank') {
          createMatchMutation.mutate({
            bankTransactionId: item.id,
            accountingEntryId: entry.id,
            reconciliationMethod: 'manual',
            confidence: 100,
            matchType: 'manual'
          });
        }
      },
      collect: (monitor) => ({
        isOver: monitor.isOver()
      })
    }));

    const isReconciled = matches.some(m => m.accounting_entry_id === entry.id);
    const matchConfidence = selectedTransaction 
      ? bankTransactions.find(t => t.id === selectedTransaction) 
        ? reconciliationService.calculateMatchConfidence(
            bankTransactions.find(t => t.id === selectedTransaction)!,
            entry
          ) 
        : null
      : null;

    // Añadir logs de diagnóstico para entradas contables
    console.log('📝 Mostrando entrada contable:', {
      id: entry.id,
      fecha: entry.date,
      descripción: entry.description,
      monto: entry.amount,
      tipo: entry.document_type || 'sin tipo',
      direccion: entry.document_direction || 'sin dirección',
      formatoFecha: formatDate(entry.date)
    });

    // Formatear el tipo de documento
    const getDocumentTypeLabel = (entry: AccountingEntry): string => {
      if (!entry.document_type) return 'Registro';
      
      const docTypes: Record<string, string> = {
        'invoice': 'Factura',
        'credit_note': 'Nota de Crédito',
        'debit_note': 'Nota de Débito',
        'payment': 'Pago',
        'transfer': 'Transferencia',
        'deposit': 'Depósito',
        'withdrawal': 'Retiro'
      };
      
      return docTypes[entry.document_type] || entry.document_type;
    };

    // Determinar si es emitida o recibida
    const isEmitida = entry.document_direction === 'emitida';
    const isRecibida = entry.document_direction === 'recibida';
    
    // Colores según tipo de documento
    let docTypeColor = '';
    let docTypeBgColor = '';
    
    if (isEmitida) {
      docTypeColor = 'text-teal-800';
      docTypeBgColor = 'bg-teal-100';
    } else if (isRecibida) {
      docTypeColor = 'text-orange-800';
      docTypeBgColor = 'bg-orange-100';
    }

    return (
      <div
        ref={drop as any}
        className={`p-4 mb-2 rounded-lg border transition-all duration-200 ${
          isOver ? 'bg-indigo-100 border-indigo-300 shadow-lg transform scale-105' : ''
        } ${isReconciled ? 'bg-green-50 border-green-200' : isEmitida ? 'bg-teal-50 border-teal-200' : isRecibida ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'
        }`}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="font-medium flex items-center gap-2">
              {formatDate(entry.date)}
              {(isEmitida || isRecibida) && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${docTypeBgColor} ${docTypeColor}`}>
                  {isEmitida ? 'EMITIDA' : 'RECIBIDA'}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-600 flex items-center gap-2">
              <span className={isEmitida ? 'text-teal-700' : isRecibida ? 'text-orange-700' : ''}>
                {getDocumentTypeLabel(entry)}
              </span>
            </div>
          </div>
          <div className="font-bold">
            {formatMoney(entry.amount)}
          </div>
        </div>
        {entry.reference && (
          <div className="mt-1 text-xs text-gray-500">
            Ref: {entry.reference}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className={`text-xs px-2 py-1 rounded-full ${
            isReconciled 
              ? 'bg-green-100 text-green-800'
              : matchConfidence && matchConfidence > 70
              ? 'bg-yellow-100 text-yellow-800'
              : isOver
              ? 'bg-indigo-100 text-indigo-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {isReconciled 
              ? '✓ Conciliado'
              : matchConfidence && matchConfidence > 70
              ? `${matchConfidence}% coincidencia`
              : isOver
              ? 'Suelte para conciliar'
              : 'Sin conciliar'
            }
          </div>
          {isReconciled && (
            <button
              onClick={() => {
                const match = matches.find(m => m.accounting_entry_id === entry.id);
                if (match) deleteMatchMutation.mutate(match.id);
              }}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Deshacer
            </button>
          )}
        </div>
        {isOver && (
          <div className="absolute inset-0 bg-indigo-200 opacity-10 rounded-lg pointer-events-none flex items-center justify-center">
            <div className="text-indigo-800 bg-white p-2 rounded-lg shadow">
              Suelte para conciliar
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 relative">
      {/* Barra de herramientas */}
      <div className="mb-6 flex justify-between items-center">
        <div className="flex space-x-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar..."
              className="pl-10 pr-4 py-2 border rounded-lg"
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
            />
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
          <button
            onClick={() => setFilters({ ...filters })}
            className="flex items-center px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <FunnelIcon className="h-5 w-5 mr-2" />
            Filtros
          </button>
        </div>
        <div className="flex space-x-2">
          <Link
            href="/dashboard/reconciliation/reconciled"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Ver Conciliaciones
          </Link>
          <button
            onClick={() => autoReconcileMutation.mutate()}
            disabled={autoReconcileMutation.isPending}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {autoReconcileMutation.isPending ? 'Procesando...' : 'Conciliación Automática'}
          </button>
        </div>
      </div>

      {/* Mensaje de estado */}
      <StatusMessage />
      
      {/* Mensajes de error */}
      {bankTxError && (
        <ErrorMessage 
          title="Error al cargar transacciones bancarias" 
          error={bankTxErrorDetails} 
        />
      )}
      {entriesError && (
        <ErrorMessage 
          title="Error al cargar registros contables" 
          error={entriesErrorDetails} 
        />
      )}

      {/* Contenedor principal */}
      <div className="grid grid-cols-2 gap-6">
        {/* Transacciones bancarias */}
        <div className="flex flex-col">
          <div className="bg-white p-4 rounded-t-lg border-b shadow-sm z-10">
            <h3 className="text-lg font-semibold">Transacciones Bancarias {bankTransactions.length > 0 && `(${bankTransactions.length})`}</h3>
          </div>
          <div className="bg-gray-50 rounded-b-lg flex-1">
            {loadingTransactions ? (
              <div className="text-center py-4">Cargando transacciones...</div>
            ) : bankTxError ? (
              <div className="text-center py-4 text-red-500">Error al cargar transacciones</div>
            ) : bankTransactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">No hay transacciones bancarias disponibles para los filtros seleccionados</p>
                <p className="text-sm text-gray-400">Prueba ajustando el rango de fechas o selecciona otra cuenta bancaria</p>
              </div>
            ) : (
              <div className="space-y-2 h-[600px] overflow-y-auto p-4 custom-scrollbar">
                {bankTransactions.map((transaction) => (
                  <BankTransactionItem
                    key={transaction.id}
                    transaction={transaction}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Registros contables */}
        <div className="flex flex-col">
          <div className="bg-white p-4 rounded-t-lg border-b shadow-sm z-10">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Registros Contables {accountingEntries.length > 0 && `(${accountingEntries.length})`}</h3>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-teal-100 border border-teal-200 mr-1"></div>
                  <span className="text-teal-800">Emitida (Venta)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-orange-100 border border-orange-200 mr-1"></div>
                  <span className="text-orange-800">Recibida (Compra)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-100 border border-green-200 mr-1"></div>
                  <span className="text-green-800">Conciliado</span>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-b-lg flex-1">
            {loadingEntries ? (
              <div className="text-center py-4">Cargando registros...</div>
            ) : entriesError ? (
              <div className="text-center py-4 text-red-500">Error al cargar registros contables</div>
            ) : accountingEntries.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">No hay registros contables disponibles para los filtros seleccionados</p>
                <p className="text-sm text-gray-400">Prueba ajustando el rango de fechas o importa nuevos datos contables</p>
              </div>
            ) : (
              <div className="space-y-2 h-[600px] overflow-y-auto p-4 custom-scrollbar">
                {accountingEntries.map((entry) => (
                  <AccountingEntryItem
                    key={entry.id}
                    entry={entry}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resumen */}
      {!bankTxError && !entriesError && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Resumen de Conciliación</h3>
            <Link
              href="/dashboard/reconciliation/reconciled"
              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
            >
              Ver historial completo
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-2xl font-bold">
                {reconciliationSummary.reconciledCount} / {reconciliationSummary.totalCount}
              </div>
              <div className="text-sm text-gray-600">Transacciones conciliadas</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-2xl font-bold text-green-600">
                {formatMoney(reconciliationSummary.reconciledAmount)}
              </div>
              <div className="text-sm text-gray-600">Monto conciliado</div>
            </div>
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-2xl font-bold text-yellow-600">
                {formatMoney(reconciliationSummary.pendingAmount)}
              </div>
              <div className="text-sm text-gray-600">Monto pendiente</div>
            </div>
          </div>
        </div>
      )}

      {/* Notificación de conciliación exitosa */}
      {showNotification && (
        <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border-l-4 border-green-500 animate-fade-in-up">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">
                {notificationMessage}
              </p>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
              <button
                onClick={() => setShowNotification(false)}
                className="inline-flex text-gray-400 hover:text-gray-500"
              >
                <span className="sr-only">Cerrar</span>
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 