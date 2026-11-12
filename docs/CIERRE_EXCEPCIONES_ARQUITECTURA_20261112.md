# Cierre de las dos excepciones de arquitectura

12 de noviembre de 2026, America/Guayaquil. Rama
`subsanacion-arquitectura-20261112`, desde `30ff888` de `pruebas-rediseno`.

## Compatibilidad de estadísticas

`GetUnivariableStatsUseCase` deja de importar el formulario HTTP `StatsRequest`.
La regla de tipos compatibles y selección predeterminada pasa a
`Domain/Statistics/UnivariableChartTypes`, sin dependencias de Laravel ni HTTP.
El formulario consume la misma regla y conserva sus constantes y métodos
públicos como delegaciones para compatibilidad.

Se conservan los tipos admitidos, límites, filtros, selección alternativa ante
un tipo incompatible y los servicios de estadísticas usados. Este cambio afecta
al contrato de la API que se mantuvo; no restablece las pantallas ni las
librerías de gráficos retiradas.

## Lectura de PDF compartida

`LegacyPublicationBridge` deja de llamar a `ObservatorioPublicacionController`.
`ReadPublicationPdf` comprueba el acceso y prepara `PublicationPdf`, un DTO con
ruta y nombre del archivo autorizado. Recibe el usuario y un indicador de
contexto de gestión, en lugar de un formulario o una respuesta HTTP.

La apertura del stream y la construcción de la respuesta quedan en
`Presentation/Http/Responses/PublicationPdfResponse`. El controlador actual y
la ficha de reportes antiguos usan ese mismo adaptador. El stream se cierra al
terminar el envío. No se entrega el DTO como JSON ni se publica su ruta interna.

Se conserva el orden de las comprobaciones: observatorio y asignaciones
actuales, eliminación, alcance del administrador, contexto de gestión,
privacidad antigua, estado, categoría de Atlas y suscripción. El puente conserva
además sus restricciones previas de lectura antigua e identidades ambiguas.
Se mantienen códigos HTTP, mensajes, cabeceras y contenido.

Un PDF importado sin copia guardada sigue devolviendo 409; no redirige a
SharePoint ni utiliza silenciosamente el archivo antiguo. Los fallos de
almacenamiento conservan su 503. No cambian rutas, migraciones, asignaciones,
datos almacenados, visores ni configuración de hosting.

## Control y pruebas

El control AST recorre todos los archivos de dominio y aplicación y exige cero
dependencias prohibidas, sin excepciones. Las pruebas negativas impiden
reintroducir tanto el formulario como el controlador. No se añaden supresiones.

Pruebas locales en PHP 8.4.27 aislado, sin `.env` ni acceso a datos productivos:

- PHPStan nivel 5 aprobado en su alcance explícito. Incluye la regla nueva de
  dominio, el DTO PDF y el adaptador de respuesta.
- 385 pruebas PHPUnit, 4.496 aserciones; 8 omisiones previstas para PostgreSQL.
- Diez casos nuevos verifican selección de tipos, filtros y denegación de acceso
  de estadísticas sin construir una petición HTTP.
- Cuatro regresiones nuevas verifican las dos URLs PDF: bytes y cabeceras,
  editor revocado sin leer almacenamiento, copia ausente sin recuperación
  insegura y fallo de almacenamiento sin recurrir al original.
- Las pruebas existentes de revisión, suscriptores, privacidad, identidades,
  reemplazos de PDF, errores y revocaciones siguen aprobando.

La CI del PR vuelve a ejecutar SQLite/PostgreSQL, secretos, higiene, PHPStan,
auditorías, frontend y recorridos de escritorio/móvil antes de integrar.
Sus resultados y la publicación se registran en el PR y el comprobante local.

## Alcance que permanece pendiente

Este cierre elimina dos dependencias concretas y la lista de excepciones del
control de dirección. Aplicación todavía utiliza modelos y contratos de
Laravel/Eloquent; no se certifica una separación total del framework.
PHPStan no analiza aún toda la aplicación. `no-explicit-any` y símbolos sin uso
del frontend siguen diferidos. La confirmación del alojamiento, la operación y
la aceptación de DIIT requieren su propio proceso.
