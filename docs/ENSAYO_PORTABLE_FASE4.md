# Fase 4: ensayo local portable

Fecha: 30 de octubre de 2026, America/Guayaquil.

DIIT aún no confirmó el host. El usuario eligió preparar un ensayo local
portable. Esta entrega no modifica las configuraciones usadas por Vercel/Render,
no migra sus datos y no define una plataforma institucional definitiva.

## Decisión de servicio

Se conserva el modo SPA que hoy se publica en Vercel. El builder usa el lockfile
de npm y el mismo shell CSR/PWA; la imagen final contiene solo el directorio
`browser` y Nginx. El código SSR permanece en el proyecto, pero no hay servidor
Node en el runtime del ensayo. Si DIIT exige SSR, se debe validar un runtime y
proxy distintos antes de adoptarlo.

Nginx sirve la SPA y remite `/api`, `/sanctum` y `/storage` al único front
controller de PHP-FPM. El navegador usa `/api` bajo el mismo origen. No se
publica el puerto de FPM ni el de ninguna base de datos.

| Servicio | Papel | Persistencia / acceso |
|---|---|---|
| web | Nginx, SPA y pasarela FastCGI | UID 101, raíz de solo lectura; entrada `127.0.0.1:4400`. |
| api | PHP-FPM 8.4 y aplicación Laravel | UID 10001, raíz de solo lectura; `storage` persistente y caché de configuración en tmpfs. |
| postgres | PostgreSQL 16, incluyendo JSONB | Volumen `pg-data`; cuenta de aplicación sin superusuario. |
| mongo | MongoDB 7, conservando consumidores actuales | Volumen `mongo-data`; aplicación con `readWrite` solo en su DB de ensayo. |
| schema | Migración explícita, perfil `tools` | Misma imagen PHP y almacenamiento de locks; no forma parte del arranque HTTP. |

PHP y las bases se conectan exclusivamente por una red interna del proyecto.
El contenedor web añade una red de entrada para publicar su puerto en Docker
Desktop; el enlace publicado permanece limitado al loopback. El backend no
recibe credenciales reales de SharePoint, correo, OAuth o almacenamiento remoto.

El nombre de proyecto es `observatorio-portable-ensayo`; sus recursos llevan
`observatorio.purpose=portable-rehearsal`. No se reutilizan contenedores ni
volúmenes de `observatorio_db`, `observatorio_mongo` o del ensayo anterior.

## Construcción y requisitos

- Node 24.17.0 coincide con CI; PHP 8.4 y MongoDB PECL 2.5.2 conservan la línea
  comprobada por las suites actuales. Las bases externas de imágenes se fijan
  por digest y npm/Composer usan los archivos de bloqueo.
- Composer se ejecuta sobre PHP con las extensiones reales: instalación de
  producción sin scripts/plugins y `check-platform-reqs --no-dev`. No se utiliza
  `--ignore-platform-reqs` en el Dockerfile portable.
- Los contextos portable son listas restrictivas de entradas. Las pruebas usan
  el matcher real de Docker con material sintético para comprobar que no entran
  `.env`, claves, cachés, dumps, dependencias locales o archivos privados.
- Los paquetes de sistema se resuelven desde los repositorios de Alpine durante
  el build. Esto no certifica reproducibilidad binaria ni sustituye la política
  de actualizaciones/mirrors que defina DIIT.

Requiere Docker Engine/Compose v2, Node para los scripts de prueba y acceso a los
registros y repositorios de dependencias durante el build. El verificador rechaza
un contexto Docker remoto. El runtime no necesita dependencias instaladas en el host.

## Preparación desde la raíz del repositorio

```powershell
node scripts/init-portable-env.mjs
docker --context default compose --project-name observatorio-portable-ensayo --env-file storage/codex-local/portable/.env -f deploy/portable/compose.yml config --quiet
docker --context default compose --project-name observatorio-portable-ensayo --env-file storage/codex-local/portable/.env -f deploy/portable/compose.yml build --builder default
node scripts/test-portable-runtime.cjs
```

El inicializador crea secretos aleatorios una sola vez, en un archivo ignorado
por Git, sin imprimirlos. No sobrescribe una configuración existente. No usar
`compose config` sin `--quiet` para compartir resultados: puede expandir secretos.

El verificador completo exige volúmenes nuevos. Inicia las bases, comprueba sus
etiquetas, ejecuta la tarea de esquema y después levanta la aplicación. Introduce
solo usuarios, documentos y marcadores sintéticos. Deja el ensayo funcionando en
`http://localhost:4400`, y registra las credenciales sintéticas en
`storage/codex-local/portable/private-access.json`, sin publicarlas en el informe.

Para arrancar manualmente sobre sus volúmenes ya preparados:

```powershell
docker --context default compose --project-name observatorio-portable-ensayo --env-file storage/codex-local/portable/.env -f deploy/portable/compose.yml up -d --wait postgres mongo
docker --context default compose --project-name observatorio-portable-ensayo --env-file storage/codex-local/portable/.env -f deploy/portable/compose.yml --profile tools run --rm --no-deps schema
docker --context default compose --project-name observatorio-portable-ensayo --env-file storage/codex-local/portable/.env -f deploy/portable/compose.yml up -d --wait api web
```

La tarea ejecuta `migrate --force --isolated=75`, sin seed. El cache de locks se
comparte por volumen en este host único. No extender esta topología a varios hosts
sin un almacén de locks central apropiado. El arranque normal solo prepara cachés;
el ensayo compara el registro de migraciones y los usuarios antes/después de
recrear los contenedores.

## Comprobaciones y recuperación

El verificador prueba:

1. Usuarios efectivos, sistema de archivos de solo lectura, ausencia de `.env`
   y dependencias de desarrollo en runtime y requisitos de plataforma PHP.
2. Rutas SPA, cabeceras, recursos ausentes y salud real de ambos motores.
   `/api/health?deep=1` requiere revisar `ok` y `services`: su contrato actual
   puede devolver HTTP 200 aunque `ok` sea falso.
3. Sesión con cookies y CSRF; rechazo del login sin token, carga de un PDF privado,
   lectura autorizada, denegación anónima y paginación de 20.
4. Persistencia de sesión, registro y bytes del PDF al recrear PHP/Nginx.
5. Dumps de PostgreSQL y MongoDB más un archivo de `storage/app`; restauración
   en otras bases y otro volumen. Arranca temporalmente la aplicación sobre esa
   restauración, vuelve a iniciar sesión y lee el mismo PDF.
6. Una escritura sintética en la restauración no afecta al origen. Finalmente
   vuelve a los volúmenes/base originales del ensayo y comprueba el PDF.

Los artefactos privados se guardan en `storage/codex-local/portable/`: dumps,
archivo de almacenamiento, acceso sintético, override temporal y `results.json`.
Las bases y el volumen restaurados también se conservan para revisión y sus
nombres se registran en el resultado. No se cambia la DB por defecto del host.

La copia del ensayo se toma sin otras escrituras de aplicación. Un respaldo real
requiere coordinar un punto consistente entre bases y archivos, conservar la
configuración/APP_KEY por separado y comprobar la recuperación completa. No
sustituir una reversión de aplicación por un `migrate:rollback` automático.

Para detener conservando los volúmenes:

```powershell
docker --context default compose --project-name observatorio-portable-ensayo --env-file storage/codex-local/portable/.env -f deploy/portable/compose.yml down
```

Para repetir el ensayo desde cero, **solo con estos datos desechables**:

```powershell
node scripts/reset-portable-rehearsal.cjs
node scripts/test-portable-runtime.cjs
```

El reset comprueba contexto local, proyecto/etiquetas, nombres de volumen y usuarios
sintéticos antes de retirar únicamente los volúmenes declarados del ensayo.
No elimina los archivos de respaldo ni los volúmenes externos de restauración.

## Pendiente de DIIT y límites de esta entrega

### Resultado del ensayo del 30 de octubre de 2026

Se construyeron ambas imágenes y pasaron las **65 comprobaciones** del
verificador completo. Los cuatro servicios quedaron saludables. La sesión y
el PDF privado sobrevivieron a la recreación de PHP/Nginx. Se restauraron
PostgreSQL, MongoDB y los archivos en destinos nuevos, se comprobó la aplicación
sobre esa copia y se volvió al origen del ensayo sin alterar sus registros.

También pasaron los dos contextos sintéticos de construcción: se excluyeron
34 archivos de prueba y se conservaron las 17 entradas necesarias. La evidencia
detallada y los respaldos permanecen en el directorio privado indicado arriba.
No se enviaron solicitudes ni escrituras a producción durante este ensayo.
Las 45 pruebas de contratos, higiene, workflow y detector de secretos también
pasaron sin omisiones.

### Datos que faltan para adoptar el alojamiento

- Sistema operativo/arquitectura, CPU/RAM/disco, Docker permitido o plataforma
  alternativa y política de imágenes/actualización.
- Dominio, terminación TLS, proxy confiable y reglas de entrada/salida. La CSP
  del ensayo conserva los controles de Vercel, cambiando el origen de conexión a
  `self` y omitiendo la mejora a HTTPS para el loopback HTTP. HTTPS, cookies
  seguras y configuración del proxy institucional se validarán antes de publicarlo.
- PostgreSQL/MongoDB propios o gestionados, versiones, identidades, red, cifrado,
  volumen/objeto para PDFs, capacidad, retención y responsables de respaldo.
- Requisitos SPA/SSR, integraciones externas, correo, OAuth y acceso a Microsoft
  Graph. Las pruebas sintéticas no prueban esas credenciales ni llamadas externas.

La fase 4 continúa abierta hasta concretar y ensayar el alojamiento acordado.
Vercel/Render siguen usando sus configuraciones actuales; no se toca `main` ni
`deploy-gratis` ni se promociona este laboratorio como producción.

Referencias primarias: [orden de arranque en Compose](https://docs.docker.com/compose/how-tos/startup-order/),
[Nginx sin privilegios](https://github.com/nginx/docker-nginx-unprivileged),
[FastCGI](https://nginx.org/en/docs/http/ngx_http_fastcgi_module.html#fastcgi_param) y
[migraciones aisladas de Laravel 12](https://laravel.com/framework/docs/12.x/migrations#isolating-migration-execution).
