# Inventario de entradas HTTP — A-02, 16 de noviembre de 2026

Corte obtenido en el entorno sintético mediante `php backend/scripts/inventory-http-entrypoints.php`.
Se inspecciona la tabla registrada por Laravel, incluyendo alias, rutas web y proveedores.
GET/HEAD se cuentan como una entrada. Es un inventario de mecanismos, no un porcentaje de seguridad.
El ingreso Nginx se comprueba por separado: /api/ debe preceder a las extensiones
estáticas para llegar a Laravel, incluidos los avatares. El ensayo sintético
verifica seis rutas API y tres controles de estáticos/denegación. La tabla no
acredita por sí sola la configuración completa del servidor o de sus ubicaciones storage.

## Recuento

- Sin payload propio; identidad/ruta/autorización: 62.
- FormRequest directo: 76.
- FormRequest tardío bajo resolución del legado: 4.
- Contrato del framework/proveedor: 7.
- Booleano de sistema (deep): 1.
- Total: 150.

## Alcance de la revisión

Los FormRequest directos se identifican por reflexión. Los cuatro writes de artículos/reportes
antiguos se validan después de resolver su origen y conservar el bloqueo, mediante los FormRequest
del bloque anterior. Las acciones sin payload consumen identidades de ruta, la sesión o configuración
servidora; no se añaden formularios vacíos a lecturas, borrados, logout o sincronizaciones sin cuerpo.
Las restricciones de ruta y los permisos siguen siendo necesarios aunque haya FormRequest.

Se revisaron las lecturas HTTP explícitas, los normalizadores y los hooks previos a la validación.
Login/registro solo normalizan correo textual UTF-8; OAuth valida query, formato/tamaño y conserva
redirecciones fijas. El callback no recorta code/state. El contexto de lectura acepta public/management
y nunca concede permisos por sí solo. Los limitadores de correo nombrados están protegidos frente a
tipos inválidos, pero las rutas actuales siguen usando throttle por IP; no se cambia esa política.

Las rutas privadas storage/{path} GET/PUT de este runtime pertenecen a Laravel y exigen firma.
La antigua declaración web duplicada, reemplazada por el proveedor en este corte, se retiró para
que no reaparezca como fallback sin firma al cambiar la configuración del host. No se acreditó una
descarga privada anónima en el runtime actual: las pruebas sintéticas devolvieron 403.
Avatares públicos y PDF autorizados conservan sus rutas propias. El límite del nombre del avatar
y los UUID de las tres rutas CRUD de observatorios quedan explícitos.

## Pendientes acreditados

A-02 sigue parcial: los FormRequest preexistentes Create/UpdateDepartamentoRequest,
UploadDatasetRequest y ConfirmImportRequest conservan reglas antiguas que necesitan reforzar texto,
listas/opciones, límites y equivalencia con PostgreSQL/importación. No se valida la totalidad del
payload solo por detectar un tipo FormRequest. La política de contraseñas es A-08; la homologación
de OAuth/correo/proveedores reales y las excepciones de framework requieren revisión posterior.
DIIT debe acordar el tratamiento de rutas sin payload y de proveedor para su requisito literal
de 100% FormRequest. Este inventario no sustituye esa aceptación ni cierra A-02.

## Por ruta

Las clases FormRequest se muestran con su nombre corto; todas pertenecen a
`App\Presentation\Http\Requests`. Los parámetros listados son restricciones del enrutador.

| Método | Ruta | Acción | FormRequest / mecanismo | Parámetros acotados |
| --- | --- | --- | --- | --- |
| GET | `/` | routes/web.php | Sin payload propio; identidad/ruta/autorización | — |
| GET | `/api/accesos/contexto` | ObservatoryAccessController@overview | Sin payload propio; identidad/ruta/autorización | user |
| GET | `/api/accesos/usuarios/{user}` | ObservatoryAccessController@context | Sin payload propio; identidad/ruta/autorización | user |
| GET | `/api/admin/configuracion` | AdminWorkspaceController@configuration | Sin payload propio; identidad/ruta/autorización | — |
| PUT | `/api/admin/configuracion` | AdminWorkspaceController@updateConfiguration | UpdatePortalConfigurationRequest | — |
| GET | `/api/admin/inicio` | AdminWorkspaceController@summary | Sin payload propio; identidad/ruta/autorización | — |
| GET | `/api/admin/publicaciones` | AdminWorkspaceController@indexPublications | WorkspacePublicationFiltersRequest | — |
| GET | `/api/articulos` | ArticuloController@index | LegacyCatalogRequest | — |
| POST | `/api/articulos` | ArticuloController@store | FormRequest tardío bajo resolución del legado | — |
| DELETE | `/api/articulos/{id}` | ArticuloController@destroy | Sin payload propio; identidad/ruta/autorización | id |
| GET | `/api/articulos/{id}` | ArticuloController@show | PublicationReadRequest | id |
| PUT | `/api/articulos/{id}` | ArticuloController@update | FormRequest tardío bajo resolución del legado | id |
| GET | `/api/atlas/categorias` | AtlasCategoriaController@index | Sin payload propio; identidad/ruta/autorización | — |
| POST | `/api/atlas/categorias` | AtlasCategoriaController@store | SaveAtlasCategoriaRequest | — |
| GET | `/api/atlas/categorias/directorio` | AtlasCategoriaController@directory | AtlasDirectoryRequest | — |
| DELETE | `/api/atlas/categorias/{categoria}` | AtlasCategoriaController@destroy | Sin payload propio; identidad/ruta/autorización | categoria |
| PUT | `/api/atlas/categorias/{categoria}` | AtlasCategoriaController@update | SaveAtlasCategoriaRequest | categoria |
| POST | `/api/atlas/categorias/{categoria}/enlaces` | AtlasEnlaceController@store | SaveAtlasEnlaceRequest | categoria |
| PATCH | `/api/atlas/enlaces/{publicacion}` | AtlasEnlaceController@update | SaveAtlasEnlaceRequest | publicacion |
| GET | `/api/auth/google/callback` | AuthController@googleCallback | GoogleCallbackRequest | — |
| POST | `/api/auth/google/exchange` | AuthController@googleExchange | GoogleCodeExchangeRequest | — |
| GET | `/api/auth/google/redirect` | AuthController@googleRedirect | Sin payload propio; identidad/ruta/autorización | — |
| GET | `/api/avatars/{filename}` | routes/api.php | Sin payload propio; identidad/ruta/autorización | filename |
| GET | `/api/categorias` | CategoriaDatasetController@index | Sin payload propio; identidad/ruta/autorización | — |
| GET | `/api/categorias/{codigo}` | CategoriaDatasetController@show | Sin payload propio; identidad/ruta/autorización | codigo |
| GET | `/api/categorias/{codigo}/datasets` | CategoriaDatasetController@datasets | Sin payload propio; identidad/ruta/autorización | codigo |
| GET | `/api/datasets` | DatasetController@index | DatasetFiltersRequest | dataset |
| POST | `/api/datasets` | DatasetController@store | UploadDatasetRequest | dataset |
| GET | `/api/datasets/{datasetId}/fuentes` | DatasetFuenteController@index | Sin payload propio; identidad/ruta/autorización | datasetId |
| POST | `/api/datasets/{datasetId}/fuentes` | DatasetFuenteController@store | SaveDatasetFuenteRequest | datasetId |
| GET | `/api/datasets/{datasetId}/graficos-predeterminados` | GraficoPredeterminadoController@index | Sin payload propio; identidad/ruta/autorización | datasetId |
| POST | `/api/datasets/{datasetId}/graficos-predeterminados` | GraficoPredeterminadoController@store | SaveGraficoPredeterminadoRequest | datasetId |
| DELETE | `/api/datasets/{dataset}` | DatasetController@destroy | Sin payload propio; identidad/ruta/autorización | dataset |
| GET | `/api/datasets/{dataset}` | DatasetController@show | Sin payload propio; identidad/ruta/autorización | dataset |
| PUT | `/api/datasets/{dataset}` | DatasetController@update | UpdateDatasetRequest | dataset |
| POST | `/api/datasets/{dataset}/analyze` | DatasetController@analyze | Sin payload propio; identidad/ruta/autorización | dataset |
| GET | `/api/datasets/{dataset}/data` | DatasetController@data | DatasetDataRequest | dataset |
| POST | `/api/datasets/{dataset}/import` | DatasetController@import | ConfirmImportRequest | dataset |
| GET | `/api/departamentos` | DepartamentoController@index | Sin payload propio; identidad/ruta/autorización | departamento |
| POST | `/api/departamentos` | DepartamentoController@store | CreateDepartamentoRequest | departamento |
| GET | `/api/departamentos/publicaciones/atlas-biblioteca` | ObservatorioPublicacionController@atlasLibrary | AdminAtlasLibraryRequest | — |
| GET | `/api/departamentos/publicaciones/atlas-global` | ObservatorioPublicacionController@indexGlobalAtlas | Sin payload propio; identidad/ruta/autorización | — |
| POST | `/api/departamentos/publicaciones/atlas-global` | ObservatorioPublicacionController@storeGlobalAtlas | StorePublicacionRequest | — |
| GET | `/api/departamentos/publicaciones/atlas-global/sharepoint/browse` | ObservatorioPublicacionController@browseSharePointGlobalAtlas | BrowseSharePointRequest | — |
| POST | `/api/departamentos/publicaciones/atlas-global/sharepoint/import-many` | ObservatorioPublicacionController@importManySharePointGlobalAtlas | ImportManySharePointRequest | — |
| GET | `/api/departamentos/publicaciones/atlas-global/{publicacion}` | ObservatorioPublicacionController@showGlobalAtlas | Sin payload propio; identidad/ruta/autorización | publicacion |
| GET | `/api/departamentos/publicaciones/atlas/recientes` | ObservatorioPublicacionController@recentAtlasReports | Sin payload propio; identidad/ruta/autorización | — |
| DELETE | `/api/departamentos/publicaciones/{publicacion}` | ObservatorioPublicacionController@destroy | Sin payload propio; identidad/ruta/autorización | publicacion |
| PATCH | `/api/departamentos/publicaciones/{publicacion}` | ObservatorioPublicacionController@update | UpdatePublicacionRequest | publicacion |
| GET | `/api/departamentos/publicaciones/{publicacion}/download` | ObservatorioPublicacionController@download | PublicationReadRequest | publicacion |
| GET | `/api/departamentos/publicos` | PublicController@departamentos | Sin payload propio; identidad/ruta/autorización | — |
| DELETE | `/api/departamentos/{departamento}` | DepartamentoController@destroy | Sin payload propio; identidad/ruta/autorización | departamento |
| GET | `/api/departamentos/{departamento}` | DepartamentoController@show | Sin payload propio; identidad/ruta/autorización | departamento |
| PUT | `/api/departamentos/{departamento}` | DepartamentoController@update | UpdateDepartamentoRequest | departamento |
| GET | `/api/departamentos/{departamento}/biblioteca/publicaciones` | ObservatorioPublicacionController@library | ObservatoryPublicationFiltersRequest | departamento |
| GET | `/api/departamentos/{departamento}/biblioteca/publicaciones/{id}` | ObservatorioPublicacionController@libraryShow | Sin payload propio; identidad/ruta/autorización | departamento, id |
| GET | `/api/departamentos/{departamento}/publicaciones` | ObservatorioPublicacionController@index | ObservatoryPublicationFiltersRequest | departamento |
| POST | `/api/departamentos/{departamento}/publicaciones` | ObservatorioPublicacionController@store | StorePublicacionRequest | departamento |
| GET | `/api/departamentos/{departamento}/publicaciones/articulos` | ObservatorioPublicacionController@articulos | Sin payload propio; identidad/ruta/autorización | departamento |
| GET | `/api/departamentos/{departamento}/publicaciones/articulos/sharepoint/browse` | ObservatorioPublicacionController@browseSharePointArticulos | BrowseSharePointRequest | departamento |
| POST | `/api/departamentos/{departamento}/publicaciones/articulos/sharepoint/import-many` | ObservatorioPublicacionController@importManySharePointArticulos | ImportManySharePointRequest | departamento |
| GET | `/api/departamentos/{departamento}/publicaciones/atlas` | ObservatorioPublicacionController@atlas | Sin payload propio; identidad/ruta/autorización | departamento |
| GET | `/api/departamentos/{departamento}/publicaciones/atlas/sharepoint/browse` | ObservatorioPublicacionController@browseSharePointAtlas | BrowseSharePointRequest | departamento |
| GET | `/api/departamentos/{departamento}/publicaciones/atlas/sharepoint/files` | ObservatorioPublicacionController@sharePointFiles | Sin payload propio; identidad/ruta/autorización | departamento |
| POST | `/api/departamentos/{departamento}/publicaciones/atlas/sharepoint/import` | ObservatorioPublicacionController@importSharePointAtlas | ImportSharePointRequest | departamento |
| POST | `/api/departamentos/{departamento}/publicaciones/atlas/sharepoint/import-many` | ObservatorioPublicacionController@importManySharePointAtlas | ImportManySharePointRequest | departamento |
| POST | `/api/departamentos/{departamento}/publicaciones/atlas/sharepoint/sync` | ObservatorioPublicacionController@syncSharePointAtlas | Sin payload propio; identidad/ruta/autorización | departamento |
| GET | `/api/departamentos/{departamento}/publicaciones/can-upload` | ObservatorioPublicacionController@canUpload | Sin payload propio; identidad/ruta/autorización | departamento |
| GET | `/api/departamentos/{departamento}/publicaciones/libros` | ObservatorioPublicacionController@libros | Sin payload propio; identidad/ruta/autorización | departamento |
| GET | `/api/departamentos/{departamento}/publicaciones/libros/sharepoint/browse` | ObservatorioPublicacionController@browseSharePointAtlas | BrowseSharePointRequest | departamento |
| GET | `/api/departamentos/{departamento}/publicaciones/libros/sharepoint/files` | ObservatorioPublicacionController@sharePointFiles | Sin payload propio; identidad/ruta/autorización | departamento |
| POST | `/api/departamentos/{departamento}/publicaciones/libros/sharepoint/import` | ObservatorioPublicacionController@importSharePointAtlas | ImportSharePointRequest | departamento |
| POST | `/api/departamentos/{departamento}/publicaciones/libros/sharepoint/import-many` | ObservatorioPublicacionController@importManySharePointAtlas | ImportManySharePointRequest | departamento |
| POST | `/api/departamentos/{departamento}/publicaciones/libros/sharepoint/sync` | ObservatorioPublicacionController@syncSharePointAtlas | Sin payload propio; identidad/ruta/autorización | departamento |
| GET | `/api/departamentos/{departamento}/publicaciones/reportes` | ObservatorioPublicacionController@reportes | Sin payload propio; identidad/ruta/autorización | departamento |
| GET | `/api/departamentos/{departamento}/publicaciones/reportes/sharepoint/browse` | ObservatorioPublicacionController@browseSharePointReportes | BrowseSharePointRequest | departamento |
| GET | `/api/departamentos/{departamento}/publicaciones/reportes/sharepoint/files` | ObservatorioPublicacionController@sharePointPowerBiLinks | Sin payload propio; identidad/ruta/autorización | departamento |
| POST | `/api/departamentos/{departamento}/publicaciones/reportes/sharepoint/import` | ObservatorioPublicacionController@importSharePointReporte | ImportSharePointRequest | departamento |
| POST | `/api/departamentos/{departamento}/publicaciones/reportes/sharepoint/import-many` | ObservatorioPublicacionController@importManySharePointReportes | ImportManySharePointRequest | departamento |
| POST | `/api/departamentos/{departamento}/publicaciones/reportes/sharepoint/sync` | ObservatorioPublicacionController@syncSharePointReportes | Sin payload propio; identidad/ruta/autorización | departamento |
| GET | `/api/docs` | routes/api.php | Sin payload propio; identidad/ruta/autorización | — |
| GET | `/api/docs-json` | SwaggerController@docs | Contrato del framework/proveedor | — |
| GET | `/api/docs-json/asset/{asset}` | SwaggerAssetController@index | Contrato del framework/proveedor | — |
| GET | `/api/documentation` | routes/api.php | Sin payload propio; identidad/ruta/autorización | — |
| GET | `/api/editor/inicio` | EditorWorkspaceController@summary | Sin payload propio; identidad/ruta/autorización | — |
| GET | `/api/editor/publicaciones` | EditorWorkspaceController@indexPublications | WorkspacePublicationFiltersRequest | — |
| DELETE | `/api/fuentes/{id}` | DatasetFuenteController@destroy | Sin payload propio; identidad/ruta/autorización | id |
| PUT | `/api/fuentes/{id}` | DatasetFuenteController@update | SaveDatasetFuenteRequest | id |
| DELETE | `/api/graficos-predeterminados/{id}` | GraficoPredeterminadoController@destroy | Sin payload propio; identidad/ruta/autorización | id |
| PUT | `/api/graficos-predeterminados/{id}` | GraficoPredeterminadoController@update | SaveGraficoPredeterminadoRequest | id |
| GET | `/api/health` | routes/api.php | Booleano de sistema (deep) | — |
| POST | `/api/login` | AuthController@login | LoginRequest | — |
| POST | `/api/logout` | AuthController@logout | Sin payload propio; identidad/ruta/autorización | — |
| GET | `/api/oauth2-callback` | SwaggerController@oauth2Callback | Contrato del framework/proveedor | — |
| GET | `/api/observatorio-admin/inicio` | ObservatoryWorkspaceController@summary | Sin payload propio; identidad/ruta/autorización | user |
| GET | `/api/observatorio-admin/publicaciones` | ObservatoryWorkspaceController@indexPublications | WorkspacePublicationFiltersRequest | user |
| GET | `/api/observatorio-admin/users` | ObservatoryAccessController@users | ObservatoryUserFiltersRequest | user |
| GET | `/api/observatorio-admin/users/{user}/permisos` | ObservatoryAccessController@show | Sin payload propio; identidad/ruta/autorización | user |
| PUT | `/api/observatorio-admin/users/{user}/permisos` | ObservatoryAccessController@save | SavePermisosRequest | user |
| GET | `/api/permisos/mis-permisos` | PermisoController@myPermissions | Sin payload propio; identidad/ruta/autorización | — |
| GET | `/api/permisos/users/{user}/permisos` | PermisoController@show | Sin payload propio; identidad/ruta/autorización | user |
| PUT | `/api/permisos/users/{user}/permisos` | PermisoController@save | SavePermisosRequest | user |
| GET | `/api/profile` | ProfileController@show | Sin payload propio; identidad/ruta/autorización | — |
| PUT | `/api/profile` | ProfileController@update | UpdateProfileRequest | — |
| DELETE | `/api/profile/avatar` | ProfileController@deleteAvatar | Sin payload propio; identidad/ruta/autorización | — |
| POST | `/api/profile/avatar` | ProfileController@uploadAvatar | UploadAvatarRequest | — |
| GET | `/api/publico/atlas` | PublicController@atlas | PublicAtlasFiltersRequest | — |
| GET | `/api/publico/atlas/biblioteca` | PublicController@atlasLibrary | PublicAtlasFiltersRequest | — |
| GET | `/api/publico/atlas/categorias` | AtlasCategoriaController@indexPublico | Sin payload propio; identidad/ruta/autorización | — |
| GET | `/api/publico/atlas/directorio` | AtlasCategoriaController@publicDirectory | AtlasDirectoryRequest | — |
| GET | `/api/publico/configuracion` | AdminWorkspaceController@configuration | Sin payload propio; identidad/ruta/autorización | — |
| GET | `/api/publico/datasets/{id}/data` | PublicController@datasetData | DatasetDataRequest | id |
| GET | `/api/publico/departamentos` | PublicController@departamentos | Sin payload propio; identidad/ruta/autorización | — |
| GET | `/api/publico/departamentos/{id}` | PublicController@departamento | Sin payload propio; identidad/ruta/autorización | id |
| GET | `/api/publico/departamentos/{id}/atlas` | PublicController@departamentoAtlas | Sin payload propio; identidad/ruta/autorización | id |
| GET | `/api/publico/estadisticas` | PublicController@estadisticas | Sin payload propio; identidad/ruta/autorización | — |
| GET | `/api/publico/publicaciones` | PublicPublicationCatalogController@index | PublicCatalogRequest | — |
| POST | `/api/publico/stats/bivariable` | PublicController@bivariable | BivariableStatsRequest | — |
| POST | `/api/publico/stats/text-analysis` | PublicController@textAnalysis | UnivariableStatsRequest | — |
| POST | `/api/publico/stats/univariable` | PublicController@univariable | UnivariableStatsRequest | — |
| POST | `/api/register` | AuthController@register | RegisterRequest | — |
| GET | `/api/reportes` | ReporteController@index | LegacyCatalogRequest | — |
| POST | `/api/reportes` | ReporteController@store | FormRequest tardío bajo resolución del legado | — |
| GET | `/api/reportes/fichas/{filename}` | ReporteController@ficha | PublicationReadRequest | filename |
| DELETE | `/api/reportes/{id}` | ReporteController@destroy | Sin payload propio; identidad/ruta/autorización | id |
| GET | `/api/reportes/{id}` | ReporteController@show | PublicationReadRequest | id |
| PUT | `/api/reportes/{id}` | ReporteController@update | FormRequest tardío bajo resolución del legado | id |
| POST | `/api/resend-verification-code` | AuthController@resendVerificationCode | ResendVerificationCodeRequest | — |
| POST | `/api/stats/bivariable` | DashboardController@bivariable | BivariableRequest | datasetId |
| GET | `/api/stats/datasets/{datasetId}/stopwords` | DashboardController@getStopwords | Sin payload propio; identidad/ruta/autorización | datasetId |
| PUT | `/api/stats/datasets/{datasetId}/stopwords` | DashboardController@updateStopwords | UpdateStopwordsRequest | datasetId |
| POST | `/api/stats/text-analysis` | DashboardController@textAnalysis | StatsRequest | datasetId |
| POST | `/api/stats/univariable` | DashboardController@univariable | StatsRequest | datasetId |
| GET | `/api/user` | AuthController@user | Sin payload propio; identidad/ruta/autorización | — |
| GET | `/api/users` | UserController@index | UserFiltersRequest | id |
| POST | `/api/users` | UserController@store | CreateUserRequest | id |
| DELETE | `/api/users/{id}` | UserController@destroy | Sin payload propio; identidad/ruta/autorización | id |
| GET | `/api/users/{id}` | UserController@show | Sin payload propio; identidad/ruta/autorización | id |
| PUT | `/api/users/{id}` | UserController@update | UpdateUserRequest | id |
| PATCH | `/api/users/{id}/password` | UserController@changePassword | ChangeUserPasswordRequest | id |
| PATCH | `/api/users/{id}/role` | UserController@updateRole | UpdateUserRoleRequest | id |
| PATCH | `/api/users/{id}/status` | UserController@toggleStatus | ToggleUserStatusRequest | id |
| POST | `/api/variables/bulk-update` | DatasetController@bulkUpdateVariables | BulkUpdateVariablesRequest | variable |
| PUT | `/api/variables/{variable}` | DatasetController@updateVariable | UpdateVariableRequest | variable |
| POST | `/api/verify-email-code` | AuthController@verifyEmailCode | VerifyEmailCodeRequest | — |
| GET | `/login` | routes/web.php | Sin payload propio; identidad/ruta/autorización | — |
| GET | `/sanctum/csrf-cookie` | CsrfCookieController@show | Contrato del framework/proveedor | — |
| GET | `/storage/{path}` | vendor/laravel/framework/src/Illuminate/Filesystem/FilesystemServiceProvider.php | Contrato del framework/proveedor | path |
| PUT | `/storage/{path}` | vendor/laravel/framework/src/Illuminate/Filesystem/FilesystemServiceProvider.php | Contrato del framework/proveedor | path |
| GET | `/up` | vendor/laravel/framework/src/Illuminate/Foundation/Configuration/ApplicationBuilder.php | Contrato del framework/proveedor | — |
