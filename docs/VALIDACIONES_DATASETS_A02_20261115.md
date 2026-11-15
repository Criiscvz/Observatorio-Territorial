# A-02, primer bloque: validaciones de las API de datasets conservadas

15 de noviembre de 2026, America/Guayaquil. Rama
`subsanacion-validaciones-datasets-20261115`, desde `1a116f6` de `pruebas-rediseno`.
Continúa los [contratos de NC-09](CONTRATOS_DATASETS_NC09_20261113.md).

## Alcance y resultado

Crear y actualizar fuentes y gráficos guardados utilizan ahora dos FormRequest
con una base común para el contrato de error. La autorización de observatorio
se ejecuta antes de las validaciones que consultan variables. Los controladores
guardan exclusivamente `validated()` y mantienen sus Resources de salida.

Las categorías de datasets solo tienen consultas: no se inventa un formulario
de escritura. Su código de ruta se limita a 255 caracteres y excluye el byte
nulo. Las ocho rutas de fuentes/gráficos restringen sus identificadores a UUID
antes de consultar PostgreSQL; un identificador mal formado responde 404.

No se restaura la interfaz gráfica retirada ni se cambian bibliotecas editoriales,
roles, permisos del Supervisor, paginación de veinte publicaciones, dependencias,
variables de alojamiento, migraciones o datos existentes.

## Contratos de entrada

| Campo | Regla en escrituras nuevas o cambios del campo |
|---|---|
| Fuente: título / URL | Obligatorios al crear; si aparecen al editar no pueden estar vacíos/nulos. Máximo 255 caracteres, acorde a varchar(255). |
| URL de fuente | Solo HTTP/HTTPS. Se conserva la normalización a HTTPS sin protocolo; también se admiten puerto explícito y URL relativa al protocolo. El límite incluye el protocolo añadido. No se consulta ni descarga la URL. |
| Fuente: descripción | Nula o texto de hasta 500 caracteres. |
| Gráfico: título / tipo de gráfico | Hasta 255 / 50 caracteres; obligatorios al crear y no nulos si se cambian. El tipo conserva el contrato extensible heredado, sin habilitar un motor gráfico. |
| Gráfico: descripción / análisis | Nulos o textos de hasta 1.000 / 5.000 caracteres. |
| Orden | Si se proporciona, entero entre 0 y 2.147.483.647, no nulo. Si se omite al crear, se conserva el valor por defecto de la base; al editar no se modifica. |
| Activo | Booleano no nulo si se proporciona. Al crear sigue siendo una decisión del servidor (`true`); al actualizar se puede cambiar con autorización. |
| Variables | UUID existentes en el mismo dataset autorizado. El estado efectivo bivariable requiere Y; al cambiar a univariable se puede quitar Y enviando null. Omitir Y al editar conserva la anterior. |
| Filtros | Null o lista de hasta veinte objetos, con claves `column, operator, value, type`. La columna debe existir en el dataset. Operador y tipo tienen listas permitidas; `value` debe estar presente. |
| Valor de filtro | Escalar de hasta 512 caracteres; `in/not_in` requieren lista no vacía de hasta cien escalares no nulos; `between` requiere dos; `contains/not_contains` texto no vacío; comparaciones ordenadas no aceptan booleano, vacío o null. |
| Configuración | Null o mapa JSON con claves extensibles para compatibilidad. No se acepta una lista superior no vacía como configuración. No equivale a validar la semántica de cada opción de un motor gráfico. |

Los textos no aceptan byte nulo, que PostgreSQL no puede persistir. Filtros y
configuración tienen además límites de datos JSON: 32 KiB codificados, cinco
niveles de profundidad, 500 nodos, cien entradas por contenedor, claves de hasta
128 caracteres y textos de hasta 2.048. Se rechazan valores no representables
como JSON y caracteres nulos en claves/valores. La lista de filtros excesiva se
rechaza antes de expandir las reglas wildcard y sus consultas de existencia.

Los campos del servidor (`dataset_id`, `creado_por`, ID y columnas no declaradas)
no se toman del payload. Un dato inválido conserva el contrato 422:
`{message: "Datos de validación inválidos", errors: {...}}`, sin escribir.
Autenticación/cuenta inactiva conserva 401, rol/alcance denegado 403 y recursos
inexistentes 404. No se cambia el formato global de errores de Laravel.

Las restricciones nuevas se aplican a la entrada; no recortan ni eliminan
automáticamente datos antiguos. Una edición parcial conserva los campos omitidos.
Un registro histórico bivariable sin Y debe corregirse al editarlo.

## Evidencia y revisión

`DatasetInputValidationTest` añade 57 casos mediante las migraciones reales.
Comprueba límites exactos y excedidos, textos multibyte, bytes nulos, JSON
mal formado en estructura/tamaño, UUID, normalización URL, defaults, actualizaciones
parciales, propiedad del dataset/creador, pertenencia de columnas/variables,
autenticación, cuenta inactiva, roles, revocación y ausencia de escrituras ante error.
La suite corre en SQLite y en el PostgreSQL 16 desechable obligatorio de CI.
La regla JSON también se incluye expresamente en PHPStan.

Backend completo local: 458 casos, 5.265 aserciones, ocho omisiones previstas
para PostgreSQL; análisis estático aprobado en su alcance declarado. Los contratos
de salida y las regresiones de autorización anteriores se conservan.
PostgreSQL 16 local: 73 casos de entrada/salida, 769 aserciones, aprobados;
29 controles de higiene y workflow aprobados. Bases sintéticas sin puertos
publicados, sin `.env` real y con retirada de los recursos temporales.
La evidencia privada de PostgreSQL, CI e integración se registra separadamente
en `storage/codex-local/a02-20261115/` y `output/`, sin publicar datos ni credenciales.

Antes de integrar se revisa el diff y la CI del mismo commit; después se verifican
los despliegues efectivos y recursos públicos con lecturas, sin fixtures en producción.
`main` debe conservar el mismo árbol que `pruebas-rediseno`, incluidos los archivos
de preparación para el alojamiento institucional. `deploy-gratis` no se modifica.

## Lo que sigue pendiente en A-02

La exigencia de 100% FormRequest **no está satisfecha en toda la aplicación**.
El inventario de llamadas inline (`->validate(` y `Validator::make(`) al cierre
de este bloque identifica estos trece controladores; el inventario es un punto
de partida estático, no un porcentaje de cobertura de endpoints:

- `AdminWorkspaceController`, `AtlasCategoriaController`, `AtlasEnlaceController`.
- `ObservatorioPublicacionController`, `PublicPublicationCatalogController`, `PublicController`.
- `ObservatoryAccessController`, `UserController`, `ProfileController`.
- `DatasetController`, `DashboardController`, `ArticuloController`, `ReporteController`.

El siguiente bloque debe extraer primero los filtros/acciones editoriales y de
Atlas usados por las vistas actuales, con regresiones de permisos y de errores.
Después se completa la revisión de cuenta/usuarios y de adaptadores conservados.
La lectura de rutas sin payload no exige crear validaciones ficticias; revisar
también servicios/reglas y no asumir que mover código a una clase cierra el requisito.
NC-09 conserva su evidencia; el seguimiento global sigue en ocho NC con evidencia
y siete parciales. A-02 y la aceptación institucional permanecen pendientes.
