# Fase 3: política de publicaciones y capacidades

Entregas de permisos y flujo de revisión de la fase 3. La fase continúa abierta: no incluye todavía la
extracción de importaciones SharePoint, archivos o coordinación de formularios,
ni una política de asignación de editores. Barómetro conserva su contrato.

## Autoridad y alcance

`ObservatorioPublicacionPolicy` centraliza creación en observatorios, lectura de
gestión, edición, eliminación y revisión. `User::canReadPublicationForManagement`
delega en esta política para mantener compatibles los lectores actuales.

- Administrador conserva la gestión general, incluido Atlas.
- Supervisor gestiona publicaciones editoriales del observatorio asignado solo
  cuando su permiso actual de edición y revisión está habilitado.
- Editor gestiona sus publicaciones de observatorios actualmente asignados. Una
  publicación rechazada queda en solo consulta.
- Suscriptor y Usuario no adquieren permisos de escritura.
- La creación y escritura consultan asignaciones actuales, aunque existan
  relaciones cargadas antes de una revocación. Cuentas inactivas o eliminadas y
  destinos marcados como eliminados no reciben permisos de gestión.

Las escrituras nativas y las rutas compatibles de artículos/reportes usan la
misma política. Guardar/eliminar vuelve a autorizar sobre el registro bloqueado
dentro de la transacción. Las validaciones de campos, observaciones y estados
se conservan; recibir capacidades anteriormente no autoriza una escritura futura.

Los filtros SQL de alcance y los controles de descarga permanecen activos.
`view` expresa lectura en contexto de gestión o lectura publicada permitida;
no sustituye los requisitos de contexto de cada endpoint de descarga ni
desclasifica contenido legado privado.

## Contrato aditivo de gestión

Bibliotecas, detalle, respuestas de creación/edición y filas del espacio de
trabajo incorporan:

```json
{"capabilities":{"can_view":true,"can_edit":true,"can_delete":false,"can_review":false}}
```

Las capacidades se calculan para el usuario autenticado y recurso concreto.
El catálogo público mantiene su contrato. `can_review` corresponde al flujo
editorial de artículos, reportes y libros, no a Atlas. `can_view` no garantiza
que haya un PDF/enlace: la interfaz comprueba también disponibilidad y bloqueo.

La biblioteca, lista editorial y formulario de edición consumen las capacidades
para sus acciones. Si faltan, las acciones dependientes se deniegan; no se
reconstruyen a partir del rol o autor en el navegador. La navegación y creación
conservan los controles actuales del observatorio y el endpoint `can-upload`,
que ahora delega su decisión en la política.

## Comprobación y despliegue

`PublicationCapabilitiesTest` contrasta capacidades y autorización Gate para
roles, estados y tipos; verifica escrituras HTTP, revocación con relaciones
precargadas, rechazos, cuenta inactiva, padre eliminado, tombstones y Atlas.
Se ejecuta en SQLite y PostgreSQL aislados, junto a las regresiones existentes.
Las pruebas de interfaz comprueban denegación con capacidades ausentes,
acciones independientes y controles de revisión.

Publicar primero backend y verificarlo; después frontend. El cambio del backend
es aditivo y admite al cliente anterior. Un frontend actualizado frente a un
backend anterior ocultaría acciones por falta de capacidades. No hay migración
ni conversión de datos en esta entrega.

## Flujo compartido de revisión

`PublicationReviewWorkflow` calcula la decisión editorial en la capa de
aplicación. Devuelve `PublicationReviewDecision`, un resultado inmutable que
solo contiene estado, observación y fecha de revisión. Los controladores y
adaptadores guardan ese resultado junto con los metadatos en su transacción;
para actualizar, reciben el registro actual bloqueado y vuelven a autorizar.

El flujo de artículos, reportes y libros conserva los cinco estados y las
reglas de roles. El editor crea en revisión y corrige contenido sin alterar
una decisión ajena; el rechazo continúa impidiendo la escritura. Los revisores
deben incluir un motivo para suspender, archivar o rechazar. El flujo valida
también estado, tipo de observación y longitud aunque se invoque sin FormRequest.

Las rutas antiguas normalizan `PUBLICADO` y `BORRADOR` antes de llamar al mismo
flujo. Mantienen sus campos y validaciones de compatibilidad, incluido el rechazo
de intentos del editor de cambiar estados. No se convierten datos ni se escriben
filas en las tablas antiguas por esta extracción.

Las escrituras nuevas de ambas rutas comparten estas reglas de fecha:

- Una decisión con motivo registra la fecha y recorta espacios del motivo.
- Guardar el mismo estado y motivo conserva su fecha; también al corregir
  metadatos o normalizar espacios de una observación antigua.
- Cambiar el estado de la decisión o su motivo registra una fecha nueva.
- Volver a publicado o en revisión limpia motivo y fecha de la decisión.
- Corregir contenido como editor conserva íntegros motivo, estado y fecha.

Esto alinea las rutas antiguas con las actuales: antes una creación antigua
podía tener motivo sin fecha y una edición repetida podía moverla. Los registros
históricos no se reescriben en lote; la regla se aplica al guardar. Si faltaba
la fecha de una decisión con motivo, se registra al guardarla por un revisor.

`PublicationReviewWorkflowTest` cubre ambos accesos, roles, estados, fechas,
revocaciones y rollback ante errores posteriores al guardado. Se ejecuta tanto
en SQLite como en PostgreSQL aislados. No cambia el contrato de capacidades,
la interfaz ni la configuración de acceso público.
