# Fase 3: cierre del alcance técnico editorial

Fecha: 30 de octubre de 2026, America/Guayaquil.

Este cierre se refiere al alcance editorial activo del plan de subsanación.
No sustituye la reevaluación institucional de DIIT ni amplía el alcance al
rediseño de Barómetro, aplazado expresamente por el usuario.

## Trazabilidad del trabajo

| Requisito de la fase | Implementación y evidencia reproducible |
|---|---|
| Centralizar acceso y transiciones | `ObservatorioPublicacionPolicy`, `PublicationReviewWorkflow`, `PublicationReviewDecision`; suites de capacidades, revisión y compatibilidad antigua. |
| Capacidades explícitas por recurso | Recursos de gestión y contexto de accesos; `can_view`, `can_edit`, `can_delete`, `can_review` y capacidades de asignación/revocación según el recurso. |
| Backend como autoridad | Policies/casos de uso consultan permisos actuales y vuelven a autorizar escrituras bloqueadas. Pruebas de accesos cruzados, revocaciones, capacidades ausentes y payloads manipulados. |
| Conservar roles y rechazo | Administrador global; Supervisor delegado; Editor en su alcance y sin modificar rechazados; Suscriptor/Usuario sin gestión. Casos HTTP en SQLite/PostgreSQL y regresiones del cliente. |
| Separar archivos e importaciones | `PublicationPdfStorage` y `SharePointPublicationImporter`; transacciones, duplicados, temporales y limpieza compensatoria comprobados. |
| Separar estado/coordinación de vistas extensas | `ObservatoryWorkspaceFacade`, `PublicationEditorFacade`, `PublicationDestinationFacade`, `AtlasDestinationFacade`, `PermissionsWorkspaceFacade`, todas provistas por pantalla. Componentes conservan presentación, navegación, diálogos y visor. |
| Agregaciones de negocio en servidor | Bibliotecas y revisión consumen páginas/totales SQL de la API. Se conservan las 20 publicaciones por página; filtros visuales, pestañas y etiquetas permanecen en el cliente. |

Los detalles están en `PERMISOS_PUBLICACIONES_FASE3.md`,
`ARCHIVOS_SHAREPOINT_FASE3.md`, `ASIGNACIONES_OBSERVATORIOS_FASE3.md` y
`COORDINACION_VISTAS_FASE3.md`.

## Verificación de la última entrega

La regresión Angular reúne 528 pruebas en 58 archivos al preparar esta entrega.
Incluye recorridos de controles reales de formulario, visor, rechazo/motivo,
suscriptores, permisos y paginación, además de aislamiento y peticiones tardías.
No equivale a una suite E2E completa de navegadores: esa ampliación corresponde
a la fase 5.

Antes de integrar se requieren todos los checks del PR: secretos, higiene,
backend SQLite/PostgreSQL, frontend y resultado. Tras integrar se comprueban
la publicación de Vercel, los módulos entregados y las bibliotecas/seguridad por
lecturas HTTP. Las evidencias de ejecución se registran en los avances privados
y las ejecuciones de CI vinculadas a los commits de entrega.

La última entrega no cambia contratos API, esquema, variables, dependencias,
archivos almacenados, plantillas o estilos. Sus pruebas de escritura usan dobles
locales y bases desechables de CI, sin escrituras de prueba en producción.

## Alcance conservado y continuación

- Las rutas/modelos legados se mantienen como compatibilidad documentada en la
  fase 2. Esta separación no ejecuta bajas de tablas ni conversiones en lote.
- Dataset/Barómetro y analítica conservan sus contratos; su rediseño funcional
  continúa aplazado. No se declara extraída toda vista histórica o cada diálogo
  pequeño de la aplicación.
- Las capacidades recibidas orientan la interfaz; no autorizan una operación
  futura. Las comprobaciones backend siguen siendo obligatorias.
- Cancelar una suscripción evita aplicar una respuesta a una pantalla destruida;
  no garantiza revertir una operación ya recibida por el servidor.

Con esta integración termina la separación editorial prevista en la fase 3.
La fase 4 prepara contenedores y alojamiento institucional: primero confirmar
el host, persistencia, dominio/proxy y modo SPA/SSR. Lint/límites de arquitectura,
cobertura ampliada, observabilidad y manual completo continúan en la fase 5.
