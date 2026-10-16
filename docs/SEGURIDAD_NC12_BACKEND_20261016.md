# NC-12: actualización dirigida de dependencias PHP

Fecha: 16/10/2026. Rama: `seguridad-dependencias-backend`, sin prefijo `codex/`.
Base: `deploy-gratis`, commit `28c860eb96aeae3a32661659e3da47272ec57db0`.

## Alcance y estado

Se corrige el conjunto de dependencias PHP señalado por la auditoría de NC-12,
manteniendo las versiones mayores existentes. No se modifican el frontend,
las herramientas npm del backend, cuentas, secretos, datos ni contratos de API.
No se ejecutan migraciones/seeds ni se publica o despliega a producción.

| Verificación | Antes | Después local |
| --- | --- | --- |
| Composer, incluido desarrollo | 12 paquetes, 43 entradas de avisos | Sin avisos |
| Composer, `--no-dev` | Los mismos 12 paquetes y 43 entradas | Sin avisos |
| Avisos únicos | 42 al deduplicar por GHSA/CVE | 0 |
| Paquetes abandonados reportados | 0 | 0 |

Las 43 entradas originales incluyen el mismo aviso Laravel recibido por dos
fuentes. Los resultados representan el feed consultado, no una garantía de
ausencia de fallos desconocidos ni un cierre completo/institucional de NC-12.
La auditoría inicial no se sobrescribe: conserva su corte anterior.

## Versiones bloqueadas

| Paquete | Antes | Después |
| --- | --- | --- |
| laravel/framework | 12.51.0 | 12.70.0 |
| league/commonmark | 2.8.0 | 2.10.3 |
| league/flysystem | 3.35.2 | 3.36.0 |
| maatwebsite/excel | 3.1.67 | 3.1.70 |
| mongodb/mongodb | 2.3.0 | 2.5.0 |
| phpoffice/phpspreadsheet | 1.30.2 | 1.30.7 |
| symfony/http-foundation | 7.4.5 | 7.4.21 |
| symfony/http-kernel | 7.4.5 | 7.4.21 |
| symfony/mailer | 7.4.4 | 7.4.19 |
| symfony/mime | 7.4.5 | 7.4.19 |
| symfony/routing | 7.4.4 | 7.4.21 |
| symfony/yaml | 7.4.1 | 7.4.21 |
| symfony/polyfill-php84 | 1.33.0 | 1.43.0 |
| symfony/polyfill-php85 | 1.33.0 | 1.43.0 |

Son 14 actualizaciones, sin instalaciones/eliminaciones de paquetes ni saltos
mayores. Los dos polyfills acompañan los requisitos de Laravel/MongoDB.
`composer.json` permanece intacto. Composer también actualizó únicamente las
URLs source/dist de `vlucas/phpdotenv` a `phpdotenv/phpdotenv`, sin cambiar
versión 5.6.3 ni commit; la URL oficial anterior redirige al nuevo repositorio.

La resolución se hizo con Composer dentro de PHP 8.4.25 y sus extensiones reales,
no simulando PHP 8.4 sobre el PHP 8.5 del host. Se revisó primero un dry-run y se
aplicó después la actualización parcial con `--with-all-dependencies`,
`--minimal-changes`, `--no-install`, sin scripts/plugins y sin ignorar requisitos
de plataforma. El host no recibe una instalación de vendor.

## Compatibilidad de MongoDB

La librería 2.5.0 requiere `ext-mongodb ^2.5`. La imagen local anterior de Render
tenía PHP 8.4.24 y driver 2.3.3; no se afirma que esa imagen describa en tiempo real
el contenedor remoto. Esta diferencia sí impide confiar en una capa PECL antigua.

Se fija `mongodb-2.5.2`, ya presente en la imagen de pruebas, en:

- `backend/Dockerfile`, para invalidar la capa antigua del driver al construir.
- `backend/Dockerfile.dev`, para mantener desarrollo alineado.
- `CI seguridad`, mediante la versión PECL explícita de setup-php.

CI añade `composer check-platform-reqs` después de instalar el lock; no recibe
secretos ni accede a servicios reales. Una regresión comprueba que el driver
fijado satisface el requisito del lock y coincide en los dos Dockerfiles y CI.
Esa regresión falló antes del ajuste y pasó después.

El contenedor de pruebas instaló el lock y aprobó `check-platform-reqs` con PHP
8.4.25 y MongoDB 2.5.2. No se cambió el servidor de MongoDB ni se consultaron
colecciones reales. No se acredita aquí una integración contra MongoDB Atlas.

## Pruebas y aislamiento

Se añadieron siete casos funcionales, con archivos y destinatarios sintéticos:

- Análisis de XLSX y CSV sin extensión, tal como llegan desde almacenamiento
  temporal: encabezados, tipos, opciones, vista previa y archivo sin modificación.
- Importación de ambos formatos: recorte de texto, fechas, valores decimales y cero.
- Validación de un libro sin encabezados, conservando el error existente.
- Construcción real del correo de verificación mediante Symfony MIME y transporte
  `array`, sin SMTP. No se utiliza `Mail::fake` para esta comprobación.
- Rechazo de caracteres de control en una dirección, sin transmitir el mensaje.

La creación del fixture usa comparación estricta con null para que el escritor
no omita el número cero. Una expectativa inicial de excepción de correo se ajustó
al rechazo explícito de caracteres de control de Symfony Mime; no se cambió
código de negocio para acomodar las pruebas.

| Ensayo | Resultado local |
| --- | --- |
| Base anterior más cinco casos Excel | 196 casos SQLite, 1.138 aserciones, 8 omitidos por PostgreSQL; 77 PostgreSQL, 183 aserciones |
| Dependencias nuevas, suite final | 198 casos SQLite, 1.146 aserciones, 8 omitidos por PostgreSQL; 77 PostgreSQL, 183 aserciones |
| Higiene/workflow | 23 aprobadas, incluidas la nueva guarda de driver y la comprobación de plataforma |
| actionlint 1.7.12 | Sin errores |
| Validación Composer/lock | Correcta con `--strict --check-lock` |
| Laravel Pint, los dos archivos de pruebas nuevos | Sin errores |
| Gitleaks 8.30.1, snapshot versionado con los archivos nuevos incluidos | Sin hallazgos |

Las suites SQLite y PostgreSQL se solapan; no sumar sus casos como pruebas
independientes. Los controles existentes incluyen sesión/CSRF, autorización,
Atlas/almacenamiento, validación de publicaciones, correo y JSONB. No sustituyen
una revisión manual autenticada de producción ni prueban disponibilidad de SMTP/S3.

Las pruebas se ejecutan con `scripts/test-backend-security.ps1`: SQLite en memoria,
PostgreSQL 16 temporal con red únicamente loopback compartida, almacenamiento tmpfs
y montajes de código de solo lectura. No se montan `.env`, datos del usuario ni
volúmenes de producción; no se descarga una imagen desde ese script ni se ejecuta
el entrypoint de despliegue.

La imagen de dependencias para las pruebas se generó desde la imagen PHP 8.4
existente con un contexto de solo `composer.json` y `composer.lock`, sin scripts
de aplicación. La construcción adicional del Dockerfile de producción utiliza
una exportación de archivos versionados de Git más los cambios revisados; no el
directorio real del usuario. La carpeta privada exportada contenía solo su
`.gitignore` y está excluida además por `.dockerignore`.

## Construcción de producción

La construcción completa de `backend/Dockerfile` terminó correctamente. La imagen
local `observatorio-backend-nc12:production-test` contiene PHP 8.4.26, MongoDB
2.5.2 y el vendor de producción (`--no-dev`) del lock actualizado. Aprobó
`composer check-platform-reqs --no-dev` dentro de esa imagen, sin red, montando
únicamente el ejecutable Composer de solo lectura; no contiene `.env` ni
`.env.testing`.

Se ejecutó el entrypoint real con Nginx/PHP-FPM, una clave sintética, SQLite en
memoria y `RUN_MIGRATIONS=false`. El contenedor temporal tenía `network=none`,
ningún montaje y ningún puerto publicado. `/api/health` respondió HTTP 200 con
`ok=true` por loopback; no se activó su comprobación profunda de bases de datos.
Hubo rechazos de conexión y un 502 transitorio antes de que PHP-FPM quedara
listo; el reintento posterior fue correcto. No se considera una prueba de
disponibilidad sin interrupciones ni de servicios externos.

El contenedor de arranque se detuvo y eliminó al concluir. Se conservaron las
imágenes locales para reproducir la revisión. El identificador de configuración
de la imagen comprobada es
`sha256:90406acb007142fc122123b114b5b460a36f95b22753a6263e5139a27291559e`.

## Comandos de comprobación

```powershell
composer --no-plugins --no-scripts --no-interaction --no-cache --working-dir=backend validate --strict --no-check-publish --check-lock
composer --no-plugins --no-scripts --no-interaction --no-cache --working-dir=backend audit --locked --format=json
composer --no-plugins --no-scripts --no-interaction --no-cache --working-dir=backend audit --locked --no-dev --format=json
node --test scripts/test-repository-hygiene.mjs scripts/security-workflow.test.mjs
.\scripts\test-backend-security.ps1 -Suite all -PhpImage observatorio-backend-nc12:test
git diff --check
```

La imagen local `observatorio-backend-nc12:test` debe construirse primero y su
lock debe coincidir con el checkout: el script comprueba el hash antes de probar.
El workflow del repositorio instala directamente las dependencias bloqueadas en
un runner limpio, pero **todavía no se ha acreditado un run GitHub de este cambio**.

## Pendientes y límites

1. Publicar/revisar un PR contra `deploy-gratis` y comprobar el CI real. No se
   fusiona ni despliega por el solo hecho de aprobar las pruebas locales.
2. Mantener la comprobación de plataforma en cualquier futura actualización de
   MongoDB; no volver a fijar solo la librería olvidando su driver.
3. Remediar por separado ECharts/wordcloud, el npm auxiliar, el paquete `install`
   y los lockfiles duplicados. No se actualizaron en este cambio.
4. Auditorías periódicas, SAST y el resto del informe siguen pendientes. La
   comprobación de plataforma añadida al CI no es una auditoría de vulnerabilidades.
5. NC-03 y eliminación manual de usuarios siguen fuera de alcance. No se
   modificaron claves, cuentas, sesiones ni tokens.

## Fuentes técnicas

- [Actualización parcial y cambios mínimos de Composer](https://getcomposer.org/doc/03-cli.md#update-u-upgrade).
- [MongoDB PHP library 2.5.0](https://github.com/mongodb/mongo-php-library/releases/tag/2.5.0).
- [Driver PECL MongoDB 2.5.2](https://pecl.php.net/package/mongodb/2.5.2).
- [Extensiones con versión específica en setup-php](https://github.com/shivammathur/setup-php#php-extension-support).
- [Publicaciones de PhpSpreadsheet](https://github.com/PHPOffice/PhpSpreadsheet/releases).
- [Repositorio oficial actual de phpdotenv](https://github.com/phpdotenv/phpdotenv).
