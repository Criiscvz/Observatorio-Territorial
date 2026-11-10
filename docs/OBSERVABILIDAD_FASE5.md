# Observabilidad de aplicación

Revisión local del 8 de noviembre de 2026. No modifica servicios publicados ni incorpora un proveedor externo de monitoreo.

## Señales implementadas

La API usa instrumentación manual con `open-telemetry/sdk`, bloqueado en Composer. Un middleware global genera `X-Request-ID` y una traza nueva por petición. No acepta identificadores, `traceparent` ni baggage del cliente; no propaga metadatos a Microsoft. Los IDs sirven para diagnóstico, no para autorizar operaciones.

Se crean spans de servidor y dependencias: consultas SQL terminadas, comandos MongoDB seleccionados y llamadas HTTP de Laravel a Microsoft Graph/identidad. Incluyen duración, operación, sistema, estado y relación padre/hijo. No incluyen sentencias/bindings SQL, comandos MongoDB, nombres de bases/tablas/documentos, hosts, URLs, cabeceras, tokens ni contenidos de petición/respuesta. No se instrumenta automáticamente cada biblioteca: S3/Guzzle directo, trabajos asíncronos, navegador y otros destinos quedan fuera de esta entrega.

Los spans muestreados se retienen en memoria solo durante la petición y se exporta una proyección JSON positiva al log existente. **No es un endpoint OTLP, un Collector ni una instalación de Jaeger/Grafana.** El SDK se configura explícitamente, sin autodetección de recursos del host ni exportación de red. La elección de almacenamiento/buscador institucional y, si procede, exportador OTLP queda para DIIT.

La instrumentación no necesita auto-instrumentación por extensión ni ejecución del plugin Composer `tbachert/spi`; este queda deshabilitado explícitamente. Las imágenes instalan las dependencias sin plugins.

## Eventos y campos

| Evento | Información |
|---|---|
| `HTTP_REQUEST_COMPLETED` | Método normalizado, plantilla de ruta, estado, duración, consultas/tiempo SQL+MongoDB, llamadas/tiempo Microsoft, spans descartados, muestreo, lentitud e IDs. |
| `OTEL_SPAN` | Componente servidor/base/cliente, operación y sistema/destino predefinidos, duración, estado de span e IDs de traza, span y padre. |
| `APPLICATION_EXCEPTION` | Clase de excepción e IDs; sin mensaje, causas, stack, consulta o bindings. |
| Códigos de autenticación, importación y almacenamiento | Tipo/clase/estado/código de proveedor limitado. Sin usuario, correo, nombre de archivo o ID de SharePoint. |
| `APPLICATION_LOG` | Sustituye mensajes no registrados; descarta contexto libre y extras. |

El filtro se aplica a los canales Monolog configurados antes de formatear JSON. Una lista de palabras prohibidas no basta: solo se admiten claves y valores de tipo/rango conocidos. Se eliminó el log que copiaba los datos validados del formulario de datasets. Los errores no pasan por el reporte crudo de excepciones de Laravel.

Las rutas provienen del objeto Route resuelto, por ejemplo `api/departamentos/{departamento}/publicaciones`, nunca del path ni la query recibidos. Una ruta desconocida usa `UNMATCHED`. La traza se cierra y el contexto se limpia al terminar; peticiones sucesivas reciben IDs distintos. El alcance probado es PHP-FPM: no se certifica Octane ni ejecución concurrente de peticiones en un mismo contenedor de aplicación.

## Configuración

| Variable | Propósito y valor inicial |
|---|---|
| `OBSERVABILITY_ENABLED` | `true`: instrumentar HTTP; `false`: no crear spans/resumen/header. La redacción de logs permanece activa. |
| `OBSERVABILITY_SAMPLE_RATE` | Fracción de trazas: `0.1`; limitada a 0–1. `0` conserva el resumen por petición sin spans. |
| `OBSERVABILITY_SLOW_REQUEST_MS` | Umbral de lentitud: 1500 ms, mínimo efectivo 1 ms. |
| `OBSERVABILITY_RELEASE` | Hash de commit de 7–40 caracteres hexadecimales; otro valor se omite. No introducir secretos o nombres personales. |
| `LOG_CHANNEL` | `stderr` para contenedores. |
| `LOG_LEVEL` | `info` para resúmenes y spans; `warning`/`error` los filtran. El muestreo no controla los resúmenes. |
| `LOG_STACK` | Si se utiliza `stack`, el valor inicial es `daily`. |
| `LOG_DAILY_DAYS` | Canal `daily`: 14 días por defecto, restringido a 1–30. No aplica a stderr. |

Hay un máximo de 32 spans de dependencias más el de servidor por petición. Se siguen contando operaciones aunque se descarte un span. Los fallos de conexión Microsoft se registran sin estado HTTP y con estado de span `Error`. SQL registra consultas finalizadas; una excepción anterior a `QueryExecuted` queda en el error/resumen de la petición, no necesariamente en un span SQL independiente.

La duración de servidor mide trabajo de aplicación hasta producir la respuesta; no equivale al tiempo completo de transferencia de un PDF. No se promete una traza de error por cada fallo cuando el muestreo es menor que 1: los resúmenes y errores redactados no se muestrean.

## Operación

1. Mantener `APP_DEBUG=false`, `LOG_CHANNEL=stderr`, `LOG_LEVEL=info` en el runtime de contenedores. Las variables del servicio existente no se cambian automáticamente al publicar código.
2. Para un incidente, obtener `X-Request-ID` en las cabeceras de la respuesta. Buscar ese UUID en los logs privados de API; `trace_id` relaciona los spans. No pedir al usuario cookies, contraseña, PDF privado ni un enlace firmado.
3. Medir tasa de errores y p95 con los eventos `HTTP_REQUEST_COMPLETED` de una misma ventana y versión. Como punto inicial de ensayo, investigar tres fallos consecutivos de salud, 5xx sostenidos o p95 por encima de 1500 ms durante cinco minutos. Estos son criterios operativos iniciales, no SLA ni alertas activadas.
4. Revisar `db_duration_ms`, `http_duration_ms`, `slow` y `dropped_spans`; aumentar muestreo temporalmente exige considerar volumen y restaurar el valor normal después.
5. Si no aparecen spans, comprobar `OBSERVABILITY_ENABLED`, muestreo y `LOG_LEVEL`; una respuesta exitosa no demuestra que el sink de logs esté disponible. La telemetría no convierte una escritura exitosa en error si el sink falla.

Comprobación reproducible, sin credenciales:

```powershell
node scripts/check-operational-health.mjs --url http://localhost:4400
```

El proceso devuelve 0 solo si liveness y ambas dependencias están sanas. `/api/health?deep=1` conserva HTTP 200 incluso durante una caída: el verificador revisa también `ok` y `services`. No vuelca respuestas ni detalles de conexión. Admite HTTP solo en loopback o un origen HTTPS, sin credenciales/query/path. No sigue redirecciones y limita el tiempo de cada sondeo. No instala tareas periódicas ni alerta a terceros.

## Retención y límites de privacidad

El Compose portable limita cada contenedor a tres archivos JSON de Docker de 10 MiB. Esto es rotación por tamaño, no por días. El canal de aplicación `daily` tiene su límite separado. En Render o en el host institucional, la retención de stdout depende del operador/proveedor y debe configurarse allí; el Dockerfile no controla esa política.

La rotación de `daily` se ejecuta al escribir y limita archivos diarios; no es una tarea que borre por antigüedad durante períodos sin tráfico. Una política institucional de expiración estricta requiere su propio mantenimiento del almacenamiento.

Se reemplazan los access logs crudos del Nginx del backend por estado/duración, y se desactivan los access logs PHP-FPM que duplicaban URLs. Los diagnósticos nativos de arranque, PHP/Nginx, base de datos o del proveedor de hosting **no pasan por el filtro de Laravel**. Restringir su acceso y aplicar la política institucional antes de reenviarlos. No declarar saneados los logs históricos ni exportar dumps/trazas de pruebas como material público.

## Validación

`ObservabilityTest` prueba redacción real de Monolog, errores, clientes Microsoft, muestreo cero, límite de spans, aislamiento de contexto, 404 sin ruta, sink caído y desactivación. PHPStan incluye el código nuevo. La suite E2E fuerza muestreo 1 y nivel info solo en su entorno sintético: comprueba spans reales de PostgreSQL y MongoDB, Graph/identidad simulados, rechazo CSRF 419 y ausencia de contraseña, correo, ID del observatorio y nombre de PDF sintéticos en los logs del runtime. Las pruebas de la herramienta operativa incluyen respuesta 200 con motor caído, JSON inválido, timeout y origen inseguro.

Resultado local: 371 pruebas PHP, 4.336 aserciones y 8 omisiones previstas para PostgreSQL; las 11 pruebas específicas de observabilidad aportan 73 aserciones. Los 16 E2E pasan sin omisiones/reintentos y verifican los registros JSON del runtime, incluyendo el verificador operativo. También pasan PHPStan, 5 pruebas del sondeo, 42 contratos de seguridad/higiene, los contextos Docker y la sintaxis Nginx. Composer audit no detecta avisos. El snapshot y el rango del commit se revisan con Gitleaks.

No se repitió la suite PostgreSQL independiente completa en este bloque; la instrumentación y los recorridos HTTP sí utilizaron PostgreSQL/MongoDB reales dentro del ensayo aislado. Quedan pendientes CI remoto, pruebas con proveedores reales y aceptación institucional. El arnés local usa Node 22.19; el build SPA Docker usa Node 24.17.0 y la API PHP 8.4.27.

Referencias de diseño: [instrumentación manual oficial PHP](https://opentelemetry.io/docs/languages/php/instrumentation/), [SDK PHP](https://opentelemetry.io/docs/languages/php/sdk/), [seguridad de OpenTelemetry](https://opentelemetry.io/docs/security/).
