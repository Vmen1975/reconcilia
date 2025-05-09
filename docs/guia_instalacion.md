# Guía de Instalación y Prueba - Reconcilia

## Requisitos Previos

1. **Node.js y npm**
   - Node.js versión 18 o superior
   - npm versión 9 o superior

2. **Base de Datos**
   - Cuenta en Supabase (https://supabase.com)
   - Crear un nuevo proyecto en Supabase

## Pasos de Instalación

1. **Clonar el Repositorio**
   ```bash
   git clone https://github.com/tu-usuario/reconcilia.git
   cd reconcilia
   ```

2. **Instalar Dependencias**
   ```bash
   npm install
   ```

3. **Configurar Variables de Entorno**
   - Crear archivo `.env.local` en la raíz del proyecto
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
   ```

4. **Iniciar la Aplicación en Modo Desarrollo**
   ```bash
   npm run dev
   ```

## Datos de Prueba

### Cuenta de Prueba
- Email: demo@reconcilia.com
- Contraseña: demo123

### Archivos de Ejemplo
En la carpeta `examples/` encontrarás:
- `banco_ejemplo.csv`: Extracto bancario de prueba
- `contabilidad_ejemplo.csv`: Registros contables de prueba

## Prueba Rápida

1. **Acceso**
   - Abrir http://localhost:3000
   - Iniciar sesión con la cuenta de prueba

2. **Importar Datos**
   - Ir a "Importar" en el menú
   - Usar los archivos de ejemplo proporcionados
   - Seguir el asistente de importación

3. **Probar Conciliación**
   - Ir a "Conciliación"
   - Seleccionar la cuenta "Banco Demo"
   - Ejecutar conciliación automática
   - Probar conciliación manual con drag & drop

4. **Revisar Reportes**
   - Ir a "Reportes"
   - Generar reporte de conciliación
   - Exportar en diferentes formatos

## Estructura de Archivos CSV de Prueba

### Formato Banco
```csv
fecha,descripcion,monto,referencia
2024-01-15,Pago Proveedor ABC,-1500.00,REF001
2024-01-16,Depósito Cliente XYZ,2000.00,REF002
```

### Formato Contabilidad
```csv
fecha,descripcion,monto,referencia
2024-01-15,Factura Proveedor ABC,1500.00,FAC001
2024-01-16,Ingreso Cliente XYZ,-2000.00,ING001
```

## Solución de Problemas Comunes

1. **Error de Conexión a Supabase**
   - Verificar credenciales en `.env.local`
   - Confirmar que el proyecto está activo en Supabase

2. **Problemas de Importación**
   - Verificar formato CSV (usar punto como separador decimal)
   - Confirmar estructura de columnas

3. **Errores de Conciliación**
   - Verificar que las fechas estén en formato YYYY-MM-DD
   - Confirmar que los montos tienen el signo correcto

## Siguientes Pasos

1. Personalizar la configuración de conciliación
2. Ajustar los umbrales de coincidencia automática
3. Configurar notificaciones por email
4. Personalizar formatos de reportes

Para más información, consultar la documentación completa en `docs/manual_usuario.pdf`. 