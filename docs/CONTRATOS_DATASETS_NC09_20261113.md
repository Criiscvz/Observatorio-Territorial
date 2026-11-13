# NC-09: contratos de categorías, fuentes y gráficos guardados

13 de noviembre de 2026, America/Guayaquil. Rama `subsanacion-contratos-datasets-20261113`,
desde `a932e57` de `pruebas-rediseno`, tras integrar el expediente mediante PR #50.

## Resultado y alcance

Los tres controladores citados literalmente por el informe —`CategoriaDatasetController`,
`DatasetFuenteController` y `GraficoPredeterminadoController`— devuelven contratos
explícitos mediante JsonResource. Sus modelos, columnas futuras y relaciones cargadas
no se serializan directamente. Se incluyen también los resúmenes de datasets,
observatorios y variables anidados en esas respuestas.

Este bloque aporta la implementación técnica de NC-09. No acredita recepción
institucional ni conversión de todos los endpoints heredados. La matriz del 12 de
noviembre conserva su corte histórico: NC-12 sigue parcial por la política de vigencia;
NC-03/04/05/07/12/13/15 conservan sus pendientes. Con la evidencia de esta entrega,
el seguimiento técnico pasa a ocho NC con evidencia en alcance examinado y siete
parciales, sujeto a la revisión/integración indicada en el PR.

## Contratos de salida

| Recurso | Campos permitidos |
|---|---|
| Categoría | `id, nombre, codigo, descripcion, icono, color, orden, activo`. |
| Fuente | `id, dataset_id, titulo, url, descripcion, orden`. |
| Gráfico guardado | `id, dataset_id, titulo, descripcion, analisis, tipo_grafico, tipo_analisis, variable_x_id, variable_y_id, filtros, configuracion, orden, activo, variable_x, variable_y`. |
| Variable resumida | `id, nombre_columna, nombre_original, tipo_dato`; relación Y nula si no corresponde. |
| Dataset de categoría pública | `id, departamento_id, categoria_id, nombre, descripcion, enlace_fuente, estado, total_registros, fecha_carga, created_at, departamento, variables_metadatos`. |
| Observatorio anidado | `id, nombre, icono`. |

La fecha `created_at` del resumen de dataset es un dato de presentación que ya usa
la tarjeta pública; se conserva explícitamente. Se omiten el nombre/ruta del Excel,
la identidad de quien lo subió, las opciones internas, metadatos de detección,
timestamps de auditoría de categoría/fuente/gráfico y la identidad del creador del gráfico.
`filtros` y `configuracion` se conservan como contenido JSON del gráfico; no son una
serialización de relaciones Eloquent ni una certificación de todo su esquema de entrada.

Los listados siguen siendo arrays JSON, las mutaciones siguen devolviendo un objeto
y las respuestas de categorías/datasets mantienen `{categoria, datasets}`. No se
deshabilita el wrapping global de Laravel ni se cambian contratos de publicaciones.
El cliente `CategoriaService` extrae `datasets` del sobre para entregar a Barómetro
la lista que su vista espera. Sus tipos reflejan el resumen y los campos nulos.

La consulta anidada ya no selecciona `departamentos.color`: esa columna no existe
en las migraciones de observatorios. El color de la categoría sigue en su contrato.
Se conserva la forma del listado de datasets; este cambio no incorpora paginación
a ese endpoint histórico ni altera las veinte publicaciones por página de bibliotecas.

## Lectura y escritura

Los listados de fuentes y gráficos comprobaban antes solo el ID del dataset. Ahora:

- Un visitante puede leer recursos de datasets completados de un observatorio
  público, siempre que dataset y observatorio sigan vigentes.
- Administrador global y Editor con asignación actual conservan lectura de sus
  datasets privados o incompletos. Una asignación revocada deja de conceder acceso
  en las siguientes peticiones.
- La regla reutiliza el alcance de gestión heredado de esos módulos. No concede
  al Supervisor permisos adicionales sobre datasets/analítica.
- Un recurso privado, inexistente o con padre eliminado responde 404 al lector
  sin acceso. El middleware global conserva 401 para una cuenta desactivada.
- Las categorías públicas incluyen solo variables visibles. Los gráficos públicos
  se omiten si una variable X/Y es oculta, falta o pertenece a otro dataset; el
  gestor autorizado sí puede consultar variables ocultas del mismo dataset.

Los permisos de escritura se conservan y se siguen comprobando en backend.
`dataset_id` y `creado_por` no pasan a depender del payload del cliente.
Para las fuentes se conserva la normalización a HTTPS cuando falta protocolo,
se restringe la URL a HTTP/HTTPS y se evita pasar arrays/números a `preg_match`:
las entradas inválidas reciben 422 con el contrato de errores existente.

La extracción general de validaciones a FormRequest y la revisión completa de
límites/esquemas de entrada siguen pendientes en A-02; este bloque no las declara
terminadas. Tampoco retira tablas/modelos o servicios de compatibilidad de NC-04/A-07.

## Verificación

La nueva suite `DatasetResourceContractTest` contiene 16 casos. Comprueba:

- Campos exactos, tipos y respuestas vacías; contratos de lectura y creación/edición.
- Columnas internas de prueba añadidas a seis tablas, atributos futuros y relaciones
  cargadas con datos de usuario que no deben aparecer en JSON.
- Categorías inactivas, observatorios privados/eliminados, datasets incompletos,
  borrados e inexistentes, roles sin alcance y revocación de asignación.
- Variables ocultas/cruzadas, relaciones nulas, estado activo, filtros/configuración.
- Autoridad del servidor sobre dataset/creador y validación URL sin escrituras.

Resultados locales sobre el código de esta entrega:

| Comprobación | Resultado |
|---|---|
| Backend completo, PHP 8.4.27/SQLite | 401 casos, 4.655 aserciones; ocho omisiones previstas para PostgreSQL. |
| Contratos nuevos en PostgreSQL 16 | 16 casos, 159 aserciones; red/base temporal sin puertos de base publicados. |
| PHPStan | Aprobado en el alcance existente declarado; no equivale al análisis estático de todos los controladores/Resources. |
| Angular | 530 pruebas en 59 archivos y lint aprobados. |
| Reglas de calidad del frontend | Siete casos aprobados. |
| Higiene y workflow | 29 controles aprobados; la suite de contratos es obligatoria también en PostgreSQL de CI. |
| Navegador | 16 E2E de escritorio/móvil; cero fallos, omisiones y reintentos. |
| Ensayo E2E | PostgreSQL/MongoDB reales, ocho comprobaciones Mongo y telemetría/redacción; proveedores externos controlados donde se indica. |

Las pruebas usan bases/cuentas/archivos sintéticos y no cargan el `.env` real.
Los subconjuntos se solapan y no se suman como cobertura. Contenedores, red y
volúmenes temporales se retiran con comprobación de propósito; la evidencia queda
en `storage/codex-local/nc09-20261113/` y `storage/codex-local/e2e/`, fuera de Git.

## Integración y continuidad

Antes de integrar: revisión del diff y todos los controles del PR sobre el mismo
head. Después: comprobar frontend/backend efectivos, salud y contratos públicos
mediante lecturas, sin fixtures productivos. No hay migraciones, conversiones,
cambios de dependencias ni escrituras masivas en esta entrega.

No se debe revertir ciegamente la protección de lectura privada para recuperar
campos de una respuesta antigua. Ante una incompatibilidad, corregir el contrato
o restringir temporalmente la lectura afectada con un cambio revisado, conservando
la autorización y sin restaurar datos automáticamente.

Siguiente bloque técnico: A-02, extracción y revisión de validaciones de entrada,
con contratos de error, límites acordes al esquema y regresiones de permisos.
