# A-02, segundo bloque: publicaciones, Atlas y entrada de SharePoint

15 de noviembre de 2026, America/Guayaquil. Rama
`subsanacion-validaciones-editoriales-20261115`, desde `5229bba` de `pruebas-rediseno`.
Continúa el [bloque de datasets](VALIDACIONES_DATASETS_A02_20261115.md).

## Resultado y alcance

Los filtros y acciones editoriales que tenían validación inline en
`AdminWorkspaceController`, `AtlasCategoriaController`, `AtlasEnlaceController`,
`ObservatorioPublicacionController`, `PublicPublicationCatalogController` y
las consultas de Atlas de `PublicController` usan ahora FormRequest y `validated()`.
Los endpoints sin payload no reciben reglas ficticias. Las otras API de análisis
conservadas en PublicController no se declaran revisadas en este bloque.

Se conservan las consultas de visibilidad, las capacidades de publicación/revisión,
los Resources, contadores, bloqueo de categorías y transacciones. Las bibliotecas
siguen paginando veinte publicaciones. La interfaz no cambia y no reaparecen
pantallas gráficas retiradas. El Atlas creado por el formulario de enlaces sigue
siendo un enlace, sin PDF ni selección única para el portal. Los endpoints de
compatibilidad de importación PDF siguen restringidos a Administración.

## Reglas comprobadas

- Filtros: tipos/estados permitidos, UUID, búsqueda de hasta 200 caracteres
  (255 en el workspace), texto UTF-8 válido y ausencia de caracteres nulos antes de consultar SQL.
  Páginas de 1 a 1.000.000 y `per_page=20`. Workspace conserva página nula como
  primera página y ahora rechaza explícitamente otros tamaños en vez de ignorarlos.
- UUID de rutas de publicación, observatorio y categoría: un valor mal formado
  responde 404 antes de intentar convertirlo a UUID en PostgreSQL. Un UUID válido
  inexistente continúa sujeto al binding y a las reglas de cada endpoint.
- Categoría: nombre normalizado de hasta 150 caracteres; también se comprueba
  el límite de su clave en minúsculas, que puede crecer al normalizar Unicode.
  La unicidad incluye categorías borradas y excluye la propia al editar. Se
  conserva la restricción de base y la traducción del conflicto de concurrencia.
  Visibilidad/icono omitidos no se reinician. Textos sin byte nulo.
- Enlace Atlas: título 255, fuente 255, descripción 3.000, URL HTTP/HTTPS 2.048;
  fecha Y-m-d entre 0001-01-01 y 9999-12-31, categoría vigente al reasignar y PDF
  prohibido. Dataset/observatorio, creador, estado y archivo no se toman de campos
  adicionales del cliente. Se vuelve a comprobar la categoría dentro de la transacción.
- Formularios nativos de artículo/libro/reporte: texto UTF-8 válido sin byte nulo; autores
  opcionales, hasta cien y 255 caracteres por autor. Se conserva texto único,
  limpieza de espacios y omisión de autores vacíos. Los tipos inválidos ya no
  se descartan silenciosamente: producen 422. Se mantiene la validación PDF de
  contenido/tamaño y se añade nombre original de hasta 255 caracteres, acorde a
  su columna. Las fechas conservan su validación `date`, con rango persistible.
- Navegación e importación de SharePoint: IDs de hasta 1.024 caracteres, sin
  controles ni separadores de ruta/query/fragmento. Lotes como lista no vacía,
  hasta cincuenta IDs distintos. Una lista sobredimensionada se rechaza antes
  de expandir reglas por elemento; no se llama al proveedor ante error.
- Los IDs opacos se codifican como un solo segmento en las consultas de ítems,
  contenido y carpetas de Graph. Los porcentajes literales permanecen datos,
  sin convertirse en separadores del endpoint. Se conservan el control de raíz
  autorizada, límites de descarga y el tratamiento de resultados de importación.

Las búsquedas/catálogos conservan la diferencia entre 422 de entrada y 404 de
recurso no visible. En biblioteca pública de Atlas, una categoría privada o
eliminada responde 404. En la administrativa se conserva su contrato de
existencia/borrado y la precedencia de `sin_categoria` sobre la categoría elegida.
No se introduce un nuevo formato global de errores: se conserva el de Laravel.

## Autorización

Las reglas de lectura de observatorio se comparten con el controlador, sin
cambiar su alcance: Supervisor solo en sus asignaciones; Editor en biblioteca
administrativa solo ve sus publicaciones, y una revocación no recupera permisos.
Se conserva que un editor revocado puede obtener una biblioteca pública vacía,
mientras un observatorio privado deja de ser accesible. Las comprobaciones se
repiten en backend; no se toman roles ni capacidades del payload.

Los FormRequest de creación consultan la política de creación antes de validar
metadatos/subir PDF. Categorías/enlaces Atlas, configuración e importación
SharePoint siguen siendo exclusivos de Administración. Los bloqueos de edición
por rechazo, las observaciones de revisión y las revalidaciones de transacción
permanecen en sus políticas y servicios existentes.

## Verificación

`EditorialInputValidationTest` añade 57 casos de HTTP y proveedor controlado,
con las migraciones reales. Verifica límites, Unicode, normalización, nulidad,
UUID, errores sin escritura de filas/archivos/contadores, categorías eliminadas,
autores, límites PDF, estados de revisión, roles y revocación. Las llamadas de
SharePoint inválidas no llegan al proveedor; la prueba de IDs opacos usa el
servicio real con Http::fake y prohíbe llamadas de red no declaradas.

- Backend completo local: 515 casos, 6.152 aserciones; ocho omisiones previstas PG.
- PostgreSQL 16 local: 80 casos editoriales/catálogos/revisión/importación,
  1.506 aserciones, aprobados.
- PHPStan: aprobado en su alcance declarado, incluyendo las tres nuevas reglas;
  no significa análisis estático de todos los controladores o FormRequest.
- Higiene/workflow: 29 controles aprobados; la suite editorial se añade al
  PostgreSQL desechable obligatorio de CI, además de SQLite.

No se usan .env, cuentas, bases o archivos productivos en pruebas de escritura.
No hay migraciones, cambios de dependencias ni alteraciones de datos existentes.
La evidencia de CI, integración y lecturas publicadas se conserva en
`storage/codex-local/a02-editorial-20261115/` y `output/`, fuera de Git.
Integrar solo tras revisar el diff y aprobar la CI del mismo head; después
comprobar el comportamiento publicado y sincronizar main conservando deploy/portable.

## Continuidad y límite de la entrega

A-02 sigue **parcial**: quedan llamadas inline en siete controladores
(`ObservatoryAccessController`, `UserController`, `ProfileController`,
`DatasetController`, `DashboardController`, `ArticuloController`, `ReporteController`).
El inventario de llamadas no detecta por sí solo los casts/lecturas manuales de
parámetros de las API antiguas de datos/estadísticas; también deben revisarse.
Sigue el bloque activo de cuenta, usuarios y gestión de accesos, y después los
adaptadores conservados. No se afirma 100% FormRequest ni aceptación de DIIT.
El balance de NC conserva ocho con evidencia técnica y siete parciales en el
alcance examinado. El expediente del 12 de noviembre mantiene su corte histórico.
