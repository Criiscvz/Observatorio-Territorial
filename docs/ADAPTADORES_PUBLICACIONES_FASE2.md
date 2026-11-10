# Fase 2: identidad permanente y accesos antiguos

29 de octubre de 2026. Rama: `subsanacion-adaptadores-publicaciones-fase2`.

## Problema y comportamiento nuevo

Una fila convertida no debe seguir editándose como si su original fuera otra publicación. La identidad de lectura tampoco debe depender de una tabla temporal de ensayo. Esta entrega introduce `publication_origins` y adapta las rutas antiguas de artículos/reportes para leer y modificar un único destino en `observatorio_publicaciones`.

El catálogo normal utiliza el mapa permanente: excluye el origen convertido antes de filtrar/contar/paginar y conserva su categoría y recepción. Las filas antiguas sin mapa continúan disponibles bajo sus controles previos, hasta conciliar su conversión. La aplicación funciona sin `phase2_publication_imports`; esa tabla solo conserva evidencias privadas del ensayo.

No se convierten registros reales en esta entrega. La migración crea un mapa vacío y el ejecutor continúa deshabilitado por defecto, limitado a bases y almacenamiento desechables.

## Mapa e integridad

| Campo o restricción | Función |
|---|---|
| `source_table`, `source_id`, `target_id` | Identidad de origen y destino. Tabla + ID de origen es única, igual que el destino. No se fusiona por título. |
| `source_kind=legacy` | Identifica una fila antigua efectivamente convertida; solo estas identidades excluyen filas de las tablas antiguas. |
| `source_kind=compatibility` | Identidad de una alta nueva solicitada con el contrato antiguo. Su ID coincide con el destino; no se inserta una fila en `articulos`/`reportes`. |
| Categoría y fecha de recepción | Metadatos actuales compartidos por los accesos antiguos y el catálogo. La categoría usa FK anulable; borrarla no deja una referencia pública huérfana. |
| `legacy_file_name` | Alias del nombre de ficha antigua hacia la descarga actual. No contiene una URL o ruta arbitraria suministrada por el visitante. |
| FK de destino restrictiva | Impide borrar físicamente un destino y dejar al origen reaparecer por pérdida de su identidad. |

El ensayo crea mapa, destino y recibo dentro de la misma transacción. Guarda también la huella del mapa y comprueba su integridad al repetir/revertir. Una edición posterior de destino o metadatos bloquea la reversión automática, en vez de descartar trabajo nuevo. Los originales permanecen intactos.

## Contratos antiguos

| Acceso | Comportamiento |
|---|---|
| `GET /api/articulos/{id}`, `/api/reportes/{id}` | Aceptan ID antiguo convertido o ID del destino/nativo del tipo correcto. Devuelven los campos antiguos usando los valores actuales y acciones de descarga del destino. |
| `PUT` en esas rutas | Actualiza únicamente el destino si hay mapa. Una actualización parcial conserva los campos omitidos, incluidos autores múltiples. Categoría/recepción modifican los metadatos compartidos. |
| `DELETE` antiguo o eliminación desde el formulario actual | Los destinos con mapa se marcan como eliminados, conservando mapa y archivos. Desaparecen de los accesos normales y el origen no resucita. Las publicaciones nativas sin mapa conservan su eliminación actual. |
| `GET /api/reportes/fichas/{filename}` | Un alias convertido sirve el PDF actual, con la autorización vigente, aunque se haya reemplazado la copia. Nombres compartidos/ambiguos o referencias ajenas con el mismo nombre se rechazan; no se elige la primera coincidencia. |
| `POST /api/articulos`, `/api/reportes` | Crea directamente un destino nuevo y una identidad de compatibilidad, sin añadir filas antiguas. |

Las respuestas adaptadas tienen una lista explícita de campos. No incluyen propietario/correo, rutas de almacenamiento, recibos, decisiones ni identificadores/URLs internos de SharePoint. Los recursos protegidos requieren suscripción o permisos de gestión actuales; conocer el alias no concede acceso.

Si dos recursos distintos comparten el ID que una URL antigua intentaría representar, se devuelve **409** para no editar o servir el equivocado. La biblioteca actual y sus rutas explícitas de publicación permiten seleccionar la identidad correcta.

## Validación y permisos

Las altas antiguas requieren ahora observatorio y fecha explícitos; los reportes requieren un enlace HTTP(S). Se conservan los nombres de campos antiguos. El propietario se toma de la sesión y el código del contador transaccional; no de datos enviados por el cliente. Sin estado explícito, el alta queda en revisión. Un Editor solo puede crear en sus observatorios y enviar a revisión; publicar/rechazar/archivar requiere revisión vigente.

Los destinos utilizan las reglas actuales: Administrador, Supervisor con revisión en ese observatorio o Editor propietario asignado. Editor no modifica ni elimina rechazados. La sesión no conserva permisos revocados. La autorización del contrato antiguo no permite trasladar un destino a otro observatorio ni quitar su privacidad conservada; esos intentos se rechazan con validación y no se ignoran silenciosamente.

Las fichas adaptadas y las altas nuevas admiten PDF de hasta 20 MB. DOC/Excel antiguos requieren conciliación o conversión explícita antes de poder convertirse; no se renombran como PDF. Las escrituras de filas antiguas todavía sin mapa siguen temporalmente su contrato previo.

Una escritura antigua bloquea primero su fila de origen y vuelve a comprobar el mapa dentro de la transacción. Si una conversión obtiene ese bloqueo primero, la escritura posterior usa el destino. Si una escritura antigua cambia la fuente antes de convertir, la huella planificada deja de coincidir y el ensayo se bloquea. La operación no mantiene dos copias sincronizadas mediante escrituras dobles.

Los archivos nuevos se retiran si falla la escritura transaccional. Para destinos con mapa, las copias anteriores se conservan al reemplazar o eliminar, junto con el original antiguo; su limpieza es una tarea posterior de conservación, no una eliminación automática. No se afirma atomicidad completa entre base y almacenamiento ante la caída del proceso.

## Despliegue y reversión

`2026_10_29_000002_create_publication_origins.php` crea únicamente el mapa vacío. El arranque de Render aplica esa migración antes de servir este código. Otros hosts deben seguir el mismo orden. No ejecuta conversiones ni crea recibos de ensayo.

La copia local aislada se respaldó antes del cambio. El mapa inicial está vacío y las huellas de las publicaciones coinciden con las anteriores. La base local original y producción no se usaron para ensayar conversiones.

La migración se niega a eliminar un mapa con identidades presentes. Tampoco se debe volver a una versión que ignore el mapa, porque podría mostrar originales junto a sus destinos o escribir en la copia equivocada. Si ya hubo conversiones/altas compatibles, conciliar los lotes y sus ediciones o restaurar un respaldo verificado; no borrar identidades manualmente.

## Pruebas y pendientes

- SQLite: **315 pruebas, 2.782 aserciones**, ocho omisiones específicas de PostgreSQL.
- PostgreSQL 16 desechable: **113 pruebas, 707 aserciones**, solapadas con SQLite.
- Edición por ID antiguo, ID nuevo y formulario actual con un solo destino; originales sin cambios y autores múltiples conservados.
- Altas antiguas sin filas antiguas nuevas; fecha/destino explícitos, propietario de sesión, revisión del Editor y rechazo de publicación indebida.
- Rechazados, revocaciones, suscripción/privacidad, PDF reemplazado y eliminación por ambas interfaces sin reaparición del original.
- Fallo durante escritura de PDF: transacción y copias nuevas revertidas; archivos previos intactos. Colisiones de ID devuelven 409; mapa único y reversión de esquema protegida.
- El catálogo y los adaptadores siguen funcionando después de quitar el registro temporal de ensayo.
- Recuperación física de cuatro fuentes sintéticas: aplicar/revertir, editar por ambas interfaces con originales intactos, bloqueo de reversión que descartaría ediciones, restauración de base/archivos en otra base vacía y nueva aplicación/reversión con huellas y SHA-256 coincidentes. Sin red externa ni solicitudes productivas.

La fase 2 sigue abierta. Falta inventario y respaldo recientes de producción, manifiestos de conciliación reales —incluidos propietarios y casos sin observatorio/fecha— y ensayo completo del corte sobre una copia autorizada. Revisar consumidores restantes y sus contratos/paginación antes de retirar tablas o endpoints antiguos. Esta entrega no autoriza `DROP TABLE` ni habilita el ejecutor de ensayo en producción.
