const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fs = require('fs');
const path = require('path');

// Puerto fijo 3001 - NO CAMBIAR
const PORT = 3001;

// Verificar si el puerto está en uso y crear un archivo PID
const pidFile = path.join(__dirname, '.server.pid');

// Comprobar si ya hay un proceso en ejecución
if (fs.existsSync(pidFile)) {
  try {
    const pid = fs.readFileSync(pidFile, 'utf8').trim();
    console.log(`Intentando terminar el proceso anterior (PID: ${pid})...`);
    try {
      process.kill(Number(pid), 'SIGTERM');
      console.log(`Proceso anterior terminado correctamente.`);
    } catch (e) {
      console.log('No se encontró el proceso anterior, continuando...');
    }
  } catch (err) {
    console.error('Error al leer el archivo PID:', err);
  }
}

// Escribir PID actual
try {
  fs.writeFileSync(pidFile, process.pid.toString());
  console.log(`PID ${process.pid} guardado en ${pidFile}`);
} catch (err) {
  console.error('Error al escribir el archivo PID:', err);
}

// Eliminar el archivo PID al cerrar el proceso
process.on('SIGINT', () => {
  try {
    fs.unlinkSync(pidFile);
    console.log('Archivo PID eliminado correctamente.');
  } catch (err) {
    console.error('Error al eliminar el archivo PID:', err);
  }
  process.exit();
});

// URL de Supabase para el proxy
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://txctbngxizudxwjzgdef.supabase.co';

// Importante: configurar variables de entorno para Next.js
process.env.PORT = PORT.toString();
process.env.NEXT_PUBLIC_APP_URL = `http://localhost:${PORT}`;

// Configuración de Next.js
const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';

// Inicializar app de Next.js con configuración específica
const app = next({ 
  dev,
  hostname,
  port: PORT,
  conf: {
    basePath: '',
    compress: true,
    env: {
      PORT: PORT.toString(),
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`
    }
  }
});

const handle = app.getRequestHandler();

// Crear proxy para Supabase
const supabaseProxy = createProxyMiddleware({
  target: SUPABASE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/supabase': '' },
  onProxyReq: (proxyReq, req, res) => {
    // Añadir headers necesarios
    proxyReq.setHeader('Origin', SUPABASE_URL);
    
    // Preservar cookies de autenticación
    const cookies = req.headers.cookie;
    if (cookies) {
      proxyReq.setHeader('Cookie', cookies);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Modificar headers de respuesta para permitir CORS con cookies
    proxyRes.headers['Access-Control-Allow-Origin'] = `http://localhost:${PORT}`;
    proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
    
    // Preservar cookies de autenticación
    if (proxyRes.headers['set-cookie']) {
      const cookies = proxyRes.headers['set-cookie'].map(cookie => 
        cookie.replace(/; Domain=[^;]+/, '; Domain=localhost')
             .replace(/; SameSite=[^;]+/, '; SameSite=Lax')
      );
      proxyRes.headers['set-cookie'] = cookies;
    }
  }
});

// Crear o limpiar directorio de sesiones
const sessionDir = path.join(__dirname, '.next/cache/sessions');
if (!fs.existsSync(sessionDir)) {
  try {
    fs.mkdirSync(sessionDir, { recursive: true });
    console.log(`Directorio de sesiones creado: ${sessionDir}`);
  } catch (err) {
    console.warn(`No se pudo crear el directorio de sesiones: ${err.message}`);
  }
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      // Parse de la URL
      const parsedUrl = parse(req.url, true);
      const { pathname } = parsedUrl;
      
      // Configuración global de CORS
      const corsHeaders = {
        'Access-Control-Allow-Origin': `http://localhost:${PORT}`,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Authorization, X-Client-Info, apikey, Prefer, Origin',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
      };
      
      // Aplicar headers CORS a todas las respuestas
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
      
      // Si es una solicitud OPTIONS, responder de inmediato
      if (req.method === 'OPTIONS') {
        res.writeHead(200, corsHeaders);
        res.end();
        return;
      }
      
      // Si es una ruta de API que va a Supabase, aplicar el proxy
      if (pathname.startsWith('/api/supabase')) {
        console.log(`Redirigiendo solicitud a Supabase: ${pathname}`);
        return supabaseProxy(req, res);
      }
      
      // Manejar la solicitud con Next.js
      await handle(req, res, parsedUrl);
      
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });
  
  // Manejar errores del servidor
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Puerto ${PORT} ya está en uso. Intenta cerrar cualquier instancia previa de la aplicación.`);
      process.exit(1);
    } else {
      console.error('Error en el servidor:', err);
    }
  });
  
  // Escuchar en el puerto 3001
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`> API Supabase proxy: http://localhost:${PORT}/api/supabase/*`);
    console.log('> IMPORTANTE: Acceder SIEMPRE a través de http://localhost:3001');
  });
}); 