# Mantenimiento de dependencias — 11 de noviembre de 2026

Rama de trabajo: `mantenimiento-dependencias-20261111`, desde `6fb32f9` de
`pruebas-rediseno`. Se conserva el entorno portable para el futuro alojamiento.

## Alcance revisado

| Dependencia | Antes | Actualización | Propuesta |
|---|---|---|---|
| laravel/sail | 1.53.0 | 1.69.0 | #36 |
| tailwindcss, backend | 4.3.4 | 4.3.5 | #37 |
| laravel/pint | 1.27.1 | 1.32.1 | #38 |
| laravel/pail | 1.2.6 | 1.2.7 | #39 |
| pdfjs-dist | 6.4.299 | 6.5.438 | #40 |
| laravel/framework | 12.70.0 | 12.71.0 | #41 |
| @tailwindcss/postcss, frontend | 4.3.4 | 4.3.5 | #42 |
| mongodb/laravel-mongodb | 5.8.2 | 5.12.0 | #43 |
| @tailwindcss/vite, backend | 4.3.4 | 4.3.5 | #44 |
| tailwindcss, frontend | 4.3.4 | 4.3.5 | #45 |

Las diez propuestas individuales tenían CI satisfactoria al revisarse. Se
comprueba además su combinación, porque sus lockfiles comparten dependencias.
Las propuestas npm se integran conservando sus commits; los lockfiles de Composer
se sustituyen por una resolución selectiva con `--minimal-changes`, sin instalar
ni ejecutar scripts durante la resolución.

Algunas propuestas de Composer también cambiaban unas 49 dependencias,
incluidos saltos mayores de Symfony. La combinación revisada conserva todas
las versiones ajenas a los cinco paquetes PHP solicitados y añade únicamente
`symfony/polyfill-php86` 1.43.0, requerido por MongoDB. Se mantiene
`mongodb/mongodb` 2.5.0 y la extensión nativa MongoDB 2.5.2.

## Compatibilidad y límites

Pint 1.32.1 requiere PHP >=8.3. El backend portable, el backend publicado y CI
usan PHP 8.4; `composer check-platform-reqs` verifica los requisitos reales.
No se omiten requisitos de plataforma. Las herramientas JavaScript se comprueban
también en Node 24.17.0, la versión de CI y del build portable.

[PDF.js 6.5.438](https://github.com/mozilla/pdf.js/releases/tag/v6.5.438)
incluye cambios de renderizado y del visor. Se comprueba la API con su worker
local, documentos de varias páginas, vistas previas y pantalla completa en
escritorio y móvil.
[MongoDB Laravel 5.12.0](https://github.com/mongodb/laravel-mongodb/releases/tag/5.12.0)
incorpora cifrado consultable opcional; esta entrega no activa esa función ni
cambia la configuración de los datos.

`scripts/e2e/verify-mongo.php` verifica ocho comportamientos con MongoDB 7 real:
inserción, aislamiento por dataset, documentos anidados, paginación Eloquent,
fechas BSON, agregaciones categóricas y numéricas y borrado con alcance. Usa
identificadores aleatorios, elimina sus propios registros y rechaza conexiones
que no sean el contenedor `mongo` y la base `observatorio_portable_test`.
El script se transmite por CLI al contenedor E2E; no entra en imágenes publicadas.

## Verificación

- Frontend: lint, 7 pruebas de calidad, 529 pruebas unitarias, compilación de
  producción, 20 pruebas de cabeceras/PWA y tipos de los recorridos del navegador.
- Backend PHP 8.4: validación de Composer, requisitos de plataforma, PHPStan y
  371 pruebas SQLite (4.336 aserciones; 8 pruebas reservadas para PostgreSQL).
- Recursos del backend: instalación del lockfile y compilación Vite en una copia
  sin `.env` ni archivos privados.
- Auditorías completas npm y Composer: sin avisos al ejecutarse el 11 de noviembre.
- Higiene: 41 pruebas del repositorio, políticas de auditoría y entorno portable;
  contextos Docker sintéticos sin secretos.
- Integración portable: 16 recorridos de escritorio/móvil aprobados, sin omisiones,
  fallos ni reintentos; ocho comprobaciones de persistencia MongoDB y verificación
  de telemetría/redacción. Los contenedores y volúmenes desechables se retiraron.

La CI de la combinación exige además la suite dirigida de PostgreSQL 16 y vuelve
a ejecutar los controles anteriores antes de integrar. Su resultado y la
publicación se registran en el PR y en el comprobante local de entrega.

Los logs y las comparaciones completos se conservan localmente en
`storage/codex-local/dependencias-20261111/` y `storage/codex-local/e2e/`, ignorados
por Git. Los usuarios y archivos de las pruebas son sintéticos. Esta entrega no
añade migraciones de datos ni supone la aceptación institucional de DIIT.
