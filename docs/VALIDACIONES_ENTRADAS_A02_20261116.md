# A-02, quinto bloque: inventario y entradas previas a la validación

16 de noviembre de 2026, America/Guayaquil. Rama
`subsanacion-inventario-entradas-a02-20261116`, desde `9ff8ca9` de `pruebas-rediseno`.
Continúa las [API conservadas](VALIDACIONES_LEGADAS_A02_20261115.md).

## Resultado

El [inventario por ruta](INVENTARIO_ENTRADAS_HTTP_A02_20261116.md) contiene 150
entradas efectivas de Laravel: 76 FormRequest directos, cuatro validaciones
tardías del legado, 62 acciones sin payload propio, siete rutas de proveedor
y un booleano de sistema. El comando de solo lectura
`php backend/scripts/inventory-http-entrypoints.php` permite repetir el corte;
también se ejecuta en el entorno aislado de CI. No es una medida de cobertura
de pruebas ni acredita por sí mismo el requisito de 100% FormRequest.

## Correcciones

- Login: un correo enviado como array provocaba un 500 durante la normalización.
  Ahora se comprueban tipo, longitud y UTF-8 antes de normalizar; el correo se
  valida como texto de hasta 255 caracteres. Registro también evita normalizar
  bytes inválidos. Se preserva el acceso con contraseñas existentes, sin añadir
  al login una longitud mínima o una política nueva de contraseñas.
- GoogleCallbackRequest valida exclusivamente la query: code ASCII imprimible
  de hasta 4096 caracteres y state base64url de 43 caracteres, correspondientes
  a los 32 bytes aleatorios generados por el servicio. Es un límite de esta
  aplicación, no un máximo publicado por Google. El callback no recorta esos
  valores. Faltantes/denegación conservan la redirección fija cancelled; formatos
  inválidos y estados expirados usan failed. No se reflejan entradas en la URL.
  Datos malformados no consumen el state ni canjean un código.
- PublicationReadRequest valida context en lectura actual/antigua y fichas;
  LegacyCatalogRequest hace lo mismo en los catálogos antiguos. Se admite
  public/management o ausencia. management sigue requiriendo identidad, acceso
  al observatorio y permiso sobre la publicación; no se convierte en un permiso.
- Los limitadores nombrados de correo soportan tipos inválidos, acotan la
  normalización y conservan correo hash/IP. **No están conectados a las rutas
  actuales**, que usan throttle por IP. No se cambia esa política ni se atribuye
  a esos limitadores el 500 del login.
- Las tres rutas de consulta/edición/borrado de observatorio exigen UUID antes
  de auth/SQL. Esto deja alcanzable el alias público /api/departamentos/publicos
  previamente oculto por la ruta genérica. Los nombres de avatar se acotan a
  250 caracteres antes de la extensión permitida, hasta 255 en total.
- Se retira una declaración web antigua de storage que el proveedor de Laravel
  reemplazaba en este runtime. Se conservan las rutas privadas firmadas del
  framework, el endpoint público de avatares y las descargas autorizadas de PDF.
  No se acreditó exposición anónima de PDF en el runtime actual: el ensayo
  sintético de la ruta efectiva devolvió 403 antes y después.
- En el ingreso Nginx, /api/ tiene precedencia sobre las extensiones estáticas y
  se envía siempre al front controller conservando query/método. Antes una URL
  /api/avatars/*.png terminaba en el bloque estático y no llegaba a Laravel.
  Se prueba con Nginx/PHP reales y un front controller sintético, incluyendo un
  archivo estático bajo /api/ que tampoco puede saltarse ese enrutamiento.
  Las seis solicitudes API y tres controles de estáticos/denegación pasan.
  Esto corrige la precedencia de API; no modifica el ingreso portable ni acredita
  todas las ubicaciones de storage del host. La tabla de 150 rutas refleja
  Laravel, mientras que el ingreso del servidor se verifica por separado.

El servicio OAuth conserva state de un uso, nonce, PKCE, verificación del token
y código de acceso de un uso. No cambia el protocolo ni las credenciales.
Referencia primaria: [flujo OpenID Connect de Google](https://developers.google.com/identity/openid-connect/openid-connect).

## Verificación local

- 23 casos nuevos de ProtocolInputValidationTest: errores de tipo/tamaño, UTF-8,
  redirecciones, query frente a cuerpo GET, estado no consumido, permisos y
  asignaciones revocados, login válido, archivos y restricciones de ruta.
- Backend completo: 654 pruebas, 7572 aserciones; ocho omisiones PG previstas
  y una de Mongo no configurado en esa ejecución. El código Mongo no cambia.
- PostgreSQL 16 desechable: 111 pruebas seleccionadas, 959 aserciones, aprobadas.
- PHPStan y arquitectura aprobados en sus alcances declarados; 29 controles
  de higiene/workflow aprobados. Las suites de protocolo y OAuth también se
  exigen en PostgreSQL de CI.
- Ensayo Nginx/PHP: seis rutas API y tres controles de estáticos/denegación,
  imágenes fijadas por digest, archivos sintéticos y ningún puerto de host.
  La configuración anterior falla en ese mismo ensayo por el avatar.
- Sin proveedores reales, cuentas o datos productivos en las pruebas. Las
  lecturas publicadas se verifican por separado. No hay migraciones, cambios
  visuales ni dependencias de aplicación.

## Continuidad

A-02 sigue parcial. El inventario identifica como siguiente bloque la revisión
de Create/UpdateDepartamentoRequest, UploadDatasetRequest y ConfirmImportRequest:
texto/UTF-8/NUL, reglas de listas/opciones, límites y contratos reales de
persistencia/importación. Detectar FormRequest no demuestra que todas sus reglas
sean suficientes. La política común de contraseñas corresponde a A-08; OAuth,
correo y proveedores reales siguen pendientes de homologación A-10.

El balance institucional no cambia: ocho NC con evidencia y siete parciales,
sin aceptación de DIIT. La matriz conserva su corte histórico y enlaza este
avance. Integrar tras diff/CI del mismo head, verificar el deploy y sincronizar
main conservando deploy/portable y deploy-gratis.
Evidencia privada: storage/codex-local/a02-entradas-20261116/ y output/.
