'use client';

import { Suspense } from 'react';
import GestionImportsContent from '@/components/dashboard/reconciliation/GestionImportsContent';

export default function GestionImportsPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <GestionImportsContent />
    </Suspense>
  );
} 