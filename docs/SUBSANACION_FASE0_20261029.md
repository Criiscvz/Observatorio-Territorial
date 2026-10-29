# Subsanación: diagnóstico y preparación de la fase 0

Corte: 29 de octubre de 2026 (America/Guayaquil).
Base: `pruebas-rediseno` en `ce5ef92256d8b9dd4947f202954e309726bea9da`.
Rama de trabajo: `subsanacion-seguridad`, sin seguimiento de la rama productiva.

## Alcance y límites

Esta primera entrega actualiza el diagnóstico frente al informe técnico consolidado de DIIT y los reportes de backend/frontend de septiembre de 2026. No modifica lógica de aplicación, datos del usuario, credenciales, Vercel, Render ni reglas externas de GitHub. No constituye una aprobación institucional ni una auditoría de penetración completa.

Se preparan cuatro ajustes concretos:

- El workflow existente incluye `pruebas-rediseno` en los pushes verificados. Mantiene los PR normales, los permisos de solo lectura, las versiones fijadas y la ausencia de secretos de despliegue.
- Sus regresiones normalizan CRLF/LF para ejecutarse en Windows y Linux.
- Se incorporan exclusivamente los dos ajustes de pruebas existentes en `main`: dominio Sanctum explícito en logout y motivo de revisión obligatorio en el fixture de archivado.
- El ejecutor backend permite seleccionar una de las ubicaciones conocidas de la imagen PHP, conservando la comparación del lock, la ausencia de `.env`, los montajes de código en solo lectura y los datos temporales.

También se añade un ensayo de respaldo/restauración con datos exclusivamente sintéticos.

## Matriz actualizada de las 15 NC

Los estados se refieren al alcance observado y a las pruebas locales de esta entrega. Ninguno equivale a cierre institucional automático.

| NC | Estado y evidencia inicial | Trabajo pendiente / criterio de cierre | Fase |
|---|---|---|---|
| 01. SQL JSONB | Corrección implementada: claves JSON con parámetros vinculados; regresiones y consultas PostgreSQL aprobadas. | Mantener evidencia de las ocho operaciones y revisar otros puntos SQL durante la fase de seguridad. | 1 |
| 02. Seed por HTTP | Control implementado; `SeedRoutesDisabledTest` aprobado dentro de la suite. | Confirmar inventario de rutas del artefacto de entrega y documentar inicialización exclusivamente por CLI. | 1 |
| 03. Secretos | Parcial. Hay escáner y controles de higiene; antecedentes documentados en los anexos anteriores. | Clasificar exposición histórica, confirmar vigencia con responsables y, si corresponde, rotar/revocar y coordinar tratamiento del historial. No se reproducen valores. | 1 |
| 04. Publicaciones duplicadas | Pendiente confirmado: `ArticuloController` y `ReporteController` todavía usan `concat` de modelos antiguos y publicaciones. | Inventario, migración repetible, conciliación de datos/archivos, consultas SQL paginadas y retirada gradual de consumidores antiguos. | 2 |
| 05. Reglas y autorización en vistas | Parcial: existe autorización backend y hay pruebas de acceso cruzado, pero la lógica sigue repartida entre helpers y vistas. | Policies/casos de uso y capacidades por recurso; el backend debe autorizar cada operación. Preservar las reglas de Supervisor y Editor. | 3 |
| 06. CI/CD | Parcial: workflow ya existente. Esta entrega añade la rama productiva a sus pushes. | Hacer obligatorios los checks y documentar el vínculo con despliegue/reversión. La rama productiva no está protegida según consulta de GitHub de este corte. | 0 y 5 |
| 07. Contenedores/IaC | Pendiente: no hay Dockerfile frontend ni definición institucional de IaC identificada. | Confirmar host y decidir SPA/SSR, persistencia y servicios; contenedores y definición reproducible adecuada a ese host. | 4 |
| 08. Dominio y pruebas | Parcial: la suite es mayor que la descrita en septiembre y pasa en aislamiento. | Medir cobertura de reglas, ampliar cálculo/analítica y contratos; E2E de roles, revisión, importación y visores. No confundir número de pruebas con cobertura. | 5 |
| 09. DTOs/Resources | Pendiente confirmado en categorías, fuentes y gráficos: existen respuestas directas de Eloquent. | Campos de salida explícitos y pruebas de contrato, con compatibilidad de consumidores. | 2 y 3 |
| 10. Sesión/interceptor | Controles implementados: cookies, origen/ruta de API restringidos, token CSRF y pruebas de sesión/autorización. | Revalidar los recorridos reales y la configuración de los dominios de la entrega; conservar pruebas contra fuga a terceros. | 1 |
| 11. Cabeceras/SSR | Controles implementados con Helmet y cabeceras Vercel. | Verificar el artefacto compilado y la futura configuración del host, incluidos PDF y Power BI. | 1 y 4 |
| 12. Dependencias | Parcial: existen actualizaciones y anexos previos. `install` y ambos lockfiles npm/bun siguen presentes; no hay script lint. | Retirar paquete impropio, definir gestor único, revisar avisos vigentes y automatización de mantenimiento. | 5 |
| 13. Observabilidad | Pendiente: no se identificó instrumentación OpenTelemetry ni una política completa de correlación/redacción. | Logs estructurados, trazas y tratamiento de datos sensibles, con ensayo operativo. | 5 |
| 14. Configuración/permisos | Parcial: seeder usa configuración cacheable y entrypoint productivo usa 775. `Dockerfile.dev` conserva 777 e instalación que ignora requisitos; hay migraciones de arranque que revisar. | Alinear runtime, permisos y verificación de extensiones; preparar migraciones únicas y controladas para el alojamiento de entrega. | 1 y 4 |
| 15. Higiene | Guardas específicas locales aprobadas; no se identificaron los binarios/logs citados entre los archivos rastreados consultados. | Conservar escaneo y revisión del paquete de entrega; esto no acredita limpieza de todo el historial ni cierra NC-03. | 1 y 5 |

## Módulos y contratos que debemos conservar

| Área | Flujos que deben mantenerse durante la subsanación |
|---|---|
| Autenticación y perfil | Sesión Sanctum/CSRF, verificación por correo, Google, cierre de sesión, perfil y cambio de contraseña. |
| Usuarios y accesos | Administrador, Supervisor, Editor, Suscriptor y Usuario; alcance por observatorio y capacidades de revisión/asignación. |
| Publicaciones | Artículo, reporte y libro; creación, edición, importación SharePoint, PDF, fuente y acceso de suscriptor. |
| Revisión | Estados, motivo de suspensión/archivo/rechazo y bloqueo de edición del rechazado para el Editor. |
| Bibliotecas | Observatorio, listado editorial y portal; búsquedas y paginación de 20 publicaciones por página. |
| Atlas | Categorías, enlaces Power BI, biblioteca pública y visor; conservar los registros existentes al consolidar modelos. |
| Barómetro/datasets | Carga e importación, metadatos, almacenamiento JSONB y consumidores MongoDB si siguen activos. No retirar un motor sin inventario. |
| Analítica | Frecuencias, estadísticas, histogramas, dispersión, contingencia, series y procesamiento de texto. |
| Visores e identidad | PDF, Power BI, ficha y pantalla completa; fotos/iconos de observatorios y apariencia adaptable. |

Este inventario es funcional y estático; no es un contrato OpenAPI exhaustivo ni una conciliación de datos productivos.

## Aislamiento de ensayos

La base asociada al servicio denominado `observatorio-territorial-pruebas` es ahora producción. El dominio principal y el enlace largo del rediseño comparten esos datos. Ninguno se usó para pruebas de escritura en esta entrega.

El ejecutor backend:

1. Compara el SHA-256 de `composer.lock` con el de la imagen antes de ejecutar.
2. Rechaza imágenes que contengan `.env`/`.env.testing` en el directorio de la aplicación.
3. Monta únicamente fuentes seleccionadas en solo lectura; storage y caché viven en tmpfs.
4. Usa SQLite en memoria con red deshabilitada para la suite general.
5. Para JSONB, crea PostgreSQL 16 efímero, sin puertos ni volúmenes del usuario y sin red externa. El cliente comparte solamente ese espacio de red aislado.
6. Usa credenciales sintéticas `TEST_DB_*`; el bootstrap rechaza hosts no locales o nombres de base que no se identifiquen como de test.
7. Detiene exclusivamente el contenedor temporal cuyo identificador creó.

No se descargaron imágenes ni se ejecutó el entrypoint de despliegue.

## Respaldo y reversión

El nuevo ensayo valida `pg_dump`/`pg_restore` en un contenedor PostgreSQL 16 sin conectividad externa. Comprueba filas sintéticas, JSONB, motivo de revisión, valores nulos, clave foránea, restricción de estado e índice. Su dump permanece dentro del contenedor temporal y desaparece al finalizar.

**Límite:** no es un respaldo ni un ensayo de recuperación del esquema completo de la aplicación o de la base productiva. Antes de la fase 2 se debe:

1. Inventariar tablas, archivos y referencias activas.
2. Preparar una copia minimizada/anonimizada del esquema y los datos necesarios para ensayo en un entorno separado.
3. Respaldar PostgreSQL y, por separado, PDF/otros archivos y configuración necesaria, sin publicar secretos.
4. Restaurar esa copia y conciliar cantidades, relaciones, permisos, estados y acceso a archivos.
5. Ensayar la migración y definir el orden de reversión de aplicación/esquema/datos. No ejecutar un `migrate:rollback` ciego sobre datos reales.
6. Aprobar el cambio concreto y conservar un punto de recuperación identificado antes del despliegue.

La rama local permite revertir esta primera entrega sin una migración de datos, porque no cambia aplicación ni esquema. La prueba futura de restauración completa sigue pendiente; no se iniciará una consolidación destructiva mientras falte.

## Verificación reproducible

Desde la raíz, con las imágenes locales ya disponibles:

```powershell
node --test scripts/test-repository-hygiene.mjs scripts/security-workflow.test.mjs
.\scripts\test-backend-security.ps1 -PhpImage backend-backend-dev:latest -PhpWorkdir /app
.\scripts\test-disposable-postgres-restore.ps1
```

Frontend desde `frontend/`:

```powershell
npm test -- --watch=false
```

El build de Vercel utiliza `API_URL=/api`. Su script modifica temporalmente `environment.prod.ts`; la verificación local de esta entrega conserva y restaura los bytes originales. Después se ejecuta `test:security-headers` con `SECURITY_CHECK_BUILD=1` para revisar el artefacto generado. No reutilizar esa variable como cambio de configuración productiva.

| Comprobación | Resultado local |
|---|---|
| Regresiones de higiene/workflow | 23 aprobadas. Antes había tres fallos por CRLF en Windows; se normalizó la lectura de la prueba. |
| Frontend | 494 pruebas aprobadas en 53 archivos. Antes fallaba el fixture de archivado sin motivo. |
| Backend SQLite | 271 casos, 2.214 aserciones; ocho omitidos porque requieren PostgreSQL. Antes fallaba el fixture de dominio de sesión. |
| Backend PostgreSQL/JSONB/aislamiento | 77 pruebas, 183 aserciones, aprobadas. Se solapan con la suite general; no sumar como casos únicos. |
| Respaldo/restauración sintéticos | Aprobado, con los límites de alcance descritos. |
| Build SPA y cabeceras/PWA del artefacto | Build aprobado y 20 comprobaciones aprobadas, sin omisiones. Persisten advertencias de presupuesto de estilos en componentes que esta entrega no modifica. |

Runtime local comprobado: PHP 8.4.26 y PHPUnit 11.5.53. Las dependencias PHP de la imagen coinciden con el lock revisado. Los logs locales detallados permanecen ignorados en `storage/codex-local/`.

## Puertas de cierre todavía abiertas

- Consulta de GitHub: `pruebas-rediseno` figura sin protección; el ruleset activo identificado corresponde a `deploy-gratis`. No se modificaron reglas externas en esta entrega.
- Añadir el disparador de CI no asegura un bloqueo de despliegue: se debe revisar y configurar el requisito de PR/checks y acreditar el run real antes de integrar.
- El flujo de trabajo y las pruebas locales no sustituyen E2E sobre un entorno separado con API/archivos representativos.
- La clasificación de secretos históricos y cualquier rotación/reescritura requieren su procedimiento específico.
- Falta el ensayo de restauración completo con datos de aplicación minimizados antes de migrar publicaciones.
- Confirmar con DIIT el host y las decisiones de despliegue y el inicio formal de los plazos. No se presupone Azure ni Kubernetes.

La primera entrega deja una línea base reproducible y pendientes trazables. La fase 0 no se presenta como cierre operativo total mientras falten estas puertas.

## Actualización operativa del 29 de octubre

Los pendientes anteriores describen la primera entrega. Se avanzó posteriormente sobre dos de ellos: `pruebas-rediseno` ya tiene protección activa con PR/check `Resultado`, y se completó la restauración integral de una copia local minimizada con PostgreSQL y sus PDF. Se añadió un modo Angular `rehearsal` que usa exclusivamente la API local separada y un ejecutor de comprobaciones HTTP.

La evidencia, cantidades, procedimiento y límites están en [Ensayo de restauración](ENSAYO_RESTAURACION_20261029.md). La copia local no sustituye un punto de recuperación de producción antes de una migración futura. Secretos históricos, recuperación productiva, integraciones externas y decisiones DIIT continúan pendientes.
