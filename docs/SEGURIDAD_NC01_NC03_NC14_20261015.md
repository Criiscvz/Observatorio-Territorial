# Avance de seguridad: NC-01, NC-03 y NC-14

Fecha: 15/10/2026. Rama local: `codex/seguridad-jsonb-config`.
Base: `origin/deploy-gratis`, commit `531c0575d960614cd0ed374eff6df4c7b53a6476`.

## Estado y alcance

| Hallazgo | Avance comprobado | Estado de publicación |
| --- | --- | --- |
| NC-01: consultas JSONB | Parametrización implementada y probada contra PostgreSQL 16 real en un entorno desechable. | Local, pendiente de revisión y publicación. |
| NC-03: secretos e historial | Inventario heurístico sin revelar valores, con metadatos de archivos/líneas/objetos y clasificación por contexto. | Parcial: no acredita vigencia, revocación, rotación ni saneamiento del historial. |
| NC-14: configuración del seeder | `env()` trasladado a configuración; regresión con `config:cache` y segundo proceso sin las variables originales. | Local, pendiente de revisión y publicación. |

Este anexo no cambia retroactivamente el balance del PDF de la matriz, que describe la versión publicada en su corte. Una corrección local probada no se presenta como una corrección desplegada ni como aceptación institucional.

Este documento registra la validación local previa al commit y al PR. En ese corte no se modificaron bases de datos del usuario, cuentas reales, credenciales, Render, Vercel o configuración externa, y no hubo fusión ni despliegue. Se conservaron los cambios ajenos del checkout principal. Publicar la rama o abrir su PR no equivale a desplegar estas correcciones ni a cerrar los hallazgos en producción.

## NC-01: cambios y comprobaciones

Archivo: `backend/app/Infrastructure/Persistence/Eloquent/Repositories/EloquentRegistroDatoRepository.php`.

- Las ocho consultas analíticas proyectan las claves JSON mediante `data->>CAST(? AS text)` con bindings, en lugar de concatenar el nombre de columna en SQL.
- Se conserva la lista permitida de nombres normalizados de importación. La parametrización y la validación son defensas independientes.
- Una subconsulta permite agrupar por alias fijos sin repetir distintos parámetros posicionales en expresiones `GROUP BY`. Los alias se escapan como identificadores; no proceden de la petición.
- El identificador del dataset, la expresión regular numérica y los límites numéricos del histograma tampoco se interpolan como fragmentos SQL.
- Se mantienen los contratos de respuesta de frecuencias, estadísticas, dispersión, promedios agrupados, contingencia y series temporales.

Las regresiones cubren cada argumento de columna de las ocho operaciones, comillas/SQL, separadores, claves vacías y saltos de línea; el rechazo ocurre antes de ejecutar una consulta. Las pruebas PostgreSQL cubren además aislamiento entre datasets, claves JSON numéricas tratadas como texto, valores nulos/ausentes/no numéricos, límites, ceros, negativos, decimales, conteos y fechas. Se inspeccionan SQL y bindings de las consultas ejecutadas.

Durante estas regresiones se corrigieron dos defectos pequeños del histograma: el cero ya no se trata como ausencia y el máximo se agrupa en el último intervalo antes de contar, evitando dos filas para el mismo intervalo. También se rechaza un número de intervalos menor que uno. Son ajustes de resultados documentados, no cambios de permisos o del esquema.

Las pruebas usan una tabla temporal de sesión con datos sintéticos. No ejecutan las migraciones de aplicación contra PostgreSQL ni certifican todo el esquema productivo, otras implementaciones de estadísticas o todos los planes de ejecución.

## NC-14: configuración cacheable y sin credenciales por defecto

Archivos: `backend/config/initial_users.php` y `backend/database/seeders/AdminUserSeeder.php`.

- Se conservan los nombres de las nueve variables de entorno existentes y los roles ADMIN, USER y SUBSCRIBER.
- Las variables se leen exclusivamente en `config/initial_users.php`; el seeder consume `config('initial_users.users', [])`.
- No se añaden credenciales predeterminadas ni ejecución automática del seeder al arrancar. El comportamiento explícito existente de actualizar/restaurar usuarios configurados no se cambia.
- Una configuración incompleta no crea usuarios de reserva. El aviso recuerda actualizar la caché cuando se cambie el entorno.

La prueba de caché crea una aplicación mínima en un directorio temporal único, copia solo la configuración necesaria, ejecuta el comando real `config:cache` y arranca un segundo proceso sin las nueve variables de usuarios iniciales. En SQLite en memoria verifica los tres roles configurados, hashes correctos e idempotencia. No lee el `.env` ni escribe la caché de la aplicación de trabajo.

Las pruebas de integración del seeder con las migraciones SQLite de aplicación mantienen los roles ADMIN y USER y comprueban creación, actualización, login, restauración lógica, ausencia de duplicados y omisión de configuración incompleta. La migración que amplía los roles a SUBSCRIBER/EDITOR se aplica solo a PostgreSQL; no se modificó esa migración para hacer pasar un fixture SQLite. La comprobación de los tres roles con caché usa un esquema sintético explícito, no se presenta como ensayo completo de las migraciones PostgreSQL.

No se repitió el seeder en un servidor real ni se modificaron usuarios de producción. Tras publicar, cualquier cambio de variables iniciales requiere regenerar la caché mediante el procedimiento de despliegue; no ejecutar el seeder indiscriminadamente porque su conducta existente puede actualizar contraseña y rol de las cuentas configuradas. La caché puede contener secretos de configuración y debe conservar los controles de acceso del servidor.

## NC-03: inventario de secretos, sin valores

Método: actualización de referencias Git y revisión local de archivos actuales versionados/no ignorados y de blobs únicos alcanzables desde las referencias locales. Se examinaron 2.354 blobs históricos candidatos de hasta 2 MiB; se omitieron binarios y archivos mayores (68 omisiones históricas y 15 en el árbol actual). La ruta histórica registrada es la primera ruta asociada al objeto, no una lista exhaustiva de todos los renombrados o commits.

Reglas heurísticas: claves privadas PEM, formatos de claves AWS/GitHub/Google/Slack, JWT, DSN con contraseña, asignaciones sensibles y valores débiles conocidos del diagnóstico. El inventario conserva únicamente regla, ruta, línea, objeto Git y contexto; nunca el valor ni la línea original. El script y el JSON detallado se mantienen en el almacenamiento privado ignorado, no en el diff para publicar.

El historial produjo 506 coincidencias de reglas, **no 506 secretos distintos**. Hay solapamientos, traducciones, reglas de validación, casts de modelos, referencias a variables, fixtures y ejemplos. Persisten ejemplos de credenciales o valores débiles en documentación actual, entre ella `docs/SDD-Integracion-MongoDB.md`, `docs/SISTEMA.md` y `docs/comandos.md`, así como versiones históricas de Compose, scripts y código. No se ha acreditado si alguno de esos valores fue reutilizado en un sistema real. No se reprodujeron sus valores en este informe.

No se encontraron coincidencias de los formatos examinados de claves privadas PEM, claves AWS/GitHub/Google/Slack o JWT. Esto no demuestra ausencia de secretos: faltan otros formatos, archivos omitidos, objetos no alcanzables, artefactos externos y confirmación de uso/vigencia. No se hicieron peticiones de autenticación para probar claves, ni se consultaron secretos de los paneles externos.

Para cerrar NC-03:

1. Clasificar con el propietario los candidatos documentales/históricos y confirmar si se reutilizaron. No enviar los valores al chat.
2. Si fueron reales, acordar y autorizar la rotación/revocación en cada servicio y verificar que la aplicación funciona con los nuevos valores.
3. Limpiar ejemplos documentales y establecer una búsqueda de secretos con reglas mantenidas y resultados redactados en CI.
4. Si procede reescribir historial, acordar primero respaldo, alcance, ramas/tags y coordinación de clones/colaboradores. Quitar el archivo actual no borra su historial. No se ejecutó ninguna reescritura.

La revisión no rotó claves ni eliminó archivos de documentación o ramas. Por ello NC-03 sigue parcial.

## Pruebas reproducibles

Desde la raíz de esta rama, con Docker activo y las imágenes locales de pruebas ya preparadas:

```powershell
.\scripts\test-backend-security.ps1
```

Opciones de alcance: `-Suite sqlite` o `-Suite postgres`. Por defecto ejecuta ambas. No construye ni descarga imágenes. Exige que el `composer.lock` de la imagen PHP coincida con el de la rama. Si no existe una imagen compatible, se detiene: no instalar dependencias ni reutilizar datos productivos para sortear esa comprobación.

El script:

- Ejecuta PHP 8.4.25 y PHPUnit 11.5.53 de la imagen local compatible.
- Monta código y configuración en solo lectura, sin `.env` ni volúmenes de datos del usuario. Rechaza imágenes que contengan `.env`/`.env.testing`.
- Ejecuta la suite general con `--network none`, SQLite en memoria y storage/caché en tmpfs.
- Crea su propio PostgreSQL 16 con credenciales sintéticas, sin puertos publicados, sin red externa y con datos en tmpfs. El cliente comparte solo ese espacio de red aislado y usa `TEST_DB_*` explícito, localhost y una base terminada en `_test`.
- Detiene únicamente el contenedor temporal cuyo ID creó; `--rm` elimina ese contenedor y los datos sintéticos desaparecen. No usa el entrypoint de despliegue.

Resultados registrados:

| Ejecución | Resultado |
| --- | --- |
| Suite general SQLite | 188 casos: 180 aprobados, 8 omitidos por requerir PostgreSQL; 1.106 aserciones, sin errores ni fallos. |
| PostgreSQL y controles de columnas/aislamiento | 77 pruebas, 183 aserciones, aprobadas, sin omisiones. Incluye las ocho regresiones PostgreSQL omitidas arriba. |
| Sintaxis PHP de los archivos modificados/nuevos | Correcta. |
| `git diff --check` | Correcto. |

Las suites comparten casos de validación; no sumar sus totales como si fueran pruebas distintas. Estos resultados son locales y no sustituyen una verificación posterior de la versión publicada.

## Criterios para el siguiente paso

1. Revisar el diff y las pruebas de esta rama, incluidos los archivos nuevos sin seguimiento; mantener fuera el inventario privado y cualquier `.env`.
2. Autorizar commit/push/PR antes de publicar; no fusionar o desplegar todavía por el hecho de que las pruebas locales pasen.
3. Validar la integración en el entorno autorizado y documentar su versión exacta. Solo entonces actualizar el estado publicado de NC-01/NC-14 en la matriz.
4. Resolver las decisiones de secretos por separado y conservar NC-03 parcial mientras falten pruebas de clasificación/rotación/historial.

Referencias técnicas del cambio: [bindings de Query Builder de Laravel 12](https://api.laravel.com/docs/12.x/Illuminate/Database/Query/Builder.html), [caché de configuración de Laravel 12](https://laravel.com/docs/12.x/configuration#configuration-caching) y [operadores JSON de PostgreSQL 16](https://www.postgresql.org/docs/16/functions-json.html). Son referencias de implementación, no evidencias de que una credencial histórica sea válida ni de que el cambio esté desplegado.
