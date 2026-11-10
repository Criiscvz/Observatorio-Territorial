# Ensayo reversible de publicaciones antiguas

Fecha: 29 de octubre de 2026. Rama: `subsanacion-migracion-ensayo-fase2`.

## Alcance de esta entrega

Se prueba la mecánica de conversión de `articulos` y `reportes` hacia `observatorio_publicaciones` con fuentes sintéticas no vacías. No se ejecuta una conversión sobre producción ni sobre la copia local de trabajo. No se eliminan tablas, registros originales ni archivos originales.

El comando `publications:rehearse-legacy` es exclusivo de CLI. No tiene ruta HTTP, no se invoca al iniciar la aplicación y no se añadió ninguna migración automática de esquema o datos a `database/migrations`.

La fase 2 sigue en ejecución. Este ensayo demuestra repetición, detección de conflictos, reversión y recuperación; todavía no habilita el corte definitivo a una única fuente.

La siguiente entrega amplía este mecanismo con [metadatos tipados y una proyección de lectura sin duplicación](ENSAYO_IDENTIDAD_PUBLICACIONES_FASE2.md), exclusiva de pruebas y recuperación sintética. Las limitaciones productivas descritas aquí siguen vigentes.

## Aislamiento obligatorio

El ejecutor rechaza cualquier operación, incluida `prepare`, salvo que se cumplan todas estas condiciones:

- `APP_ENV=testing` y `LEGACY_PUBLICATION_REHEARSAL_ENABLED=true`. La bandera está desactivada por defecto.
- SQLite en memoria, o PostgreSQL local con nombre terminado en `_test`/`_testing`, sin URL de conexión alternativa.
- Disco local dedicado `phase2-rehearsal`, separado del almacenamiento normal de publicaciones.

Estas comprobaciones son barreras contra errores de operación; el nombre de la base no sustituye su aislamiento real. El ejecutor de recuperación crea PostgreSQL con `--network none`, datos temporales y fixtures nuevos, y ejecuta PHP únicamente en la red de ese contenedor. No monta archivos `.env`, no descarga archivos remotos y no utiliza credenciales de servicios publicados.

Una comprobación adicional sobre la aplicación local de ensayo confirmó que el comando permanece bloqueado, no crea la tabla auxiliar y no modifica la huella de sus publicaciones. No se deben cambiar sus variables para activar esta herramienta.

## Decisiones explícitas y conservación de campos

Cada manifiesto privado incluye versión, UUID del lote y hasta 500 decisiones. Cada origen necesita tabla e ID, SHA-256 de la fila planificada, UUID destino, código de migración y propietario autorizado con justificación. No se decide que dos publicaciones son iguales por compartir título o UUID entre tablas.

| Dato | Tratamiento del ensayo |
|---|---|
| ID y código | UUID destino y código `ART-MIG-`/`REP-MIG-` explícitos; cualquier colisión bloquea. No se consumen los contadores normales. |
| Propietario | Cuenta activa con rol autor y acceso actual al observatorio; decisión documentada porque las tablas antiguas no registran ese propietario. |
| Observatorio y publicación | Se conservan los valores existentes. Si faltan, se exige valor y justificación; no se reasignan silenciosamente. |
| Estado | Traducción conocida para artículos. Reportes sin estado o valores desconocidos requieren decisión explícita. Suspendido, archivado y rechazado requieren motivo. |
| Título, descripción, autores, fuente, enlace y marcas de tiempo | Se trasladan a los campos equivalentes, conservando la lista de autores y la distinción de registros. |
| Solo suscriptores | Se conserva como restricción de acceso. La visibilidad privada antigua se bloquea hasta definir una representación sin pérdida. |
| Categoría, fecha de recepción y otros campos sin equivalente | Se conservan íntegros en `source_snapshot` del registro de conversión y en la tabla original. Todavía no se incorporan al contrato público de la tabla destino. |
| Eliminación lógica | Se bloquea hasta acordar una política de conservación. No se convierte automáticamente en una publicación activa. |
| Ficha PDF | Mapeo local explícito, nombre compatible con el origen, límite de 20 MB, cabecera PDF y SHA-256. Se copia a un espacio exclusivo del ensayo, sin borrar el archivo original. |

El registro auxiliar `phase2_publication_imports` conserva origen/destino, lote completo, decisiones, instantánea de origen, huellas de origen/destino y manifiesto de archivo. Es información privada de recuperación, sin endpoint público; no se versionan sus datos o manifiestos reales.

## Repetición y reversión

`preview` valida todas las decisiones antes de escribir. `apply` utiliza una transacción SQL por lote, bloqueo de filas y, en PostgreSQL, bloqueo asesor para serializar operaciones del ensayo. La segunda ejecución de un manifiesto idéntico reconoce sus recibos y no duplica filas ni archivos. Un manifiesto cambiado, una fuente modificada o un destino ocupado bloquean la operación.

Un fallo intermedio revierte las filas y retira las copias creadas por ese intento. `rollback` comprueba el lote completo y sus huellas antes de retirar exclusivamente destinos y copias del lote. Si alguien modificó fuentes, destinos, recibos o archivos, se exige conciliación manual: no hay opción de sobrescritura forzada. La eliminación de copias sucede después de confirmar la transacción; un fallo de almacenamiento se informa y requiere limpieza/recuperación controlada. No se afirma atomicidad entre PostgreSQL y el sistema de archivos ante una caída del proceso.

Secuencia disponible únicamente dentro del entorno desechable preparado:

```text
php artisan publications:rehearse-legacy prepare
php artisan publications:rehearse-legacy preview --manifest=/ruta/privada/manifiesto.json
php artisan publications:rehearse-legacy apply --manifest=/ruta/privada/manifiesto.json
php artisan publications:rehearse-legacy rollback --batch=UUID-DEL-LOTE
```

La salida CLI contiene contadores, identificadores y motivos acotados. Los errores de validación o del motor no imprimen el manifiesto, filas originales ni credenciales.

## Evidencia de validación

- SQLite: **295 pruebas, 2.431 aserciones**, ocho omisiones específicas de PostgreSQL.
- PostgreSQL 16 desechable: **93 pruebas, 356 aserciones**; se solapan con las anteriores y no son casos únicos adicionales.
- Casos específicos: decisiones faltantes, autorización del propietario, títulos duplicados, colisiones, fuentes privadas/eliminadas, manifiestos cambiados, recibos incompletos, fallo intermedio, repetición, reversión, rutas de archivo y huellas alteradas.
- Recuperación física: un artículo, un reporte y un archivo sintético; `pg_dump` y respaldo de archivos antes de aplicar; aplicación repetida sin duplicados; reversión con coincidencia de huellas; `pg_restore` en una segunda base vacía y recuperación de archivos en otra carpeta; coincidencia de datos y SHA-256 de archivos; nueva aplicación y reversión después de restaurar. Cero solicitudes a producción y sin red externa.

La suite SQL se ejecuta en CI para SQLite y PostgreSQL. La recuperación física se ejecutó localmente con `node scripts/test-legacy-publication-recovery.cjs`; requiere las imágenes locales `backend-backend-dev:latest` y `postgres:16-alpine` y Docker. El script comprueba la coincidencia de `composer.lock`, no construye/descarga imágenes y elimina únicamente su contenedor identificado. Las evidencias y respaldos sintéticos permanecen bajo `storage/codex-local`, ignorado por Git.

## Trabajo pendiente antes de convertir datos reales

1. Inventariar producción y obtener un respaldo reciente y verificable de su base y archivos.
2. Resolver campos y casos bloqueados: categoría, recepción, privacidad, eliminación lógica y asignaciones de propietario.
3. Preparar la identidad de lectura y el cambio de fuente: el catálogo actual sigue uniendo tablas antiguas y nuevas. Aplicar conversiones sin adaptar esa lectura produciría duplicados. Este ensayo no debe activarse en el despliegue actual.
4. Transicionar escrituras, detalles, fichas y consumidores antiguos; verificar sus permisos y paginación.
5. Ensayar el corte completo y su reversión con una copia autorizada. Solo después programar una migración real; retirar tablas es una etapa posterior.
