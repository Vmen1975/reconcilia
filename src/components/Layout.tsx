'use client';

import React from 'react';
import Link from 'next/link';
import { 
  HomeIcon, 
  UserIcon, 
  Cog6ToothIcon as CogIcon,
  ArrowLeftOnRectangleIcon as LogoutIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function Layout({ children, title = 'Dashboard' }: LayoutProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/signin');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64 bg-white border-r">
          <div className="flex flex-col h-0 flex-1">
            <div className="flex items-center h-16 flex-shrink-0 px-4 bg-indigo-600">
              <h1 className="text-xl font-bold text-white">Reconcilia</h1>
            </div>
            <div className="flex-1 flex flex-col overflow-y-auto">
              <nav className="flex-1 px-2 py-4 space-y-1">
                <Link href="/dashboard" className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900">
                  <HomeIcon className="mr-3 h-6 w-6 text-gray-400 group-hover:text-gray-500" />
                  Dashboard
                </Link>
                <Link href="/dashboard/reports" className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900">
                  <DocumentTextIcon className="mr-3 h-6 w-6 text-gray-400 group-hover:text-gray-500" />
                  Reportes
                </Link>
                <Link href="/dashboard/configuration" className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900">
                  <CogIcon className="mr-3 h-6 w-6 text-gray-400 group-hover:text-gray-500" />
                  Configuración
                </Link>
                <Link href="/dashboard/profile" className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900">
                  <UserIcon className="mr-3 h-6 w-6 text-gray-400 group-hover:text-gray-500" />
                  Perfil
                </Link>
                <button 
                  onClick={handleSignOut}
                  className="w-full text-left group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  <LogoutIcon className="mr-3 h-6 w-6 text-gray-400 group-hover:text-gray-500" />
                  Cerrar Sesión
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="bg-white shadow">
          <div className="px-4 sm:px-6 py-4">
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 bg-gray-100">
          {children}
        </main>
      </div>
    </div>
  );
} 