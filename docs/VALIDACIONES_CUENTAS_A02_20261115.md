# A-02, tercer bloque: cuentas, perfil y gestión de accesos

15 de noviembre de 2026, America/Guayaquil. Rama
`subsanacion-validaciones-cuentas-20261115`, desde `8ef1646` de `pruebas-rediseno`.
Continúa las [validaciones editoriales](VALIDACIONES_EDITORIALES_A02_20261115.md).

## Resultado

UserController, ProfileController y ObservatoryAccessController dejan de validar
inline. Sus acciones con entrada usan FormRequest y validated(); no se añaden
campos ficticios a acciones sin payload. Los filtros conservan los Resources,
orden, paginación y ámbitos de Administración/Supervisor existentes.

Se revisan también los FormRequest de creación/edición de cuenta, cambio de rol,
contraseña, registro y guardado de permisos. La normalización acepta únicamente
cadenas; una lista u otro tipo en rol produce 422 en vez de TypeError. El registro
conserva la normalización de correo y evita convertir listas a cadenas.

## Contratos y límites

- Filtros: per_page entre 1 y 100, page entre 1 y 1.000.000; search hasta 255
  caracteres, UTF-8 válido y sin NUL. Roles y purpose con listas permitidas.
  La autorización precede a la validación de campos.
- Texto de cuenta/perfil/institución: límites existentes, tipo explícito y
  comprobación DatabaseText antes de consultas de unicidad o escrituras.
  Se conservan los condicionales de institución y los intereses públicos vivos.
- Contraseñas nuevas: mínimo de ocho caracteres y máximo de 72 bytes,
  UTF-8 válido, sin NUL. Incluye alta/edición administrativa, reset y registro.
  No se modifican hashes ni contraseñas existentes. La confirmación se conserva
  donde ya formaba parte del contrato; no se exige en el alta administrativa.
- Estado: booleanos y representaciones 0/1 aceptadas por la regla boolean de
  Laravel. null, listas y cadenas como "false" se rechazan; ya no se interpretan
  mediante un cast de entrada libre. Omitir is_active conserva la acción de alternar.
- Avatar: imagen JPEG/PNG/WebP real con extensión correspondiente, hasta 2 MiB,
  dimensiones máximas de 4096 × 4096. Una imagen llamada .php se rechaza antes
  de reemplazar el avatar anterior. Se conserva el servicio de almacenamiento
  existente; esta entrega no incorpora recodificación de imágenes.
- Permisos: lista no vacía de hasta 1000 filas; filas de tipo array, módulos,
  niveles, UUID vivos y flags válidos. Una lista sobredimensionada o con claves
  no secuenciales falla antes de expandir comodines o consultar cada observatorio.
  Los permisos extras que el servicio no consume no conceden capacidades.
- Rutas de usuarios/accesos: IDs decimales positivos de hasta 18 dígitos. Valores
  mal formados, cero, negativos o desbordados devuelven 404 antes de binding,
  SQL o conversión a int. Los IDs actuales y los inexistentes válidos mantienen
  su comportamiento.

Los servicios y políticas de revisión, roles y accesos no se sustituyen. Se
conservan la transacción de asignación, revalidación de capacidades/revocación,
promoción delegada a Editor y permisos fuera del ámbito del Supervisor.
El perfil público no admite cambios de rol, correo, activación ni otra cuenta.
Se mantienen revocación de sesiones/tokens al cambiar contraseña y la prohibición
de autodesactivarse mediante la acción específica de estado. No se introduce
una nueva política de último administrador en las demás acciones.

## Verificación

AccountInputValidationTest aporta 55 casos con cuentas, bases, imágenes y permisos
sintéticos: errores sin escrituras/revocación, rol como lista, contraseñas por
bytes, autorización, preferencias, avatar, límites de lote y filtros/rutas.

- Backend completo local: 570 casos, 6680 aserciones; ocho omisiones previstas PG.
- PostgreSQL 16 local: 88 casos de cuentas, contraseñas, perfil y accesos,
  842 aserciones, aprobados.
- PHPStan aprobado en su alcance declarado más BcryptPasswordBytes; no se afirma
  análisis estático de todos los controladores/FormRequest.
- 29 controles de higiene/workflow aprobados. CI exige también este bloque,
  contraseñas, preferencias de registro y cuentas inactivas en PostgreSQL.

Sin migraciones, dependencias, cambios visuales, fixtures en producción ni
alteraciones de los datos publicados. Las lecturas de despliegue, CI e integración
se registran por separado en output/ y storage/codex-local/a02-cuentas-20261115/,
fuera de Git. Integrar tras revisar el diff y aprobar la CI del mismo head;
sincronizar main conservando deploy/portable y deploy-gratis.

## Continuidad

A-02 permanece parcial. Quedan validaciones inline en cuatro controladores:
DatasetController, DashboardController, ArticuloController y ReporteController.
También quedan parámetros leídos/casteados manualmente en API antiguas de
datos/estadísticas. Sigue el bloque de adaptadores conservados; retirarlos no
forma parte de esta entrega. No se afirma 100% FormRequest ni aceptación DIIT.
El balance mantiene ocho NC con evidencia técnica y siete parciales; la matriz
del 12 de noviembre conserva su corte histórico.
