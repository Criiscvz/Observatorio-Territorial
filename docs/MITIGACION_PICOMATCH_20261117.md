# Mitigación temporal de picomatch — 17 de noviembre de 2026

La PR de formularios A-02 quedó pendiente de integración porque npm incorporó
GHSA-fc5q-39xc-vjpf a las auditorías. Ambos lockfiles de la base ya contenían
el paquete afectado: seis paquetes propagados en backend y 23 en frontend,
desde un único aviso. Este documento registra la sustitución y su verificación;
no declara cerrada la subsanación institucional.

## Solución y procedencia

La última versión oficial consultada continúa siendo 4.0.7; el
[aviso original](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) no indica
una publicación corregida. Se fija temporalmente el fork
[@ryotsu/picomatch 4.0.7-a](https://github.com/ryotsu-kankichi/secured-picomatch)
mediante un override exacto en backend y frontend. Los lockfiles conservan
su tarball npm y SHA-512, sin rangos móviles ni referencias a ramas Git.

Se descargaron ambos tarballs sin ejecutar scripts, se comprobó su integridad
y se compararon sus diez archivos. La licencia MIT permanece idéntica. El
código ejecutable cambia en parse.js y constants.js; las otras cinco entradas
JavaScript permanecen idénticas. El manifiesto no tiene hooks de instalación.
Se contrastó el cambio con el código y changelog publicados por el autor.
La firma/atestación declarada por npm no se presenta como una revisión
independiente de seguridad ni como una aprobación del proyecto original.

El fork elimina repeticiones redundantes de ramas con estrellas cuando puede
resolverlas y trata literalmente otras formas complejas. También cambia
tratamiento de globstars, negación en corchetes y una clase POSIX. Esos cambios
son parte del código revisado, no solo un cambio de nombre/versión para obtener
un audit verde. Hay diferencias deliberadas en patrones complejos y capturas;
no se garantiza equivalencia para todos los globs posibles.

## Controles obligatorios

`scripts/verify-picomatch.mjs` se ejecuta en ambos jobs después de instalar:

- Exige override, nombre, versión, URL, SHA-512 y condición dev en cada entrada
  del lockfile. Rechaza copias oficiales viejas o cualquier copia adicional.
- Comprueba SHA-256 de los siete archivos JavaScript, manifiesto y licencia;
  rechaza enlaces y archivos ejecutables adicionales. Los bytes comprobados
  son los del tarball examinado, no una descarga posterior de una rama mutable.
- Comprueba que cada consumidor instalado resuelva la copia examinada.
- Ejecuta diez patrones de ataque en procesos separados, limitados a cinco
  segundos, con modos normal, captura, Windows y sin fastpaths. Usa
  --max-old-space-size=64 para el heap antiguo de V8, sin afirmar un límite
  de 64 MiB de memoria total del proceso. Exige rechazo de cada cadena.
- Verifica patrones de uso habitual y el plugin real de recarga de Laravel:
  vistas/rutas producen eventos, un archivo ajeno no los produce.
- Consulta el registro de avisos del picomatch original 4.0.7. Solo reconoce
  como parcheado el aviso exacto probado, con su título/rango/severidad. Un
  aviso nuevo, cambiado, respuesta inválida o registro indisponible falla.
  Esta consulta ocurre después de comprobar los bytes y ejecutar las pruebas.

El último punto evita que el nombre nuevo oculte futuros avisos del código
original. La auditoría completa de dependencias se conserva intacta, incluye
desarrollo/opcionales/peers y no añade excepciones de severidad. Un audit del
alias sin comprobar su código y el origen no bastaría para aceptar el cambio.

## Compatibilidad comprobada

Los únicos paquetes resueltos que cambian son las copias de picomatch. Se
conservan las versiones de Angular, Vite, Tailwind y las demás dependencias.
La copia 2.3.2 que usaba vite-plugin-full-reload se sustituye por el mismo fork
4.x; por ello se prueba su consumidor real, incluido el manejo de rutas.

En aislamiento, el original 4.0.7 agotó el tiempo de la prueba de control y el
candidato terminó los diez casos. Hubo 84.480 comparaciones sobre nombres de
archivos del proyecto y patrones de uso habitual, sin diferencias. Esto es
evidencia del alcance ensayado, no una prueba formal de ausencia de ReDoS.

Instalación con npm 11.13.0, auditorías completas sin avisos, controles del fork,
recarga Laravel y compilación del backend aprobados localmente. También se
comprueban lint, unitarios, build SPA, cabeceras/PWA y tipos de E2E del frontend.
CI debe ejecutar los recorridos de escritorio/móvil con PostgreSQL/MongoDB
sintéticos y aprobar todos sus jobs en el mismo commit antes de integrar.
La ejecución exacta y sus resultados se guardan en el informe local de cierre.

## Mantenimiento y límites

El fork tiene un publicador distinto y una historia reciente. El pin de
integridad/código reduce cambios silenciosos, pero no sustituye mantenimiento
ni acredita equivalencia general con el original. Mantener la revisión de
avisos originales y comprobar este pin en cada instalación de CI.

Revisar esta solución antes del 17 de diciembre de 2026 y sustituirla por una
publicación oficial corregida cuando exista y pase estas pruebas. Retirar
entonces el override y adaptar los controles mediante revisión; no quitar
las pruebas de ataque ni la auditoría para resolver un fallo.

No se modifican datos, secretos, migraciones, permisos o archivos portable.
La mitigación y A-02 se publican únicamente tras CI y las comprobaciones del
despliegue. Evidencia privada en storage/codex-local/picomatch-20261117/ y
storage/codex-local/a02-formularios-20261117/.
