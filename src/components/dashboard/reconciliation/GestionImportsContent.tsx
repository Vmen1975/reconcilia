'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { HomeIcon } from '@heroicons/react/24/outline';

export default function GestionImportsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <h1 className="text-2xl font-bold mb-4">Gestión de Importaciones</h1>
        <p>Esta página está en mantenimiento. Vuelve pronto.</p>
        <div className="mt-4">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center text-indigo-600 hover:text-indigo-900"
          >
            <HomeIcon className="h-5 w-5 mr-1" />
            Volver al dashboard
          </Link>
        </div>
      </div>
    </div>
  );
} 