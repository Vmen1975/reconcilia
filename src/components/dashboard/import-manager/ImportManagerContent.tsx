'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { HomeIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useSession } from '@/hooks/useSession';

export default function ImportManagerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const importId = searchParams?.get('id');
  const importType = searchParams?.get('type');
  const { session } = useSession();
  
  const [loading, setLoading] = useState(false);
  
  // Redireccionar si no hay ID o tipo
  useEffect(() => {
    if (!importId || !importType) {
      router.push('/dashboard/reconciliation');
    }
  }, [importId, importType, router]);
  
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
          </ul>
        </nav>
      </div>

      {/* Contenido principal con margen para la barra lateral */}
      <div className="pl-64">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <button 
                onClick={() => router.back()}
                className="mr-4 p-1 rounded-full hover:bg-gray-200"
              >
                <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">
                Gestión de Importación
              </h1>
            </div>
          </div>
          
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <div className="text-center py-10">
                <p className="text-gray-500 font-medium">Esta página está en mantenimiento o actualizando</p>
                <p className="mt-2 text-gray-400">Por favor, inténtalo más tarde</p>
                <div className="mt-6">
                  <Link 
                    href="/dashboard/reconciliation" 
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Volver a Conciliación
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 