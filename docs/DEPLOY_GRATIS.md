# Despliegue académico gratuito

Arquitectura: Angular en Vercel Hobby, Laravel Docker en Render Free, PostgreSQL en Neon Free, MongoDB Atlas Free y Supabase Storage por S3.

## Render: backend

1. Crea un **Web Service** gratuito desde el repositorio, con `backend` como directorio raíz y `Dockerfile` como Dockerfile.
2. No configures disco persistente, worker ni cron. Render inyecta `PORT`; la imagen lo usa automáticamente.
3. Añade las variables indicadas abajo y despliega. El health check es `GET /api/health`.
4. Cuando el servicio esté activo, abre la Shell de Render y ejecuta una sola vez por despliegue de migraciones:

   ```sh
   php artisan migrate --force
   ```

   No ejecutes `migrate:fresh` ni `db:seed` en producción. Swagger se genera al iniciar el contenedor y queda disponible en `/api/docs`.

Render Free suspende servicios inactivos. La primera petición después de una suspensión puede tardar; no se debe intentar evitarlo con tráfico artificial.

## Variables de Render

```env
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:GENERADA_CON_php_artisan_key:generate_--show
APP_URL=https://TU-SERVICIO.onrender.com
FRONTEND_URL=https://TU-PROYECTO.vercel.app
LOG_CHANNEL=stderr
LOG_LEVEL=warning

DB_CONNECTION=pgsql
DATABASE_URL=URL_DE_NEON_CON_sslmode=require
DB_SSLMODE=require

MONGODB_URI=URI_DE_MONGODB_ATLAS
MONGODB_DATABASE=observatorio_nosql

MICROSOFT_TENANT_ID=TENANT_ID_DE_MICROSOFT_ENTRA
MICROSOFT_CLIENT_ID=APPLICATION_CLIENT_ID_DE_MICROSOFT_ENTRA
MICROSOFT_CLIENT_SECRET=CLIENT_SECRET_DE_MICROSOFT_ENTRA
SHAREPOINT_SITE_ID=SITE_ID_DE_SHAREPOINT
SHAREPOINT_DRIVE_ID=DRIVE_ID_DE_LA_BIBLIOTECA
SHAREPOINT_FOLDER_PATH=RUTA_RAIZ_DE_ATLAS
SHAREPOINT_BAROMETER_FOLDER_PATH=RUTA_RAIZ_DE_ARTICULOS_Y_REPORTES

FILESYSTEM_DISK=s3
AWS_ACCESS_KEY_ID=SUPABASE_S3_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=SUPABASE_S3_SECRET_KEY
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=NOMBRE_DEL_BUCKET
AWS_ENDPOINT=https://PROJECT_REF.storage.supabase.co/storage/v1/s3
AWS_URL=https://PROJECT_REF.supabase.co/storage/v1/object/public/NOMBRE_DEL_BUCKET
AWS_USE_PATH_STYLE_ENDPOINT=true

CACHE_STORE=file
SESSION_DRIVER=cookie
QUEUE_CONNECTION=sync
L5_SWAGGER_CONST_HOST=https://TU-SERVICIO.onrender.com/api
L5_SWAGGER_GENERATE_ALWAYS=false
```

Configura en Atlas el acceso de red que permita a Render y usa una URI TLS. No guardes ninguna de estas credenciales en `.env` versionado.

La importación desde SharePoint utiliza Microsoft Graph con permisos de aplicación. Copia los valores existentes de tu `.env` local a las variables equivalentes de Render, sin incluirlos en Git. La aplicación de Microsoft Entra debe tener permisos de aplicación aprobados por un administrador para leer la biblioteca configurada.

## Vercel: frontend

Importa únicamente el directorio `frontend`. El archivo `vercel.json` ejecuta `npm ci`, compila Angular y publica `dist/frontend/browser`.

Configura esta variable de Vercel:

```env
API_URL=https://TU-SERVICIO.onrender.com/api
```

La compilación falla deliberadamente si `API_URL` no es HTTPS, para evitar publicar `localhost`. El rewrite de Vercel mantiene funcionando las rutas del SPA.

## Archivos históricos

No se migran automáticamente. Tras configurar S3, primero simula cada copia:

```sh
php artisan storage:migrate-local storage/app/private --dry-run
php artisan storage:migrate-local storage/app/datasets --prefix=datasets --dry-run
```

Cuando la lista sea correcta, elimina `--dry-run`. Haz copia de seguridad de los archivos antes de ejecutar la importación.

## Límites conocidos

- No hay scheduler ni worker persistente en esta arquitectura gratuita. Las colas se ejecutan con `sync`.
- La importación/análisis de datasets usa `/tmp` sólo durante la petición. Para archivos muy grandes puede superar los límites de memoria o tiempo de Render Free.
