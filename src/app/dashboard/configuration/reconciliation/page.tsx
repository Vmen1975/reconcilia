'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { HomeIcon, AdjustmentsHorizontalIcon, BuildingOfficeIcon, BanknotesIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Loader2 } from 'lucide-react';

export default function ReconciliationConfigPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Parámetros de conciliación
  const [config, setConfig] = useState({
    exactMatchConfidence: 100,       // Confianza para coincidencias exactas
    dateAmountMatchConfidence: 95,   // Confianza para coincidencias de fecha y monto
    minConfidenceThreshold: 70,      // Confianza mínima para considerar una coincidencia válida
    
    // Pesos para el cálculo de confianza
    amountWeight: 50,                // Peso del monto en el cálculo (max 50%)
    dateWeight: 30,                  // Peso de la fecha en el cálculo (max 30%)
    descriptionWeight: 20,           // Peso de la descripción en el cálculo (max 20%)
    
    // Tolerancias
    amountTolerancePercent: 1,       // Tolerancia de diferencia en monto (1%)
    dateTolerance: 3,                // Tolerancia de días para coincidencia de fecha
    
    // Estrategia de conciliación
    prioritizeExactMatches: true,    // Priorizar coincidencias exactas
    autoReconcileAboveThreshold: 90, // Conciliar automáticamente si la confianza supera este umbral
  });
  
  // Cargar configuración inicial
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Buscar si existe una configuración personalizada en la base de datos
        const { data, error } = await supabase
          .from('system_config')
          .select('*')
          .eq('config_key', 'reconciliation_params')
          .maybeSingle();
        
        if (error) throw error;
        
        // Si hay configuración personalizada, cargarla
        if (data && data.config_value) {
          setConfig(JSON.parse(data.config_value));
        }
      } catch (err) {
        console.error('Error al cargar configuración:', err);
        setError('No se pudo cargar la configuración. Se usarán los valores por defecto.');
      } finally {
        setLoading(false);
      }
    };
    
    loadConfig();
  }, [supabase]);
  
  // Guardar configuración
  const saveConfig = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      // Validar que los pesos sumen 100%
      const totalWeight = config.amountWeight + config.dateWeight + config.descriptionWeight;
      if (totalWeight !== 100) {
        setError(`La suma de los pesos debe ser 100%. Actualmente es ${totalWeight}%`);
        return;
      }
      
      // Guardar configuración en la base de datos
      const { error } = await supabase
        .from('system_config')
        .upsert({
          config_key: 'reconciliation_params',
          config_value: JSON.stringify(config),
          updated_at: new Date().toISOString()
        }, { onConflict: 'config_key' });
      
      if (error) throw error;
      
      setSuccess('Configuración guardada exitosamente');
    } catch (err) {
      console.error('Error al guardar configuración:', err);
      setError('No se pudo guardar la configuración');
    } finally {
      setSaving(false);
    }
  };
  
  // Restablecer valores predeterminados
  const resetToDefaults = () => {
    setConfig({
      exactMatchConfidence: 100,
      dateAmountMatchConfidence: 95,
      minConfidenceThreshold: 70,
      amountWeight: 50,
      dateWeight: 30,
      descriptionWeight: 20,
      amountTolerancePercent: 1,
      dateTolerance: 3,
      prioritizeExactMatches: true,
      autoReconcileAboveThreshold: 90
    });
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
                className="flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 hover:text-indigo-600"
              >
                <AdjustmentsHorizontalIcon className="mr-3 h-5 w-5 text-gray-400" />
                Conciliación
              </Link>
            </li>
            <li>
              <Link 
                href="/dashboard/configuration" 
                className="flex items-center px-2 py-2 text-sm font-medium rounded-md bg-indigo-50 text-indigo-600"
              >
                <AdjustmentsHorizontalIcon className="mr-3 h-5 w-5 text-indigo-500" />
                Configuración
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
                Configuración de Conciliación
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Ajusta los parámetros que determinan cómo se concilian los registros bancarios y contables
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex space-x-3">
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowLeftIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Volver al Dashboard
              </button>
            </div>
          </div>

          {loading ? (
            <div className="bg-white shadow sm:rounded-lg p-8 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="bg-white shadow sm:rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-700">{error}</p>
                  </div>
                )}
                
                {success && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-green-700">{success}</p>
                  </div>
                )}
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Umbrales de Confianza</h3>
                    <p className="mt-1 text-sm text-gray-500">Define los niveles de confianza para diferentes tipos de coincidencias</p>
                    
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Confianza mínima (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={config.minConfidenceThreshold}
                          onChange={(e) => setConfig({...config, minConfidenceThreshold: parseInt(e.target.value) || 0})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500">Umbral mínimo para considerar una coincidencia válida</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Conciliación Automática (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={config.autoReconcileAboveThreshold}
                          onChange={(e) => setConfig({...config, autoReconcileAboveThreshold: parseInt(e.target.value) || 0})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500">Conciliar automáticamente si la confianza supera este umbral</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Pesos para Cálculo de Confianza</h3>
                    <p className="mt-1 text-sm text-gray-500">Define el peso de cada factor en el cálculo de confianza (debe sumar 100%)</p>
                    
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Peso del Monto (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={config.amountWeight}
                          onChange={(e) => setConfig({...config, amountWeight: parseInt(e.target.value) || 0})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Peso de la Fecha (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={config.dateWeight}
                          onChange={(e) => setConfig({...config, dateWeight: parseInt(e.target.value) || 0})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Peso de la Descripción (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={config.descriptionWeight}
                          onChange={(e) => setConfig({...config, descriptionWeight: parseInt(e.target.value) || 0})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                      </div>
                      
                      <div className="sm:col-span-3">
                        <p className={`text-sm ${config.amountWeight + config.dateWeight + config.descriptionWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>
                          Suma total: {config.amountWeight + config.dateWeight + config.descriptionWeight}% {config.amountWeight + config.dateWeight + config.descriptionWeight === 100 ? '✓' : '(Debe ser 100%)'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Tolerancias</h3>
                    <p className="mt-1 text-sm text-gray-500">Define los márgenes de error aceptables para considerar una coincidencia</p>
                    
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Tolerancia de Monto (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={config.amountTolerancePercent}
                          onChange={(e) => setConfig({...config, amountTolerancePercent: parseFloat(e.target.value) || 0})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500">Diferencia porcentual aceptable entre montos</p>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Tolerancia de Fecha (días)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={config.dateTolerance}
                          onChange={(e) => setConfig({...config, dateTolerance: parseInt(e.target.value) || 0})}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500">Diferencia máxima de días para considerar fechas similares</p>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Estrategia de Conciliación</h3>
                    
                    <div className="mt-4">
                      <div className="flex items-center">
                        <input
                          id="prioritize-exact"
                          type="checkbox"
                          checked={config.prioritizeExactMatches}
                          onChange={(e) => setConfig({...config, prioritizeExactMatches: e.target.checked})}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="prioritize-exact" className="ml-2 block text-sm text-gray-700">
                          Priorizar coincidencias exactas
                        </label>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">Las coincidencias exactas (por referencia o número de documento) tendrán prioridad sobre otras coincidencias</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-5">
                    <button
                      type="button"
                      onClick={resetToDefaults}
                      className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Restablecer valores predeterminados
                    </button>
                    <button
                      type="button"
                      onClick={saveConfig}
                      disabled={saving}
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Guardando...
                        </>
                      ) : 'Guardar configuración'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 