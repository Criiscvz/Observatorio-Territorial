# Fase 2: privacidad y conservación de eliminaciones antiguas

29 de octubre de 2026. Rama: `subsanacion-privacidad-publicaciones-fase2`.

## Resultado y alcance

Una publicación antigua privada no equivale a una publicación para suscriptores. Tampoco debe reaparecer un registro eliminado cuando se convierte a la tabla nueva. Esta entrega añade dos campos internos anulables a `observatorio_publicaciones`: `visibilidad_legada` y `eliminado_legado_at`. Las filas actuales mantienen ambos campos nulos y conservan su comportamiento previo.

El ejecutor de ensayo puede conservar registros privados o eliminados si el manifiesto incluye una justificación explícita `preservation_decision`, además de las decisiones de propietario, observatorio, fecha y estado. Copia las restricciones originales, conserva filas/archivos originales y verifica las huellas al repetir o revertir. Valores de visibilidad desconocidos y casos sin propietario/observatorio activo resuelto siguen bloqueados.

La conversión continúa limitada a bases y archivos desechables. **No se migra contenido real ni se activa la proyección de cambio de fuente en producción.** Esta entrega sí incorpora un esquema aditivo y controles de acceso normales para que los futuros destinos privados no dependan de una protección exclusiva del catálogo de ensayo.

## Reglas de acceso

| Caso | Catálogo y vistas públicas | Gestión y descarga directa |
|---|---|---|
| Publicación nativa, sin marcas antiguas | Reglas actuales de estado, observatorio y suscripción | Permisos actuales |
| Origen antiguo público/suscriptor convertido | Estado/observatorio y bloqueo de suscripción habituales | Suscripción o permiso de gestión actual según contexto |
| Origen antiguo privado convertido | Se excluye antes de contar/paginar, incluso para un administrador que consulta el catálogo público | Administrador; o propietario Editor / Supervisor revisor con asignación vigente y contexto de gestión |
| Origen antiguo eliminado convertido | Se excluye | No se resuelve por ID ni permite editar, eliminar o descargar en las rutas habituales; recuperación mediante manifiesto/respaldo |

El filtro global del modelo oculta las marcas de eliminación en relaciones, bibliotecas de gestión, resúmenes y resolución de parámetros de ruta. El catálogo SQL aplica expresamente el mismo filtro porque no usa Eloquent. Los listados públicos antiguos y las bibliotecas/Atlas públicos también respetan la privacidad conservada. Una comprobación adicional del recurso y la descarga impide servir datos privados por una ruta alternativa.

La asignación y capacidad de revisión se consultan al usar el recurso. Retirar el observatorio al Editor o desactivar revisión al Supervisor revoca también el acceso mediante una sesión ya existente. `context=management` no concede permiso por sí mismo. Los campos de conservación no forman parte de los campos editables o del contrato de salida: una actualización de revisión no puede borrarlos enviándolos en la petición.

Esta marca representa una eliminación **histórica**, no sustituye el comportamiento de eliminación de las publicaciones nativas actuales. No se añade una papelera o botón de restauración general.

## Rutas antiguas que siguen activas

Se refuerzan las lecturas de detalle de artículos/reportes para que oculten observatorios privados/eliminados y visibilidades desconocidas. El rol Editor deja de tratarse como suscripción en estas lecturas públicas, igual que en el catálogo nuevo.

La descarga antigua de fichas requiere una referencia de reporte con nombre exacto de archivo. Se rechazan archivos huérfanos y referencias eliminadas o restringidas. Si varias filas comparten el mismo archivo, basta una referencia privada/eliminada para bloquearlo; si alguna exige suscripción, se exige suscripción. No se elige simplemente la primera coincidencia de un sufijo. Las respuestas autorizadas utilizan `Cache-Control: private, no-store` para no perpetuar una autorización anterior en cachés públicas.

Este control no elimina copias que un destinatario autorizado ya haya guardado ni puede revocar URLs públicas externas de Power BI. La compatibilidad de IDs convertidos en escrituras/detalles/fichas antiguos todavía requiere una entrega posterior.

## Esquema, orden de despliegue y reversión

La migración `2026_10_29_000001_preserve_legacy_publication_access.php` agrega únicamente columnas anulables; no convierte filas, no actualiza contraseñas, no borra archivos y no crea recibos de ensayo. El arranque de Render aplica ese archivo antes de atender tráfico, también cuando `RUN_MIGRATIONS` está desactivado. Otros despliegues deben ejecutar la migración antes de servir este código.

La copia local aislada se respaldó antes de añadir el esquema. Se comprobó que sus valores previos coincidieran y que los nuevos campos quedaran nulos, sin habilitar conversión. No se utilizó la base local original.

Para revertir esta entrega, no basta con publicar código antiguo que ignore las restricciones: comprobar primero que no existen filas con marcas de conservación. La reversión del esquema se niega a quitar columnas si contienen restricciones, para no hacer públicos sus registros por pérdida de metadatos. Si hay datos convertidos, conciliar y revertir sus lotes o restaurar un respaldo verificado antes de retirar controles. No desactivar filtros manualmente.

## Validación

- SQLite: **304 pruebas y 2.666 aserciones**, ocho omisiones específicas de PostgreSQL.
- PostgreSQL 16 desechable: **102 pruebas y 591 aserciones**, solapadas con SQLite.
- Matriz de visitante, Usuario, Suscriptor, Editor ajeno, Supervisor sin revisión, Editor propietario, Supervisor revisor y Administrador: catálogo, listado de gestión, descarga directa y contexto de gestión.
- Las marcas eliminadas no permiten resolución ni escritura por ID, incluso con rol Administrador; las filas y archivos originales se conservan al revertir el ensayo.
- Revocación de asignación/revisión sin cerrar la sesión. Revisión incapaz de limpiar los campos internos. Reversión de esquema bloqueada si perdería restricciones.
- Rutas antiguas: suscripción consistente, observatorio privado/eliminado, archivos huérfanos, referencias compartidas/restringidas y coincidencia exacta de nombre.
- Recuperación física de **cuatro registros sintéticos**, incluido uno privado y uno eliminado: repetición, reversión, `pg_dump`/`pg_restore` a otra base vacía y restauración de archivos. Se conservan restricciones, categoría, recepción, huellas y SHA-256. Cero solicitudes a producción en este ensayo.

Los esquemas mínimos de pruebas de Atlas/CSRF se actualizan mediante la misma migración. Las pruebas de conversión y acceso corren en CI con SQLite/PostgreSQL. Evidencias y respaldos permanecen en almacenamiento local ignorado.

## Pendiente de fase 2

Transicionar escrituras y URLs antiguas de detalle/ficha al destino convertido, fijar el esquema persistente del mapa y el despliegue del cambio de fuente, inventariar/resguardar datos reales y ensayar el corte completo con una copia autorizada. Todavía no se retiran tablas antiguas ni se declara terminada la fase.
