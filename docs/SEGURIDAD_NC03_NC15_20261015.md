# NC-03 y NC-15: clasificación de ejemplos e higiene del repositorio

Fecha: 15/10/2026. Rama local: `seguridad-secretos-higiene` (sin prefijo `codex/`).
Base: `deploy-gratis`, commit `3d81992320046c7c583f23063c6a437f99341ed1`, posterior a la integración y publicación del PR #10.

## Estado y límites

| Control | Resultado de este cambio | Límite |
| --- | --- | --- |
| NC-03, valores históricos | Se retiran contraseñas compartidas y URI con contraseña de los documentos revisados. La comprobación privada posterior encontró coincidencias en contraseñas de cuentas activas de producción y locales. | NC-03 permanece abierto: no se cambiaron contraseñas ni se revocaron sesiones. Los identificadores y la evidencia detallada se mantienen privados. |
| NC-15, artefactos actuales | Cinco archivos se retiran del índice de Git y se añaden exclusiones específicas. Sus copias locales se conservan, con bytes idénticos. | No se purga el historial ni se eliminan archivos del equipo del responsable. No se afirma cierre institucional. |
| NC-01 y NC-14 | La base de este trabajo ya contiene las correcciones del PR #10 publicadas y verificadas en Render/Vercel. | Esta limpieza no ejecuta usuarios iniciales, migraciones ni nuevas pruebas de datos en producción. |

Este anexo registra las verificaciones locales previas al commit y al PR. Publicar esos cambios para revisión no implica una fusión, un despliegue de producción, rotación de claves, cambio de accesos o reescritura de Git. La matriz PDF anterior conserva su corte histórico; este documento es un anexo posterior, no una alteración retroactiva de sus conteos.

## NC-03: documentación y clasificación

Se revisan los candidatos del inventario privado previo sin reproducir sus valores:

- `docs/SDD-Integracion-MongoDB.md`: URI vacía que debe completarse en el entorno protegido; el ejemplo Compose exige `MONGODB_ROOT_PASSWORD` y deja de incluir una clave literal.
- `docs/SISTEMA.md`: los accesos de ejemplo pasan a describir las variables de usuarios iniciales, sin cuentas/contraseñas listas para copiar.
- `docs/comandos.md`: se elimina la contraseña predeterminada y la URI con contraseña; se documenta la solicitud interactiva de clave del PostgreSQL local. Se advierte que cambiar una variable no actualiza la clave de un volumen existente y que no debe borrarse el volumen como solución.
- `docs/DEPLOY_GRATIS.md`: seis valores sensibles quedan vacíos para completarlos en el panel protegido. Se distingue la generación de `APP_KEY` para una instalación nueva de la conservación de la clave existente.
- `backend/.env.example` ya deja vacíos o `null` los campos sensibles examinados; no se rellenó con valores reales. La limpieza y sus regresiones no leen `.env`; la comparación privada autorizada posterior se describe por separado a continuación.

El responsable respondió inicialmente el 15/10/2026 que los valores solo eran ejemplos o pruebas y después autorizó compararlos privadamente con la configuración real y revisar las cuentas sin intentar iniciar sesión. Esa verificación posterior **impide mantener la clasificación de «solo ejemplos sin uso»**:

- La comprobación de cuentas confirmó reutilización de valores históricos en entornos reales. Sus cantidades, roles e identificadores se mantienen exclusivamente en la evidencia privada mientras la remediación está pendiente. Se confirmó que la rama y base de Neon corresponden a Render antes de consultar. Las transacciones fueron de solo lectura y terminaron en `ROLLBACK`; las comparaciones bcrypt se realizaron en memoria, sin enviar los candidatos en las consultas ni mostrar hashes.
- La configuración local también contiene una coincidencia documental; no se comprobó mediante autenticación que sea la contraseña efectiva del volumen persistente.
- Las contraseñas de conexión de PostgreSQL y MongoDB configuradas en Render no coinciden con los tres candidatos. Esto no certifica su seguridad general, ausencia de exposición ni validez de otros secretos.

No se publican contraseñas, hashes, conexiones, correos ni identificadores de cuentas en este anexo. La igualdad de contraseña no demuestra por sí sola la fecha o método de creación de la cuenta ni un acceso indebido. No se hicieron intentos de login con los valores históricos, cambios de configuración, seeds, migraciones ni mutaciones de cuentas. La remediación de cuentas queda fuera del alcance de esta limpieza y sigue pendiente; **NC-03 permanece abierto** y esta limpieza no sustituye el restablecimiento de las contraseñas afectadas, la revocación de sesiones/tokens ni la revisión de accesos.

Se conserva el inventario histórico previo: 2.354 blobs candidatos, 68 omisiones y 506 coincidencias de reglas (no 506 secretos distintos). No se repitió ese escaneo histórico ni se presenta como exhaustivo. Se repite únicamente la revisión heurística del índice actual más los archivos nuevos no ignorados, con una corrección de la regla de asignaciones para que un valor vacío no consuma la siguiente línea.

Resultado registrado antes de añadir este anexo: 29 coincidencias, clasificadas como 13 contextos de prueba, una URI con marcadores de plantilla, un marcador documental, dos casts de modelo, cuatro referencias a variables de entorno y ocho etiquetas de traducción. No hubo coincidencias en los cuatro documentos limpiados ni candidatos de revisión manual en ese resultado. Quince archivos binarios o mayores de 2 MiB se omitieron. Es un corte anterior, no un conteo del diff final. Los conteos históricos y de ese corte no se comparan como una reducción exacta porque se corrigió una regla. No se encontraron formatos de claves privadas/tokens de los proveedores incluidos en las reglas, lo cual no demuestra ausencia general de secretos ni invalida las coincidencias de contraseñas confirmadas después.

El inventario conserva solo metadatos de ruta, línea, regla y contexto en almacenamiento privado ignorado. La revisión privada de cuentas conserva únicamente resultados acotados, sin contraseñas ni hashes. No se publican valores ni líneas originales; los identificadores internos de las cuentas afectadas permanecen fuera del diff. Las contraseñas sintéticas de fixtures siguen siendo necesarias para las regresiones y no se sustituyen por claves reales.

## NC-15: exclusiones y recuperación

Se retiran únicamente del índice de Git:

| Archivo | Motivo | Copia local |
| --- | --- | --- |
| `backend/toArray())` | Artefacto accidental no referenciado como archivo ejecutable. | Conservada, 695 bytes. |
| `backend/_ide_helper_models.php` | Ayuda generada para el IDE, fuera del autoload de aplicación. | Conservada, 273 bytes. |
| `backend/.phpstorm.meta.php` | Metadatos generados del IDE con rutas locales, no código de negocio. | Conservada, 223.066 bytes. |
| `backend/Dockerfile.devpatch` | Parche local sin referencias de uso en la configuración versionada. | Conservada, 194 bytes. |
| `frontend/src/app/features/datasets/dataset-view/dataset-view.component.ts.bak` | Copia de respaldo sin referencias; `tsconfig.app.json` incluye `src/**/*.ts`, no `.ts.bak`, y los inputs de assets no incluyen esta carpeta. Se conserva el componente `.ts` activo. | Conservada, 74.257 bytes. |

La búsqueda de referencias distingue los nombres de archivo de llamadas normales a `toArray()`; esas llamadas no se modificaron. Composer usa autoload PSR-4 y no registra los archivos retirados como entradas ejecutables. Los manifiestos backend de Vite/Tailwind se conservan porque todavía tienen scripts/consumidores declarados: no se eliminan solo por parecer scaffolding.

Se añade `.gitignore` raíz para worktrees, informes/salidas temporales, archivos de entorno, autenticación de Composer, formatos de claves, logs y copias `.bak`. Se conservan las excepciones explícitas para `.env.example` y `.env.*.example`, que deben contener solo plantillas. El ignore de backend excluye los cuatro artefactos backend y las demás variantes locales de `.env`; la regla raíz protege la copia de respaldo del frontend.

El contexto Docker excluye variantes de `.env` y `auth.json` a cualquier profundidad, archivos PEM/KEY/P12/PFX, logs, copias `.bak`, almacenamiento privado, cargas locales, directorios temporales de revisión y el artefacto accidental. La plantilla raíz `.env.example` sigue permitida; sus campos sensibles tienen una regresión específica. Las ayudas IDE y Dockerfiles temporales ya estaban excluidos.

Una prueba adicional usa el matcher real de Docker con una copia de `.dockerignore` y archivos exclusivamente ficticios. Comprueba tanto las exclusiones como la conservación de rutas necesarias de aplicación. El contexto real del backend, los `.env`, las cargas y los informes privados no se envían al constructor. Utiliza el socket local y el constructor `default` con driver `docker`, `FROM scratch`, `COPY`, sin `RUN`, sin descargar imágenes, sin ejecutar contenedores y sin publicar una imagen. Solo exporta archivos ficticios a un directorio temporal único que se elimina tras validarlo. No equivale a construir ni ensayar la imagen completa de producción.

Las reglas anidadas usan la sintaxis `**` de [Docker para archivos de exclusión](https://docs.docker.com/build/concepts/context/#dockerignore-files). El ensayo no reemplaza las revisiones de futuros nombres o formatos de secretos ni protege otros contextos de construcción diferentes al backend revisado.

Para recuperar versiones anteriores, consultar esos archivos en el commit base mediante Git, sin sustituir automáticamente una copia local existente. El historial sigue intacto. No se borraron volúmenes, bases, uploads, documentación local del checkout principal ni ramas.

## Verificación reproducible

Desde la raíz de esta rama:

```powershell
node --test scripts/test-repository-hygiene.mjs
node scripts/test-docker-context-hygiene.mjs
.\scripts\test-backend-security.ps1
git diff --check
git diff --cached --check
```

Desde `frontend`:

```powershell
npm test -- --watch=false
npm run build
```

- Higiene: 13 pruebas aprobadas, ninguna omitida. Comprueban el índice, reglas reales de ignore, excepciones de plantillas, exclusiones esperadas de Docker, cuatro documentos, configuración sensible vacía/null y que el detector no devuelva valores.
- Contexto Docker: ensayo final aprobado, con 31 rutas ficticias excluidas y 11 rutas necesarias conservadas. Antes de corregir las reglas, el ensayo inicial reprodujo 12 exclusiones ausentes. Motor local 29.5.3, sin leer el contexto real ni crear una imagen de aplicación.
- Backend SQLite aislado: 188 casos, 180 aprobados, ocho omitidos por requerir PostgreSQL; 1.106 aserciones.
- PostgreSQL 16 aislado y validación de columnas/aislamiento: 77 pruebas y 183 aserciones, todas aprobadas. Las suites se solapan; no sumar sus totales.
- PHP 8.4.25 / PHPUnit 11.5.53. Se usan las imágenes ya existentes, sin descargas, `.env`, volúmenes del usuario ni red externa. Datos sintéticos y almacenamiento temporal.
- Frontend: 208 pruebas aprobadas en 26 archivos; `npm run build` completado sin errores. Conserva 10 advertencias de presupuesto de estilos en archivos SCSS no modificados por esta limpieza. No se ejecutó `build:vercel` ni se cambió la URL de API.
- Las suites anteriores se repitieron con estos cambios, sin fallos. Se verificaron el diff y las exclusiones después de añadir el respaldo del frontend. Las cinco copias locales son idénticas a sus blobs del commit base; no se modificaron ni eliminaron.

La prueba de higiene es una guarda específica de regresión del repositorio, no un escáner general de secretos ni un sustituto de reglas mantenidas por una herramienta especializada. No ejecuta peticiones, pruebas de contraseñas o escrituras de producción.

## Pendientes para el cierre

1. La revisión local y las comprobaciones del diff están completas. Publicar un PR con la misma rama sin prefijo cuando se autorice. No fusionar ni desplegar por el solo hecho de que estas pruebas locales pasen. La higiene del árbol actual no cierra NC-03.
2. Integrar un escáner mantenido en CI con salida redactada, permisos mínimos y tratamiento revisado de fixtures. Estas 13 pruebas aún no son una puerta obligatoria de GitHub ni cierran NC-06.
3. Remediar por separado las cuentas con coincidencias confirmadas y la configuración local, con autorización específica. Revisar omisiones y alcance histórico restante. No existe autorización ni necesidad acreditada para una purga indiscriminada; cualquier saneamiento del historial necesita respaldo, alcance y coordinación con colaboradores.
4. Acreditar por separado revocación de tokens históricos y restauración aislada de respaldos. No se ejecutaron en esta tarea.
5. Actualizar la matriz con un nuevo corte después de revisar/publicar la limpieza, conservando la versión anterior y sin confundir implementación local con cierre operativo o institucional.
