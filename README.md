# Reconcilia - Sistema de Conciliación Bancaria

Sistema automatizado de conciliación bancaria que simplifica el proceso de comparación entre extractos bancarios y registros contables.

## Características principales

- 🔄 Conciliación automática de transacciones
- 📊 Dashboard con métricas clave
- 📱 Interfaz responsive y moderna
- 🔒 Sistema de autenticación seguro
- 🏢 Soporte para múltiples empresas
- 📝 Registro detallado de actividades
- 📈 Reportes personalizables

## Tecnologías utilizadas

- **Frontend**: Next.js 14, React, TypeScript, TailwindCSS
- **Backend**: Supabase (PostgreSQL, Autenticación, Storage)
- **Estado**: Zustand, React Query
- **UI**: Headless UI, Heroicons

## Requisitos previos

- Node.js 18.x o superior
- npm 9.x o superior
- Cuenta en Supabase

## Configuración del entorno

1. Clona el repositorio:
```bash
git clone https://github.com/tu-usuario/reconcilia.git
cd reconcilia
```

2. Instala las dependencias:
```bash
npm install
```

3. Copia el archivo de variables de entorno:
```bash
cp .env.example .env.local
```

4. Configura las variables de entorno en `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=tu-url-de-supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

5. Inicia el servidor de desarrollo:
```bash
npm run dev
```

## Estructura del proyecto

```
reconcilia/
├── src/
│   ├── app/                    # Páginas de la aplicación
│   ├── components/             # Componentes React
│   ├── lib/                    # Utilidades y configuración
│   ├── services/              # Servicios de API
│   └── types/                 # Definiciones de tipos
├── public/                    # Archivos estáticos
└── package.json              # Dependencias y scripts
```

## Configuración de la base de datos

El esquema de la base de datos incluye las siguientes tablas principales:

- `users`: Usuarios del sistema
- `companies`: Empresas registradas
- `bank_accounts`: Cuentas bancarias
- `bank_transactions`: Transacciones bancarias
- `accounting_entries`: Registros contables
- `reconciliations`: Conciliaciones realizadas

## Contribución

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/amazing-feature`)
3. Commit tus cambios (`git commit -m 'Add some amazing feature'`)
4. Push a la rama (`git push origin feature/amazing-feature`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Soporte

Para reportar bugs o solicitar nuevas características, por favor abre un issue en el repositorio.
