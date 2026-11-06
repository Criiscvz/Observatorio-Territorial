# Ensayo E2E de la fase 5

Las pruebas usan la SPA compilada y la API real de la revisión local, con PostgreSQL, MongoDB y almacenamiento independientes. No usan cuentas, archivos, configuraciones ni servicios de producción. Se ejecutan en Chromium con perfiles de escritorio (1366 × 768, claro) y móvil (390 × 844, oscuro); la emulación no sustituye la validación en dispositivos físicos.

La preferencia `observatorio-theme` se establece en cada contexto nuevo porque la aplicación usa su tema guardado, no la preferencia del sistema. La biblioteca comprueba también el tema aplicado al documento. No se altera el almacenamiento de autenticación.

## Ejecución

Requisitos: Node 24.17.0, npm 11.13.0, Docker Engine local y Compose v2. Desde `frontend`:

```sh
npm ci --no-audit --no-fund
npx --no-install playwright install chromium --only-shell
node node_modules/typescript/bin/tsc -p tsconfig.e2e.json
npm run test:e2e
```

En Linux CI, instalar las bibliotecas del navegador con `playwright install --with-deps chromium --only-shell`. El script construye imágenes propias y requiere acceso a los registros de dependencias durante la construcción. No requiere variables de producción.

El puerto reservado es `127.0.0.1:4500`; PostgreSQL, MongoDB y PHP no publican puertos. El proyecto Compose fijo es `observatorio-e2e-fase5`. No se aceptan motores Docker remotos. Las contraseñas, clave de aplicación y marcador del ensayo se generan en cada ejecución y se guardan exclusivamente en `storage/codex-local/e2e`, ignorado por Git.

Las imágenes E2E tienen nombres propios; no reemplazan las imágenes del ensayo portable de la fase 4. Las bases de datos nuevas usan volúmenes exclusivos. El script rechaza un proyecto previo sin limpiar y comprueba sus etiquetas antes de eliminar únicamente sus contenedores y volúmenes al terminar, incluso si falla una prueba. No ejecuta ninguna limpieza sobre los volúmenes del ensayo portable ni sobre servicios publicados.

## Límites de la simulación

Se mantienen `APP_ENV=production`, middleware de autenticación, cookies y CSRF. Antes del navegador se comprueba que un login sin token CSRF devuelve 419. La carga inicial de datos es un script CLI sin ruta HTTP, que exige una base vacía y el entorno aislado.

El proveedor `backend/tests/E2E/E2EGraphProvider.php` solo se copia a la imagen de pruebas. Las imágenes normales excluyen este directorio E2E; el ensayo portable excluye todo `tests`. Su arranque fuera del entorno aislado se rechaza. Simula la respuesta externa de Microsoft Graph, conservando el servicio SharePoint, el importador y el almacenamiento reales. No comprueba credenciales ni disponibilidad reales de Microsoft.

El navegador simula únicamente el documento externo del iframe Power BI. No se simulan rutas de aplicación, API, PDF ni sesión. Los demás intentos de tráfico externo se bloquean y fallan la prueba. Se verifica la integración del visor, no el contenido ni los filtros de un reporte de Microsoft.

## Recorridos

Cada recorrido se ejecuta en los dos perfiles de pantalla:

| Recorrido | Comprobación |
|---|---|
| Sesión | Campos obligatorios, login, sesión en otra pestaña, cancelar y confirmar cierre, invalidación de sesión. |
| Biblioteca pública | 20 resultados por página, siguiente página y búsqueda. Worker PDF con MIME JavaScript y `nosniff`; lectura real de dos páginas, ficha, pantalla completa y restauración. |
| Artículo | Observatorio asignado, distribución adaptable, campos obligatorios, vista previa antes de subir, envío, rechazo motivado y bloqueo de edición/eliminación por interfaz y API. Conserva lectura del PDF. |
| Libro | Vista previa local, envío a revisión y suspensión con motivo visible en la biblioteca del editor. |
| Reporte | Vista previa del enlace, envío y archivo con motivo visible. No exige PDF. |
| Alcance y suscripción | Supervisor sin acceso a otro observatorio privado; PDF reservado inaccesible para anónimo/usuario y accesible para suscriptor. |
| Atlas y Power BI | Apertura del visor integrado, ficha, ocultación de ficha en pantalla completa y regreso al visor. |
| SharePoint | Selección e importación mediante servicio real y Graph simulado, almacenamiento de copia y lectura con PDF.js. |

No se cubren aquí la recuperación por correo/Google, las asignaciones de roles desde su modal, todos los estados/transiciones, navegadores Firefox/WebKit ni la infraestructura HTTPS institucional pendiente. Las reglas de autorización y revisión tienen suites PHP separadas; esta suite no las sustituye.

## Evidencia y fallos

Los resultados JSON, trazas y capturas de fallos permanecen en `storage/codex-local/e2e`. Son privados y no se publican como artefactos de CI. Las trazas pueden contener la contraseña sintética y los cuerpos de las solicitudes del ensayo. No contienen cuentas reales.

Las pruebas se ejecutan sin reintentos y con un trabajador, usando títulos distintos por perfil. Los errores se deben corregir; no se ocultan con esperas fijas ni reintentos de escritura. Para inspeccionar un fallo, revisar `playwright-results.json`, las capturas y `operation-*.log` en ese directorio. Si el proceso se interrumpe antes de la limpieza, revisar expresamente el proyecto y sus etiquetas antes de retirarlo; el siguiente ensayo no borra residuos automáticamente.

El comando termina con código distinto de cero ante errores de preparación, aislamiento, pruebas o limpieza. La suite E2E complementa las pruebas unitarias, de integración PostgreSQL, arquitectura, dependencias y secretos existentes.

## Verificación local del 5 de noviembre de 2026

| Control | Resultado |
|---|---|
| Recorridos Chromium | 16 aprobados: 8 por perfil; cero fallos, omisiones y reintentos. |
| Temas y presentación | Escritorio claro y móvil oscuro comprobados; capturas de la biblioteca revisadas visualmente. |
| Angular | 529 pruebas aprobadas en 58 archivos. |
| TypeScript E2E y lint de aplicación | Sin errores. |
| Cabeceras/PWA | 20 comprobaciones aprobadas, incluidas las de artefactos generados. |
| Seguridad, higiene, runtime y política de auditoría | 41 pruebas aprobadas. |
| Contextos Docker | 3 contextos sintéticos: 59 exclusiones y 19 inclusiones verificadas. Contexto Render: 33 exclusiones y 11 inclusiones. |
| Auditoría npm | Sin nuevos avisos; permanece el aviso moderado de ECharts ya documentado en `DEPENDENCIAS_FASE5.md`. |
| Secretos | Snapshot y rango del commit comprobados con Gitleaks, sin hallazgos. |

Las pruebas encontraron un fallo del servidor portable: `.mjs` se servía como `application/octet-stream`, lo que impedía cargar el worker de PDF.js con `nosniff`. Se corrigió el MIME de esos módulos a JavaScript, conservando CSP y `nosniff`. El navegador comprobó después la lectura de PDFs guardados y de las vistas previas locales.

El último ensayo retiró sus contenedores, redes y volúmenes. La revisión queda en una rama local, sin ejecución del workflow remoto, push, fusión ni despliegue. No se repitieron las suites PHP completas en este bloque: no cambia su código de aplicación; la API compilada sí se ejecutó con PostgreSQL/MongoDB reales durante los recorridos.

En esta computadora, el arnés del navegador se ejecutó con Node 22.19.0/npm 10.9.3; las imágenes SPA se construyeron con Node 24.17.0/npm 11.13.0 y la API con PHP 8.4. El workflow mantiene Node 24.17.0. La ejecución de ese workflow en Linux remoto queda pendiente de la integración por PR.
