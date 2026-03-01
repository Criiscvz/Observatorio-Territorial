# 🔭 Observatorio de Datos ULEAM

**Plataforma integral de gestión, análisis estadístico y visualización de datos para la Universidad Laica Eloy Alfaro de Manabí (ULEAM).**

![Laravel](https://img.shields.io/badge/Laravel-12-FF2D20?logo=laravel&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![PHP](https://img.shields.io/badge/PHP-8.2+-777BB4?logo=php&logoColor=white)
![License](https://img.shields.io/badge/Licencia-MIT-green)

---

## 📋 Descripción

El Observatorio ULEAM es un sistema web que permite a departamentos universitarios cargar archivos Excel con cualquier estructura de columnas, detectar automáticamente los tipos de variables y generar análisis estadísticos interactivos — todo sin necesidad de modificar el esquema de la base de datos.

La plataforma funciona como un **Barómetro Socioeconómico** que ofrece tanto un panel administrativo interno como un portal público donde ciudadanos e investigadores pueden explorar datasets publicados, visualizar gráficos y consultar indicadores.

### Funcionalidades principales

- **Ingesta dinámica de datos**: Carga de archivos Excel con detección automática del tipo de cada columna (numérico, categórico, fecha, texto)
- **Análisis univariable y bivariable**: Histogramas, barras, líneas, pie, scatter, heatmaps y tablas cruzadas
- **Procesamiento de lenguaje natural (NLP)**: Nubes de palabras, TF-IDF, análisis de sentimiento, n-gramas y clasificación por keywords — todo en PHP puro
- **Portal público**: Exploración de datasets publicados sin autenticación, vista de barómetro por departamento
- **Roles multi-departamento**: Los usuarios pueden pertenecer a varios departamentos con roles diferenciados (Admin, Editor, Lector)
- **Sistema de diseño Glassmorphism + Neo-SaaS**: Temas claro/oscuro con soporte completo
- **Internacionalización**: Soporte multi-idioma con ngx-translate
- **SSR**: Server-Side Rendering con Angular para mejor SEO

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Angular 21)                 │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌────────┐│
│  │ Features  │  │ Core     │  │Presentation│  │ Shared ││
│  │(lazy-load)│  │(services,│  │(viewmodels)│  │(layout,││
│  │           │  │ guards)  │  │            │  │ comps) ││
│  └──────────┘  └──────────┘  └───────────┘  └────────┘│
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / REST API
┌────────────────────────┴────────────────────────────────┐
│                   Backend (Laravel 12)                   │
│  ┌─────────────┐  ┌────────────┐  ┌──────────────────┐ │
│  │ Presentation │  │ Application│  │  Infrastructure  │ │
│  │ (Controllers,│  │ (UseCases, │  │  (Repositories,  │ │
│  │  Requests,   │  │  DTOs)     │  │   Services)      │ │
│  │  Resources)  │  │            │  │                  │ │
│  └─────────────┘  └────────────┘  └──────────────────┘ │
│  ┌─────────────────────────────────────────────────────┐│
│  │          Domain (Entities, Repositories, VOs)       ││
│  └─────────────────────────────────────────────────────┘│
└────────────────────────┬────────────────────────────────┘
                         │ SQL / JSONB
              ┌──────────┴──────────┐
              │   PostgreSQL 16     │
              │  (JSONB + Relacional)│
              └─────────────────────┘
```

El backend sigue **Domain-Driven Design (DDD)** con arquitectura limpia en 4 capas. El frontend usa una **arquitectura feature-based con MVVM** y standalone components de Angular 21.

---

## 🛠️ Tech Stack

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Backend | Laravel (PHP) | 12.x (PHP 8.2+) |
| Frontend | Angular | 21.x |
| Base de datos | PostgreSQL | 16 (Alpine, Docker) |
| Autenticación | Laravel Sanctum | 4.x |
| UI | Angular Material + Tailwind CSS | Material 21.x |
| Gráficos | ECharts (ngx-echarts) | 5.6.x |
| Excel Import | maatwebsite/excel | 3.1 |
| API Docs | L5-Swagger (OpenAPI) | 10.x |
| Internacionalización | @ngx-translate | 17.x |
| SSR | Angular SSR + Express | Built-in |
| Package Manager | Bun (con fallback a npm) | 1.3+ |
| Testing | PHPUnit 11 / Vitest 4 | — |

---

## 📦 Estructura del monorepo

```
Observatorio/
├── backend/            # API REST — Laravel 12 (DDD)
│   ├── app/
│   │   ├── Domain/         # Entidades, interfaces de repositorios, value objects
│   │   ├── Application/    # Casos de uso, DTOs
│   │   ├── Infrastructure/ # Repositorios Eloquent, servicios (Statistics, NLP, Excel)
│   │   ├── Presentation/   # Controllers, Form Requests, API Resources
│   │   └── Models/         # Modelos Eloquent
│   ├── routes/modules/     # Rutas modularizadas (auth, datasets, stats, publico...)
│   ├── config/             # Configuración (nlp.php, cors.php, sanctum.php...)
│   └── database/           # Migraciones y seeders
│
├── frontend/           # SPA — Angular 21
│   └── src/app/
│       ├── core/           # Servicios singleton, guards, interceptors, modelos
│       ├── features/       # Módulos por funcionalidad (lazy-loaded)
│       ├── presentation/   # ViewModels (patrón MVVM)
│       ├── shared/         # Componentes reutilizables (layout, charts, panels)
│       └── routes/         # Configuración de rutas (admin, auth, público)
│
├── scripts/            # Scripts de desarrollo multiplataforma (.sh / .ps1)
├── docs/               # Documentación (diseño, DB, datos CSV)
└── docker-compose.yml  # PostgreSQL 16
```

---

## 🚀 Inicio rápido

### Requisitos previos

- **Docker** y **Docker Compose** (para PostgreSQL)
- **PHP 8.2+** con extensiones: pdo_pgsql, mbstring, xml, zip
- **Composer** 2.x
- **Node.js 20+** o **Bun 1.3+**

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPOSITORIO>
cd Observatorio
```

### 2. Usando los scripts de desarrollo (recomendado)

```bash
# Iniciar todo (PostgreSQL + Backend + Frontend) en un solo comando
./scripts/start.sh

# O individualmente:
./scripts/docker.sh up         # Levanta PostgreSQL
./scripts/backend.sh install   # Instala dependencias PHP
./scripts/backend.sh migrate   # Ejecuta migraciones
./scripts/backend.sh start     # Inicia servidor Laravel (puerto 8000)
./scripts/frontend.sh install  # Instala dependencias Node/Bun
./scripts/frontend.sh start    # Inicia dev server Angular (puerto 4200)
```

### 3. Usando VS Code Tasks

El proyecto incluye tareas preconfiguradas en VS Code:

- **`🚀 Iniciar TODO`** — Levanta Docker + Backend + Frontend en paralelo
- **`🔧 Setup inicial`** — Instala dependencias y ejecuta migraciones en secuencia
- **`⏹️ Detener TODO`** — Detiene todos los servicios

Ejecutarlas desde: `Ctrl+Shift+P → Tasks: Run Task`

### 4. Variables de entorno

```bash
# backend/.env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=observatorio_uleam
DB_USERNAME=postgres
DB_PASSWORD=secret123

SANCTUM_STATEFUL_DOMAINS=localhost:4200
SESSION_DOMAIN=localhost
```

### 5. URLs de desarrollo

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:4200 |
| API Backend | http://localhost:8000/api |
| Swagger (OpenAPI) | http://localhost:8000/api/documentation |
| PostgreSQL | localhost:5432 |

---

## 📖 Documentación adicional

- [Backend — README detallado](backend/README.md)
- [Frontend — README detallado](frontend/README.md)
- [Sistema de diseño](docs/diseño.md)
- [Documentación de la base de datos](docs/documentaciondelaDB.md)

---

## 📄 Licencia

Este proyecto es software de código abierto bajo la [Licencia MIT](https://opensource.org/licenses/MIT).

Desarrollado para la **Universidad Laica Eloy Alfaro de Manabí (ULEAM)**.
