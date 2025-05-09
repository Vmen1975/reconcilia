'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import Layout from '@/components/shared/Layout';
import CompanyDetailsContent from '@/components/companies/CompanyDetailsContent';

// Crear una instancia de QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 1000, // 10 segundos
      retry: 1,
    },
  },
});

interface CompanyDetailsClientProps {
  id: string;
}

// Este es un componente del lado del cliente que recibe el id
// directamente como prop, evitando el problema con params
export function CompanyDetailsClient({ id }: CompanyDetailsClientProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
        <CompanyDetailsContent id={id} />
      </Layout>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
} 