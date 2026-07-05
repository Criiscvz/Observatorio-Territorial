# Artículos y Reportes de Observatorios

Este documento describe la implementación actual del módulo de Artículos y Reportes. La información se basa en el código Laravel, Angular y la migración de base de datos presentes en el proyecto.

## 1. Ubicación en el sistema

La funcionalidad está integrada en el detalle de un Observatorio. En el código, los Observatorios se representan mediante la entidad y tabla `departamentos`.

- Ruta Angular: `/admin/departamentos/:id`
- Componente: `frontend/src/app/features/departamentos/departamento-detail/`
- Botón de apertura: **Agregar Artículo / Reporte / Atlas**
- El botón y el formulario aparecen antes de la sección de datasets.
- Las listas **Artículos subidos** y **Reportes subidos** aparecen después de los datasets.

## 2. Usuarios y permisos

Todas las rutas del módulo requieren autenticación mediante Laravel Sanctum.

- `ADMIN`: puede listar, descargar, crear y editar publicaciones.
- `USER`: no puede crear ni editar. El backend responde `403` aunque intente llamar directamente a esos endpoints.
- Un usuario autenticado puede listar o descargar publicaciones cuando es ADMIN, cuando el Observatorio es público o cuando está asignado al departamento correspondiente.

En el frontend, el botón de creación y los botones **Editar** solo se renderizan cuando `AuthService.isAdmin` es verdadero. La seguridad definitiva está en el middleware backend `role:ADMIN`.

## 3. Crear una publicación

1. Iniciar sesión como ADMIN.
2. Abrir el detalle de un Observatorio.
3. Pulsar **Agregar Artículo / Reporte / Atlas**.
4. Seleccionar **Artículo** o **Reporte**.
5. Completar los campos y seleccionar un PDF.
6. Pulsar **Guardar artículo** o **Guardar reporte**.

Angular envía un `FormData` al backend. Después de una respuesta correcta, limpia y cierra el formulario, vuelve a consultar las publicaciones y muestra una notificación. No es necesario recargar la página.

### Crear un Artículo

Campos actuales:

| Campo | Regla |
|---|---|
| Tipo | `ARTICULO`; obligatorio |
| Código | Informativo en el formulario; se genera en backend |
| Título | Obligatorio; máximo 255 caracteres |
| Fecha de publicación | Obligatoria; debe ser una fecha válida |
| Link URL | Obligatorio; debe comenzar con `http://` o `https://`; máximo 2048 caracteres |
| Breve descripción | Obligatoria; máximo 3000 caracteres |
| Autor o autores | Obligatorio; máximo 1000 caracteres |
| Fuente | Obligatoria; máximo 255 caracteres |
| PDF | Obligatorio al crear; máximo 20 MB |

### Crear un Reporte

El modelo usa internamente el campo `titulo`, aunque la interfaz lo presenta como **Nombre**.

| Campo | Regla |
|---|---|
| Tipo | `REPORTE`; obligatorio |
| Código | Informativo en el formulario; se genera en backend |
| Nombre | Obligatorio; máximo 255 caracteres |
| Fecha de publicación | Obligatoria; debe ser una fecha válida |
| Link URL | Obligatorio; debe comenzar con `http://` o `https://`; máximo 2048 caracteres |
| Fuente | Obligatoria; máximo 255 caracteres |
| Descripción | Obligatoria; máximo 3000 caracteres |
| PDF | Obligatorio al crear; máximo 20 MB |

Los Reportes no utilizan el campo `autores`.

## 4. Opción Atlas

Atlas aparece en el selector, pero todavía no se puede guardar.

- La interfaz muestra **Funcionalidad de Atlas próximamente disponible**.
- No se muestra el formulario completo.
- El frontend no ejecuta el guardado cuando el tipo es Atlas.
- El backend solo acepta `ARTICULO` y `REPORTE` en `StorePublicacionRequest`; un intento directo con `ATLAS` falla la validación.
- El enum de la tabla incluye `ATLAS` para la estructura futura, pero la funcionalidad actual no crea registros de ese tipo.

## 5. Código automático

Los códigos se generan exclusivamente en Laravel y no son editables desde Angular.

- Artículo: prefijo `ART-`, por ejemplo `ART-0001`.
- Reporte: prefijo `REP-`, por ejemplo `REP-0001`.

La tabla `publicacion_contadores` mantiene un contador independiente para `ARTICULO` y `REPORTE`. Durante la creación, Laravel:

1. Abre una transacción.
2. Bloquea la fila del contador mediante `lockForUpdate()`.
3. Lee y aumenta `siguiente_numero`.
4. Forma el código con al menos cuatro dígitos.
5. Crea la publicación dentro de la misma transacción.

Los contadores son globales por tipo para todo el sistema, no reinician por Observatorio.

## 6. Subida y almacenamiento del PDF

### Cuadro de carga

El formulario ofrece una zona con borde punteado que funciona de estas maneras:

- Click: abre el selector de archivos.
- Teclado: `Enter` o espacio abre el selector.
- Drag-and-drop: `dragover` activa el estado visual y `drop` procesa el primer archivo arrastrado.

Tanto el selector como drag-and-drop llaman a la misma función de validación.

Cuando el archivo es válido se muestra:

- **Archivo cargado correctamente**.
- Nombre original.
- Tamaño en B, KB o MB.
- Botón **Cambiar**.
- Botón **Quitar**.

### Formato permitido

Solo se aceptan archivos PDF de hasta 20 MB.

El frontend comprueba simultáneamente:

- MIME `application/pdf`.
- Extensión `.pdf`.
- Tamaño máximo de 20 MB.

El backend vuelve a validar el archivo con `file`, `mimetypes:application/pdf,application/x-pdf`, `mimes:pdf` y `max:20480`. La validación backend no depende de la validación del navegador.

Los archivos se guardan en el disco privado `local`, cuya raíz es `storage/app/private`:

```text
storage/app/private/publicaciones/{departamento_id}/{uuid}.pdf
```

La ruta interna y el nombre original se almacenan por separado. Los PDF no se sirven como archivos públicos directos.

## 7. Validaciones

Angular usa Reactive Forms y muestra errores junto a los campos. Además valida el archivo antes de añadirlo al `FormData`.

Laravel valida nuevamente todos los datos mediante:

- `StorePublicacionRequest` para creación.
- `UpdatePublicacionRequest` para edición.

En creación el PDF es obligatorio. En edición es opcional. La fecha debe ser válida y la URL solo acepta los protocolos HTTP o HTTPS.

Aunque la columna `descripcion` es nullable en la migración original, los requests actuales exigen descripción para Artículos y Reportes.

## 8. Visualización de publicaciones

El frontend carga todas las publicaciones del Observatorio y las separa por el campo `tipo`.

### Artículos subidos

Cada Artículo muestra:

- Código.
- Fecha de publicación.
- Título.
- Descripción.
- Autor o autores.
- Fuente.
- Botón **Ver fuente**.
- Botón **PDF**.
- Botón **Editar**, solo para ADMIN.

### Reportes subidos

Cada Reporte muestra:

- Código.
- Fecha de publicación.
- Nombre, almacenado como `titulo`.
- Descripción.
- Fuente.
- Botón **Ver fuente**.
- Botón **PDF**.
- Botón **Editar**, solo para ADMIN.

El backend devuelve las publicaciones ordenadas por `fecha_publicacion` descendente.

## 9. Descarga del PDF

Al pulsar **PDF**, Angular solicita el endpoint de descarga autenticado con `responseType: 'blob'`. Después crea temporalmente una URL del navegador y dispara la descarga usando `nombre_archivo_original`.

Antes de servir el archivo, Laravel:

1. Comprueba que el usuario esté autenticado.
2. Comprueba que tenga acceso al Observatorio.
3. Verifica que el archivo exista en el disco `local`.
4. Responde con `Content-Type: application/pdf`.

Si el archivo no existe, responde `404`.

## 10. Edición

El botón **Editar** abre el mismo formulario y precarga los datos existentes.

- El tipo queda deshabilitado.
- El código se muestra como texto informativo y no se envía como campo editable.
- El título o nombre, fecha, URL, descripción, fuente y autores cuando corresponde pueden modificarse.
- El formulario muestra **Documento actual: {nombre}**.
- Angular envía `multipart/form-data` mediante POST con `_method=PATCH`, que Laravel interpreta como PATCH.

### Editar sin nuevo PDF

Si no se selecciona un archivo:

- Angular no añade `archivo` al `FormData`.
- El backend conserva `archivo_pdf` y `nombre_archivo_original` sin cambios.

### Editar con nuevo PDF

Si se selecciona otro PDF:

1. Laravel guarda el archivo nuevo con otro UUID.
2. Actualiza la publicación dentro de una transacción.
3. Si la actualización falla, elimina el archivo nuevo.
4. Si la actualización termina correctamente, elimina el PDF anterior.
5. Conserva el mismo código y el mismo Observatorio.

## 11. Endpoints

Todos los endpoints tienen el prefijo `/api/departamentos`.

| Método | Endpoint | Uso | Permiso |
|---|---|---|---|
| `GET` | `/{departamento}/publicaciones` | Lista todas las publicaciones; admite query `tipo=ARTICULO` o `tipo=REPORTE` | Usuario autenticado con acceso |
| `GET` | `/{departamento}/publicaciones/articulos` | Lista solo Artículos | Usuario autenticado con acceso |
| `GET` | `/{departamento}/publicaciones/reportes` | Lista solo Reportes | Usuario autenticado con acceso |
| `POST` | `/{departamento}/publicaciones` | Crea un Artículo o Reporte | Solo ADMIN |
| `PATCH` | `/publicaciones/{publicacion}` | Actualiza una publicación | Solo ADMIN |
| `GET` | `/publicaciones/{publicacion}/download` | Descarga el PDF | Usuario autenticado con acceso |

## 12. Base de datos y entidades

### Tabla `observatorio_publicaciones`

Campos principales:

- `id`: UUID y clave primaria.
- `departamento_id`: UUID, clave foránea a `departamentos`; eliminación en cascada.
- `creado_por`: clave foránea a `users`; restringe la eliminación del usuario relacionado.
- `tipo`: enum `ARTICULO`, `REPORTE`, `ATLAS`.
- `codigo`: único.
- `titulo`.
- `fecha_publicacion`.
- `link_url`.
- `descripcion`.
- `autores`, nullable.
- `fuente`.
- `archivo_pdf`: ruta privada.
- `nombre_archivo_original`.
- `created_at` y `updated_at`.

Tiene un índice compuesto por `departamento_id` y `tipo`.

### Tabla `publicacion_contadores`

- `tipo`: clave primaria.
- `siguiente_numero`.

Se inicializa con filas para `ARTICULO` y `REPORTE`.

### Entidades y relaciones

- Modelo `ObservatorioPublicacion`.
- `ObservatorioPublicacion` pertenece a `Departamento` mediante `departamento_id`.
- `ObservatorioPublicacion` pertenece a `User` mediante `creado_por`.
- `Departamento` tiene muchas publicaciones mediante `publicaciones()`.

## 13. Cómo probar paso a paso

### Preparación

1. Aplicar migraciones:

   ```powershell
   .\scripts\backend.ps1 migrate
   ```

2. Iniciar backend y frontend:

   ```powershell
   .\scripts\backend.ps1 start
   cd frontend
   npm start
   ```

3. Iniciar sesión con un usuario ADMIN configurado en el entorno.
4. Abrir un Observatorio desde el panel administrativo.

## Pruebas recomendadas

### Crear Artículo

1. Pulsar **Agregar Artículo / Reporte / Atlas**.
2. Seleccionar **Artículo**.
3. Comprobar que aparece `Se generará automáticamente: ART-####`.
4. Completar título, fecha, URL HTTP/HTTPS, descripción, autores y fuente.
5. Seleccionar o arrastrar un PDF menor o igual a 20 MB.
6. Verificar nombre, tamaño y mensaje de carga correcta.
7. Guardar y comprobar que aparece en **Artículos subidos** con un código `ART-...`.

### Crear Reporte

1. Abrir el formulario y seleccionar **Reporte**.
2. Comprobar que aparece `Se generará automáticamente: REP-####`.
3. Completar nombre, fecha, URL HTTP/HTTPS, fuente y descripción.
4. Seleccionar o arrastrar un PDF válido.
5. Guardar y comprobar que aparece en **Reportes subidos**.

### Editar Artículo

1. Pulsar **Editar** en un Artículo.
2. Verificar que los datos, el código y el documento actual aparecen precargados.
3. Modificar un campo y actualizar sin subir PDF.
4. Confirmar que los datos cambian y que el PDF anterior todavía descarga.
5. Repetir seleccionando otro PDF y confirmar que ahora se descarga el nuevo.

### Editar Reporte

1. Pulsar **Editar** en un Reporte.
2. Cambiar nombre, descripción o fuente.
3. Actualizar sin PDF y comprobar que conserva el documento actual.
4. Actualizar con otro PDF y comprobar el reemplazo.

### Descargar PDF

1. Pulsar **PDF** en cualquiera de las listas.
2. Confirmar que descarga con el nombre original guardado.
3. Repetir con un usuario autenticado que tenga acceso al Observatorio.

### Subir archivo inválido

1. Arrastrar o seleccionar una imagen, archivo Word u otro formato.
2. Confirmar el mensaje **Formato no válido. Solo se permiten archivos PDF.**
3. Intentar un PDF mayor de 20 MB y confirmar el mensaje de tamaño máximo.
4. En creación, intentar guardar sin PDF y confirmar que el formulario lo exige.

### Modo claro y modo oscuro

1. Abrir el formulario en modo claro.
2. Revisar selector, inputs, zona punteada, errores y estado de éxito.
3. Activar modo oscuro desde la barra superior.
4. Repetir la revisión y confirmar que textos, bordes, fondos y estados siguen siendo legibles.

### Verificar permisos ADMIN

1. Como ADMIN, confirmar que aparecen los botones de creación y edición.
2. Como USER, confirmar que esos botones no aparecen.
3. Con el token de USER, intentar `POST /api/departamentos/{id}/publicaciones` y comprobar `403`.
4. Con el token de USER, intentar `PATCH /api/departamentos/publicaciones/{id}` y comprobar `403`.

## 14. Archivos principales

Backend:

- `backend/routes/modules/publicaciones.php`
- `backend/app/Presentation/Http/Controllers/Api/ObservatorioPublicacionController.php`
- `backend/app/Presentation/Http/Requests/Publicacion/StorePublicacionRequest.php`
- `backend/app/Presentation/Http/Requests/Publicacion/UpdatePublicacionRequest.php`
- `backend/app/Presentation/Http/Resources/Publicacion/PublicacionResource.php`
- `backend/app/Models/ObservatorioPublicacion.php`
- `backend/app/Models/Departamento.php`
- `backend/database/migrations/2026_07_01_000001_create_observatorio_publicaciones_table.php`
- `backend/config/filesystems.php`

Frontend:

- `frontend/src/app/features/departamentos/departamento-detail/departamento-detail.component.ts`
- `frontend/src/app/features/departamentos/departamento-detail/departamento-detail.component.html`
- `frontend/src/app/features/departamentos/departamento-detail/departamento-detail.component.scss`
- `frontend/src/app/core/services/publicacion.service.ts`
- `frontend/src/app/core/models/publicacion/publicacion.interface.ts`
