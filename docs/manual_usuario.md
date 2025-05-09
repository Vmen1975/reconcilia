# Manual de Usuario - Reconcilia

## Índice
1. [Introducción](#introducción)
2. [Modelo de Datos](#modelo-de-datos)
3. [Casos de Uso](#casos-de-uso)
4. [Guía Paso a Paso](#guía-paso-a-paso)
5. [Reportes](#reportes)

## Introducción

Reconcilia es una aplicación diseñada para automatizar y simplificar el proceso de conciliación bancaria. Permite a los usuarios importar transacciones bancarias y registros contables, realizar conciliaciones automáticas y manuales, y generar reportes detallados del proceso.

### Características Principales
- Importación de archivos CSV y Excel
- Conciliación automática y manual
- Sistema de reportes detallados
- Interfaz intuitiva con drag & drop
- Exportación de datos a Excel y PDF

## Modelo de Datos

### Entidades Principales

1. **Cuentas Bancarias**
   - ID
   - Nombre
   - Número de cuenta
   - Banco
   - Saldo actual
   - ID de la empresa

2. **Transacciones Bancarias**
   - ID
   - Fecha
   - Descripción
   - Monto
   - Referencia
   - Estado de conciliación
   - ID de la cuenta bancaria
   - ID de conciliación (opcional)

3. **Registros Contables**
   - ID
   - Fecha
   - Descripción
   - Monto
   - Referencia
   - Estado de conciliación
   - ID de la cuenta bancaria
   - ID de conciliación (opcional)

4. **Conciliaciones**
   - ID
   - Fecha
   - ID de transacción bancaria
   - ID de registro contable
   - Estado
   - Porcentaje de confianza
   - Notas

## Casos de Uso

### 1. Importación de Datos
- Importar extracto bancario (CSV/Excel)
- Importar registros contables (CSV/Excel)
- Validación automática de formato
- Mapeo de columnas

### 2. Conciliación Automática
- Ejecución del algoritmo de coincidencia
- Identificación de transacciones coincidentes
- Asignación de porcentajes de confianza
- Marcado automático de coincidencias seguras

### 3. Conciliación Manual
- Visualización de transacciones pendientes
- Drag & drop para emparejar registros
- Confirmación/rechazo de coincidencias sugeridas
- Añadir notas a las conciliaciones

### 4. Generación de Reportes
- Resumen de conciliación
- Estado de cuenta
- Exportación a Excel/PDF
- Filtrado por fecha y estado

## Guía Paso a Paso

### 1. Inicio de Sesión
1. Acceder a la aplicación
2. Ingresar credenciales
3. Seleccionar empresa (si aplica)

### 2. Importación de Datos
1. Ir a "Importar" en el menú principal
2. Seleccionar tipo de archivo (banco/contabilidad)
3. Arrastrar archivo o usar el botón de selección
4. Verificar el mapeo de columnas
5. Confirmar importación

### 3. Proceso de Conciliación
1. Ir a "Conciliación" en el menú
2. Seleccionar cuenta bancaria
3. Establecer rango de fechas
4. Ejecutar conciliación automática (opcional)
5. Para conciliación manual:
   - Arrastrar registros coincidentes
   - Verificar detalles
   - Confirmar conciliación

### 4. Revisión y Reportes
1. Acceder a "Reportes"
2. Seleccionar tipo de reporte
3. Aplicar filtros necesarios
4. Generar y exportar reporte

## Reportes

### Tipos de Reportes Disponibles

1. **Reporte de Conciliación**
   - Lista detallada de transacciones
   - Estado de cada transacción
   - Montos y fechas
   - Notas y observaciones

2. **Estado de Cuenta**
   - Total conciliado
   - Total pendiente
   - Montos totales
   - Última fecha de conciliación

### Opciones de Exportación
- Excel: Para análisis detallado
- PDF: Para presentación y archivo

## Consejos y Mejores Prácticas

1. **Importación de Datos**
   - Verificar formato del archivo antes de importar
   - Validar los montos totales después de la importación
   - Mantener consistencia en el formato de fechas

2. **Conciliación**
   - Comenzar con la conciliación automática
   - Revisar coincidencias sugeridas
   - Documentar casos especiales con notas

3. **Reportes**
   - Generar reportes periódicamente
   - Mantener copias de respaldo
   - Revisar discrepancias inmediatamente

## Soporte

Para asistencia adicional:
- Email: soporte@reconcilia.com
- Teléfono: +1234567890
- Documentación en línea: docs.reconcilia.com 