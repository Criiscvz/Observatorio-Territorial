# Fase 3: asignaciones de observatorios

La gestión de accesos usa una política y un caso de uso compartidos. Se conserva
la lista compacta, los formularios y las rutas anteriores de guardado.

## Responsabilidades y alcance

- `ObservatoryAccessPolicy` decide consulta, asignación y revocación a partir de
  la cuenta activa, el rol y las asignaciones actuales consultadas en la base.
- `ManageObservatoryAccess` prepara el contexto del formulario y coordina el
  guardado. La promoción de Usuario a Editor y sus permisos forman una única
  transacción. Bloquea las cuentas en orden estable y vuelve a autorizar antes
  de escribir; no confía en relaciones cargadas previamente ni datos del cliente.
- Administrador conserva la configuración global. Supervisor solo asigna
  editores donde tiene `puede_agregar_editores`. Puede consultar los editores
  compartidos aunque no tenga ese permiso, sin modificarlos.
- Al guardar o quitar accesos delegados se preservan los observatorios ajenos
  al alcance modificable y los permisos de otros módulos. Un Supervisor no puede
  conceder revisión, delegación ni otro rol mediante el payload de permisos.
- Las cuentas inactivas no se pueden promover mediante delegación. Los
  observatorios eliminados no aparecen ni se aceptan como nuevas asignaciones.

## Contrato para la interfaz

`GET /api/accesos/contexto` devuelve capacidades de la sesión.
`GET /api/accesos/usuarios/{user}` devuelve `capabilities`, `observatorios` y
`permisos`, restringidos al alcance del actor. Ambas rutas requieren una sesión
de Administrador o Supervisor. No exponen secretos ni amplían permisos.

Los listados de gestión añaden `access_capabilities` por usuario y la capacidad
`can_assign_editors` a sus metadatos. Los indicadores de cada usuario son
`can_view_access`, `can_manage_access`, `can_assign_editors` y
`can_revoke_access`. Las respuestas de inicio de sesión no cambian.

La interfaz espera el contexto de la API antes de habilitar acciones. No utiliza
el almacenamiento local de permisos para elegir observatorios o autorizar el
guardado. Ante errores o capacidades ausentes mantiene la consulta sin edición.
Las comprobaciones del servidor siguen siendo obligatorias en cada guardado.

## Verificación y publicación

Las pruebas cubren ámbitos cruzados, módulos y flags manipulados, revocación con
relaciones obsoletas, cuentas inactivas, observatorios eliminados, conservación
de accesos ajenos y reversión de la promoción cuando falla la persistencia.
La interfaz comprueba también capacidades ausentes y respuestas de solo lectura
aunque el rol almacenado localmente sea Administrador.

Publicar primero el backend y verificarlo antes de integrar el cliente. Los
endpoints anteriores permanecen disponibles durante esa transición. No hay
migraciones, nuevas variables ni escrituras masivas sobre asignaciones actuales.

Esta entrega no cierra la fase 3: queda separar coordinación de las vistas grandes.
Barómetro mantiene sus contratos y su rediseño continúa aplazado.
