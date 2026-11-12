# Expediente de subsanación para reevaluación

**Preparación de fase 6 · 12 de noviembre de 2026 · America/Guayaquil.**

Este documento organiza la evidencia del proyecto y los pendientes para una futura revisión por DIIT. No es acta de recepción ni certificación de cumplimiento total. No se ha enviado el expediente a DIIT. La [matriz actual](MATRIZ_CUMPLIMIENTO_20261112.md) contrasta literalmente las 15 NC del PDF y doce observaciones adicionales de los dos reportes.

## Resultado del cotejo

Hay **siete NC con evidencia técnica disponible (V)** y **ocho parciales (P)**. V propone reevaluación dentro del alcance descrito; P identifica una exigencia sin completar/aceptar. No se calcula avance global a partir de estas cantidades.

Las brechas más concretas son: purga histórica no ejecutada; tablas/modelos y servicios de compatibilidad conservados; tres controladores de datasets todavía sin Resources/DTOs; alcance arquitectónico/calidad aún parcial; vigencia de librerías de seis meses aún sin acreditar; IaC/alojamiento sin confirmar; observabilidad y custodia institucional incompletas. Las fuentes conservan su severidad original.

La siguiente implementación acotada recomendada es **NC-09: contratos y validaciones de CategoriaDataset, DatasetFuente y GraficoPredeterminado**, conservando sus consumidores y permisos. No requiere restaurar la interfaz gráfica retirada ni esperar el rediseño visual de Barómetro.

## Versión funcional examinada

| Elemento | Referencia |
|---|---|
| Producción | `pruebas-rediseno` · `6b7f5ea3f35e42f39ac0c8370379d1e3d090a371` |
| Main para alojamiento futuro | `f261478681f61bf7b75a5b5936e53ffc3d3df8ac` |
| Árbol de código idéntico en ambas | `966ebd9f5a5b180d80a7f043bdecb61da7eecbf2` |
| Versión antigua conservada | `deploy-gratis` · `931b0e8b42807121949a98966113eb1c7d218dd3` |
| Última entrega funcional | [PR #48](https://github.com/Criiscvz/Observatorio-Territorial/pull/48); sincronización [PR #49](https://github.com/Criiscvz/Observatorio-Territorial/pull/49) |
| Portal estable | [Observatorio Territorial](https://observatorio-territorial-dun.vercel.app) |
| API actual | [Render](https://observatorio-territorial-pruebas.onrender.com) |
| Evidencia de hosting del corte | Vercel Production `7746234218`, success; Render `dep-dbr0dcl9el5s73bp00e0`, Live, ambos en `6b7f5ea` |

El nombre del servicio Render incluye “pruebas”, pero sirve a la producción actual. Esta entrega documental se prepara en `expediente-cierre-fase6-20261112` desde la versión indicada. No cambia código ejecutable, esquema, variables, asignaciones, archivos almacenados o hosting.

## Evidencias de calidad vinculadas a la versión

| Ejecución | Resultado y alcance |
|---|---|
| [CI del PR #48 · 43279880456](https://github.com/Criiscvz/Observatorio-Territorial/actions/runs/43279880456) | Secretos, Higiene, Backend, Frontend y Resultado aprobados sobre el cambio revisado `e6f1098`. |
| [CI producción · 43281237320](https://github.com/Criiscvz/Observatorio-Territorial/actions/runs/43281237320) | Aprobada en `6b7f5ea`. |
| [CI del PR #49 · 43281256808](https://github.com/Criiscvz/Observatorio-Territorial/actions/runs/43281256808) | Aprobada antes de sincronizar main. |
| [CI main · 43282698098](https://github.com/Criiscvz/Observatorio-Territorial/actions/runs/43282698098) | Aprobada en `f261478`; estado reconfirmado durante este cotejo. |
| Backend | SQLite: 385 casos, 4.496 aserciones, ocho omisiones previstas para PostgreSQL. PostgreSQL 16: 177 casos, 2.358 aserciones. Son suites solapadas; no se suman. |
| Frontend | 529 pruebas/59 archivos, lint, siete pruebas de calidad, build y veinte controles de cabeceras/PWA. |
| Navegador | 16 E2E de escritorio/móvil en Chromium sin fallos, omisiones ni reintentos; servicios/bases de ensayo y proveedores controlados donde se indica. |
| Arquitectura/seguridad | AST sin excepciones de presentación; PHPStan nivel 5 en alcance explícito; auditorías npm/Composer sin avisos en esas ejecuciones; escaneo de archivos actuales y rango nuevo. |

No hay porcentaje de cobertura acreditado. Un check verde no certifica todo el historial Git, todo endpoint, navegadores físicos, credenciales de proveedores reales ni aceptación institucional. Las pruebas completas no se repitieron para esta modificación documental; se reutilizan sus ejecuciones identificadas y se cotejan las fuentes con el código.

El ruleset de producción exige PR y `Resultado` estricto, prohíbe force-push/borrado y no tiene bypass. Exige cero revisores aprobadores: la protección no equivale a doble firma humana.

## Estado de producción observado

El comprobante privado del 12 de noviembre registra **39 solicitudes automáticas posteriores al despliegue**, todas aprobadas, sin escrituras de contenido: catálogo/API/proxy, salud, sesión/CSRF, PDF, cabeceras, PWA y worker. Catálogo público: cuatro observatorios, 17 publicaciones (siete artículos, ocho reportes, dos libros), diez categorías y seis Atlas.

Dos PDF públicos conservaron el SHA-256 del respaldo; un PDF fuera del catálogo público fue rechazado anónimamente con 404. El worker PDF 6.5.438 coincide con el paquete revisado. Los conteos públicos no representan la totalidad de registros privados o restringidos.

La evidencia privada está bajo `storage/codex-local/release-20261112/`, con resumen `release-summary.json`. Logs, respaldos, datos personales y configuración no se adjuntan al repositorio público. Un revisor autorizado deberá recibir la evidencia por un canal acordado, con minimización y control de acceso.

## Respaldo y recuperación

La última copia productiva integral documentada corresponde al **9 de noviembre**, con restauración verificada después. No se etiqueta como respaldo recién realizado el 12.

| Componente | Evidencia del respaldo y restauración |
|---|---|
| PostgreSQL | Instantánea de solo lectura compartida con pg_dump; 31 tablas, 38 publicaciones nativas, cero filas antiguas y cero mapas; huellas iguales al restaurar en PostgreSQL 16 aislado. |
| Archivos | 25 PDF, 65.859.467 bytes, ninguna referencia ausente; copias y streams restaurados verificados por SHA-256. No están dentro del dump SQL. |
| MongoDB | Base configurada `observatorio_pruebas_rediseno`, cero documentos en ese corte; restauración y acceso comprobados. No confundirla con otra base existente del proveedor. |
| Configuración | Exportación protegida con DPAPI CurrentUser; recuperación/comparación verificadas. Depende del perfil Windows actual; no es una custodia institucional portable. |
| Privacidad operativa | Copias con ACL privadas; entrada temporal de IP retirada después del respaldo. No se publican credenciales, dumps ni inventarios de personas/archivos. |

**Pendiente:** destino fuera de esta computadora, cifrado integral y llaves recuperables, custodios, calendario/retención y medición de RPO/RTO. Un SHA correcto o una restauración aislada no demuestran por sí solos continuidad de producción. Antes de otra migración, renovar/conciliar las copias según cambios y antigüedad; no reutilizar automáticamente el corte del 9.

Procedimiento versionado: [manual técnico de operación](MANUAL_TECNICO_OPERACION.md) y [ensayo portable](ENSAYO_PORTABLE_FASE4.md). Los comprobantes privados históricos son `output/PREPUBLICACION_PR33_20261109.md` y `output/PUBLICACION_FASES4_5_20261109.md`; no se requiere distribuirlos completos para sustentar esta síntesis.

## Despliegue y reversión

1. Cada implementación parte de `pruebas-rediseno` en rama separada. Revisar diff, contratos, datos afectados y CI del mismo head; no usar fixtures de escritura productivos.
2. Antes de integrar una migración: inventario/backup actual, restauración ensayada, SQL revisado y compatibilidad de la versión anterior. El expediente actual no contiene migraciones.
3. Integrar por PR con el control obligatorio; comprobar SHA efectivo y salud en frontend/backend. Conservar los artefactos previos y su configuración protegida.
4. Ante regresión atribuible al código, recuperar artefacto compatible y preparar PR de reversión con CI. No aplicar `migrate:rollback`, restaurar bases ni revocar permisos del proveedor automáticamente.
5. Para datos/esquema, usar un plan específico conciliado y autorizado. No “revertir” la rotación de secretos o el permiso correcto de la aplicación como si fueran cambios de código.
6. Sincronizar `main` tras validar una futura entrega, conservando el ensayo portable. La ficha técnica institucional definirá la adaptación final; este expediente no mueve ramas conectadas a servicios.

## Correspondencia con el plan de fases

| Plan interno | Situación al corte |
|---|---|
| 0 · Inventario y línea base | Registrada; usar commits/evidencias del corte actual. |
| 1 · Seguridad inmediata | Alcance técnico examinado implementado; purga histórica literal aún pendiente en NC-03/15. |
| 2 · Datos y contratos | Bibliotecas unificadas y paginadas; retiro físico de compatibilidad y los tres DTOs citados siguen pendientes. |
| 3 · Arquitectura y permisos | Alcance editorial implementado; no constituye homologación integral de módulos históricos. |
| 4 · Alojamiento portable | Ensayo local comprobado; host/IaC y homologación institucional abiertos. |
| 5 · Calidad, dependencias y operación | Bloques implementados y CI aprobada; análisis/cobertura, observabilidad/custodia y pruebas externas conservan límites explícitos. |
| 6 · Expediente y reevaluación | Matriz y expediente preparados. Criterio de salida aún no cumplido: requisitos parciales y aceptación DIIT pendientes. |

El PDF original organiza el trabajo en **tres etapas institucionales**; los dos reportes Markdown usan sus propias cuatro fases. Nuestro plan 0–6 descompone esos requisitos, no reemplaza sus condiciones. El PDF menciona 10/15/15 días laborables; sin constancia de fecha de recepción e interpretación de DIIT no se afirma cumplimiento ni vencimiento de esos plazos.

## Decisiones y documentación por completar

- **Proyecto:** NC-09/A-02 primero; después política de contraseña, calidad/medición y alcance de módulos conservados. Registrar resultado de cada bloque sin cambiar el sentido de los requisitos.
- **Responsable del repositorio y DIIT:** tratamiento de historia y compatibilidad (NC-03/04/15), con evidencia o excepción explícita. Ningún DROP o force-push queda autorizado por esta lista.
- **DIIT/operador:** ficha técnica del host; dominio/TLS/proxy, red y motores, almacenamiento, secretos, IaC y ejecución única de migraciones; sink/logs/alertas, custodios y RPO/RTO.
- **Proyecto/operador:** pruebas autorizadas de correo/OAuth/Microsoft/storage y dispositivos/navegadores sobre la topología definitiva; no atribuir a dobles de CI una integración externa real.
- **Recepción:** actualizar matriz a la versión presentada, compartir evidencias saneadas por canal autorizado y obtener acta de reevaluación/condiciones de DIIT. Este expediente no se envía automáticamente.

## Índice de evidencia versionada

1. [Matriz actual y fuentes con SHA-256](MATRIZ_CUMPLIMIENTO_20261112.md).
2. [Cierre técnico de fase 1 y tratamiento de historial](CIERRE_FASE1_20261029.md).
3. [Adaptadores de publicaciones](ADAPTADORES_PUBLICACIONES_FASE2.md) y [bibliotecas paginadas](BIBLIOTECAS_PAGINADAS_FASE2.md).
4. [Cierre editorial de fase 3](CIERRE_TECNICO_FASE3.md) y [coordinación de vistas](COORDINACION_VISTAS_FASE3.md).
5. [Ensayo portable](ENSAYO_PORTABLE_FASE4.md), [calidad](CALIDAD_CI_FASE5.md), [observabilidad](OBSERVABILIDAD_FASE5.md) y [manual](MANUAL_TECNICO_OPERACION.md).
6. [Retiro de gráficos antiguos](RETIRO_ANALISIS_GRAFICO_20261110.md), [mantenimiento de dependencias](MANTENIMIENTO_DEPENDENCIAS_20261111.md) y [cierre de las dos excepciones](CIERRE_EXCEPCIONES_ARQUITECTURA_20261112.md).

Los originales del usuario permanecen privados y sus huellas están en la matriz. No se reproducen contraseñas históricas, configuraciones reales ni firmas de los auditores.
