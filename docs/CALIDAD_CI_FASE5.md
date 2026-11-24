# Fase 5: primer bloque de calidad y CI

Fecha: 30 de octubre de 2026, America/Guayaquil.

La rama `subsanacion-calidad-ci-fase5` continúa desde el ensayo portable local
`97869d8`. Esta entrega incorpora controles de calidad; no modifica la
configuración activa de Vercel/Render ni completa toda la fase 5.

## Frontend

`npm run lint` revisa `src/**/*.ts` y plantillas HTML, incluyendo plantillas
inline de componentes Angular. Usa ESLint 10.14.0, typescript-eslint 8.72.1
y angular-eslint 21.4.0, fijados en el lockfile y compatibles con Angular 21.
No requiere un servicio, credenciales ni conexión a una API.

Se aplican reglas recomendadas de corrección de JavaScript/TypeScript y reglas
de plantillas para bindings mal escritos, igualdad, negación de async y atributos
duplicados. Se conserva la precedencia válida de Angular entre `class` y
`[class]`, y entre estilos estáticos y dinámicos. No se ejecuta un formateo masivo.

Los contratos actuales todavía usan `any` en varios payloads y gráficos, y hay
símbolos antiguos sin uso. Sus dos reglas correspondientes quedan fuera de este
primer control; no se presenta esta entrega como una eliminación de esa deuda.
La compilación mantiene la configuración estricta de TypeScript y plantillas.
Los comentarios inline no pueden desactivar reglas. El comando falla ante
cualquier advertencia o error, sin baseline de resultados aceptados.

La regla `architecture/dependency-direction` resuelve las rutas con TypeScript
y el `tsconfig` real. Comprueba imports, reexports, importaciones dinámicas,
tipos importados y `require` con nombre literal:

- Dominio no depende de implementaciones de datos, servicios concretos,
  configuración de entorno ni vistas. HTTP queda fuera del dominio.
- Entidades no dependen de Angular ni RxJS. Los contratos de repositorios
  existentes pueden usar observables, y los casos de uso conservan la inyección
  actual de Angular; no se afirma que toda esa capa sea independiente del framework.
- Datos no depende de vistas, rutas o componentes.

`npm run test:quality` demuestra que código sintético inválido se rechaza y
que las dependencias permitidas y el binding de clases válido siguen pasando.
No reemplaza las pruebas de comportamiento ni la revisión de dependencias
construidas dinámicamente en ejecución.

## Backend

`composer analyse` ejecuta PHPStan 2.3.4 en nivel 5 sobre `app/Domain` y
`PublicationReviewDecision`; el 12 de noviembre incorpora también el DTO
`PublicationPdf` y su adaptador `PublicationPdfResponse`. Desde el bloque del 8 de noviembre incluye también
`Infrastructure/Observability` y el middleware `ObserveRequest`. No arranca Laravel ni consulta bases. No usa
baseline, exclusiones de archivos ni `ignoreErrors`. El alcance es explícito:
todavía no equivale a analizar todos los controladores, modelos y casos de uso.

`composer test:architecture` ejecuta las cuatro pruebas de arquitectura, que
también forman parte de la suite PHPUnit normal. El parser PHP 5.7.0 ya estaba
en el lockfile y ahora se declara como dependencia directa de desarrollo.
Las comprobaciones recorren dominio y aplicación usando AST, aliases,
imports agrupados y nombres completos; no se basan en buscar texto en comentarios.

- Dominio no puede depender de aplicación, infraestructura, presentación,
  modelos Eloquent, Policies, HTTP, base de datos o Facades.
- Aplicación no puede introducir dependencias de presentación nuevas.
- Se conservan los contratos existentes de Collection y paginación: no se
  certifica aquí una arquitectura completamente independiente de Laravel.

Las dos excepciones previas se eliminan el 12 de noviembre de 2026:

| Archivo | Dependencia retirada | Sustitución |
|---|---|---|
| `Application/Dashboard/UseCases/GetUnivariableStatsUseCase.php` | `Presentation/Http/Requests/Stats/StatsRequest` | `Domain/Statistics/UnivariableChartTypes`, compartido con el formulario HTTP; conserva el contrato de la API retenida. |
| `Application/Publicaciones/LegacyPublicationBridge.php` | `Presentation/Http/Controllers/Api/ObservatorioPublicacionController` | `ReadPublicationPdf` prepara un DTO autorizado; los adaptadores HTTP comparten `PublicationPdfResponse` para transmitirlo. |

El recorrido AST exige ahora cero infracciones en cada archivo de dominio y
aplicación, sin lista de excepciones. Las pruebas negativas también comprueban
que no reaparezcan las dependencias concretas del formulario y del controlador.
Se conservan los límites declarados de Laravel/Eloquent y del alcance de PHPStan.
Ver [cambios y comprobaciones del cierre](CIERRE_EXCEPCIONES_ARQUITECTURA_20261112.md).

## CI e integración

El workflow conserva sus cuatro trabajos y el check estable `Resultado`:

1. Backend instala el lockfile y comprueba los requisitos de PHP; ejecuta
   `composer analyse` antes de PHPUnit. Las pruebas de arquitectura se incluyen
   en la suite SQLite normal.
2. Frontend instala el lockfile; ejecuta lint y sus pruebas negativas antes de
   las pruebas funcionales, compilación y controles de cabeceras/PWA.
3. Secretos, higiene, aislamiento PostgreSQL y contextos Docker conservan sus
   controles. No se añaden secretos, permisos de escritura o despliegues al CI.
4. Una regresión del workflow comprueba que las nuevas órdenes permanezcan
   antes de las suites correspondientes.

Consulta de GitHub del 30 de octubre: el ruleset de `pruebas-rediseno` está
activo, exige PR y `Resultado` aprobado sobre una rama actualizada, y no tiene
actores con bypass. No se modificó la configuración externa del repositorio.
La aprobación de este bloque local no sustituye un futuro CI del PR.

## Verificación local

Las herramientas de PHP se verificaron en una imagen temporal con PHP 8.4,
sin `.env`, datos ni volúmenes de aplicación. Los controles y pruebas se
ejecutan sin red. El ensayo portable de fase 4 permanece separado.

Se compararon los lockfiles contra el commit base: no cambiaron las versiones
de las dependencias de ejecución de PHP ni de frontend. Solo se añadieron
herramientas de desarrollo. La única limpieza en código de ejecución elimina
una inicialización que se sobrescribía antes de usarse en `LanguageService`;
las pruebas del servicio y la suite Angular verifican su comportamiento.

La evidencia detallada se conserva localmente en `storage/codex-local/phase5/`.
No versionar logs, configuración privada ni dependencias temporales.

| Control | Resultado local |
|---|---|
| Lint TypeScript y plantillas | 384 archivos, 0 errores, 0 advertencias. |
| Pruebas negativas y positivas de calidad frontend | 6 aprobadas. |
| Angular | 528 pruebas aprobadas en 58 archivos. |
| Build SPA de producción | Aprobado; conserva avisos previos de presupuesto CSS. |
| Cabeceras y PWA sobre artefactos generados | 20 pruebas aprobadas. |
| PHPStan nivel 5 en el alcance declarado | Sin errores. |
| Arquitectura PHP | 4 pruebas, 106 aserciones, aprobadas. |
| Regresión PHP con SQLite en memoria | 360 pruebas, 4.263 aserciones; 8 omisiones previstas para PostgreSQL. |
| Contratos de seguridad, higiene y workflow | 46 pruebas aprobadas. |

No se repitieron las suites PostgreSQL en esta entrega local; permanecen
obligatorias en CI. Tampoco se declara ejecutado el nuevo workflow remoto:
esta entrega queda en una rama local para su integración posterior mediante PR.

## Siguientes bloques

- Ampliar análisis de PHP y tipos de payloads de forma gradual y comprobada.
- El bloque de dependencias del 5 de noviembre retira `install`, unifica npm y
  añade auditorías al CI; ver [resultados y retiro posterior de ECharts](DEPENDENCIAS_FASE5.md).
- El bloque [E2E en escritorio y móvil](E2E_FASE5.md) añade recorridos con API,
  bases y archivos sintéticos reales, sin credenciales de producción.
- Continuar con cobertura de reglas críticas y aceptación operativa de la
  topología definitiva.
- El bloque [de observabilidad](OBSERVABILIDAD_FASE5.md) incorpora trazas locales
  y amplía PHPStan al middleware y su infraestructura; el
  [manual de operación](MANUAL_TECNICO_OPERACION.md) reúne los procedimientos.
- Validar alojamiento y controles de publicación cuando DIIT confirme el host.

## Línea base de cobertura A-03 · 19 de noviembre de 2026

Medición local sobre `dacf6a0`, la revisión de `pruebas-rediseno` usada para
iniciar A-03. La configuración de cobertura del frontend es opcional y usa
el proveedor V8 de la misma versión de Vitest (`4.1.12`). El backend se midió
con PHPUnit 11.5.53, PHP 8.4.27 y PCOV 1.0.12 en contenedores sin acceso a
producción y con las dependencias exactas de `composer.lock`.

| Suite | Líneas ejecutadas | Resultado |
|---|---:|---|
| Laravel, suite general con SQLite y MongoDB de prueba | 5.228 de 8.094 (64,59 %) | 743 aprobadas, 8 omitidas por requerir PostgreSQL, 8.236 aserciones |
| Laravel, selección de CI con PostgreSQL 16 y MongoDB de prueba | 5.036 de 8.094 (62,22 %) | 581 aprobadas, 6.318 aserciones |
| Angular, suite unitaria | 3.350 de 5.062 (66,17 %) | 564 aprobadas en 61 archivos |

PHPUnit mide el árbol `backend/app` e incluye archivos sin ejecutar. PCOV mide
líneas. La selección PostgreSQL de CI vuelve a ejecutar casos de la suite
general, por lo que se reporta por separado. En Angular se verificó que el
informe incluya los 249 archivos TypeScript elegibles de `src/app`. En ese
alcance se ejecutaron 3.014 de 4.400 ramas (68,50 %). Los tests E2E, las
plantillas HTML, el servidor SSR externo a `src/app` y el relay Node quedan
fuera de este porcentaje.

Para volver a medir el frontend, ejecutar `npm ci` y `npm run test:coverage`
desde `frontend`. El HTML y el resumen JSON se generan en `frontend/coverage/frontend/`.
Para PHP, usar una copia de pruebas aislada con PCOV disponible y ejecutar
desde `backend`:

```sh
php -d "pcov.directory=$PWD/app" vendor/bin/phpunit --no-progress --coverage-text --coverage-clover=../output/backend-coverage.xml
```

Crear `output/` antes de ejecutar y usar las bases de prueba desechables y las
variables `TEST_DB_*` y `TEST_MONGO_*` de CI para reproducir cada suite. El
resumen por capa y los informes Clover de este ensayo se conservan localmente
en `storage/codex-local/a03-20261119/`.

La primera prioridad de esta medición fue el flujo de verificación de correo en
Angular. Su pantalla tiene 0 de 39 líneas cubiertas por la suite unitaria,
mientras que el servicio de verificación de Laravel alcanza 55 de 58 líneas.
Cubrir el rechazo de un código, la recuperación del formulario y la espera de
reenvío. Después, priorizar los casos de error en el cliente de publicaciones
(11 de 81 líneas) y la pantalla de importación de datasets (0 de 31 líneas),
que ya cuenta con pruebas separadas para su fachada (58 de 70 líneas).

En Laravel, la suite general cubrió el 98,11 % de las líneas de `Policies`,
el 77,81 % de `Application` y el 36,50 % de `Infrastructure`. La cobertura
baja de infraestructura se concentra en estadísticas, repositorios MongoDB
y SharePoint. Conviene confirmar los consumidores activos al elegir casos
de persistencia y recuperación de errores para ese bloque.

PHPStan (nivel 5, alcance actual), ESLint, los 32 controles de workflow e
higiene y la auditoría del lockfile frontend pasaron en local. Dado que la
medición es una referencia, la incorporación del informe a CI y el umbral
quedan para un bloque posterior de A-03.

[Cobertura de Angular](https://v21.angular.dev/cli/test) ·
[Cobertura en PHPUnit 11.5](https://docs.phpunit.de/en/11.5/code-coverage.html) ·
[PCOV 1.0.12](https://pecl.php.net/package/pcov/1.0.12)

## Actualización de cobertura A-03 · 24 de noviembre de 2026

La medición se repitió sobre `50cceb6`, con el Barómetro ya integrado. Los
resultados de Angular comparan la misma revisión antes y después de incorporar
nueve pruebas. El backend se midió con dependencias de `composer.lock` y bases
desechables de MongoDB y PostgreSQL, además de SQLite en memoria.

| Suite | Líneas ejecutadas | Pruebas |
|---|---:|---|
| Angular, antes | 3.371 de 5.160 (65,32 %) | 567 aprobadas |
| Angular, después | 3.420 de 5.160 (66,27 %) | 576 aprobadas en 62 archivos |
| Laravel, SQLite y MongoDB | 5.309 de 8.174 (64,95 %) | 751 aprobadas y 8 omitidas por requerir PostgreSQL |
| Laravel, PostgreSQL 16 y MongoDB | 5.068 de 8.174 (62,00 %) | Selección del workflow de CI |

La pantalla de verificación de correo pasó de 0 a 46 de 46 líneas. Las pruebas
cubren el rechazo de un código, un nuevo intento, la espera y el fallo de
reenvío, la redirección por rol y la respuesta cuando la verificación está
en pausa. El servicio de publicaciones pasó de 11 a 15 de 81 líneas al
comprobar la carga del PDF desde la API, la propagación de un `403` y el caso
sin una copia almacenada.

CI ejecuta estas pruebas con su suite habitual. El informe se genera bajo
demanda y queda fuera de Git. Quedan por definir los umbrales de cobertura y por
ampliar las pruebas de persistencia en infraestructura. El catálogo público
y el editor del Barómetro tienen recorridos E2E y registran 0 de 48 y 0 de 102
líneas, respectivamente, en la suite unitaria de Angular.

Referencias: [configuración de typescript-eslint](https://typescript-eslint.io/users/configs/),
[herramientas oficiales angular-eslint](https://github.com/angular-eslint/angular-eslint),
[niveles de PHPStan](https://phpstan.org/user-guide/rule-levels).
