# Fase 3: coordinación de la biblioteca y del editor del observatorio

La pantalla del observatorio conserva el diseño, los pasos del formulario, la
ventana central, el visor y la paginación de 20 publicaciones. Esta entrega
separa la carga, el borrador y los efectos de guardado de su presentación.

## Responsabilidades

- `ObservatoryWorkspaceFacade` mantiene el observatorio actual, biblioteca,
  cola de revisión, filtros, páginas, contadores y errores de carga. Coordina
  revisión, eliminación y sincronización y recarga las páginas desde la API.
  No calcula agregaciones de negocio sustituyendo los totales del servidor.
- `PublicationEditorFacade` mantiene el borrador, autores, selección de PDF,
  validaciones, pasos, serialización y ciclo de guardado. Conserva el PDF y
  los datos introducidos cuando el servidor devuelve una validación fallida.
- `DepartamentoDetailComponent` conecta la ruta con estos estados y atiende
  diálogos, confirmaciones, avisos y visor. Sus delegados mantienen el contrato
  de la plantilla existente. `ObservatoryLibraryComponent` sigue siendo el
  componente de presentación de la biblioteca.

Ambas facades se proveen en el componente, sin instancia global. Dos pantallas
no comparten borradores, archivos, páginas ni peticiones. No dependen de las
instancias de diálogos o del router para preparar y guardar un formulario.

## Navegación y peticiones pendientes

Cambiar de observatorio cancela la observación de las peticiones de metadatos,
permisos, biblioteca, revisión y comandos del contexto anterior. Reinicia el
borrador, selección local, cola y páginas. Una recarga tardía del importador
anterior no consulta ni reemplaza la biblioteca actual. Cerrar o destruir la
vista también termina las suscripciones de guardado.

Una confirmación antigua no puede editar, eliminar o revisar una publicación de
otro observatorio mostrado. Las capacidades ausentes continúan denegando las
acciones. La API sigue siendo la autoridad y vuelve a comprobar cada escritura.

Cancelar la observación HTTP no garantiza deshacer una operación que el servidor
ya recibió: evita que su respuesta altere la pantalla siguiente. No se reintentan
escrituras automáticamente. Si hay dudas sobre un guardado, consultar la biblioteca
actual antes de enviarlo de nuevo.

## Verificación y alcance

Las regresiones conservan las pruebas del diálogo, navegación desde Publicaciones,
visor con reemplazo local, estados, motivos, suscriptores, paginación y permisos.
Las pruebas de facades añaden aislamiento entre pantallas, respuestas tardías,
cancelación al navegar/destruir, recuperación de errores, rechazo de acciones
de otro ámbito y prevención de guardados simultáneos.

Sin cambios de API, esquema, variables o archivos almacenados. Las lecturas de
producción se verifican tras integrar el cliente; las pruebas de escritura usan
dobles locales y las bases desechables de CI. Barómetro conserva sus contratos.

Esta entrega se concentra en biblioteca, revisión y editor del observatorio;
la fase 3 continúa abierta para revisar el alcance restante de las vistas.
