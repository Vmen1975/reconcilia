'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import Layout from '@/components/shared/Layout';
import CompaniesContent from '@/components/companies/CompaniesContent';

// Crear una instancia de QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 1000, // 10 segundos
      retry: 1,
    },
  },
});

export default function CompaniesPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <Layout>
        <CompaniesContent />
      </Layout>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
} 