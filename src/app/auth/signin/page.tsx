import { LoginForm } from '@/components/auth/LoginForm';
import { Suspense } from 'react';

export default function SignInPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <LoginForm />
    </Suspense>
  );
} 