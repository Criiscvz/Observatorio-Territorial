# A-02, cuarto bloque: API antiguas de datos, análisis y publicaciones

15 de noviembre de 2026, America/Guayaquil. Rama
`subsanacion-validaciones-legadas-20261115`, desde `ce3690e` de `pruebas-rediseno`.
Continúa el bloque de [cuentas y accesos](VALIDACIONES_CUENTAS_A02_20261115.md).

## Resultado y alcance

DatasetController, DashboardController, ArticuloController y ReporteController
dejan de validar payloads inline. Se extrae también la validación de catálogo y
escritura de LegacyCatalogResponse/LegacyPublicationBridge. La paginación pública
de datos deja de convertir entrada libre a enteros. No se retiran API ni datos,
no se reinstalan las pantallas gráficas retiradas y no se modifica el Barómetro.

La publicación antigua puede seguir siendo un registro original o apuntar a una
publicación convertida. Su FormRequest se resuelve **después** de conocer y
autorizar la rama real, dentro de la transacción que bloquea el origen. El puerto
LegacyPublicationInput permite invocar ese validador de presentación sin añadir
dependencias de Presentation a Application. La composición se registra en
AppServiceProvider. Se preservan resolución de identidades, bloqueo, políticas,
decisiones de revisión, contadores, mapas y respuestas de compatibilidad.

## Contratos comprobados

| Entrada | Regla |
| --- | --- |
| Directorio de datasets | departamento UUID opcional; page de 1 a 1.000.000; tamaño existente fijo de quince, ahora explícito si se envía per_page |
| Filas públicas/protegidas | page de 1 a 1.000.000, per_page de 1 a 100, valores predeterminados 1/50 |
| Edición de dataset | nombre 255, descripción 2000, fuente HTTP/HTTPS 255; UTF-8 válido y sin NUL |
| Variables por lote | lista de 1 a 200 UUID; tipo permitido y booleano válido; sin expansión de comodines para lote no válido |
| Palabras excluidas | lista de 1 a 1000 textos de hasta 100 caracteres; UTF-8 sin NUL; conserva limpieza, deduplicación y opciones del dataset |
| Análisis conservado | dataset/variables UUID, variable requerida por cada DTO, limit de 1 a 100 cuando se envía, chart_type acotado con el contrato previo de cada ruta |
| Filtros de análisis | hasta 50 filas y 32 KiB; columnas imprimibles de hasta 500 caracteres; operadores conocidos y valores simples sin NUL, UTF-8 válido, listas de hasta 100 operandos de hasta 2048 caracteres; between exige dos valores |
| Catálogo antiguo | UUID opcionales de observatorio/categoría; conserva su respuesta como lista |
| Publicación de compatibilidad | campos, fechas de años 0001–9999, enlaces HTTP/HTTPS, motivo y estados admitidos; PDF de reporte hasta 20 MiB y nombre original hasta 255 caracteres |
| Artículo original | título/autor/fuente 255, descripción 3000, estado textual 255, enlace HTTP/HTTPS 2048, fechas y UUID válidos |
| Reporte original | indicador/fuente 255, descripción 3000, enlace HTTP/HTTPS 255; conserva normalización de dirección sin protocolo; ficha PDF/Word/Excel hasta 10 MiB con extensión correspondiente |
| IDs de rutas | UUID de dataset/variable antes de SQL; fichas con nombre ASCII seguro de hasta 255 caracteres |

Los límites de fuente del dataset y URL del reporte original se ajustan a los
varchar(255) reales. Una entrada superior antes podía superar la validación y
fallar al persistir en PostgreSQL. Descripciones/enlaces/estado originales
previamente abiertos reciben límites explícitos. La paginación pública ya no
recorta silenciosamente per_page superior a 100: devuelve 422.

La conversión de booleanos y de límites numéricos se hace sobre datos validados
antes de pasarlos a parámetros tipados; 0/1 y cadenas numéricas válidas conservan
su uso. No se cambian los algoritmos ni sus decisiones previas de muestreo
(incluido el scatter privado de hasta 1000 puntos). Esta entrega no certifica
exactitud estadística ni ejecuta proveedores reales de análisis en pruebas.

La reasignación de un reporte original autoriza el observatorio de destino
**antes** de reemplazar su ficha. Un rechazo no elimina el archivo anterior.
Se conservan error 422 del formulario original, formatos permitidos y ámbitos
de acceso. El formulario de compatibilidad continúa creando solo una publicación
actual y su mapa; no duplica filas antiguas ni convierte originales por leerlos.

## Verificación

LegacyInputValidationTest añade 57 casos HTTP: entradas malformadas, límites,
paginación, permisos vigentes/revocados, metadatos, números/booleanos de transporte,
archivos, tipos de publicación y filtros válidos/invalidos. Comprueba datos,
contadores, mapas y archivos sin cambios ante errores. Se ejecutan además las
suites existentes de puentes, preservación, catálogo, contratos y autorización.

- Backend completo local: 627 casos, 7319 aserciones; ocho omisiones previstas PG.
- PostgreSQL 16 local: 164 casos, 1871 aserciones, aprobados.
- PHPStan aprobado en el alcance previo más StatisticsFilters y FormRequestResolver.
- Pruebas de dirección de dependencias aprobadas; Application no importa Presentation.
- 29 controles de higiene/workflow aprobados; los casos nuevos son obligatorios en
  el PostgreSQL desechable de CI.

Las bases, cuentas y archivos de prueba son sintéticos. El repositorio de filas y
el servicio de estadísticas se controlan en estos HTTP tests; no se llama a MongoDB,
Graph ni correo reales para probar entradas malformadas. La lectura publicada se
verifica por separado, sin escrituras de negocio ni fixtures en producción.
No hay migraciones, cambios de dependencias ni cambios visuales.

## Inventario y continuidad

Ya no hay llamadas Request::validate/Validator::make de payload HTTP en los
controladores API ni en los dos adaptadores revisados. La validación restante de
LegacyPublicationRehearsal corresponde al manifiesto de un ensayo CLI, no a
un formulario HTTP, y se conserva.

Ese resultado de búsqueda **no demuestra 100% FormRequest**. A-02 continúa
parcial hasta contrastar cada ruta, los FormRequest preexistentes y las lecturas
previas a ellos: por ejemplo, code/state del protocolo OAuth, correo de
limitadores y context del visor. Es el siguiente bloque de inventario/cierre;
no se cambian esos protocolos en esta entrega.

El balance mantiene ocho NC con evidencia técnica y siete parciales, sin
aceptación de DIIT. La matriz del 12 de noviembre conserva su corte histórico.
Integrar solo después de revisar el diff y aprobar CI del mismo head, verificar
el despliegue y sincronizar main conservando deploy/portable y deploy-gratis.
Evidencia de integración/lecturas: output/ y storage/codex-local/a02-legadas-20261115/,
fuera de Git.
