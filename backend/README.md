# 🔧 Observatorio ULEAM — Backend

**API REST construida con Laravel 12 siguiendo Domain-Driven Design (DDD) para la gestión y análisis estadístico de datos institucionales.**

![Laravel](https://img.shields.io/badge/Laravel-12-FF2D20?logo=laravel&logoColor=white)
![PHP](https://img.shields.io/badge/PHP-8.2+-777BB4?logo=php&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Sanctum](https://img.shields.io/badge/Auth-Sanctum%204-FF2D20)

---

## 📋 Descripción

El backend del Observatorio expone una API RESTful que administra el ciclo de vida completo de los datos: desde la importación de archivos Excel hasta la generación de estadísticas avanzadas y análisis de texto con NLP. Está diseñado para ser consumido por la SPA de Angular y ofrece también endpoints públicos sin autenticación.

---

## 🏗️ Arquitectura DDD (4 capas)

```
app/
├── Domain/                # Capa de dominio puro (sin dependencias del framework)
│   ├── Dataset/               Entidades, interfaces de repositorios, ValueObjects
│   ├── Departamento/          Entidades, interfaces de repositorios
│   ├── User/                  Entidades, interfaces de repositorios
│   ├── Statistics/            Interfaces de servicios estadísticos
│   └── Shared/                Excepciones compartidas, ValueObjects comunes
│
├── Application/           # Casos de uso (orquestación)
│   ├── Auth/                  Login, Register (DTOs + UseCases)
│   ├── Dashboard/             GetUnivariableStats, GetBivariableStats, GetTextAnalysis
│   ├── Dataset/               Upload, Analyze, ConfirmImport, Delete, UpdateVariable...
│   ├── Departamento/          CRUD de departamentos
│   ├── Public/                Endpoints públicos (stats sin auth, datasets públicos)
│   ├── Profile/               Gestión de perfil de usuario
│   └── User/                  Administración de usuarios
│
├── Infrastructure/        # Implementaciones concretas
│   ├── Persistence/           Repositorios Eloquent, QueryBuilders
│   ├── Services/
│   │   ├── StatisticsService      Estadísticas SQL sobre JSONB
│   │   ├── TextProcessingService  Pipeline NLP (tokenización, TF-IDF, stemming...)
│   │   └── ExcelReaderService     Lectura y análisis de archivos Excel
│   └── Providers/             Bindings de inyección de dependencias
│
├── Presentation/          # Capa HTTP
│   └── Http/
│       ├── Controllers/Api/   11 controllers (Auth, Dashboard, Public, Dataset...)
│       ├── Requests/          Form Request validation classes
│       ├── Resources/         API Resource transformers
│       └── Transformers/      Transformadores de respuesta
│
└── Models/                # Modelos Eloquent (6 modelos con UUID)
    ├── User, Perfil
    ├── Departamento
    ├── Dataset, VariableMetadato
    └── RegistroDato (almacena filas Excel como JSONB)
```

### Patrones de diseño aplicados

- **Repository Pattern**: El dominio define interfaces, la infraestructura proporciona implementaciones Eloquent
- **Use Case Pattern**: Cada operación de negocio es una clase independiente
- **DTO Pattern**: Objetos de transferencia de datos entre capas
- **Strategy Pattern**: Estadísticas calculadas según el tipo de variable (numérico, categórico, fecha, texto)

---

## 🗄️ Modelo de datos

El sistema usa una estrategia **híbrida relacional + JSONB** para máxima flexibilidad:

| Modelo | Tabla | Descripción |
|--------|-------|-------------|
| `User` | `users` | Usuarios con rol global (ADMIN/USER) |
| `Perfil` | `perfiles` | Extensión 1:1 del perfil de usuario |
| `Departamento` | `departamentos` | Departamentos/observatorios con flag público |
| `Dataset` | `datasets` | Metadatos del dataset (nombre, estado, total de registros) |
| `VariableMetadato` | `variables_metadatos` | Metadatos por columna (tipo detectado, opciones JSON) |
| `RegistroDato` | `registros_datos` | **Filas del Excel almacenadas como JSONB en `data`** |

**Tabla pivote**: `usuario_departamento` (many-to-many con roles: ADMIN, EDITOR, LECTOR)

La columna `data` de tipo JSONB con índices GIN permite almacenar archivos Excel con **cualquier estructura de columnas** sin cambiar el esquema de la base de datos.

---

## 🧠 Pipeline NLP (Procesamiento de Lenguaje Natural)

El backend incluye un pipeline completo de NLP en PHP puro para análisis de texto:

1. **Tokenización**: Segmentación de textos en palabras, limpieza de puntuación y normalización Unicode
2. **Stopwords**: Diccionarios en español e inglés + stopwords personalizados por dataset
3. **Stemming**: Reducción de palabras a su raíz (configurado para español)
4. **Frecuencias**: Conteo de unigramas, bigramas y trigramas
5. **TF-IDF**: Clasificación de textos por keywords dominantes
6. **Análisis de sentimiento**: Lexicón español con scores positivo, negativo y neutro
7. **Nube de palabras**: Datos de frecuencia con pesos normalizados para visualización

La configuración se centraliza en `config/nlp.php`.

---

## 🛣️ Endpoints API

Las rutas están modularizadas en `routes/modules/`:

### Autenticación (`/api/auth`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/login` | Iniciar sesión (Sanctum token) |
| POST | `/register` | Registro de usuario |
| POST | `/logout` | Cerrar sesión |
| GET | `/me` | Obtener usuario autenticado |

### Datasets (`/api/datasets`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar datasets del usuario |
| POST | `/upload` | Subir archivo Excel |
| POST | `/{id}/analyze` | Analizar columnas del archivo |
| POST | `/{id}/confirm-import` | Confirmar importación con tipos ajustados |
| GET | `/{id}` | Ver detalle de un dataset |
| DELETE | `/{id}` | Eliminar dataset |

### Estadísticas (`/api/stats`)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/univariable` | Estadísticas de una variable |
| POST | `/bivariable` | Estadísticas de dos variables (cruce) |
| POST | `/text-analysis` | Análisis NLP completo de una variable de texto |

### Público (`/api/publico`) — Sin autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/departamentos` | Listar departamentos públicos |
| GET | `/departamentos/{id}` | Detalle de departamento público |
| GET | `/datasets/{id}/data` | Datos de un dataset público |
| POST | `/stats/univariable` | Estadísticas públicas univariable |
| POST | `/stats/bivariable` | Estadísticas públicas bivariable |
| POST | `/stats/text-analysis` | Análisis de texto público |

> La documentación completa de la API está disponible en Swagger: `http://localhost:8000/api/documentation`

---

## 🚀 Instalación y desarrollo

### Requisitos

- PHP 8.2+ con extensiones: `pdo_pgsql`, `mbstring`, `xml`, `zip`, `gd`
- Composer 2.x
- PostgreSQL 16 (incluido en Docker)

### Usando los scripts del proyecto (recomendado)

```bash
# Desde la raíz del monorepo (Observatorio/):

./scripts/docker.sh up         # Levanta PostgreSQL en Docker
./scripts/backend.sh install   # composer install
./scripts/backend.sh migrate   # Ejecuta migraciones
./scripts/backend.sh start     # php artisan serve en puerto 8000
```

### Instalación manual

```bash
cd backend

# 1. Instalar dependencias
composer install

# 2. Configurar entorno
cp .env.example .env
php artisan key:generate

# 3. Configurar base de datos en .env
#    DB_CONNECTION=pgsql
#    DB_HOST=127.0.0.1
#    DB_PORT=5432
#    DB_DATABASE=observatorio_uleam
#    DB_USERNAME=postgres
#    DB_PASSWORD=secret123

# 4. Ejecutar migraciones y seeders
php artisan migrate --seed

# 5. Iniciar servidor
php artisan serve
```

### Comandos útiles

```bash
./scripts/backend.sh migrate-fresh   # Resetear base de datos (drop + migrate + seed)
./scripts/backend.sh swagger         # Regenerar documentación Swagger
./scripts/backend.sh routes          # Ver todas las rutas registradas
./scripts/backend.sh cache-clear     # Limpiar caché de config, rutas y vistas
./scripts/backend.sh tinker          # Abrir REPL de Laravel (Tinker)
```

---

## 🧪 Testing

```bash
cd backend
php artisan test                 # Ejecutar todos los tests
php artisan test --filter=Unit   # Solo tests unitarios
php artisan test --filter=Feature # Solo tests de integración
```

El proyecto usa **PHPUnit 11** con la estructura:
- `tests/Unit/` — Tests de dominio y lógica de negocio
- `tests/Feature/` — Tests de endpoints API

---

## ⚙️ Configuración relevante

| Archivo | Descripción |
|---------|-------------|
| `config/nlp.php` | Parámetros del pipeline NLP (stemming, n-gramas, stopwords, max records) |
| `config/cors.php` | Configuración CORS para el frontend |
| `config/sanctum.php` | Dominios permitidos para autenticación con cookies |
| `config/l5-swagger.php` | Configuración de la documentación Swagger |

---

## 📄 Licencia

Software de código abierto bajo la [Licencia MIT](https://opensource.org/licenses/MIT).
