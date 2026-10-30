# Bibliotecas paginadas: gestión y Atlas

La biblioteca pública de observatorios ya utiliza el catálogo paginado. Esta entrega añade consultas separadas para gestión y Atlas; conserva los endpoints antiguos usados por Barómetro y otros clientes. No elimina tablas ni convierte datos.

## Contratos aditivos

- `GET /api/departamentos/{id}/biblioteca/publicaciones`: roles Administrador, Supervisor y Editor. Filtros `tipo` (artículo/reporte/libro), `estado`, `q`, `page` y `per_page=20`. Devuelve `data`, `meta`, `links`, `counts` por tipo y `review_total`. Los totales de pestañas y revisión se calculan antes de búsqueda/tipo/estado, después del alcance autorizado.
- `GET /api/departamentos/{id}/biblioteca/publicaciones/{id}`: resuelve una publicación fuera de la página visible aplicando exactamente el mismo alcance. No permite saltar a otro observatorio.
- `GET /api/departamentos/publicaciones/atlas-biblioteca`: solo Administrador. Filtros `categoria_id` o `sin_categoria=1`, búsqueda y página de 20.
- `GET /api/publico/atlas/biblioteca`: exige una categoría pública activa. Devuelve solo Atlas globales publicados, sin restricciones privadas históricas ni eliminaciones; los recursos de suscriptor quedan bloqueados según la sesión.
- `/api/atlas/categorias/directorio` y `/api/publico/atlas/directorio`: categorías con `publicaciones_total`; búsqueda SQL por nombre/descripción o publicación autorizada. No descargan las publicaciones completas para construir contadores. El directorio de gestión incluye `unassigned_total`.

La búsqueda admite hasta 200 caracteres, usa parámetros enlazados y trata `%`, `_` y `!` como texto literal. El orden de publicaciones es fecha descendente, creación descendente e ID, con fechas nulas al final. Las páginas son estables en una instantánea; no prometen aislamiento entre peticiones concurrentes.

El Editor ve su propio contenido en observatorios con asignación actual. El Supervisor conserva el alcance y el permiso de revisión actual; revocarlo retira borradores y motivos del resultado y sus totales. No se concede acceso de suscriptor por pertenecer a un rol editorial. Rechazados, motivos, bloqueo y descarga conservan las reglas existentes.

Las filas usan un contrato explícito sin rutas de almacenamiento, correo de creador, IDs o errores internos de SharePoint. Los PDF se consultan mediante la descarga autorizada; no se entrega el enlace privado de SharePoint como transporte alternativo. Los contratos antiguos permanecen compatibles.

## Cliente y publicación

Las bibliotecas y la cola de revisión solicitan páginas al servidor, conservan filtros durante una recarga y ajustan la página cuando disminuye el total. `switchMap` cancela solicitudes antiguas; al cambiar de observatorio/categoría se retiran las filas previas. Los fallos se distinguen de listas vacías y permiten reintentar. La edición por URL usa el detalle autorizado, no una búsqueda en la página cargada.

Publicar primero el backend aditivo y comprobar los endpoints antes de publicar el cliente. Para revertir el cliente se mantiene el backend compatible; no hay reversión de datos ni de esquema en esta entrega.

Barómetro queda explícitamente pendiente de su rediseño. Sus contratos antiguos deben conservarse mientras existan consumidores. Esta entrega no declara cerrada la fase 2 ni autoriza retirar tablas/endpoints por estar vacíos en el inventario.
