import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // No aplicar middleware a rutas de API
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return res;
  }
  
  try {
    const supabase = createMiddlewareClient({ req, res });

    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Si el usuario no está autenticado y trata de acceder a una ruta protegida
    if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
      console.log('Redirigiendo usuario no autenticado desde:', req.nextUrl.pathname, 'a /login');
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Si el usuario está autenticado y trata de acceder a las páginas de login o registro
    if (session && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/register')) {
      console.log('Redirigiendo usuario autenticado desde:', req.nextUrl.pathname, 'a /dashboard');
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return res;
  } catch (error) {
    console.error('Error en middleware:', error);
    return res;
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*', 
    '/login', 
    '/register',
    // Excluir explícitamente rutas API para evitar errores inesperados
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}; 