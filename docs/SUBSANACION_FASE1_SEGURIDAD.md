# Fase 1 — permisos, sesión e inventario de credenciales

Fecha: 29 de octubre de 2026 (America/Guayaquil).
Base de trabajo: `pruebas-rediseno`, commit `5d5fd835eadee64c33c4f60e1fa84fcb9a431c66`.
Rama: `subsanacion-seguridad-fase1`.

## Cambios de esta entrega

La lectura de publicaciones en contexto de gestión ahora exige permisos vigentes. Un parámetro de URL no concede permisos y ser el autor no sustituye una asignación de Editor activa. El mismo criterio se usa al generar enlaces de descarga y al autorizar su lectura.

- Editor: conserva acceso de gestión a sus artículos, reportes y libros únicamente en observatorios donde mantiene asignación de edición. Una publicación rechazada sigue disponible en consulta para su propietario autorizado y permanece sin edición/eliminación.
- Supervisor: el permiso `puede_revisar` controla el acceso al contenido pendiente o privado por gestión. Si se desactiva, quedan disponibles las publicaciones publicadas que le corresponden por lectura ordinaria; no puede eludir la restricción mediante `context=management`. El permiso independiente para agregar editores se conserva.
- Un observatorio eliminado lógicamente, o una publicación ordinaria sin observatorio, no se convierte en una descarga global. Administración mantiene el acceso de recuperación. Atlas global conserva sus reglas de categoría/estado y Administración.
- Las cuentas desactivadas ya no pueden continuar operando con cookies o tokens anteriores. Se devuelve 401 y se invalida la sesión de navegador presente. Las solicitudes públicas anónimas siguen funcionando.
- Se verifica también que una cookie válida antes de cambiar la contraseña recibe 401 al reutilizarla después de la rotación. La comprobación usa el driver de cookies de producción y el middleware de Sanctum existente.
- Se retira el registro temporal de usuario/rol/ruta de `CheckRole` y se elimina la escritura para todos (`777`) de storage/cache en el Dockerfile de desarrollo, usando `775`.

No hay migración de datos ni cambios de diseño. Los fixtures se ajustaron al estado de cuenta activa y a la regla de que ser antiguo propietario de Atlas no concede gestión a un Editor.

## Inventario histórico sin publicar valores

El control de CI sigue revisando archivos rastreados y el rango nuevo del PR, con los mismos controles de redacción y sin ampliar excepciones. Se añade una auditoría manual de todo el historial alcanzable desde las referencias locales, incluidos commits raíz. No incluye reflogs, objetos inalcanzables, clones ajenos ni forks.

`scripts/audit-secret-history.mjs` combina Gitleaks con un inventario conservador de candidatos de configuración/documentación de baja entropía. Este segundo inventario no demuestra por sí solo que una credencial sea real o esté vigente. Ambos devuelven únicamente archivo, commit, línea y regla; no valores, fragmentos de fuente ni hashes de contraseñas.

El escaneo utiliza la [configuración oficial de Gitleaks 8.30.1](https://github.com/gitleaks/gitleaks/blob/v8.30.1/config/gitleaks.toml). Los candidatos se clasifican de manera privada; los ejemplos explícitos no generan una excepción general para documentos o historial.

La revisión operativa de credenciales permanece **abierta** y se lleva en registros locales ignorados. Esos registros, exportaciones, nombres/correos de cuentas, contraseñas e información de acceso a proveedores no deben adjuntarse a un PR público. No se ha reescrito el historial ni cambiado credenciales de servicios por el hecho de encontrar una coincidencia.

Para repetir la auditoría manual desde una copia completa, con el binario verificado configurado en `GITLEAKS_BIN`:

```powershell
node scripts/audit-secret-history.mjs
```

Guarda metadatos en `storage/codex-local/phase1/secret-history-metadata.json` y termina con código 1 si hay hallazgos o candidatos que requieren clasificación. Esto es un resultado de inventario, separado del check de prevención de nuevas filtraciones en CI. No se debe usar una lista de exclusiones histórica para convertirlo automáticamente en verde.

## Evidencia de pruebas locales

| Control | Resultado |
|---|---|
| Nuevas regresiones antes de corregir | Reprodujeron acceso tras revocación, bypass sin revisión, descarga con padre eliminado y sesión/token de cuenta inactiva. |
| Backend SQLite | 279 casos, 2.258 aserciones; 8 omisiones que requieren PostgreSQL. |
| PostgreSQL/JSONB/aislamiento | 77 pruebas y 183 aserciones aprobadas. Hay solapamiento con la suite general; no sumar como casos únicos. |
| Frontend | 494 pruebas aprobadas en 53 archivos. |
| Escáner/higiene/workflow | 35 pruebas aprobadas, incluidos canarios históricos y candidatos eliminados de documentación. |
| Copia de aplicación restaurada | 121 comprobaciones HTTP, cinco roles y 26 PDF verificados por SHA-256, aprobados contra `localhost:8101`. |

La suite de aplicación restaurada utiliza cuentas sintéticas y configuración independiente. Las pruebas de escritura y regresión no usan producción. La revisión operativa autorizada de cuentas se realizó mediante una transacción SQL de solo lectura y comparación local de hashes; no se probaron inicios de sesión con contraseñas encontradas ni se modificaron cuentas.

## Estado de las observaciones aplicables

| Observación | Evidencia/tratamiento |
|---|---|
| NC-01, SQL JSONB | Regresiones PostgreSQL aprobadas; parámetros vinculados conservados. |
| NC-02, seed HTTP | `SeedRoutesDisabledTest` aprobado; no se introduce inicialización por HTTP. |
| NC-03, credenciales | Inventario ampliado y revisión operativa documentada de forma privada. Requiere tratamiento del responsable antes del cierre. |
| NC-05, autorización | Se corrigen límites de lectura y revocación. La centralización completa en Policies/capacidades sigue prevista en fase 3. |
| NC-10, sesión | Regresiones de cookies/CSRF y cuentas desactivadas aprobadas; el interceptor conserva restricción de origen/ruta de API. |
| NC-11, cabeceras/visores | Se conservan Helmet/CSP y los controles de origen del visor. CI verifica el build y las cabeceras/PWA del artefacto. |
| NC-14, configuración | Variables operativas se revisan sin publicarlas; sin `env()` en negocio/rutas/bootstrap. Se retira `777` del Dockerfile de desarrollo. |
| NC-15, higiene | Guardas y escaneo aprobados. No equivale a limpieza del historial o de copias ajenas. |

La fase 1 no se declara cerrada mientras siga pendiente el tratamiento de credenciales operativas. La actualización de contenedores completos, `--ignore-platform-reqs`, usuario de ejecución y migraciones de arranque se coordinan en la fase 4 con un build reproducible; esta entrega no presenta una nueva imagen Docker validada. Las restricciones de red, continuidad del servicio gratuito y recuperación productiva requieren su procedimiento operativo específico.
