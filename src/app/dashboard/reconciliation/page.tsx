'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HomeIcon } from '@heroicons/react/24/outline';

export default function ReconciliationPage() {
  const router = useRouter();
  
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
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Conciliación</h1>
          
          {/* Sección de acciones de conciliación */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Acciones de conciliación
              </h3>
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="border rounded-lg p-6 bg-indigo-50">
                  <h4 className="text-base font-medium text-indigo-800 mb-2">Reconciliación automática</h4>
                  <p className="text-sm text-indigo-600 mb-4">
                    Ejecuta el proceso automático de conciliación entre transacciones bancarias y registros contables.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/reconciliation/auto')}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Iniciar conciliación automática
                  </button>
                </div>
                <div className="border rounded-lg p-6 bg-green-50">
                  <h4 className="text-base font-medium text-green-800 mb-2">Reconciliación manual</h4>
                  <p className="text-sm text-green-600 mb-4">
                    Concilia manualmente transacciones bancarias con registros contables.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/reconciliation/manual')}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Iniciar conciliación manual
                  </button>
                </div>
              </div>
              
              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="border rounded-lg p-6">
                  <h4 className="text-base font-medium text-gray-800 mb-2">Transacciones bancarias</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Ver todas las transacciones bancarias importadas.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/reconciliation/bank')}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Ver transacciones
                  </button>
                </div>
                <div className="border rounded-lg p-6">
                  <h4 className="text-base font-medium text-gray-800 mb-2">Entradas contables</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Ver todos los registros contables importados.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/reconciliation/accounting')}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Ver registros
                  </button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="border rounded-lg p-6">
                  <h4 className="text-base font-medium text-gray-800 mb-2">Registros conciliados</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Ver todas las conciliaciones realizadas.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/reconciliation/reconciled')}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Ver conciliados
                  </button>
                </div>
                <div className="border rounded-lg p-6">
                  <h4 className="text-base font-medium text-gray-800 mb-2">Importar datos</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Importar nuevos archivos de extractos bancarios o registros contables.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/dashboard/reconciliation/import')}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Importar archivos
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 