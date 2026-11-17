# A-02, sexto bloque: observatorios y confirmación de importaciones

17 de noviembre de 2026, America/Guayaquil. Rama
`subsanacion-formularios-importacion-a02-20261117`, desde `113e1f1` de
`pruebas-rediseno`. Continúa el [inventario de entradas](VALIDACIONES_ENTRADAS_A02_20261116.md).

## Resultado

Se revisan los cuatro FormRequest preexistentes de creación/edición de
observatorios, carga de datasets y confirmación de columnas. Conservar un
FormRequest no bastaba: un código duplicado al editar o un tipo_detectado
arbitrario podía alcanzar una restricción SQL; columnas duplicadas, nombres
inexistentes y opciones sin límites llegaban a la sustitución de metadatos.

| Entrada | Contrato comprobado |
| --- | --- |
| Observatorio | solo administrador; texto UTF-8 sin NUL; nombre 255, código 50, descripción 1000; icono conserva 100 al crear y 50 al editar |
| Código al editar | único incluyendo observatorios eliminados; ignora únicamente el UUID de la ruta, nunca un ID del cuerpo; conservar el propio código es válido |
| Foto | archivo JPG/JPEG/PNG/WebP, MIME y extensión correspondientes; hasta 2 MiB y 4096 × 4096; conserva miniatura JPEG en la base y eliminación de foto |
| Carga de dataset | solo administrador, observatorio existente no eliminado; nombre 255/ descripción 1000 sin NUL y UTF-8 válido; Excel XLSX/XLS/CSV hasta 50 MiB con extensión correspondiente |
| Columnas confirmadas | lista de 1 a 200 columnas, hasta 256 KiB JSON en total; sin expansión de comodines ante lote/tamaño/JSON inválidos |
| Nombre de salida | único, hasta 255; letra ASCII o guion bajo inicial y luego letras, números o guiones bajos; se conserva renombrar columnas |
| Nombre original | texto UTF-8 de hasta 255, sin NUL; debe corresponder al encabezado del archivo al importar |
| Tipos | NUMERICO, CATEGORICO, FECHA o TEXTO tanto para tipo_dato como tipo_detectado |
| Visibilidad/orden | booleanos de transporte 0/1 válidos; orden entero 0–2147483647; la persistencia sigue ordenando por posición en la lista |
| Opciones/muestra | opciones: hasta 100 valores simples; muestra_valores: hasta cinco; cada texto hasta 2048 y cada lista hasta 32 KiB, sin objetos anidados/NUL/UTF-8 inválido |

Los límites de lote y JSON son nuevos contratos deliberados. Coinciden con el
análisis de muestras de hasta cien valores y cinco ejemplos. El límite de 200
columnas se aplica también a los encabezados de origen. Cabeceras que colisionan
tras normalizar, carecen de letras/números o superan 255 caracteres fallan con
422. No se asignan claves aleatorias que luego cambien entre analizar e importar.

## Integridad y conservación

El lector resuelve cada encabezado original a su posición y escribe con el nombre
de salida confirmado. La interfaz ya permitía renombrarlo, pero el lector anterior
buscaba el nombre nuevo en los encabezados y podía omitir esa columna. Ahora se
conservan sus valores y la exclusión de columnas no seleccionadas. Se mantienen
conversiones, valores cero, muestreo y tamaño de lote de 500 filas.

Antes de eliminar metadatos o filas previos se inicia el generador: carga el
archivo, valida encabezados y correspondencia de columnas y obtiene su primer
resultado. Un rechazo de esquema ocurre antes de cualquier sustitución. El
error de esquema usa una excepción de dominio que el controlador traduce a
422; el lector se puede probar sin contexto HTTP. El libro se libera al finalizar
o fallar y se conserva la retirada del archivo temporal.

Los nombres de archivos nuevos son UUID más extensión validada. Antes se usaba
segundo actual y nombre original: dos cargas del mismo nombre podían sobrescribir
el objeto. No se renombran ni se eliminan archivos existentes; la respuesta HTTP
de carga sigue sin exponer la ruta privada.

Se conservan las comprobaciones del caso de uso de pertenencia al observatorio
y estado PENDIENTE, así como los rechazos de asignaciones o padres eliminados.
El servidor decide dataset, creador, total y estado; opciones/muestras no pueden
inyectar esos atributos. La muestra se acepta para compatibilidad del frontend
y no se persiste como metadato.

## Verificación y límites

La suite nueva ObservatoryImportValidationTest contiene 40 casos HTTP sobre
límites, duplicados activos/eliminados, texto binario, imágenes reales, archivos,
tipos y errores sin cambios SQL/archivos. Incluye 200 columnas válidas, renombrado,
selección, booleanos numéricos, datos procesados y cargas del mismo nombre.
ExcelReaderServiceTest añade nueve casos al alcance previo y comprueba lectura
real de CSV/XLS/XLSX, conversión, renombrado y errores de encabezados.

- Backend completo local: 703 casos, 7868 aserciones; ocho omisiones PG previstas
  y una de Mongo no configurado. No se modifica el código Mongo.
- PostgreSQL 16 local seleccionado: 150 casos, 1284 aserciones.
- Rutas en caché: 77 casos, 515 aserciones.
- PHPStan y arquitectura aprobados en sus alcances declarados; ImportValueList
  entra en PHPStan. Higiene/workflow: 29 controles aprobados. CI exige también
  las suites de importación y lector real en PostgreSQL.

SQL y archivos sintéticos; el repositorio de filas se controla en las pruebas
HTTP, sin escribir MongoDB ni proveedores productivos. El lector usa archivos
reales generados en aislamiento. No hay migraciones, nuevas dependencias ni
cambios visuales. Las lecturas del despliegue se verifican por separado.

Este bloque valida metadatos y esquema de importación; no crea una transacción
distribuida SQL/MongoDB ni resuelve importaciones concurrentes o fallos de un lote
posterior. Esos aspectos requieren un diseño de ingestión/recuperación específico.
PhpSpreadsheet sigue cargando el libro completo: el límite de archivo no acredita
un consumo máximo de memoria ni una auditoría completa de libros comprimidos.

## Continuidad

Los cuatro formularios identificados en el bloque anterior tienen ahora revisión
y regresiones. A-02 sigue parcial frente a la exigencia literal de 100% FormRequest:
el inventario distingue acciones sin payload, rutas de framework y validaciones
tardías que DIIT debe aceptar o precisar. No se cambia su estado institucional
por contar clases o por aprobar CI. El siguiente bloque técnico propuesto es
A-08, política común de contraseñas y recuperación, seguido por medición/calidad.

Integrar tras revisión y CI del mismo head, comprobar frontend/API efectivos y
sincronizar main conservando deploy/portable y deploy-gratis. Evidencia privada
en storage/codex-local/a02-formularios-20261117/ y output/.
