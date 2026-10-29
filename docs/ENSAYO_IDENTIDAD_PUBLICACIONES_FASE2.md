# Fase 2: identidad de lectura y metadatos antiguos

29 de octubre de 2026. Rama: `subsanacion-identidad-publicaciones-fase2`, desde `pruebas-rediseno`.

## Problema y resultado del ensayo

La conversión conserva el origen, pero el catálogo normal todavía une fuentes antiguas y nuevas. Convertir filas sin preparar el cambio de lectura las contaría dos veces. Además, categoría antigua y fecha de recepción solo estaban en la instantánea privada, sin representación consultable en el catálogo convertido.

Esta entrega añade una proyección de lectura exclusiva del ensayo, `RehearsalPublicationCatalog`. Conserva la categoría y recepción en campos tipados del registro de conversión y excluye únicamente la fila antigua identificada por un recibo origen/destino. Las demás filas antiguas y las publicaciones nuevas sin recibo siguen apareciendo normalmente.

El catálogo de producción **no cambia de fuente**. La proyección no se registra en el contenedor de la aplicación ni se conecta a rutas HTTP. Solo las pruebas la enlazan expresamente con el controlador para verificar el contrato. Instanciarla exige los mismos controles de entorno, base y disco desechables que el ejecutor. No hay migraciones automáticas de esquema ni conversiones de datos reales.

## Identidad y reglas de lectura

- La identidad es tabla de origen + UUID de origen → UUID destino. Coincidir en título o UUID entre tablas no fusiona publicaciones.
- Un recibo se crea en la misma transacción que su destino. Su identidad única impide que una fila antigua contribuya al catálogo junto con su copia convertida.
- La exclusión del origen no depende del estado público del destino: archivar, suspender o rechazar la copia nueva no debe resucitar la antigua.
- Los filtros de estado y observatorio público siguen aplicándose antes de contar, buscar o paginar. Se conservan páginas de 20 y los totales por tipo.
- Las respuestas convertidas usan ID y acciones de la publicación nueva. La compatibilidad de URLs antiguas de detalle/escritura/fichas sigue pendiente.
- Los recibos son parte de la integridad del cambio de fuente. No deben editarse o eliminarse manualmente. Este ensayo no demuestra recuperación automática ante una manipulación arbitraria de la tabla auxiliar.

## Categoría, recepción y datos privados

Los recibos incorporan `categoria_id`, `fecha_recepcion` y `metadata_hash`. La categoría mantiene su UUID y se consulta con los datos de `categorias_dataset`; no se confunde con categorías de Atlas. La fecha de recepción se conserva como fecha y permanece nula en reportes sin ese campo. La instantánea original completa continúa disponible para recuperación.

Repetir o revertir un lote comprueba que esos metadatos coincidan tanto con su huella como con la fuente. Si cambian, se bloquea la operación. Un esquema antiguo del ensayo no se actualiza sobre la marcha: `prepare` exige una base desechable nueva cuando faltan los campos de esta versión.

El contrato público conserva su lista explícita de campos. No expone decisiones de propietario, instantáneas, recibos ni huellas. El origen suscriptor conserva el bloqueo de recursos y la descarga requiere autorización, incluso si alguien conoce la URL directa.

Los registros privados y eliminados lógicamente **siguen bloqueados para conversión**. Antes de habilitarlos se debe definir una representación equivalente y aplicarla también a gestión, detalles y descargas; ocultarlos solo en el catálogo no sería suficiente. Las fuentes originales permanecen intactas.

## Validación

- SQLite: **300 pruebas y 2.524 aserciones**, ocho omisiones específicas de PostgreSQL.
- PostgreSQL 16 desechable: **98 pruebas y 449 aserciones**, solapadas con SQLite.
- Conversión parcial de 12 artículos entre 25 registros: total estable antes/después, páginas de 20 y 5 sin claves repetidas, búsqueda remota y totales por tipo.
- Artículo/reporte con el mismo UUID: siguen siendo dos publicaciones; categoría y recepción se conservan tras aplicar y revertir.
- Una copia convertida suspendida/archivada/rechazada/en revisión no hace reaparecer el origen; un observatorio privado tampoco se publica.
- Libros nativos conservan título y autores. Visitante, Usuario, Editor y Supervisor sin suscripción no descargan el PDF de suscriptor; Suscriptor recibe los mismos bytes.
- Cambios de metadatos bloquean repetición/reversión. La proyección se rechaza fuera del ensayo autorizado.
- Recuperación física ampliada: después de `pg_restore` y restaurar archivos en otra carpeta, se comprueban categoría, recepción y totales sin duplicación antes/durante/después de aplicar y revertir. Las huellas de datos y SHA-256 de archivos coinciden. Cero solicitudes productivas y sin red externa.

La suite del catálogo y conversión se ejecuta en CI con SQLite/PostgreSQL. La recuperación física local se repite con `node scripts/test-legacy-publication-recovery.cjs`, con imágenes ya disponibles y datos sintéticos. Resultados privados bajo `storage/codex-local`.

## Siguientes puertas

1. Representar privacidad y eliminación lógica en todos los puntos de autorización, no solo en lectura pública.
2. Transicionar escrituras, detalles y fichas antiguos para evitar dos fuentes editables divergentes; verificar consumidores de Barómetro y gestión.
3. Definir el esquema persistente de conversión y el orden explícito de despliegue del cambio de fuente. No activar el ejecutor de ensayo en producción.
4. Inventariar y respaldar la base/archivos reales, ensayar el corte completo con una copia autorizada y conciliar resultados antes de migrar. La fase 2 sigue abierta y las tablas originales no se retiran.
