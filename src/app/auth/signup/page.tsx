import { SignupForm } from '@/components/auth/SignupForm';
import { Suspense } from 'react';

export default function SignUpPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <SignupForm />
    </Suspense>
  );
} 