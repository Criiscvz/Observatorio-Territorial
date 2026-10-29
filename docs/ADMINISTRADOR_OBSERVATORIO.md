# Supervisor de observatorio

Nombre visible: **Supervisor**. Rol global interno: `ADMIN_OBSERVATORIO`. Su alcance se asigna explícitamente por observatorio; no equivale al administrador general.

## Configuración

1. El administrador general asigna el rol desde **Usuarios → Rol → Supervisor**.
2. En **Permisos → Supervisor → Gestionar observatorios**, selecciona los observatorios.
3. Activa por observatorio los permisos necesarios:
   - **Edición y revisión**: crear, editar, eliminar y revisar artículos, reportes y libros, incluyendo publicaciones de otros autores. Permite los estados En revisión, Publicado, Suspendido y Archivado.
   - **Agregar editores**: convertir usuarios normales en editores y administrar su asignación dentro de ese observatorio.

Al seleccionar un observatorio nuevo, **Edición y revisión** empieza activo y **Agregar editores** desactivado. Los permisos guardados como desactivados se respetan. Los dos permisos son independientes. La asignación sin ambos permisos permite consultar la biblioteca del observatorio, pero no modificarla ni asignar editores. Al entrar o salir de este rol se retiran las asignaciones anteriores para requerir una nueva configuración explícita.

## Espacio de trabajo

- Inicio, Observatorios y Publicaciones se limitan a los observatorios asignados.
- La cola de revisión contiene publicaciones de todos los autores en los observatorios con edición y revisión habilitada.
- Las listas de publicaciones mantienen 20 resultados por página.
- Gestión incluye Usuarios y Permisos. Usuarios muestra cuentas normales; Permisos muestra editores de todos sus observatorios asignados. Solo puede modificar accesos donde tenga **Agregar editores** habilitado.
- **Permisos → Agregar editor** permite seleccionar una cuenta activa con rol Usuario y asignarla como Editor a un observatorio autorizado.
- No tiene administración de Atlas, Barómetro, configuración del sitio, creación de observatorios ni cambios arbitrarios de roles o cuentas.
- La asignación de editores conserva los accesos que otros responsables hayan concedido fuera del alcance del administrador actual.

## Persistencia y autorización

Migración: `2026_10_27_000001_add_observatory_administrator.php`. Amplía el rol admitido y agrega `puede_revisar` y `puede_agregar_editores` a `usuario_departamento`, con valor inicial falso.

El arranque de esta versión aplica esa migración incremental antes de servir tráfico, incluso cuando `RUN_MIGRATIONS` está desactivado. No ejecuta seeders ni modifica las asignaciones existentes; la revisión predeterminada se aplica en el formulario al crear una nueva asignación.

Las operaciones delegadas usan `/api/observatorio-admin`. El servidor consulta los permisos vigentes en cada operación; desactivar un permiso bloquea la siguiente solicitud aunque la sesión permanezca abierta. El cliente usa los permisos de `/api/user` para mostrar los controles, y refleja los cambios de configuración al recargar la sesión o la página.

El administrador de observatorio solo puede conceder acceso de editor mediante este flujo. La autorización, validación del alcance y promoción se ejecutan dentro de una transacción. Los endpoints generales de administración siguen reservados al rol `ADMIN`.

## Verificación local

Pruebas de autorización en `backend/tests/Feature/ObservatoryAdministratorTest.php`; pruebas de controles y formularios en `frontend/src/app/features/permisos/observatory-administrator.spec.ts`.

También se comprobó el flujo por HTTP contra PostgreSQL local con cuentas temporales, incluyendo publicación, cuatro estados, asignación y revocación. Los datos temporales fueron eliminados.

## Contraseñas y gestión de usuarios

La lista compacta usa acciones directas y ventanas para editar datos, cambiar rol y gestionar accesos. Solo el Administrador general puede cambiar una contraseña mediante el botón de llave; el servidor guarda su hash, invalida las sesiones y tokens anteriores de esa cuenta y acepta la nueva contraseña en el inicio de sesión. Supervisor y Editor no pueden utilizar ese endpoint.
