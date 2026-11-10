# Fase 3: almacenamiento PDF e importación SharePoint

Esta entrega separa responsabilidades del controlador de publicaciones sin
cambiar su interfaz, rutas, permisos ni esquema de datos.

## Responsabilidades

- `PublicationPdfStorage`: escritura de PDFs en el disco privado configurado,
  lectura de streams, distinción entre archivo ausente y almacenamiento caído,
  eliminación confirmada y limpieza compensatoria. También libera el archivo
  temporal recibido de `SharePointService`, incluso cuando falla la escritura.
- `SharePointPublicationImporter`: coordinación de copias/importaciones y
  sincronización de enlaces, transacciones, contadores y comprobación de
  duplicados por observatorio. Recibe el usuario y devuelve modelos/resultados;
  no recibe `Request` ni construye `JsonResponse` o recursos HTTP.
- Controlador: valida las entradas y acceso de las rutas, resuelve los archivos
  mediante el proveedor existente y serializa el resultado. La lectura descarga
  continúa autorizada antes de abrir el stream, y lo cierra al terminar.
- Adaptador de artículos/reportes antiguos: usa el mismo almacenamiento para
  sus PDFs, manteniendo sus identidades, payloads y contratos de compatibilidad.

El importador comprueba también en la capa de aplicación que el usuario sea
Administrador activo. Supervisor, Editor, Suscriptor y Usuario no adquieren
acceso a SharePoint. La descarga y validación de destino/tamaño/contenido de
Microsoft Graph siguen en `SharePointService`; esta entrega no amplía destinos
ni introduce llamadas externas en las pruebas automáticas.

## Consistencia y fallos

Las importaciones serializan su escritura por observatorio, o por el contador
global de Atlas, y vuelven a comprobar el duplicado después de descargar.
Categoría y contador conservan el orden de bloqueo de creación nativa de Atlas.
Los registros existentes se bloquean antes de materializar o reemplazar PDFs.
Las descargas externas no mantienen abierta esa transacción SQL.

Los lotes conservan los grupos `imported`, `duplicates`, `rejected`, `errors`
y sus totales. Un fallo revierte el registro y contador de ese elemento; los
otros elementos pueden completarse. Una copia no utilizada se limpia. Los
errores externos se presentan con mensajes controlados: no se reproducen
mensajes crudos del proveedor o de la base de datos en respuesta ni logs.

Una reimportación duplicada materializa el PDF si faltaba y conserva autor,
estado, motivo, fecha de revisión, acceso y código. Una actualización de copia
elimina el PDF anterior solo después de confirmar el guardado; los destinos
con identidad de origen preservan el archivo anterior para su recuperación.
La eliminación de una publicación nativa requiere confirmar la eliminación
de su PDF; si falla, responde 503 y conserva el registro. Los destinos legados
mantienen su eliminación mediante marca y sus archivos de recuperación.

La limpieza compensatoria es de mejor esfuerzo: si el proveedor impide borrar
una copia, se registra un evento controlado sin ocultar el error original.
No hay atomicidad distribuida entre SQL y almacenamiento ni una tarea nueva de
recolección de archivos. Esos eventos requieren conciliación del almacenamiento.

## Validación y despliegue

`PublicationPdfStorageTest` verifica escritura/lectura en disco privado,
streams/temporales cerrados ante fallos, rechazo por tamaño, diagnóstico seguro
y eliminación confirmada. `SharePointPublicationImporterTest` verifica permisos,
duplicados aparecidos durante descarga, contadores, fallos parciales, rollback,
categoría eliminada, conservación de decisiones y PDFs de recuperación.

Estas pruebas y las regresiones de importación/visor se ejecutan en SQLite y
PostgreSQL aislados, con Graph/almacenamiento simulados. Una pasada correcta no
certifica la disponibilidad de Microsoft Graph ni una importación real en
producción. La comprobación desplegada es de solo lectura; no crea publicaciones.

No requiere migraciones, cambios de variables ni conversiones. Se integra en
`pruebas-rediseno` tras CI y se confirma el commit activo en Render. Esta entrega
no cierra la fase 3. Las entregas posteriores de asignaciones y coordinación
se documentan en `ASIGNACIONES_OBSERVATORIOS_FASE3.md` y
`COORDINACION_VISTAS_FASE3.md`.
Barómetro conserva sus contratos y queda pendiente del rediseño del usuario.
