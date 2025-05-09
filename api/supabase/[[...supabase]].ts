import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy para redirigir peticiones a Supabase
 */
export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  try {
    const { pathname, search } = new URL(req.url);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    if (!supabaseUrl) {
      return new NextResponse('Error: NEXT_PUBLIC_SUPABASE_URL no está configurado', { 
        status: 500 
      });
    }

    // Extraer el path después de /api/supabase/
    const path = pathname.replace(/^\/api\/supabase/, '');
    const targetUrl = `${supabaseUrl}${path}${search}`;

    // Clone headers
    const headers = new Headers();
    req.headers.forEach((value, key) => {
      headers.set(key, value);
    });

    // Set origin to match Supabase
    headers.set('Origin', supabaseUrl);

    // Forward the request to Supabase
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.body,
      redirect: 'follow',
    });

    // Clone the response
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    // Adjust CORS headers for client
    responseHeaders.set('Access-Control-Allow-Origin', req.headers.get('origin') || '*');
    responseHeaders.set('Access-Control-Allow-Credentials', 'true');
    
    // Special handling for OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization, X-Client-Info, apikey, Prefer, Origin');
      responseHeaders.set('Access-Control-Max-Age', '86400');
      
      return new NextResponse(null, { 
        status: 204, 
        headers: responseHeaders 
      });
    }

    // Return proxied response
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new NextResponse('Error al procesar la solicitud', { status: 500 });
  }
} 