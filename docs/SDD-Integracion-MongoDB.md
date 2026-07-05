# Software Design Document (SDD)
## Integración de un motor NoSQL (MongoDB) para el almacenamiento de datasets de Excel

| Campo | Valor |
|-------|-------|
| Proyecto | Observatorio ULEAM |
| Componente | Capa de almacenamiento de datos dinámicos (datasets de Excel) |
| Documento | SDD — Integración MongoDB |
| Versión | 1.0 |
| Fecha | 2026-06-24 |
| Estado | Propuesta de diseño |
| Stack actual | Laravel 12 · PHP 8.2+ · PostgreSQL 16 · Angular |
| Motor NoSQL propuesto | MongoDB 7.x (Community) |

---

## 1. Introducción

### 1.1 Propósito
Este documento describe el diseño técnico para integrar un motor de base de datos **no relacional (MongoDB)** en el sistema Observatorio ULEAM, con el fin de almacenar los datos provenientes de archivos Excel cargados por los usuarios.

El modelo conceptual es: **cada archivo Excel = una "tabla"**, **cada columna del Excel = un campo**, y **cada fila = un documento**. Este patrón (esquema flexible por documento) es justamente el que hoy se emula con la columna `jsonb data` de PostgreSQL; el objetivo es llevarlo a un motor documental nativo.

### 1.2 Alcance
El SDD cubre:
- Selección y justificación del motor NoSQL.
- Modelo de datos (mapeo Excel → colección/documento) y su "DDL" (creación de colecciones, validadores JSON Schema e índices).
- Arquitectura de coexistencia **PostgreSQL + MongoDB** (poliglot persistence).
- Pipeline de ingesta de Excel (análisis de tipos → confirmación → inserción en MongoDB).
- Diseño de la API de consulta.
- Rendimiento, seguridad y migración de los datos ya existentes.
- Plan de implementación por fases.

### 1.3 Definiciones
- **Dataset**: representación lógica de un archivo Excel cargado.
- **Variable / metadato**: descripción de una columna (nombre, tipo, visibilidad).
- **Registro**: una fila de datos del Excel.
- **Colección**: equivalente NoSQL de una "tabla".
- **Documento**: equivalente NoSQL de una "fila" (objeto BSON/JSON).
- **JSONB**: tipo de dato binario-JSON de PostgreSQL usado actualmente.
- **Poliglot persistence**: uso simultáneo de varios motores de base de datos, cada uno para lo que mejor hace.

### 1.4 Referencias
- Conector oficial: `mongodb/laravel-mongodb` v5.2+ (compatible con Laravel 12).
- Documentación: ver sección 12 (Fuentes).

---

## 2. Situación actual (línea base)

El sistema **ya implementa** el patrón "Excel como tabla flexible" sobre PostgreSQL mediante tres tablas:

| Tabla | Rol | Comentario |
|-------|-----|------------|
| `datasets` | Catálogo de archivos Excel | UUID, departamento, estado (`PENDIENTE/PROCESANDO/COMPLETADO/ERROR`), `total_registros`, soft-deletes |
| `variables_metadatos` | Columnas de cada Excel | `nombre_columna`, `tipo_dato` (NUMERICO/CATEGORICO/FECHA/TEXTO), `opciones`, `orden`, `es_visible` |
| `registros_datos` | Filas del Excel | `dataset_id` + **`jsonb data`** + índice **GIN** |

El flujo de ingesta vive en una arquitectura limpia (DDD):
- `Infrastructure/Services/ExcelReaderService` → `analyze()` (detección de tipos sobre muestra de 100 filas) e `import()` (generador fila a fila).
- `Application/Dataset/UseCases/ConfirmImportUseCase` → inserta por lotes de 500 dentro de una transacción, a través de **interfaces de repositorio** (`RegistroDatoRepositoryInterface`, etc.).

> **Implicación de diseño clave:** como la persistencia se accede mediante **interfaces de repositorio**, cambiar el backend de almacenamiento de los *registros* (de JSONB a MongoDB) se reduce, en gran medida, a proveer **una nueva implementación** de `RegistroDatoRepositoryInterface`. El resto de la aplicación no cambia.

---

## 3. Motivación y decisión del motor

### 3.1 ¿Por qué un motor documental?
El dato de entrada es heterogéneo: cada Excel tiene columnas distintas, sin un esquema fijo común. Un motor documental modela esto de forma nativa (documentos con esquema variable), y ofrece:
- Inserción masiva eficiente sin migraciones de esquema por cada dataset nuevo.
- Consultas y **agregaciones** ricas sobre campos arbitrarios.
- Índices por campo definibles dataset a dataset.

### 3.2 Motor seleccionado: **MongoDB 7.x**
| Criterio | Razón |
|----------|-------|
| Madurez del conector | `mongodb/laravel-mongodb` v5.2+ es oficial de MongoDB Inc. y soporta Laravel 12 |
| Modelo de datos | Documento BSON ≈ fila de Excel; colección ≈ tabla |
| Agregaciones | *Aggregation Pipeline* potente para estadística (la app tiene `Domain/Statistics`) |
| Validación | *JSON Schema validators* nativos por colección |
| Operación local | Imagen Docker oficial, encaja con el `docker-compose` existente |

### 3.3 Requisitos técnicos
- **Extensión PHP `mongodb`** (PECL) instalada y habilitada en el `php.ini`.
- Paquete Composer **`mongodb/laravel-mongodb:^5.2`** (probar la última 5.x).
- MongoDB Server 7.x (contenedor Docker).

> ⚠️ MongoDB **no usa SQL**. En este SDD, lo que en el mundo relacional sería "DDL/SQL" se materializa como: (a) creación de colecciones con *JSON Schema validators*, (b) definición de **índices**, y (c) el **esquema relacional que permanece en PostgreSQL** para el catálogo. Ver secciones 5 y 6.

---

## 4. Arquitectura de coexistencia (PostgreSQL + MongoDB)

Se adopta **persistencia políglota**: cada motor almacena aquello para lo que es mejor.

```
                ┌─────────────────────────────────────────────┐
                │                Angular (SPA)                 │
                └───────────────────────┬─────────────────────┘
                                        │ HTTP/JSON (API REST)
                ┌───────────────────────▼─────────────────────┐
                │            Laravel 12 (Backend)              │
                │  Presentation → Application → Domain          │
                │                                              │
                │   RegistroDatoRepositoryInterface            │
                │        ├─ PgRegistroDatoRepository (actual)  │
                │        └─ MongoRegistroDatoRepository (NUEVO) │
                └───────┬───────────────────────────┬─────────┘
                        │                           │
        Catálogo/metadatos                  Filas de datasets
                        │                           │
         ┌──────────────▼──────────┐   ┌────────────▼─────────────┐
         │      PostgreSQL 16       │   │        MongoDB 7.x        │
         │  users, departamentos,   │   │  Colecciones por dataset: │
         │  datasets,               │   │  ds_<uuid> (documentos)   │
         │  variables_metadatos     │   │                           │
         └──────────────────────────┘   └───────────────────────────┘
```

**Reparto de responsabilidades:**

| En PostgreSQL (relacional) | En MongoDB (documental) |
|----------------------------|-------------------------|
| Usuarios, auth, roles | — |
| Departamentos, categorías | — |
| `datasets` (catálogo, estado, dueño) | — |
| `variables_metadatos` (esquema de columnas) | — |
| — | **Registros (filas) de cada Excel** |

Justificación: el catálogo y el control de acceso son relacionales y transaccionales (se quedan donde brillan). El volumen y la heterogeneidad (las filas) van a MongoDB.

---

## 5. Diseño de datos

### 5.1 Mapeo Excel → MongoDB
| Concepto Excel | Concepto MongoDB |
|----------------|------------------|
| Archivo Excel | Colección `ds_<dataset_uuid>` |
| Encabezado de columna | Campo (key) del documento |
| Fila | Documento |
| Celda | Valor del campo |

### 5.2 Estrategia de colecciones — decisión de diseño
Se evaluaron dos opciones:

**Opción A — Una colección por dataset (RECOMENDADA).**
Nombre: `ds_<dataset_uuid>`. Realiza literalmente "cada Excel es una tabla".
- ✅ Aislamiento total entre datasets; índices y validador propios por dataset.
- ✅ Borrar un dataset = `drop` de su colección (O(1), sin barrer documentos).
- ⚠️ Genera muchas colecciones; requiere convención de nombres y limpieza.

**Opción B — Una sola colección `registros` con campo `dataset_id`.**
- ✅ Pocas colecciones; consultas cruzadas más simples.
- ⚠️ Índices compuestos obligatorios; borrar dataset = `deleteMany` masivo.

> **Recomendación:** **Opción A**, porque coincide con el modelo mental del requisito ("el Excel cuenta como una tabla"), permite validadores e índices por dataset y hace triviales el borrado y el versionado. La Opción B queda documentada como alternativa si el número de datasets creciera a decenas de miles.

### 5.3 Estructura del documento
Cada documento contiene los campos del Excel más metadatos mínimos de trazabilidad:

```json
{
  "_id": "ObjectId(...)",
  "dataset_id": "9b1c...-uuid",
  "data": {
    "edad": 34,
    "provincia": "Manabí",
    "fecha_registro": "2025-03-01T00:00:00Z",
    "ingreso_mensual": 850.5
  },
  "_row": 2,
  "created_at": "2026-06-24T18:00:00Z"
}
```

Se conserva `data` como subdocumento (igual que el `jsonb data` actual) para minimizar cambios en el código de consulta y evitar colisiones con nombres reservados. `dataset_id` se duplica dentro del documento para auditoría aunque la colección ya sea específica.

### 5.4 Tipos de dato
El `tipo_detectado` de `variables_metadatos` se traduce a tipos BSON nativos durante la ingesta:

| `tipo_dato` (app) | Tipo BSON destino | Conversión |
|-------------------|-------------------|------------|
| NUMERICO | `double` / `int` | `floatval` / `intval` |
| FECHA | `Date` (UTCDateTime) | parse Excel serial → ISO-8601 |
| CATEGORICO | `string` | trim + normalización |
| TEXTO | `string` | tal cual |

Almacenar tipos nativos (no todo como string) es lo que habilita filtros por rango y agregaciones correctas en MongoDB.

---

## 6. "DDL" en MongoDB: colecciones, validadores e índices

### 6.1 Creación de colección con JSON Schema validator
El validador se **genera dinámicamente** a partir de `variables_metadatos` del dataset. Ejemplo (mongosh) para un dataset con columnas `edad` (numérico) y `provincia` (categórico):

```javascript
db.createCollection("ds_9b1c_uuid", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["dataset_id", "data"],
      properties: {
        dataset_id: { bsonType: "string" },
        data: {
          bsonType: "object",
          properties: {
            edad:      { bsonType: ["double", "int", "null"] },
            provincia: { bsonType: ["string", "null"] }
          }
        }
      }
    }
  },
  validationLevel: "moderate",
  validationAction: "warn"
});
```

`validationAction: "warn"` (en lugar de `error`) evita rechazar filas con celdas atípicas durante la carga masiva; los avisos quedan en el log del servidor. Puede endurecerse a `error` por dataset.

### 6.2 Índices
```javascript
// Filtro por dataset (redundante en Opción A, obligatorio en Opción B)
db.ds_9b1c_uuid.createIndex({ dataset_id: 1 });

// Índices por columnas consultadas con frecuencia (derivados de es_visible / uso)
db.ds_9b1c_uuid.createIndex({ "data.provincia": 1 });
db.ds_9b1c_uuid.createIndex({ "data.edad": 1 });

// Búsqueda de texto libre (opcional, columnas TEXTO)
db.ds_9b1c_uuid.createIndex({ "data.observaciones": "text" });
```

> Equivalencia conceptual: el índice GIN sobre `jsonb` del esquema actual se reemplaza por **índices por campo** en MongoDB. Estos son más selectivos para los filtros típicos de la app (igualdad y rango por columna).

### 6.3 Esquema relacional que permanece (PostgreSQL)
No se elimina nada del catálogo. Solo se **deja de usar** `registros_datos` para nuevos datasets (se conserva para migración/rollback). El "SQL" del lado relacional se limita a una migración opcional que marca el backend de cada dataset:

```php
// database/migrations/xxxx_add_storage_engine_to_datasets.php
Schema::table('datasets', function (Blueprint $table) {
    $table->enum('motor_datos', ['JSONB', 'MONGODB'])->default('MONGODB');
    $table->string('coleccion_mongo')->nullable(); // ds_<uuid>
});
```

Esto permite **coexistencia y migración progresiva**: datasets viejos siguen en JSONB, nuevos en MongoDB, y el repositorio elige según `motor_datos`.

---

## 7. Configuración técnica

### 7.1 Extensión PHP y paquete
```powershell
# 1. Extensión PHP (Windows: descargar php_mongodb.dll acorde a tu versión/TS/arquitectura
#    y colocarla en C:\php\ext, luego en php.ini:)
#    extension=mongodb

# 2. Paquete Laravel
composer require mongodb/laravel-mongodb:^5.2
```

### 7.2 Conexión (`config/database.php`)
```php
'connections' => [

    // ... pgsql existente ...

    'mongodb' => [
        'driver'   => 'mongodb',
        'dsn'      => env('MONGODB_URI', 'mongodb://127.0.0.1:27017'),
        'database' => env('MONGODB_DATABASE', 'observatorio_nosql'),
    ],
],
```

### 7.3 Variables de entorno (`.env`)
```env
MONGODB_URI=mongodb://root:secret123@127.0.0.1:27017/?authSource=admin
MONGODB_DATABASE=observatorio_nosql
```

### 7.4 Servicio Docker (`docker-compose.yml`)
```yaml
  mongodb:
    image: mongo:7
    container_name: observatorio_mongo
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: secret123
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  postgres_data:
  mongo_data:
```

---

## 8. Pipeline de ingesta de Excel (diseño detallado)

Se reutiliza el flujo actual de dos pasos; solo cambia **dónde se escriben las filas**.

```
[1] POST /api/datasets/upload        → guarda archivo, crea dataset (PENDIENTE)
[2] POST /api/datasets/{id}/analyze  → ExcelReaderService.analyze()
                                       → devuelve columnas + tipos + preview
[3] (usuario revisa/ajusta tipos en el frontend)
[4] POST /api/datasets/{id}/confirm  → ConfirmImportUseCase
        4.1 guarda variables_metadatos en PostgreSQL
        4.2 crea colección ds_<uuid> + validador + índices  (NUEVO)
        4.3 ExcelReaderService.import() (generador) → conversión de tipos
        4.4 insertMany por lotes de 500 en MongoDB         (NUEVO)
        4.5 marca dataset COMPLETADO + total_registros (PostgreSQL)
```

### 8.1 Nueva implementación de repositorio
Se añade `MongoRegistroDatoRepository` que implementa `RegistroDatoRepositoryInterface`:

```php
namespace App\Infrastructure\Repositories\Mongo;

use App\Domain\Dataset\Repositories\RegistroDatoRepositoryInterface;
use MongoDB\Laravel\Connection;            // conexión 'mongodb'
use Illuminate\Support\Facades\DB;

class MongoRegistroDatoRepository implements RegistroDatoRepositoryInterface
{
    private function collection(string $datasetId)
    {
        return DB::connection('mongodb')
                 ->getCollection('ds_' . str_replace('-', '_', $datasetId));
    }

    public function insertBatch(string $datasetId, array $registros): void
    {
        $docs = array_map(fn ($data) => [
            'dataset_id' => $datasetId,
            'data'       => $data,
            'created_at' => new \MongoDB\BSON\UTCDateTime(),
        ], $registros);

        $this->collection($datasetId)->insertMany($docs);
    }

    public function deleteByDatasetId(string $datasetId): void
    {
        // Opción A: drop de la colección completa (O(1))
        $this->collection($datasetId)->drop();
    }

    public function paginate(string $datasetId, int $page, int $perPage, array $filtros = []): array
    {
        $query = $this->buildQuery($filtros); // ver §10.2 sobre saneo
        $cursor = $this->collection($datasetId)
            ->find($query, [
                'skip'  => ($page - 1) * $perPage,
                'limit' => $perPage,
            ]);
        return iterator_to_array($cursor);
    }
}
```

### 8.2 Selección del repositorio (binding)
En un *Service Provider*, el binding se resuelve según `motor_datos` del dataset (estrategia/factory), de modo que JSONB y MongoDB coexistan:

```php
$this->app->bind(RegistroDatoRepositoryInterface::class, function ($app) {
    // Factory que decide Pg* o Mongo* según el dataset en contexto.
    return $app->make(RegistroDatoRepositoryFactory::class)->make();
});
```

> La transacción atómica multi-motor no es posible de forma trivial (PostgreSQL y MongoDB son sistemas distintos). Se usa el patrón **saga ligera**: si la inserción en MongoDB falla, el `ConfirmImportUseCase` marca el dataset como `ERROR` y hace `drop` de la colección parcial (compensación). Ver §11.

---

## 9. Diseño de la API

No cambia el contrato público; cambia la fuente de datos. Endpoints principales:

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/datasets/upload` | Sube el archivo, crea dataset PENDIENTE |
| POST | `/api/datasets/{id}/analyze` | Devuelve columnas, tipos detectados y preview |
| POST | `/api/datasets/{id}/confirm` | Confirma tipos e ingesta a MongoDB |
| GET | `/api/datasets/{id}/registros` | Lista paginada de filas (desde MongoDB) |
| GET | `/api/datasets/{id}/estadisticas` | Agregaciones (conteos, promedios, distribuciones) |

### 9.1 Ejemplo — consulta paginada con filtros
**Request**
```http
GET /api/datasets/9b1c.../registros?page=1&per_page=50&provincia=Manab%C3%AD&edad_min=18
```
**Response**
```json
{
  "data": [
    { "edad": 34, "provincia": "Manabí", "ingreso_mensual": 850.5 }
  ],
  "meta": { "page": 1, "per_page": 50, "total": 120 }
}
```

### 9.2 Ejemplo — estadística vía Aggregation Pipeline
Promedio de `ingreso_mensual` por `provincia`:
```php
$pipeline = [
    ['$group' => [
        '_id' => '$data.provincia',
        'promedio_ingreso' => ['$avg' => '$data.ingreso_mensual'],
        'n' => ['$sum' => 1],
    ]],
    ['$sort' => ['promedio_ingreso' => -1]],
];
$result = DB::connection('mongodb')
    ->getCollection('ds_9b1c_uuid')
    ->aggregate($pipeline)->toArray();
```

---

## 10. Rendimiento

1. **Inserción por lotes:** mantener `insertMany` en lotes de 500 (alineado con el código actual). Considerar `['ordered' => false]` para no abortar todo el lote ante un documento inválido.
2. **Índices selectivos:** crear índices solo sobre columnas realmente consultadas (las `es_visible` o usadas en filtros), no sobre todas.
3. **Proyección:** devolver solo los campos necesarios (`projection`) para reducir tráfico.
4. **Paginación:** para datasets muy grandes, preferir paginación por cursor/rango sobre `skip` profundo.
5. **Agregaciones:** apoyarse en índices al inicio del pipeline (`$match` antes de `$group`).
6. **Cold start (Render):** la app ya tiene `/api/health` para warmup; añadir verificación de conexión a MongoDB en el health check.

---

## 11. Seguridad

1. **Autenticación de MongoDB:** habilitada (usuario/clave, `authSource=admin`). Nunca exponer 27017 públicamente; en producción, red privada/VPC y TLS.
2. **Inyección NoSQL:** **nunca** pasar entradas del usuario directamente a un filtro. Sanear y *castear* tipos; rechazar claves que empiecen con `$` o contengan `.`. Construir filtros con listas blancas de columnas (las de `variables_metadatos`).
3. **Autorización:** el control de acceso por departamento se mantiene en PostgreSQL (`ConfirmImportUseCase` ya verifica `existsForUser`). Toda consulta a MongoDB debe pasar antes por esa verificación.
4. **Validación de carga:** límites de tamaño de archivo y de número de columnas; los validadores JSON Schema actúan como segunda barrera.
5. **Datos sensibles:** credenciales solo en `.env` (fuera de git). Backups cifrados del volumen `mongo_data`.

---

## 12. Migración de datos existentes (JSONB → MongoDB)

Comando Artisan idempotente que recorre datasets con `motor_datos = JSONB` y los copia a MongoDB:

```
php artisan datasets:migrar-a-mongo {--dataset=} {--dry-run}
```

Algoritmo:
1. Por cada dataset COMPLETADO en JSONB:
   1. Crear colección `ds_<uuid>` + validador (desde `variables_metadatos`) + índices.
   2. Leer `registros_datos.data` por lotes (cursor) e `insertMany` en MongoDB.
   3. Verificar conteo: `count(Mongo) == total_registros`.
   4. Si coincide → `motor_datos = MONGODB`, `coleccion_mongo = ds_<uuid>`.
2. **No** borrar `registros_datos` hasta validar en producción (rollback disponible).

---

## 13. Plan de implementación por fases

| Fase | Entregable | Criterio de aceptación |
|------|-----------|------------------------|
| 0. Infra | Servicio Docker `mongodb`, extensión PHP, paquete Composer | `php artisan tinker` conecta a MongoDB |
| 1. Repositorio | `MongoRegistroDatoRepository` + factory + binding | Tests de inserción/lectura en verde |
| 2. Ingesta | `ConfirmImportUseCase` crea colección/índices e inserta en Mongo | Subir un Excel real → filas en MongoDB |
| 3. Consulta | Endpoints `registros` y `estadisticas` leyendo de MongoDB | Paridad funcional con JSONB |
| 4. Migración | Comando `datasets:migrar-a-mongo` | Conteos coinciden 100% |
| 5. Endurecimiento | Validadores en `error`, índices afinados, seguridad | Revisión de rendimiento y pentest básico |

### 13.1 Checklist de tareas

**Fase 0 — Infraestructura**
- [ ] Agregar el servicio `mongodb` (mongo:7) al `docker-compose.yml` con volumen `mongo_data`.
- [ ] Levantar el contenedor (`docker compose up -d mongodb`) y verificar healthcheck.
- [ ] Instalar la extensión PHP `mongodb` (PECL / `php_mongodb.dll`) y habilitarla en `php.ini`.
- [ ] Verificar la extensión: `php -m | findstr mongodb`.
- [ ] Instalar el paquete: `composer require mongodb/laravel-mongodb:^5.2`.
- [ ] Registrar la conexión `mongodb` en `config/database.php`.
- [ ] Añadir `MONGODB_URI` y `MONGODB_DATABASE` al `.env` y `.env.example`.
- [ ] Probar la conexión con `php artisan tinker` (`DB::connection('mongodb')->getMongoClient()`).

**Fase 1 — Repositorio y binding**
- [ ] Crear migración: campos `motor_datos` y `coleccion_mongo` en `datasets`.
- [ ] Crear `MongoRegistroDatoRepository` implementando `RegistroDatoRepositoryInterface`.
- [ ] Implementar `insertBatch`, `deleteByDatasetId` (drop), `paginate` y `countByDatasetId`.
- [ ] Crear `RegistroDatoRepositoryFactory` que elija Pg/Mongo según `motor_datos`.
- [ ] Registrar el binding en un Service Provider.
- [ ] Tests unitarios de inserción/lectura/borrado contra MongoDB.

**Fase 2 — Ingesta de Excel**
- [ ] Generar el JSON Schema validator dinámicamente desde `variables_metadatos`.
- [ ] Crear la colección `ds_<uuid>` con validador en el paso de confirmación.
- [ ] Crear índices por columnas visibles/consultadas y por `dataset_id`.
- [ ] Adaptar `ConfirmImportUseCase` para insertar en MongoDB por lotes de 500.
- [ ] Implementar conversión de tipos (NUMERICO/FECHA/CATEGORICO/TEXTO → BSON).
- [ ] Implementar compensación (saga): si falla la carga → `drop` colección + estado `ERROR`.
- [ ] Prueba E2E: subir un Excel real y verificar las filas en MongoDB.

**Fase 3 — Consulta y estadística**
- [ ] Endpoint `GET /datasets/{id}/registros` con paginación y filtros desde MongoDB.
- [ ] Endpoint `GET /datasets/{id}/estadisticas` usando Aggregation Pipeline.
- [ ] Saneo de filtros (lista blanca de columnas; rechazar claves con `$` o `.`).
- [ ] Validar paridad funcional con la implementación JSONB.

**Fase 4 — Migración de datos existentes**
- [ ] Comando `php artisan datasets:migrar-a-mongo` (idempotente, con `--dry-run`).
- [ ] Migrar por lotes con cursor y verificar conteos (`Mongo == total_registros`).
- [ ] Actualizar `motor_datos = MONGODB` y `coleccion_mongo` al validar.
- [ ] Conservar `registros_datos` (JSONB) hasta validar en producción.

**Fase 5 — Endurecimiento**
- [ ] Endurecer validadores a `validationAction: "error"` por dataset.
- [ ] Afinar índices según consultas reales (revisar `explain`).
- [ ] Habilitar autenticación/TLS de MongoDB y cerrar el puerto 27017 al exterior.
- [ ] Añadir verificación de MongoDB al endpoint `/api/health`.
- [ ] Configurar backups cifrados del volumen `mongo_data`.
- [ ] Actualizar README y documentación de despliegue.

---

## 14. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Falta atomicidad PG↔Mongo | Datos inconsistentes ante fallo | Patrón saga + compensación (drop colección) + estado `ERROR` |
| Proliferación de colecciones (Opción A) | Operación más compleja | Convención de nombres + `drop` en borrado + opción B si escala |
| Extensión `mongodb` no instalada | Bloqueo de despliegue | Documentar en README y validar en CI/health check |
| Inyección NoSQL | Seguridad | Lista blanca de columnas + saneo de operadores `$`/`.` |
| Doble costo de almacenamiento durante migración | Recursos | Migración por dataset + limpieza de JSONB tras validación |

---

## 15. Conclusión

La integración propone una arquitectura **políglota**: PostgreSQL conserva el catálogo y el control de acceso (transaccional, relacional), y **MongoDB** almacena las filas de cada Excel como documentos en colecciones por dataset, materializando el requisito "cada Excel es una tabla". Gracias al patrón Repository ya presente, el cambio se concentra en una nueva implementación de repositorio y unos pasos extra en el caso de uso de importación, con coexistencia y migración progresiva sin interrumpir lo existente.

---

## 16. Fuentes

- [Laravel MongoDB 5.2 Released: Support for Laravel 12 — Laravel News](https://laravel-news.com/laravel-mongodb-5-2)
- [Laravel Feature Compatibility — MongoDB Docs](https://www.mongodb.com/docs/drivers/php/laravel-mongodb/current/feature-compatibility/)
- [Compatibility — Laravel MongoDB — MongoDB Docs](https://www.mongodb.com/docs/drivers/php/laravel-mongodb/current/compatibility/)
- [mongodb/laravel-mongodb — Packagist](https://packagist.org/packages/mongodb/laravel-mongodb)
- [MongoDB — Laravel 12.x Docs](https://laravel.com/docs/12.x/mongodb)
- [Releases · mongodb/laravel-mongodb (GitHub)](https://github.com/mongodb/laravel-mongodb/releases)
</content>
