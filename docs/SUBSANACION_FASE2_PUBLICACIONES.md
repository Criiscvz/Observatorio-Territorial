# Fase 2: publicaciones y contratos API

Inicio: 29 de octubre de 2026 (America/Guayaquil).
Base: `pruebas-rediseno`, cierre de fase 1 en `44cc4cb3598071a71f4b5605025ac5c9e192799e`.
Rama inicial: `subsanacion-publicaciones-fase2`.

## Estado y fuente objetivo

La fase 2 está en ejecución. Esta primera entrega prepara el contrato público común y elimina la combinación de resultados en memoria en los listados de artículos y reportes. **No constituye la migración final ni elimina tablas.**

La fuente objetivo es `observatorio_publicaciones`, que soporta los tipos, propietario, códigos, estados y motivos de revisión, archivos y metadatos de SharePoint utilizados por los formularios actuales. `articulos` y `reportes` siguen existiendo como fuentes antiguas de compatibilidad mientras se concilian y retiran sus consumidores/escrituras.

No se fusionan automáticamente registros por título, fecha o UUID. Cada origen conserva su identidad; un UUID coincidente en dos tablas no prueba que representen la misma publicación.

## Inventario inicial del ensayo

El inventario de la aplicación restaurada separada encontró:

| Tabla/tipo | Registros |
|---|---:|
| `articulos` | 0 |
| `reportes` | 0 |
| `observatorio_publicaciones` | 33 |
| Artículos unificados | 14 |
| Reportes unificados | 11 |
| Libros unificados | 7 |
| Atlas unificados | 1 |

Estas cantidades corresponden al ensayo preparado en fase 0, no a un inventario actual de producción. Las relaciones antiguas apuntan a departamentos y categorías de datasets; no se identificaron claves foráneas entrantes hacia artículos/reportes en esa copia. Los 26 PDF referenciados se mantienen sin trasladar ni renombrar en esta entrega.

Para repetir el inventario de una base autorizada mediante CLI:

```powershell
php artisan publications:inventory --json
```

El comando solo consulta y devuelve agregados: registros activos/eliminados, ausencia de observatorio/fecha, categoría, visibilidad privada, referencias inválidas y colisiones de ID con la tabla destino. No imprime títulos, autores, contraseñas ni URLs privadas y no habilita migraciones. Los modelos antiguos carecen de propietario: cualquier registro activo requiere una decisión trazable; no se asignará al primer administrador encontrado.

## Consumidores identificados

| Consumidor | Situación/tratamiento |
|---|---|
| `ArticuloController::index` y `ReporteController::index` | Ahora consultan un read model SQL común, sin `get()->filter()->concat()->sort`. Conservan temporalmente el array antiguo y sus nombres de campos. |
| Estadísticas del portal | Usan el mismo alcance SQL de lectura pública que el catálogo; no suman conjuntos con filtros distintos. |
| Biblioteca pública por observatorio | Migración del cliente al nuevo contrato paginado, después de publicar/verificar el backend. Conserva pestañas, buscador, visor y 20 registros por página. |
| Barómetro público y servicios antiguos `getAll` | Siguen usando los arrays de compatibilidad. No se declara eliminada toda descarga de listas completas. |
| Formularios, bibliotecas de gestión, revisión, Atlas y SharePoint | Usan `observatorio_publicaciones`; se conservan en esta entrega. Su paginación/contratos se revisarán dentro del resto de fase 2. |
| Escritura/detalle/fichas de `/articulos` y `/reportes` | Continúan temporalmente en modelos antiguos, sujetos a sus controles existentes. Requieren adaptadores y transición antes de retirar tablas. |

## Contrato público paginado

`GET /api/publico/publicaciones`

| Parámetro | Regla |
|---|---|
| `departamento_id` | UUID opcional. Si se suministra, debe corresponder a un observatorio público activo; en otro caso 404. |
| `tipo` | `ARTICULO`, `REPORTE` o `LIBRO`. Atlas conserva su catálogo independiente. |
| `categoria_id` | UUID opcional para categorías antiguas; las publicaciones nuevas sin esa categoría no se mezclan con el filtro. |
| `q` | Hasta 200 caracteres; búsqueda parametrizada de título, código, autores y fuente, sin distinción de mayúsculas/tildes españolas. `%`, `_` y `!` se buscan como caracteres literales. |
| `page` | Entero positivo, máximo 1.000.000. |
| `per_page` | Si se envía, solo admite 20. |

La respuesta usa `data`, `meta`, `links` y `counts`. `counts` contiene los totales de las tres pestañas para el observatorio/categoría, antes del filtro de tipo/búsqueda; `meta.total` corresponde al conjunto filtrado. El orden es fecha descendente con nulos al final, creación descendente, origen e ID. Es estable ante empates en una misma instantánea; no es paginación de snapshot frente a escrituras concurrentes.

`CatalogPublicationResource` declara los campos públicos de forma explícita. Incluye ID, `resource_key` (`origen:UUID`), origen, tipo, código, título, descripción, autores como lista, fuente, fechas, observatorio/categoría resumidos, bloqueo y recursos disponibles. No expone propietario/correo, motivo de revisión, ruta de almacenamiento, identificador de SharePoint ni errores de integración.

Se filtran en SQL observatorios privados/eliminados, estados sin publicación y registros antiguos privados/eliminados antes de calcular totales o paginar. La compatibilidad del Barómetro conserva contenido antiguo público sin observatorio; no lo incorpora artificialmente a un observatorio. Las publicaciones nuevas sin padre válido no aparecen. Ser Editor o Supervisor no concede por sí solo acceso público de suscriptor; las acciones de gestión conservan sus reglas específicas.

## Validación de la primera entrega

- SQLite: 285 casos y 2.351 aserciones, con ocho omisiones específicas de PostgreSQL.
- PostgreSQL 16 desechable: 83 pruebas y 276 aserciones, con solapamiento respecto de SQLite; no sumarlas como casos únicos.
- Regresiones específicas: mezcla de orígenes, páginas de 20, orden estable, categorías, colisiones de UUID, filtrado antes de contar, estados, campos excluidos, suscripción, búsqueda parametrizada y límites de entrada. El inventario no modifica sus fuentes.
- Ensayo HTTP previo: 121 comprobaciones de cinco roles y 26 PDF conservados.
- Conciliación adicional: doce combinaciones de observatorio/tipo, quince publicaciones de lectura pública visibles y huella de todas las filas unificadas sin cambios. La diferencia frente al total de 33 corresponde al alcance público y estados; no se eliminaron registros.
- Compilación Angular de producción aprobada en una carpeta ignorada. Se conservan advertencias previas de presupuestos de estilos, sin cambios de SCSS en esta entrega.

Las pruebas de lectura SQL se ejecutan tanto en SQLite como en PostgreSQL en CI. Los logs, huellas y manifiestos permanecen en almacenamiento local ignorado.

## Orden de publicación y reversión

1. Publicar el backend aditivo con el endpoint y adaptadores antiguos; CI debe pasar antes de integrar. No hay migración de esquema/datos en esta primera entrega.
2. Comprobar el endpoint nuevo en el backend y a través de `/api` del dominio publicado.
3. Integrar el frontend que pide páginas al catálogo común. El despliegue previo del backend evita una ventana de 404 al actualizar el cliente.
4. Para revertir el cliente, restaurar su versión anterior manteniendo el backend compatible. Para retirar después el endpoint, confirmar antes que no quedan clientes activos que dependan de él. No hay reversión de datos necesaria en esta entrega.

## Puertas que faltan para cerrar fase 2

1. Inventario actual autorizado de producción y respaldo reciente de su base y archivos antes de cualquier migración; la copia local no sustituye ese punto de recuperación.
2. Mapa reversible de orígenes y campos: UUID/código, categoría, fecha de recepción/publicación, autor/propietario, observatorio, visibilidad, estados/motivos y fichas/enlaces/PDF. Tratar explícitamente propietarios, fechas o departamentos ausentes; no inventarlos.
3. Migración repetible con conciliación de registros/archivos y restauración. La mecánica ya se ensayó con fixtures sintéticos no vacíos (véase la tercera entrega); falta el ensayo del corte completo con una copia autorizada y resolver los campos/casos todavía bloqueados.
4. Transición de escrituras, detalles, fichas y consumidores de Barómetro/gestión; paginación SQL donde todavía hay arrays completos y contratos de salida explícitos restantes.
5. Solo tras demostrar compatibilidad, integridad y reversión: retirar modelos, servicios/endpoints y tablas antiguos. No ejecutar `DROP TABLE` por encontrar tablas vacías en una copia.

No se declara cerrada la fase 2 por aprobar la primera entrega del catálogo.

## Cliente de biblioteca: segunda entrega compatible

El backend se integró primero mediante el [PR #17](https://github.com/Criiscvz/Observatorio-Territorial/pull/17), commit `863a61092e8b347ba645f7c67a6f818880f55643`. La rama `subsanacion-biblioteca-fase2` migra la biblioteca pública al endpoint anterior sin modificar sus estilos o acciones de consulta.

`PublicCatalogService` solicita únicamente la página seleccionada; las pestañas usan `counts` y la numeración usa `meta.total`, no el tamaño del array recibido. Búsqueda, cambio de tipo y navegación solicitan resultados al servidor. El cliente cancela solicitudes anteriores y elimina los resultados previos al cambiar de ruta o búsqueda. Si el total disminuye y deja fuera la página actual, solicita la última página válida. Los fallos de carga pueden reintentarse conservando el observatorio visible.

El adaptador del visor admite el título, descripción y autores del contrato común y conserva los contratos antiguos usados por otras vistas. `resource_key` distingue registros con el mismo UUID procedentes de tablas distintas; las descargas utilizan su URL explícita, no esa clave de presentación.

Verificación del cliente: **497 pruebas aprobadas en 54 archivos**, incluidas solicitudes de páginas de 20, búsqueda remota, totales de pestañas, cancelación de solicitudes obsoletas, cambio de totales, reintento y apertura de PDF/Power BI con sus metadatos. El ensayo queda disponible en `http://localhost:4300`, con API separada `http://localhost:8101`; no usa la base publicada. CI vuelve a verificar el build de producción y las cabeceras/PWA antes de integrar.

## Tercera entrega: mecánica de conversión y recuperación

El [ensayo reversible de publicaciones antiguas](ENSAYO_MIGRACION_PUBLICACIONES_FASE2.md) documenta el ejecutor CLI desactivado por defecto, las decisiones trazables, la repetición sin duplicados, el bloqueo de conflictos y la recuperación desde respaldos en una base vacía. Se verificó con fuentes y archivos sintéticos separados de la aplicación local y de producción. No introduce migraciones automáticas ni habilita una conversión real; quedan pendientes la identidad de lectura al cortar fuentes, los campos sin equivalente y la transición de consumidores/escrituras.
