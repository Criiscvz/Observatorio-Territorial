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

Referencias: [configuración de typescript-eslint](https://typescript-eslint.io/users/configs/),
[herramientas oficiales angular-eslint](https://github.com/angular-eslint/angular-eslint),
[niveles de PHPStan](https://phpstan.org/user-guide/rule-levels).
