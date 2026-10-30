# Fase 3: política de publicaciones y capacidades

Primera entrega de la fase 3. La fase continúa abierta: no incluye todavía la
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
