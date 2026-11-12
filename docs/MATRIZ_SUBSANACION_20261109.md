# Revisión conjunta de subsanación

Corte: 9 de noviembre de 2026, America/Guayaquil. Base publicada comprobada en GitHub: `pruebas-rediseno`, `0ba95c9`. Esta revisión reúne los bloques locales de fases 4–5 para validarlos mediante PR; no declara una aceptación de DIIT ni una publicación de esos bloques.

Actualizaciones posteriores: el [mantenimiento del 11 de noviembre](MANTENIMIENTO_DEPENDENCIAS_20261111.md)
revisó las primeras diez propuestas de Dependabot, ya activo, y el
[cierre del 12 de noviembre](CIERRE_EXCEPCIONES_ARQUITECTURA_20261112.md)
retira las dos excepciones del control de dirección. Se conserva el corte
histórico de las entregas anteriores; cada revisión exige su propia CI y evidencia.

## Entregas reunidas

| Commit | Entrega |
|---|---|
| `97869d8` | Ensayo portable aislado: SPA, API, PostgreSQL/MongoDB, persistencia y recuperación. |
| `1eb8e26` | Lint, límites de arquitectura y PHPStan, integrados en CI. |
| `598583a` | Dependencias dirigidas, npm único, retiro de `install`, auditorías y excepción ECharts acotada. |
| `6b767d2` | 16 recorridos E2E de escritorio/móvil y corrección MIME del worker PDF. |
| `5695295` | Logs redactados, correlación, OpenTelemetry local, salud y manual de operación. |

No hay archivos de migración de base de datos nuevos entre esa base y estas entregas. Los scripts de esquema, carga sintética y restauración se invocan explícitamente en entornos aislados; no son rutas HTTP de inicialización. No se retiraron tablas de compatibilidad ni se ejecutaron conversiones sobre datos publicados durante estos bloques.

## Matriz NC-01 a NC-15

Los estados distinguen implementación técnica, prueba reproducible y aceptación pendiente. Las cantidades de pruebas no constituyen porcentajes de cobertura. Los cierres históricos conservan su fecha y alcance; esta tabla no sustituye sus evidencias privadas.

| NC | Situación técnica y evidencia | Límite / requisito pendiente |
|---|---|---|
| 01 · SQL dinámico JSONB | Parámetros vinculados y regresiones PostgreSQL conservados. `RegistroDatoPostgresTest`, `EloquentRegistroDatoRepositoryTest` y aislamiento son obligatorios en CI. | Confirmar resultado remoto sobre la revisión de entrega; mantener inventario de SQL si se amplía analítica. |
| 02 · Seed HTTP | Rutas de seed retiradas/protegidas por `SeedRoutesDisabledTest`. Fixtures E2E solo CLI, con guardas de base vacía/entorno/URL. | Inicialización institucional exclusivamente por tarea controlada y CLI, no reintroducir endpoints. |
| 03 · Secretos | [Tratamiento de hallazgos identificados](CIERRE_FASE1_20261029.md), renovación de cuentas por el responsable, rotación MongoDB local y escaneo de snapshot/rango nuevo. | No se certifica ausencia de secretos en reflogs, forks, copias o servicios fuera del inventario. No se reescribe historial para aparentar revocación. |
| 04 · Publicaciones paralelas | Catálogos/bibliotecas SQL paginados, puente de compatibilidad, identidades y conservación. [Bibliotecas](BIBLIOTECAS_PAGINADAS_FASE2.md), [adaptadores](ADAPTADORES_PUBLICACIONES_FASE2.md). | Los datos/modelos antiguos que aún tienen consumidores se conservan. No eliminar tablas ni mapas sin conciliación y recuperación verificadas. |
| 05 · Negocio/autorización en vistas | Policies, flujo de revisión y capacidades de recursos; fachadas editoriales separadas. [Cierre de fase 3](CIERRE_TECNICO_FASE3.md), pruebas de revocación/acceso cruzado/rechazados. | No equivale a extraer toda vista histórica. Barómetro conserva contratos y su rediseño sigue aplazado. |
| 06 · CI/CD | Workflow con cuatro trabajos y `Resultado` obligatorio. Regla de `pruebas-rediseno`: PR, check estricto, cero bypass, sin force-push/borrado. | Esta revisión debe pasar CI remoto antes de integrar. El PR en borrador no es aprobación ni despliegue. Revalidar base y hospedajes al decidir publicación. |
| 07 · Contenedores/IaC | [Ensayo portable](ENSAYO_PORTABLE_FASE4.md): motores/red/volúmenes separados, bases de imágenes por digest, SPA sin Node en runtime, restauración ensayada. | DIIT no confirmó host/proxy/TLS/dominio/recursos/almacenamiento. El Dockerfile publicado heredado no se sustituye automáticamente por el portable. |
| 08 · Dominio y pruebas | 385 casos PHP/4.496 aserciones en la regresión local del 12 de noviembre; 8 omisiones previstas para PostgreSQL. 529 Angular y 16 E2E en los bloques documentados. CI también ejecuta el subconjunto PostgreSQL. | Verificar suites sobre el commit remoto. E2E usa Chromium, Graph/Power BI controlados; no certifica dispositivos físicos, Firefox/WebKit ni proveedores externos reales. |
| 09 · DTOs/Resources | Contratos explícitos de bibliotecas, capacidades y metadatos; [adaptadores](ADAPTADORES_PUBLICACIONES_FASE2.md) y [coordinación de vistas](COORDINACION_VISTAS_FASE3.md). | No se afirma que cada endpoint heredado de Barómetro/analítica esté convertido. Conservar contratos y pruebas durante su trabajo posterior. |
| 10 · Sesión/interceptor | Cookies/CSRF, aislamiento de origen API, revocación/estado de cuenta y cierre entre pestañas comprobados; E2E conserva CSRF de producción. | Validar cookies/proxy/dominios definitivos en el host acordado. No confundir cuentas o datos de ensayo con producción. |
| 11 · Cabeceras/SPA/visores | Controles de cabeceras/PWA, servidor portable y visor real. Worker `.mjs` con MIME JavaScript; `nosniff`/CSP conservados. | Revalidar respuesta del artefacto publicado y proxy TLS después de una integración autorizada. No desactivar controles para arreglar un visor. |
| 12 · Dependencias | npm único, locks, parches dirigidos, `install`/Bun retirados y auditorías obligatorias. El 10 de noviembre se retiró ECharts; el 11 se revisaron e integraron las primeras diez propuestas de Dependabot con auditorías sin avisos. [Detalle](MANTENIMIENTO_DEPENDENCIAS_20261111.md). | Dependabot está activo y propone cambios a `pruebas-rediseno`; exige revisión y CI antes de integrar, sin auto-merge. Mantener la política de auditorías y requisitos de plataforma. La aceptación de DIIT es independiente. |
| 13 · Telemetría | [Observabilidad](OBSERVABILIDAD_FASE5.md): SDK manual, logs JSON con esquema positivo, correlación, SQL/MongoDB/Microsoft, límites y redacción verificados en runtime sintético. | Sin Collector/OTLP remoto ni alertas activadas. Logs nativos/históricos/hosting no están certificados como redactados; retención y aceptación institucional pendientes. |
| 14 · Configuración/permisos | Ensayo con UID no root, filesystem de runtime de solo lectura, almacenamiento privado, cachés explícitas, requisitos PHP y esquema como tarea separada. [Manual](MANUAL_TECNICO_OPERACION.md). | El runtime hospedado heredado mantiene diferencias documentadas, incluida instalación que ignora requisitos de plataforma. No dar por homologada su sustitución, permisos o estrategia multi-host. |
| 15 · Higiene | Escáner sin nuevas supresiones amplias, contextos Docker sintéticos verificados y exclusión de env/dumps/trazas/archivos locales. Evidencia privada fuera del repositorio. | El resultado del rango nuevo no es una auditoría universal del historial. Mantener restricciones al preparar cualquier paquete institucional. |

## Brechas que no deben ocultarse al integrar

1. **Mantenimiento continuo.** El análisis gráfico antiguo y su excepción se retiraron el 10 de noviembre. Dependabot ya está activo; sus primeras diez propuestas se revisaron el 11. Mantener revisión humana, auditorías y pruebas de la combinación antes de integrar.
2. **Alcance de arquitectura/análisis.** Las dos dependencias de presentación se retiran el 12 de noviembre; el control AST exige cero excepciones. PHPStan sigue en nivel 5 sobre el alcance declarado, no toda la aplicación. Aplicación todavía utiliza Laravel/Eloquent; `no-explicit-any` y unused symbols del frontend siguen diferidos.
3. **Alojamiento y operación institucionales.** Confirmar topología, persistencia, recuperación, RPO/RTO, acceso/retención de logs, alertas y eventual Collector; ensayar la entrega en ese entorno. El manual no inventa valores ni aceptación.
4. **Proveedores reales y publicación.** Correo/OAuth, permisos Microsoft, almacenamiento remoto, dominios/cookies y disponibilidad Power BI requieren pruebas autorizadas en el entorno definitivo. Las pruebas de escritura actuales son sintéticas y aisladas.

## Puerta de integración

El primer CI del PR identificó dos problemas de ejecución que no deben confundirse con omisiones aceptadas: el setter de API rechazaba aplicar de nuevo el mismo origen después del build SPA, y la referencia de `setup-php` era el objeto de etiqueta anotada en vez del commit. Se añadieron pruebas de doble ejecución y se conserva exactamente la versión 2.40.0 de PHP setup, fijada al commit verificado de esa etiqueta. No se retiraron trabajos ni se debilitaron sus condiciones para aprobarlos.

Antes de publicar, registrar para el **mismo commit**:

- `Resultado` verde con Secretos, Higiene, Backend y Frontend; el check no se elude ni se debilita para aprobar un fallo.
- SQLite y PostgreSQL, lint/PHPStan, auditorías, build/cabeceras y E2E completos según el workflow. Verificar los motivos de las omisiones previstas.
- Revisión del diff y de las brechas anteriores. Las excepciones técnicas documentadas no se convierten automáticamente en aceptación de DIIT.
- Estado actual de la base del PR, respaldo/recuperación y plan de publicación/reversión. Esta entrega no migra datos; tampoco autoriza borrar datos antiguos.
- Después de una integración autorizada: comprobar los commits efectivos de frontend/backend, salud, cabeceras, sesión y lecturas de bibliotecas/archivos. No usar producción como fixture de escritura.

El bloque original del 9 de noviembre no cambiaba `main` ni `deploy-gratis` ni configuraba hosting. Las integraciones posteriores se registran por separado y conservan `main` para el alojamiento futuro. Registrar enlaces y resultados de CI y publicación de cada revisión; no se autoriza una fusión automática por la sola existencia de esta matriz.
