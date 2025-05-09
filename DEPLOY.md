# Cómo desplegar Reconcilia en Vercel

Este documento proporciona instrucciones paso a paso para desplegar la aplicación Reconcilia en Vercel utilizando GitHub como repositorio de código fuente.

## Requisitos previos

1. Una cuenta en [GitHub](https://github.com/)
2. Una cuenta en [Vercel](https://vercel.com/)
3. Una cuenta en [Supabase](https://supabase.com/)

## Paso 1: Preparar el repositorio en GitHub

1. Crea un nuevo repositorio en GitHub para tu proyecto
2. Asegúrate de inicializar Git en tu proyecto local si aún no lo has hecho:
   ```bash
   git init
   ```
3. Añade el repositorio remoto:
   ```bash
   git remote add origin https://github.com/tu-usuario/tu-repositorio.git
   ```
4. Añade todos los archivos modificados:
   ```bash
   git add .
   ```
5. Haz commit de los cambios:
   ```bash
   git commit -m "Preparación para despliegue en Vercel"
   ```
6. Sube los cambios a GitHub:
   ```bash
   git push -u origin main
   ```

## Paso 2: Conectar Vercel con GitHub

1. Inicia sesión en tu cuenta de [Vercel](https://vercel.com/)
2. Haz clic en "Add New" → "Project"
3. Selecciona la opción "Import Git Repository"
4. Conecta tu cuenta de GitHub si aún no lo has hecho
5. Selecciona el repositorio que acabas de crear
6. Vercel detectará automáticamente que es un proyecto Next.js

## Paso 3: Configurar las variables de entorno

Asegúrate de configurar las siguientes variables de entorno en Vercel:

| Nombre | Descripción |
|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto en Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima de tu proyecto en Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio de tu proyecto en Supabase |
| `NEXT_PUBLIC_APP_URL` | URL donde se desplegará la aplicación (ej. https://reconcilia.vercel.app) |

Para configurar estas variables:

1. En Vercel, ve a la configuración de tu proyecto
2. Navega a la sección "Environment Variables"
3. Añade cada variable y su valor
4. Guarda los cambios

## Paso 4: Personalizar configuración del despliegue (Opcional)

Puedes ajustar la configuración del despliegue en Vercel:

1. Ve a la configuración de tu proyecto
2. Navega a la sección "Build & Development Settings"
3. Verifica que:
   - Build Command esté establecido como `npm run build`
   - Output Directory esté establecido como `.next`
   - Install Command esté establecido como `npm install`

## Paso 5: Desplegar

1. Una vez configurado todo, haz clic en "Deploy"
2. Vercel comenzará a construir y desplegar tu aplicación
3. Una vez completado, se te proporcionará una URL donde podrás acceder a tu aplicación

## Configuración de dominio personalizado (Opcional)

Para usar un dominio personalizado:

1. Ve a la configuración de tu proyecto en Vercel
2. Navega a la sección "Domains"
3. Agrega tu dominio personalizado
4. Sigue las instrucciones para configurar los registros DNS de tu dominio

## Actualizar tu aplicación

Para actualizar tu aplicación después de realizar cambios:

1. Haz los cambios necesarios en tu código
2. Haz commit de los cambios y súbelos a GitHub:
   ```bash
   git add .
   git commit -m "Descripción de los cambios"
   git push
   ```
3. Vercel detectará automáticamente los cambios y desplegará una nueva versión

## Solución de problemas comunes

### Error en el proxy de Supabase

Si encuentras problemas con la comunicación con Supabase:
- Asegúrate de que las variables de entorno están correctamente configuradas
- Verifica que los permisos en Supabase están correctamente configurados
- Comprueba que estás utilizando las claves correctas para la comunicación

### Error en la construcción (Build)

Si la construcción falla:
- Revisa los logs del build en Vercel para identificar el problema específico
- Asegúrate de que todas las dependencias están correctamente instaladas
- Verifica que no hay errores en tu código que impidan la construcción

---

Si necesitas más ayuda, consulta la [documentación oficial de Vercel](https://vercel.com/docs) o la [documentación oficial de Supabase](https://supabase.com/docs). 