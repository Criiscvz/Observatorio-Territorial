# Categorías de Atlas

## Arquitectura y alcance

El frontend usa Angular 21 con componentes standalone, signals, Angular Material y `ApiService`. Las rutas `/admin/atlas` y `/admin/atlas/subir` ya tienen `adminGuard`. El CRUD de observatorios usa `DepartamentoController`, casos de uso y la tabla `departamentos`; su API pública selecciona únicamente observatorios públicos y sus operaciones de escritura usan `auth:sanctum` y `role:ADMIN`.

Atlas tiene un flujo propio más directo: `PublicacionService` → `ObservatorioPublicacionController` → `ObservatorioPublicacion` → `observatorio_publicaciones`. La migración anterior que separa libros define Atlas global como `tipo=ATLAS` con `departamento_id=NULL`. Los antiguos Atlas asociados a observatorios son ahora libros. Esta implementación mantiene esa separación y no cambia la gestión de libros, artículos, reportes ni datasets.

`AtlasService` (localStorage) y `AtlasFormComponent` son implementaciones antiguas sin consumidores en las rutas actuales. No se utilizan para estas categorías ni se migran datos simulados.

## Funcionamiento

- Sección “Atlas” debajo de “Observatorios” en el menú administrativo, visible solo para ADMIN. Su botón “+” abre el formulario de categorías en `/admin/atlas/categorias`; debajo aparecen las categorías de la API, enlazadas a sus archivos. La lista se actualiza automáticamente después de crear, editar o eliminar una categoría, siguiendo el patrón de notificaciones de observatorios.
- Cada categoría ofrece “Ver archivos” y “Subir archivo”. La biblioteca `/admin/atlas?categoria=UUID` filtra sus documentos, permite abrirlos y editarlos, y distingue los archivos sin categoría. El formulario conserva la categoría de origen y vuelve a ella después de guardar.
- Selector opcional en el formulario de creación/edición y en la importación de Atlas global desde SharePoint. La categoría se persiste en la publicación que contiene la referencia al PDF. Una importación duplicada no mueve un documento existente de categoría. Los documentos anteriores permanecen sin categoría hasta que un administrador los clasifique.
- API: `GET /api/publico/atlas/categorias`; `GET/POST /api/atlas/categorias`; `PUT/DELETE /api/atlas/categorias/{id}`. Todas las rutas administrativas exigen Sanctum y ADMIN.
- La consulta pública `/api/publico/atlas` admite `categoria_id` y sigue mostrando únicamente publicaciones globales en estado `PUBLICACION`. Conserva los bloqueos de suscriptores y las comprobaciones de descarga. No expone diagnósticos internos ni metadatos de sincronización SharePoint de Atlas.
- La pantalla pública presenta las categorías como tarjetas con nombre, descripción y cantidad de publicaciones. Al abrir una tarjeta muestra sus documentos y un botón “Volver a categorías”. Las categorías vacías siguen visibles y los documentos sin categoría conservan un acceso propio. La búsqueda opera dentro de la categoría abierta; “Actualizar datos” vuelve a consultar la API. Se conservan los estados de carga y error y las restricciones de acceso.
- `atlas_categorias` usa UUID, nombre normalizado, clave única en minúsculas, descripción opcional y eliminación lógica. Los nombres de categorías eliminadas permanecen reservados.
- `observatorio_publicaciones.atlas_categoria_id` es nullable y tiene FK `ON DELETE RESTRICT`. No hay asignaciones masivas ni eliminación en cascada de archivos/publicaciones.
- La eliminación comprueba todas las publicaciones asociadas, incluidos borradores, suspendidas, archivadas y contenido para suscriptores. Las asignaciones y la eliminación bloquean la misma fila de categoría en una transacción para evitar carreras dentro de la API.
- El seeder inicializa las diez categorías solicitadas. Una identidad inicial estable conserva cambios de nombre, descripción y eliminación lógica al ejecutarlo de nuevo. También respeta una categoría equivalente que ya exista.

## Aplicación

Desde `backend`, con las migraciones previas del proyecto ya aplicadas:

```powershell
php artisan migrate --path=database/migrations/2026_09_27_000001_create_atlas_categorias.php
php artisan db:seed --class=AtlasCategoriaSeeder
```

Desplegar el frontend y backend actualizados de la forma habitual. Las futuras modificaciones administrativas de categorías no requieren recompilar Angular.

## Archivos

Nuevos:

- `backend/app/Models/AtlasCategoria.php`
- `backend/app/Presentation/Http/Controllers/Api/AtlasCategoriaController.php`
- `backend/routes/modules/atlas.php`
- `backend/database/migrations/2026_09_27_000001_create_atlas_categorias.php`
- `backend/database/seeders/AtlasCategoriaSeeder.php`
- `backend/tests/Feature/AtlasCategoriaTest.php`
- `frontend/src/app/core/services/atlas-categoria.service.ts`
- `frontend/src/app/features/public/public-atlas/atlas-categorias.component.ts`
- `frontend/src/app/features/public/public-atlas/atlas-categorias.component.spec.ts`
- `frontend/src/app/features/public/public-atlas/public-atlas.component.spec.ts`

Integraciones modificadas:

- `backend/routes/api.php`
- `backend/app/Models/ObservatorioPublicacion.php`
- `backend/app/Presentation/Http/Controllers/Api/ObservatorioPublicacionController.php`
- `backend/app/Presentation/Http/Controllers/Api/PublicController.php`
- `backend/app/Presentation/Http/Requests/Publicacion/StorePublicacionRequest.php`
- `backend/app/Presentation/Http/Requests/Publicacion/UpdatePublicacionRequest.php`
- `backend/app/Presentation/Http/Resources/Publicacion/PublicacionResource.php`
- `frontend/src/app/core/models/publicacion/publicacion.interface.ts`
- `frontend/src/app/features/public/public-atlas/global-atlas-management.component.ts` y `.html`
- `frontend/src/app/features/public/public-atlas/global-atlas-upload.component.ts`
- `frontend/src/app/features/public/public-atlas/public-atlas.component.ts` y `.html`

## Comprobaciones reproducibles

### Corrección de archivos y organización de categorías

- La subida y el reemplazo del PDF comprueban el resultado del almacenamiento antes de escribir los metadatos. Si falla, se devuelve 503 y se conserva el documento anterior.
- Abrir PDF lee el archivo mediante la API con los permisos existentes. Las respuestas PDF usan `Cache-Control: private, no-store`. Reemplazar un archivo importado desvincula el enlace anterior de SharePoint para abrir el PDF nuevo.
- Gestión de Atlas muestra Editar y Eliminar directamente. Editar permite actualizar datos, categoría y PDF. Eliminar identifica el documento, exige confirmación y bloquea envíos repetidos; si falla la eliminación física se conserva el registro. Los originales de SharePoint no se eliminan.
- El directorio público busca categorías por nombre y descripción sin distinguir tildes o mayúsculas, y permite mostrar solo categorías con publicaciones. El menú administrativo también permite buscarlas. El formulario de categorías queda separado de las tarjetas bajo «Categorías disponibles».
- No hay migraciones nuevas para esta corrección. Hay que desplegar **backend y frontend**.

Se detectaron registros reales sin ruta de PDF mediante una consulta de solo lectura. Esos registros deben repararse desde **Editar**, seleccionando nuevamente el PDF original; el código no puede recuperar bytes que no llegaron al almacenamiento. No se modificaron ni eliminaron documentos reales durante la verificación.

En el servidor, verificar el almacenamiento persistente configurado en `docs/DEPLOY_GRATIS.md` (`FILESYSTEM_DISK=s3`, bucket y credenciales S3 correctos). El bucket de documentos sensibles debe ser privado; los PDF se sirven por la API y no necesitan una URL pública. La configuración remota de Render no se verificó desde esta sesión.

Validación de esta corrección: 21 pruebas Laravel (149 aserciones), 22 pruebas Angular y compilación Angular de producción completadas. La compilación conserva advertencias de presupuesto CSS. Se comprobó en navegador la búsqueda pública de categorías sin tildes.

Resultado tras añadir la navegación administrativa por categorías: compilación Angular de desarrollo correcta; 17 pruebas Laravel con 114 aserciones y 16 pruebas Angular aprobadas (incluido el servicio de publicaciones); `git diff --check` sin errores de espacios.

Desde `backend`:

```powershell
php vendor/phpunit/phpunit/phpunit tests/Feature/AtlasCategoriaTest.php tests/Feature/PublicacionRequestValidationTest.php
```

Las pruebas de Atlas crean un esquema mínimo en SQLite en memoria y aplican la migración nueva. No ejecutan comandos de reinicio de la base de datos. Cubren CRUD, normalización, duplicados, inicialización repetida, FK restrictiva, asociaciones, permisos, asignación/reasignación y limpieza de categoría, filtros públicos y acceso de suscriptores.

Desde `frontend`:

```powershell
node node_modules/@angular/cli/bin/ng.js build --configuration=development
node node_modules/@angular/cli/bin/ng.js test --watch=false --include=src/app/features/public/public-atlas/*.spec.ts
```

Las pruebas de componentes cubren cancelación, confirmación, prevención de solicitudes repetidas, conflictos, navegación por categoría, estados vacíos y errores. No sustituyen una revisión visual en navegador ni una prueba de concurrencia sobre PostgreSQL.

La migración y el seeder se aplicaron posteriormente a PostgreSQL real por solicitud del usuario. Se verificaron diez categorías activas, cero claves duplicadas y 34 publicaciones tanto antes como después. El seeder se ejecutó dos veces con el mismo resultado. Para esta sesión de mantenimiento se utilizó `PDO::ATTR_EMULATE_PREPARES=true`, después de que la conexión mediante el pooler abortara el primer intento de migración; no se modificó la configuración persistente del proyecto.
