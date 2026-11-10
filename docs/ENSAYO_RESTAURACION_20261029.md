# Ensayo local de recuperación de aplicación — 29 de octubre de 2026

## Alcance y resultado

Se restauró una copia de la aplicación desde la base local `observatorio_copia_20261019`, incluyendo PostgreSQL y los PDF referenciados. No se accedió a la base productiva para preparar o probar este ensayo. La base local original permaneció detenida y su volumen se montó únicamente en lectura para preparar la copia.

| Verificación | Resultado |
|---|---|
| Esquema completo | 30 tablas, 264 columnas, 76 restricciones y 62 índices conciliados. |
| Datos | Cantidades y huellas del contenido de cada tabla iguales antes/después de `pg_restore`; secuencias conciliadas. |
| Publicaciones restauradas | 33 registros: 14 artículos, 11 reportes, 7 libros y 1 Atlas. Incluye registros en observatorios eliminados lógicamente; el total visible respeta los filtros de la aplicación. |
| PDF | 26 archivos referenciados; SHA-256 idéntico en el respaldo, volumen restaurado y respuesta HTTP. |
| Otros datos representativos | 12 categorías Atlas, 17 observatorios, 10 datasets, 77 variables y 51.120 registros analíticos. Estas cantidades pertenecen a la copia local y no se presentan como inventario productivo. |
| Migraciones | Las 47 migraciones ya estaban aplicadas; `migrate` sobre la copia preparatoria no encontró pendientes. |
| Uso de la aplicación | 121 comprobaciones HTTP aprobadas con Administrador, Supervisor, Editor, Suscriptor y Usuario. |
| Permisos | Rutas administrativas denegadas a otros roles, listas acotadas al observatorio/autor, sesión invalidada al salir, CSRF exigido y CORS del ensayo verificado. |
| Archivos restringidos | Tres PDF restringidos rechazan acceso anónimo. Los 26 PDF se leen correctamente con Administración. |
| Usuario PostgreSQL de la API | Rol independiente, sin superusuario, sin creación de bases ni roles. |

Las comprobaciones de alcance de esta ejecución son de lectura. Las transiciones y escrituras de permisos siguen cubiertas por las suites automatizadas aisladas del backend, no por cambios sobre publicaciones reales en este ensayo.

## Separación del entorno

- Frontend: `http://localhost:4300`, configuración Angular `rehearsal`.
- API de ensayo: `http://localhost:8101/api`, expuesta únicamente en loopback mediante un proxy de destino fijo.
- Base: `observatorio_ensayo_test`, contenedor `subsanacion-ensayo-db`, con volumen propio.
- Aplicación: `subsanacion-ensayo-api`, fuentes en lectura, almacenamiento independiente, usuario sin privilegios, capacidades eliminadas y raíz del contenedor en lectura.
- API y base pertenecen a una red Docker interna sin salida externa. El proxy solo reenvía al contenedor de aplicación; no recibe credenciales de base o de nube.
- No se montó el `.env` original. Se generaron nueva clave de aplicación y contraseñas locales. Correo usa el transporte `array`; no se configuraron credenciales SharePoint, Google, S3 ni MongoDB.
- `production` y el desarrollo habitual conservan sus configuraciones Angular. El modo de ensayo desactiva service worker para evitar reutilizar caché del entorno habitual.

El nombre del servicio Render que contiene «pruebas» no lo convierte en ensayo: ese servicio y su base sostienen actualmente producción. No se deben reutilizar para pruebas de escritura.

## Minimización de la copia

La minimización se hizo exclusivamente sobre la copia temporal. Se reemplazaron nombres, correos, contraseñas y autores por valores de ensayo; se vaciaron datos personales de perfiles, sesiones, tokens, códigos de acceso y el almacén legado de contraseñas. Los 51.120 registros analíticos se sustituyeron por valores sintéticos conservando su estructura representativa. También se retiraron opciones y referencias privadas de datasets.

Se conservaron títulos, estados y relaciones de publicaciones para verificar bibliotecas y archivos. **Los contenidos de los PDF no se anonimizaron**: permanecen en almacenamiento local, sin publicarse como artefactos del PR. Por tanto, la copia está minimizada, pero no debe describirse como completamente anónima ni compartirse libremente.

La copia física temporal, que inicialmente incluía otras bases locales, fue eliminada después de verificar la restauración. Se conservaron únicamente el entorno de ensayo y los respaldos minimizados de trabajo.

## Repetir la comprobación HTTP

Con el entorno ya preparado, sus contenedores en marcha y los archivos privados de ensayo presentes, ejecutar desde la raíz:

```powershell
node scripts/test-rehearsal-application.cjs
```

El ejecutor tiene destino fijo `localhost:8101`, base `observatorio_ensayo_test` y exige la etiqueta `observatorio.purpose=rehearsal`. Lee las credenciales sintéticas y el manifiesto de archivos en `storage/codex-local/ensayo/`; no imprime contraseñas ni las acepta por argumentos. Esta prueba requiere Docker local y no es un trabajo de CI conectado a producción.

Para servir el frontend desde `frontend/`:

```powershell
npm start -- --configuration rehearsal --host localhost --port 4300
```

Los archivos privados ignorados `application-ready.dump`, `application-files.tar`, `database-manifest.json`, `files-manifest.json`, `restore-results.json` y `http-results.json` documentan el respaldo y la conciliación local. No agregarlos a Git ni adjuntarlos al PR.

Para preparar una nueva copia, repetir este orden operativo:

1. Confirmar origen local, PostgreSQL compatible y base original detenida; verificar que todos los destinos sean volúmenes nuevos.
2. Copiar el volumen original en lectura a un volumen temporal sin red. Nunca minimizar ni migrar sobre el original.
3. Minimizar únicamente la copia, generar credenciales sintéticas y copiar solo archivos referenciados a un respaldo separado.
4. Generar `pg_dump` en formato custom, restaurar en una base preparatoria independiente y comprobar migraciones allí.
5. Capturar manifiestos de tablas/columnas/restricciones/índices/secuencias y huellas de filas; generar un nuevo dump y restaurarlo en otra base vacía con propietario limitado.
6. Comparar ambos manifiestos y SHA-256 de todos los PDF; iniciar la API con configuración independiente y ejecutar la comprobación HTTP.
7. Eliminar exclusivamente los recursos temporales identificados y etiquetados, preservando el original y el respaldo verificado.

## Protección de la rama productiva

Se activó el ruleset [Produccion - PR y CI - pruebas-rediseno](https://github.com/Criiscvz/Observatorio-Territorial/rules/26110957):

- Aplica exclusivamente a `refs/heads/pruebas-rediseno`.
- Exige pull request, conversaciones resueltas y check `Resultado` de GitHub Actions (`integration_id: 15368`).
- Exige la base actualizada antes de integrar; bloquea borrado y actualización no fast-forward.
- No tiene actores de bypass. La cuenta que aplicó la regla figura sin bypass.
- Se requieren cero aprobaciones humanas adicionales, dado el mantenimiento individual; eso no equivale a revisión independiente. CI no se puede omitir para integrar.

La regla anterior de `deploy-gratis` se conservó. Las reglas protegen la integración en GitHub; no configuran por sí solas controles de acceso o el orden de despliegue en Render/Vercel.

## Límites y siguiente puerta

Este ensayo acredita recuperación de una copia local representativa. No acredita recuperación a un instante concreto de producción, RPO/RTO contractual, restauración de MongoDB ni importaciones SharePoint en vivo. Tampoco constituye una auditoría completa de permisos o prueba visual de extremo a extremo.

Antes de una migración de datos productivos aún se requiere un respaldo identificado de **esa** base y sus archivos, un ensayo de la migración concreta y su reversión, y verificar la configuración de destino. La clasificación de secretos históricos, la rotación que corresponda y las decisiones institucionales/DIIT siguen pendientes en sus fases.
