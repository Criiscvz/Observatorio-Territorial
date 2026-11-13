# Matriz de evidencia de subsanación

Corte: **12 de noviembre de 2026**, America/Guayaquil. Corresponde a la fase 6 del plan interno (fases 0–6), no a una declaración de recepción de DIIT. Contrasta el PDF original, especialmente sus páginas 5–6, y los dos reportes Markdown. Sustituye como referencia actual a la matriz del 9 de noviembre, que se conserva como antecedente.

Seguimiento del **13 de noviembre**: [contratos de respuesta de NC-09](CONTRATOS_DATASETS_NC09_20261113.md).
La tabla y las versiones de este documento conservan el corte del día 12; la entrega
posterior identifica su alcance, pruebas y condiciones de integración por separado.

## Versión y significado de los estados

- Producción examinada: `pruebas-rediseno`, `6b7f5ea3f35e42f39ac0c8370379d1e3d090a371`.
- `main`: `f261478681f61bf7b75a5b5936e53ffc3d3df8ac`; mismo árbol de código `966ebd9f5a5b180d80a7f043bdecb61da7eecbf2`. Preparada para la futura adaptación al alojamiento institucional.
- `deploy-gratis` se conserva en `931b0e8b42807121949a98966113eb1c7d218dd3`. No es la base del examen.
- Las evidencias funcionales corresponden a esos commits y a las ejecuciones enlazadas en el [expediente](EXPEDIENTE_SUBSANACION_20261112.md). Esta revisión documental no vuelve a ejecutar todas las suites ni hace escrituras en producción.

**V — evidencia técnica disponible:** el defecto concreto tiene implementación y comprobaciones en el alcance descrito. Es una propuesta para reevaluación, no aceptación de DIIT ni certificación de toda la aplicación.

**P — parcial:** existe avance, pero queda un requisito literal, una ampliación técnica o una decisión institucional sin aceptar. Una justificación del proyecto no es una excepción aprobada por DIIT.

Resultado documental: **7 V y 8 P; ninguna recepción institucional acreditada**. No son porcentajes de cobertura, de seguridad o de avance global. Las severidades se conservan del PDF original, sin recalificarlas como riesgo residual.

| NC | Severidad original | Tema | Estado |
|---|---|---|---|
| NC-01 | Crítica | SQL dinámico JSONB | V |
| NC-02 | Crítica | Inicialización HTTP | V |
| NC-03 | Crítica | Secretos y contraseñas | P |
| NC-04 | Crítica | Publicaciones paralelas | P |
| NC-05 | Crítica | Negocio y autorización en vistas | P |
| NC-06 | Crítica | CI/CD | V |
| NC-07 | Alta | Contenedores e IaC | P |
| NC-08 | Alta | Pruebas de dominio | V |
| NC-09 | Alta | DTOs y respuestas API | P |
| NC-10 | Alta | Sesión e interceptor | V |
| NC-11 | Alta | Cabeceras web y SSR | V |
| NC-12 | Media | Dependencias | P |
| NC-13 | Media | Telemetría | P |
| NC-14 | Media | Permisos de archivo y configuración | V |
| NC-15 | Baja | Higiene del repositorio | P |

## Evidencia y criterio pendiente por NC

### NC-01 · V · SQL dinámico JSONB

**Exigencia:** parametrizar las claves y valores dinámicos en `EloquentRegistroDatoRepository` (PDF pp. 5–6; backend sección 2.11).

**Evidencia:** `backend/app/Infrastructure/Persistence/Eloquent/Repositories/EloquentRegistroDatoRepository.php`; regresiones `EloquentRegistroDatoRepositoryTest` y `RegistroDatoPostgresTest`, incluidas en CI con PostgreSQL real. Se conserva el vínculo de parámetros y el aislamiento de las bases de prueba.

**Límite / continuidad:** la evidencia no es una auditoría de cualquier SQL futuro. Conservar los casos maliciosos y ampliar el inventario cuando se modifiquen consultas. Responsable: proyecto; reevaluación: DIIT.

### NC-02 · V · Inicialización HTTP

**Exigencia:** retirar `/api/seed/*` y sembrar únicamente por CLI (PDF pp. 5–6).

**Evidencia:** `backend/routes/api.php` y `backend/tests/Feature/SeedRoutesDisabledTest.php`. Los fixtures de ensayo se ejecutan por CLI con guardas de entorno/base, sin convertirlos en administración HTTP.

**Límite / continuidad:** el alojamiento debe conservar la separación entre operación web e inicialización controlada. No se han reintroducido endpoints seed. Responsable: proyecto y operador.

### NC-03 · P · Secretos y contraseñas

**Exigencia:** retirar secretos del código y **purgarlos del historial Git**, usar configuración protegida y sin valores débiles predeterminados (PDF p. 6; backend sección 2.13).

**Evidencia:** [cierre de fase 1](CIERRE_FASE1_20261029.md); rotación y comparación privada de los candidatos identificados; contraseñas de siete cuentas activas cambiadas por el responsable; Gitleaks sobre archivos actuales y commits nuevos, con pruebas de detección/redacción.

**Pendiente:** el historial compartido conserva ejemplos identificados; no hubo purga. Tampoco se certifican reflogs, objetos inalcanzables, forks o clones ajenos. El cierre técnico acotado de fase 1 no satisface por sí solo la purga literal del PDF.

**Salida:** proyecto prepara inventario saneado y ensayo de reescritura; responsable del repositorio y DIIT acuerdan purga coordinada o aceptan explícitamente una alternativa. No ejecutar force-push ni reescribir ramas alojadas como limpieza rutinaria. Rotación y custodia siguen siendo necesarias aun con purga.

### NC-04 · P · Publicaciones paralelas

**Exigencia:** consolidar artículos/reportes, eliminar concatenación en RAM y **retirar tablas/modelos redundantes** (PDF p. 6; backend sección 2.8).

**Evidencia:** [adaptadores](ADAPTADORES_PUBLICACIONES_FASE2.md), [bibliotecas SQL paginadas](BIBLIOTECAS_PAGINADAS_FASE2.md), `PublicationLibraryPaginationTest`, `PublicationSourceMigrationTest` y pruebas del puente. La conciliación productiva del 9 de noviembre registró 38 publicaciones nativas, cero filas antiguas y cero mapas de conversión; no existía un lote antiguo que convertir. Las bibliotecas conservan 20 publicaciones por página.

**Pendiente:** permanecen tablas/modelos y rutas de compatibilidad; no hubo DROP. Que las tablas estén vacías en ese respaldo no demuestra ausencia de consumidores futuros o en otros entornos.

**Salida:** inventariar consumidores retenidos, conciliar un respaldo reciente, ensayar su retiro y recuperación, revisar migración SQL y retirar por entrega autorizada; o lograr aceptación expresa de la compatibilidad temporal. Proyecto/DBA/DIIT. No se autoriza borrado mediante esta matriz.

### NC-05 · P · Negocio y autorización en vistas

**Exigencia:** backend como autoridad, capacidades booleanas, ViewModel y subcomponentes en el detalle del observatorio (PDF p. 6; frontend secciones 2.1, 2.4).

**Evidencia:** [cierre editorial de fase 3](CIERRE_TECNICO_FASE3.md), Policies, `PublicationReviewWorkflow`, `PublicationReviewDecision`, capacidades y facades por pantalla; pruebas de acceso cruzado, revocación, rechazados y payloads alterados. El cierre de arquitectura del 12 de noviembre elimina las dos dependencias de presentación pendientes.

**Pendiente:** el alcance completado es editorial. Dataset/Barómetro y otras vistas históricas no están homologados en su totalidad; el rediseño funcional de Barómetro fue aplazado por el responsable. Eso no equivale a una excepción de DIIT.

**Salida:** acordar alcance de recepción y completar el inventario restante con casos de uso, contratos y denegaciones en backend. La seguridad de una API conservada debe mantenerse aunque su pantalla se retire.

### NC-06 · V · CI/CD

**Exigencia:** compilación, lint, pruebas de ambos componentes y publicación trazable (PDF p. 6).

**Evidencia:** `.github/workflows/security.yml`; trabajos Secretos, Higiene, Backend, Frontend y Resultado. CI del PR #48 y del commit de producción aprobadas. Ruleset activo de `pruebas-rediseno`: PR y `Resultado` sobre rama actualizada, cero bypass, sin force-push/borrado. La regla exige cero revisores aprobadores; no debe describirse como doble aprobación humana.

**Límite / continuidad:** CI no recibe secretos de despliegue ni hace cambios productivos de datos. Render/Vercel publican desde la rama conectada; conservar comprobación del SHA efectivo y reversión. La canalización del futuro host se adaptará al contrato de DIIT.

### NC-07 · P · Contenedores e IaC

**Exigencia:** build multi-stage del frontend, Compose e IaC Bicep/Terraform para el alojamiento acordado (PDF pp. 5–6).

**Evidencia:** `frontend/Dockerfile.portable`, `backend/Dockerfile.portable`, `deploy/portable/compose.yml` y [ensayo portable](ENSAYO_PORTABLE_FASE4.md). Build, persistencia, restauración y retorno al origen ensayados en aislamiento; 65 comprobaciones registradas en el ensayo original.

**Pendiente:** DIIT no confirmó host, recursos, Docker, dominio, proxy, TLS, red ni almacenamiento. Compose local no sustituye el aprovisionamiento Bicep/Terraform solicitado. El runtime heredado publicado difiere del portable.

**Salida:** recibir ficha técnica; elegir y acordar plataforma; preparar IaC aplicable o alternativa aceptada, y repetir despliegue/recuperación en esa topología. Proyecto y DIIT. No se presupone Azure ni se crea infraestructura facturable.

### NC-08 · V · Pruebas de dominio

**Exigencia:** incrementar pruebas de reglas/entidades y gobierno arquitectónico (PDF pp. 5–6; backend sección 2.2).

**Evidencia:** `UnivariableStatsUseCaseTest` verifica reglas de selección sin petición HTTP; suites de revisión, privacidad y conservación; `ArchitectureTest` recorre Domain/Application mediante AST sin excepciones de presentación. Última regresión: 385 casos SQLite con 4.496 aserciones y ocho omisiones de PostgreSQL; subconjunto PostgreSQL de 177 casos y 2.358 aserciones. Ver [calidad](CALIDAD_CI_FASE5.md).

**Límite / continuidad:** se acredita existencia y regresión de reglas examinadas; no se midió un porcentaje de líneas/ramas ni se certifica cobertura de todas las entidades o APIs. Los subconjuntos se solapan y no se suman. Ampliar medición y alcance según A-03, sin inventar una meta numérica no acordada.

### NC-09 · P · DTOs y respuestas API

**Exigencia:** Resources/DTOs en **CategoriaDatasetController, DatasetFuenteController y GraficoPredeterminadoController**, además de contratos controlados (PDF p. 6; backend sección 2.9).

**Evidencia parcial:** `PublicacionResource` y contratos editoriales explícitos, DTO PDF y adaptador de respuesta. Se evita exponer la ruta privada del descriptor PDF como JSON.

**Pendiente confirmado en el código del corte:** `CategoriaDatasetController` devuelve `$categorias`/`$categoria`; `DatasetFuenteController` devuelve `$fuentes`/`$fuente`; `GraficoPredeterminadoController` devuelve `$graficos`/`$grafico` mediante `response()->json(...)` sin Resource. Las relaciones cargadas también requieren un contrato. Sus permisos mejorados no corrigen esa serialización.

**Salida:** convertir los tres controladores con listas explícitas de campos y contratos de relaciones/paginación; probar ausencia de atributos internos y compatibilidad de consumidores. Prioridad técnica inmediata del proyecto; no requiere esperar el rediseño visual de Barómetro.

### NC-10 · V · Sesión e interceptor

**Exigencia:** no guardar tokens de sesión en localStorage ni enviarlos a terceros; restringir el interceptor (PDF pp. 5–6; frontend sección 2.9).

**Evidencia:** `auth.interceptor.ts` limita credenciales al origen y rutas API confiables; sesión mediante cookies y CSRF, sin Bearer de sesión almacenado. Pruebas de revocación, cuentas desactivadas, cambio de contraseña y pestañas; E2E mantiene CSRF. Lecturas productivas verificaron cookies seguras y 419 sin token.

**Límite / continuidad:** no es una certificación de ausencia de XSS. El dominio/proxy institucional y los recorridos externos requieren homologación (A-06/A-10). No añadir política de complejidad al login que rechace contraseñas existentes válidas.

### NC-11 · V · Cabeceras web y SSR

**Exigencia:** Helmet/CSP para SSR y controles efectivos del servidor usado (PDF p. 5; frontend sección 2.9).

**Evidencia:** `frontend/src/server.ts` usa Helmet; `frontend/vercel.json` y servidor portable aplican cabeceras para SPA. `security-headers.test.mjs`, pruebas PWA/E2E y lectura productiva verifican CSP, nosniff y worker PDF correcto.

**Límite / continuidad:** producción usa SPA en Vercel, no el servidor Express opcional. Comprobar cabeceras reales del proxy del futuro host; no declarar desplegado SSR por la sola presencia de su código. No desactivar CSP/nosniff para corregir visores.

### NC-12 · P · Dependencias

**Exigencia:** retirar `install`, resolver parches/gestor de paquetes y mantener dependencias; el PDF también establece vigencia de librerías ≤ seis meses (PDF pp. 1–2 y 5; reportes sección 2.3).

**Evidencia:** npm único, locks, retiro de Bun y `install`; [retiro del análisis gráfico antiguo](RETIRO_ANALISIS_GRAFICO_20261110.md) y [mantenimiento del 11 de noviembre](MANTENIMIENTO_DEPENDENCIAS_20261111.md). Diez propuestas de Dependabot revisadas, con pruebas de la combinación; auditorías npm/Composer sin avisos en las ejecuciones enlazadas. Dependabot está activo.

**Pendiente confirmado:** `fakerphp/faker` v1.24.1 conserva en el lockfile fecha `2024-11-21`. Es una dependencia de desarrollo y no se instala en la imagen de producción sin dev, pero no existe aceptación de DIIT de esa excepción a la vigencia. Las auditorías sin avisos no satisfacen por sí solas el límite de seis meses.

**Salida / continuidad:** inventariar vigencia y soporte de dependencias de producción/desarrollo, evaluar actualización o sustitución y obtener tratamiento aceptado por DIIT cuando no haya relevo compatible. No calificar una biblioteca como vulnerable o abandonada solo por su edad. Mantener auditorías y requisitos reales; el instalador heredado que ignora plataforma sigue en A-05. Proyecto/DIIT.

### NC-13 · P · Telemetría

**Exigencia:** trazabilidad OpenTelemetry y logs JSON correlacionados (PDF p. 5; backend sección 2.12).

**Evidencia:** [observabilidad](OBSERVABILIDAD_FASE5.md): SDK manual, IDs por petición, spans SQL/MongoDB/Microsoft y esquema positivo de logs; muestreo/límites, errores y redacción probados con runtime sintético.

**Pendiente:** no hay Collector/OTLP remoto, almacenamiento/buscador central ni alertas activas. Los logs nativos, históricos o del proveedor quedan fuera del filtro Laravel; no se acredita trazabilidad distribuida completa. La retención del hosting tampoco se fija desde el código.

**Salida:** operador y DIIT acuerdan alcance, sink, acceso, retención/expiración y alertas; prueban consulta por Request-ID, pérdida del sink y redacción antes de reenviar logs. Proyecto completa instrumentación adicional según ese alcance.

### NC-14 · V · Permisos de archivo y configuración

**Exigencia:** sustituir chmod 777 por permisos/propiedad adecuados y centralizar `env()` en configuración (PDF p. 5; backend sección 2.14).

**Evidencia:** Dockerfile y entrypoint heredados usan 775 para directorios escribibles con propiedad `www:www`; portable añade UID no root y filesystem de solo lectura. Búsqueda del corte sin `env()` en `backend/app`, `routes`, `bootstrap` o `database`; `InitialUsersConfigCacheTest` y ensayo de caché de configuración.

**Límite / continuidad:** se verifica el defecto concreto; no equivale a homologar todo el runtime heredado ni múltiples réplicas. A-05 recoge instalación/arranque pendientes. Con caché, `env()` no siempre devuelve null: puede leer variables reales del proceso; la corrección es centralizar el acceso, no sostener esa afirmación absoluta del reporte.

### NC-15 · P · Higiene del repositorio

**Exigencia:** retirar binarios, volcados, logs y metadatos de IDE; los reportes también solicitan limpieza histórica (PDF pp. 5–6; backend sección 2.14; frontend sección 2.11).

**Evidencia:** el índice actual no contiene composer.phar, logs, archivos .bak, helpers/volcados enumerados ni Bun. `test-repository-hygiene.mjs` y pruebas de contextos Docker rechazan secretos/evidencia privada y conservan los archivos necesarios.

**Pendiente:** retirar del índice no elimina versiones históricas. No hubo purga histórica; coordinar con NC-03. Los manifiestos Vite/Tailwind del backend se conservan por consumidores declarados, no son basura demostrada por su nombre.

**Salida:** registrar y acordar tratamiento de historia y scaffolding (A-11) con DIIT; mantener prevención de reincidencia. No declarar saneados todos los clones.

## Observaciones adicionales de los reportes

Estas filas evitan perder requisitos que el cuadro de 15 NC resume de forma general. No cambian la severidad original ni amplían una autorización para operaciones destructivas.

| ID y fuente | Evidencia / situación actual | Tratamiento y responsable |
|---|---|---|
| A-01 · Backend secciones 2.1, 2.4; frontend secciones 2.1, 2.4 | Casos de uso y facades editoriales; Domain/Application sin dependencias prohibidas de presentación. Aplicación aún utiliza Laravel/Eloquent; CRUD de datasets conserva validación/mutaciones en controladores. | **Parcial.** Completar inventario de responsabilidades fuera del alcance editorial; no prometer DDD puro. Proyecto; DIIT acuerda alcance. |
| A-02 · Backend sección 2.7 | Avatares con regex restringida; FormRequests editoriales y URLs http/https. DatasetFuente/Grafico y adaptadores antiguos conservan validación inline. | **Parcial.** Inventariar endpoints, extraer validaciones y probar equivalencia; la exigencia de 100% FormRequest no está satisfecha. Proyecto. |
| A-03 · Backend sección 2.2; frontend sección 2.2 | CI incluye unitarias, integración PostgreSQL, E2E y reglas AST/ESLint. PHPStan nivel 5 en rutas explícitas; no-explicit-any y no-unused-vars siguen desactivadas. | **Parcial.** Medir cobertura por capa y acordar umbral; ampliar análisis estático y tipos gradualmente. No existe porcentaje acreditado. Proyecto/DIIT. |
| A-04 · Backend secciones 2.1, 2.8 | PostgreSQL es fuente relacional; MongoDB conserva documentos de módulos antiguos. Roles/UUID mixtos no se modificaron globalmente. | **Decisión pendiente.** Documentar y acordar motores/propiedad por dato; PostgreSQL único sugerido requiere migración específica si se exige. Tipos distintos de clave no prueban por sí solos un defecto. Proyecto/DBA/DIIT. |
| A-05 · Backend secciones 2.5, 2.10, 2.14 | Portable comprueba plataforma real, no root y esquema como tarea separada. Dockerfile hospedado conserva --ignore-platform-reqs; su entrypoint aún asegura migraciones aditivas al arrancar y no declara USER final. No ejecuta seeders. | **Parcial.** Homologar runtime y job único; revisar SQL antes de cambios de esquema y probar recuperación. No cambiar Render a ciegas ni ejecutar migraciones por este expediente. Proyecto/operador. |
| A-06 · Frontend secciones 2.5, 2.10 | API_URL se inyecta en build con guardas; el placeholder falla de forma segura. Producción usa HTTPS y SPA/proxy. Ensayo portable conserva configuración separada. | **Condicionado al host.** Confirmar dominio/proxy/TLS/SPA o SSR, cookies, recursos, Docker e IaC; validar artefacto final. DIIT/proyecto. |
| A-07 · Frontend sección 2.8 | Las vistas actuales usan catálogo/publicaciones unificados; articulos.service.ts y reportes.service.ts permanecen por compatibilidad. | **Parcial.** Inventariar consumidores y retirar servicios/rutas redundantes junto con NC-04, con regresión. Proyecto. |
| A-08 · Frontend sección 2.7 | Registro/alta siguen usando mínimo de longitud; no se acredita un validador robusto común a alta/cambio/restablecimiento. URLs editoriales sí restringen esquema. | **Pendiente.** Acordar política y aplicarla coherentemente en frontend/backend; conservar login de contraseñas válidas. Proyecto/responsable de seguridad. |
| A-09 · Backend sección 2.6; PDF p. 6 | Manual de operación versionado, backup SQL/MongoDB/archivos restaurado y huellas verificadas en aislamiento. Configuración protegida con DPAPI del perfil Windows actual. | **Parcial.** Falta copia/custodia institucional fuera del equipo, cifrado integral acordado, calendario, responsables y RPO/RTO medidos. Operador/DIIT. |
| A-10 · Calidad/integraciones de ambos reportes | CI usa cuentas/datos sintéticos y dobles de proveedores donde se indica. Producción recibió lecturas, no fixtures de escritura. | **Pendiente de homologación.** Ensayar correo/OAuth/Graph/storage reales con autorización y cuentas adecuadas; también navegadores/dispositivos institucionales. Proyecto/operador/DIIT. |
| A-11 · Backend sección 2.14; frontend sección 2.11 | Snapshot limpio, Vite/Tailwind backend tiene consumidores y build probado; historia sin purgar. [Justificación](SEGURIDAD_NC03_NC15_20261015.md). | **Decisión pendiente.** Acreditar necesidad o retirar scaffolding sin romper recursos; DIIT debe aceptar el tratamiento histórico o exigir operación coordinada. Proyecto/DIIT. |
| A-12 · Backend/frontend secciones 2.6; PDF p. 6 | GitHub CI y manual disponibles; infraestructura institucional y procedimiento de release específicos todavía no existen. | **Parcial.** Adaptar pipeline/IaC/manual y revisar formalmente la entrega con DIIT. Sin fecha de recepción/acta no se calculan vencimientos institucionales. Proyecto/DIIT. |

## Orden propuesto para completar la subsanación

1. **NC-09 y A-02:** contratos de los tres controladores citados, campos explícitos, validación y regresión de consumidores conservados. Es un bloque acotado que puede ejecutarse antes de conocer el host.
2. **A-08 y A-03:** política de contraseñas/recuperación, medición de cobertura y ampliación gradual de calidad, sin afectar accesos existentes.
3. **NC-03/15 y NC-04/A-07:** acordar por separado el tratamiento histórico y el retiro de compatibilidad. Requieren inventario, respaldo y ensayo; no se ejecutan por estar enumerados aquí.
4. **DIIT:** confirmar ficha técnica y alcance para NC-07, A-04/A-06; después cerrar runtime/migraciones, telemetría/custodia y pruebas de proveedores.
5. Actualizar esta matriz con resultados de la misma revisión, integrar por PR con CI y solicitar reevaluación. Ninguna de las ocho P se convierte en V por una aprobación genérica del expediente.

## Fuentes e integridad

Los originales se conservan privadamente; no se copian sus ejemplos de credenciales al repositorio.

| Documento original | SHA-256 |
|---|---|
| INFORME_TECNICO_PLATAFORMA_VIVA.pdf · 6 páginas | `403d1299e9e16edea591c95be3fc8907e4d18e63d7cf9dbeec6860c6cfeb63c3` |
| REPORTE_SEGURIDAD_ARQUITECTURA.md | `9c501565d9dd2f6c91d4051b5cf2cb06a27a1dc374eef42a8edce64945cf2783` |
| REPORTE_SEGURIDAD_ARQUITECTURA_FRONTEND.md | `92ebcb34167c97e5598876423888ebcd22597f1c58001b7ddf647324d19fe197` |

El [expediente de entrega](EXPEDIENTE_SUBSANACION_20261112.md) identifica CI, despliegue, respaldo, reversión y las condiciones para una futura recepción.
