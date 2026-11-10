# Cierre técnico de fase 1: seguridad residual y credenciales

Fecha: 29 de octubre de 2026, America/Guayaquil.
Versión funcional verificada: `pruebas-rediseno`, commit `3b7fbf526740e8151233fb755ef5b1e2734cfdff`, integrado mediante el [PR #15](https://github.com/Criiscvz/Observatorio-Territorial/pull/15).
Rama del cierre documental y de configuración local: `subsanacion-cierre-fase1`.

## Resultado y alcance

Se completa el alcance técnico de fase 1 del plan: controles de acceso actuales, sesión/CSRF, archivos y visores, configuración examinada, prevención de nuevas filtraciones e inventario y tratamiento de los hallazgos históricos identificados. La aceptación institucional corresponde a DIIT; este documento no cierra automáticamente las observaciones de arquitectura ni certifica ausencia de vulnerabilidades.

La verificación funcional se hizo en una aplicación restaurada independiente. En la producción actual solo se hicieron comprobaciones HTTP de lectura y la consulta autorizada de cuentas en una transacción SQL de solo lectura con TLS verificado. El cambio de contraseñas de esas cuentas lo efectuó el responsable desde la interfaz. No se hicieron logins contra producción con valores recuperados del historial.

## Matriz de cumplimiento del alcance

| Control | Evidencia y resultado | Límite o seguimiento |
|---|---|---|
| NC-01: SQL JSONB | Parámetros vinculados conservados; suite PostgreSQL aprobada. | Mantener las regresiones al consolidar datos. |
| NC-02: inicialización | Prueba de ausencia de seed HTTP aprobada. | Inicialización por CLI; sin crear rutas de administración remota. |
| NC-03: credenciales actuales | Contraseñas afectadas renovadas por el responsable. Comparación posterior sin coincidencias con los candidatos históricos examinados. Configuración de los dos servicios Render examinada de forma privada. | La comparación no demuestra que cualquier contraseña posible sea robusta ni cubre servicios externos ajenos al inventario. |
| NC-03: MongoDB local | Copia del volumen detenido respaldada/restaurada. Rotación ensayada antes de aplicarla. Contraseña anterior rechazada; nueva aceptada por mongosh y el driver PHP. Configuración local actualizada. | El respaldo anterior es privado; restaurarlo exige renovar nuevamente la credencial antes de habilitar acceso. |
| NC-03/15: historial | Inventario de referencias locales alcanzables y clasificación privada. Sin coincidencias restantes entre los candidatos examinados y la configuración local. | Se conservan ejemplos históricos. No se inspeccionaron reflogs, objetos inalcanzables, forks o clones ajenos. |
| NC-05: permisos inmediatos | Revocación de asignación de Editor y del permiso de revisión de Supervisor efectiva también en descargas/listados; padre eliminado no concede acceso global. | Centralización completa en Policies/capacidades prevista en fase 3. |
| NC-10: sesión e interceptor | Cookies/CSRF y restricción de origen/ruta de API verificadas. Cuentas desactivadas bloqueadas con cookie/token anterior; cookie anterior al cambio de contraseña rechazada. | Conservar las pruebas de regresión al modificar autenticación. |
| NC-11: cabeceras y visores | Pruebas de frontend, cabeceras/PWA del artefacto y controles PDF/Power BI aprobadas; cabeceras presentes en las páginas publicadas verificadas. | Revalidar SPA/SSR, proxy y cabeceras del alojamiento institucional en fase 4. |
| NC-14: configuración local | Sin `env()` en negocio/rutas/bootstrap examinados; retiro de `777` del Dockerfile de desarrollo. MongoDB local solo publica en loopback. | Usuario efectivo, extensiones, imagen completa y permisos de runtime se validan en fase 4. |
| NC-15: higiene | Git/build excluyen secretos y evidencias privadas; CI conserva escaneo de archivos actuales y rango nuevo, con canarios de detección/redacción. | Sin baseline histórica ni exclusiones generales de documentos o tests. |

## Evidencia reproducible

| Verificación | Resultado registrado |
|---|---|
| Backend SQLite | 279 casos, 2.258 aserciones; ocho omisiones correspondientes a PostgreSQL. |
| PostgreSQL/JSONB/aislamiento | 77 pruebas, 183 aserciones aprobadas; subconjunto solapado, no sumar como casos únicos. |
| Frontend | 494 pruebas aprobadas en 53 archivos. |
| Escáner, higiene y workflow | 36 pruebas aprobadas, incluidos canarios de historial y rechazo de errores de lectura de Git. |
| Aplicación restaurada | 121 comprobaciones HTTP con cinco roles; 26 PDF conciliados por SHA-256. |
| CI del PR funcional y su integración | [Run del PR](https://github.com/Criiscvz/Observatorio-Territorial/actions/runs/40913443907) y [run de integración](https://github.com/Criiscvz/Observatorio-Territorial/actions/runs/40913735163), aprobados. |
| Producción | Vercel Ready/Production y Render Live en el commit indicado; 16 comprobaciones HTTP de lectura aprobadas. |
| Cierre local | Respaldo/restauración y rotación MongoDB comprobados, incluido driver PHP; Compose validado sin iniciar servicios mediante configuración sintética. |

Las cantidades anteriores describen sus ejecuciones concretas, no un porcentaje de cobertura. Los logs, inventarios operativos y datos de las cuentas permanecen en almacenamiento local ignorado; no forman parte del repositorio público. Las exportaciones de configuración usadas para el examen y el estado temporal de contraseñas se eliminaron.

## Decisión sobre el historial compartido

Se conserva el historial compartido y se documenta el tratamiento de los hallazgos identificados. La revocación/rotación es la medida que invalida una credencial; eliminar una línea de Git no revoca copias ya obtenidas. No se atribuye a un resultado verde del escáner una certificación de todo el historial.

El inventario conservador de contraseñas de ejemplo sigue devolviendo candidatos históricos y requiere clasificación, por lo que su código de salida 1 es esperado en ese caso. No se añade una baseline ni se ocultan esos candidatos para convertir la auditoría en verde. CI sigue rechazando filtraciones nuevas en archivos rastreados y commits nuevos. El wrapper también rechaza diagnósticos de error de Gitleaks aunque este devuelva código 0: una lectura fallida de Git no equivale a un historial sin hallazgos. La regresión reprodujo ese falso resultado antes de corregirlo.

Para repetir el inventario desde un clon completo, con el binario de Gitleaks verificado configurado en `GITLEAKS_BIN`:

```powershell
node scripts/audit-secret-history.mjs
```

Si DIIT exige retirar físicamente determinados ejemplos del historial, se tramitará como una operación coordinada independiente: identificar archivos/commits sin publicar valores; detener integraciones; conservar un respaldo privado; ensayar la reescritura en un clon separado; verificar tags, ramas alojadas y reglas de protección; aprobar la sustitución de referencias y coordinar nuevos clones. No ejecutar `push --force` sobre ramas alojadas como parte de una limpieza rutinaria. Reescribir no elimina copias externas.

## Uso de la configuración local

La plantilla mantiene vacíos `MONGODB_URI` y `MONGODB_ROOT_PASSWORD`. Sus valores locales se suministran en `backend/.env`, excluido de Git y del build. No copiar credenciales de producción a la configuración de ensayo.

La configuración Compose puede seleccionarse explícitamente:

```powershell
docker compose --env-file backend/.env up -d mongodb
```

La operación requiere también las variables obligatorias del archivo Compose. Cambiar una variable de inicialización no cambia por sí solo la contraseña de un volumen existente. Para renovar una cuenta existente se utiliza el método de gestión de usuarios de [MongoDB 7](https://www.mongodb.com/docs/v7.0/reference/method/db.changeuserpassword/) y se comprueba el rechazo de la credencial anterior.

El mantenimiento de esta entrega usó conexiones dentro de un contenedor sin red externa, conservó el volumen de datos y dejó el servicio detenido como estaba inicialmente. Los consumidores existentes en contenedores detenidos deben recrearse desde la configuración actual al volver a iniciar el entorno; no reutilizar una configuración congelada anterior a la rotación.

## Seguimiento que permanece fuera de este cierre

| Trabajo | Fase o momento | Responsable y aceptación esperada |
|---|---|---|
| Consolidar publicaciones, Resources y contratos; conciliar datos/archivos antes de retirar modelos antiguos. | Fase 2. | Implementación y revisión del proyecto; respaldo productivo reciente y ensayo antes de migrar. |
| Policies, capacidades y separación de responsabilidades. | Fase 3. | Implementación y revisión del proyecto; pruebas de permisos y estados. |
| Build completo, usuario efectivo, extensiones, eliminación de instalación que ignora requisitos, almacenamiento y migraciones de arranque. | Fase 4. | Proyecto y DIIT, según características del host. |
| Cobertura de dominio/E2E, dependencias, telemetría y manual. | Fase 5. | Proyecto; evidencia y revisión institucional. |
| Restricción de acceso externo a la base, acceso administrativo de respaldo y continuidad del servicio actual. | Seguimiento operativo inmediato; no esperar al host institucional. | Responsable de infraestructura: coordinar reglas sin cortar acceso y verificar restauración productiva. La fecha de vencimiento comunicada por el proveedor se conserva en el informe privado. |
| Aceptación de requisitos, host y cómputo de plazos. | Coordinación institucional. | DIIT y responsable del proyecto; no se presupone su aprobación. |

La fase 2 puede prepararse con inventario y contratos sobre el ensayo aislado. Este cierre no autoriza una migración destructiva de producción sin respaldo y verificación propios de esa entrega.
