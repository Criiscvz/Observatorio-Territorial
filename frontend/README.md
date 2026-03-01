# 🖥️ Observatorio ULEAM — Frontend

**Single Page Application construida con Angular 21, Angular Material y ECharts para la visualización interactiva de datos estadísticos.**

![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Material](https://img.shields.io/badge/Angular%20Material-21-757575?logo=angular&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![ECharts](https://img.shields.io/badge/ECharts-5.6-AA344D)

---

## 📋 Descripción

El frontend del Observatorio es una aplicación Angular 21 que permite a distintos tipos de usuarios interactuar con la plataforma:

- **Administradores**: Dashboard con KPIs, gestión de departamentos, datasets, usuarios y variables
- **Editores/Lectores**: Exploración y análisis de datasets asignados a su departamento
- **Público en general**: Portal abierto para explorar datasets publicados, visualizar gráficos y consultar el barómetro socioeconómico

---

## 🏗️ Arquitectura

El frontend sigue una **arquitectura feature-based con patrón MVVM** y standalone components de Angular 21:

```
src/app/
├── core/                  # Servicios singleton, DI y configuración global
│   ├── services/              ApiService, AuthService, DashboardService, DatasetService...
│   ├── models/                Interfaces TypeScript por dominio
│   ├── guards/                authGuard, adminGuard, roleGuard
│   ├── interceptors/          Auth interceptor (Sanctum token)
│   └── infrastructure/        Configuración de providers
│
├── features/              # Módulos funcionales (lazy-loaded)
│   ├── auth/                  Login y registro
│   ├── dashboard/             Panel principal del admin
│   ├── datasets/              Lista, upload, detalle, análisis de variables
│   ├── departamentos/         CRUD de departamentos/observatorios
│   ├── profile/               Perfil de usuario
│   ├── public/                Portal público (home, departamentos, datasets, barómetro)
│   └── usuarios/              Gestión de usuarios (solo admin)
│
├── presentation/          # ViewModels (patrón MVVM)
│   ├── viewmodels/            AuthViewModel, DashboardViewModel, DatasetAnalysisViewModel
│   ├── components/            Componentes de presentación
│   └── shared/                Componentes compartidos de presentación
│
├── shared/                # Componentes y utilidades reutilizables
│   ├── components/
│   │   ├── main-layout/       Layout principal (sidebar + header + content)
│   │   ├── variable-analysis/ Componente de análisis de variables con gráficos
│   │   ├── text-insights-panel/ Panel de insights NLP (wordcloud, sentiment, n-grams)
│   │   └── ...
│   ├── directives/
│   └── services/
│
└── routes/                # Configuración de rutas
    ├── admin.routes.ts        Rutas del panel administrativo (protegidas)
    ├── auth.routes.ts         Rutas de autenticación
    └── public.routes.ts       Rutas del portal público (abiertas)
```

### Patrones clave

- **Standalone Components**: Angular 21+ sin NgModules, cada componente es autocontenido
- **Lazy Loading**: Todas las rutas cargan componentes de forma diferida con `loadComponent()`
- **Signals**: Uso extensivo de `signal()`, `computed()` y `effect()` para estado reactivo
- **MVVM**: ViewModels dedicados separan lógica de presentación de la UI
- **Guards funcionales**: `authGuard` y `adminGuard` protegen rutas según roles

---

## 🎨 Sistema de diseño

El frontend implementa un sistema de diseño **Glassmorphism + Neo-SaaS** con:

- **Angular Material 21**: Componentes base (buttons, cards, forms, tables, dialogs...)
- **Tailwind CSS 4**: Utilidades de layout, spacing y responsive design
- **Temas claro/oscuro**: Toggle completo con `ThemeService` y variables CSS
- **Paleta ULEAM**: Rojo institucional `#C8102E` + Indigo primario `#6366F1`
- **Glassmorphism**: Efectos de blur y transparencia en cards y paneles

> Documentación completa del sistema de diseño en `docs/diseño.md`

---

## 📊 Visualizaciones

Los gráficos se renderizan con **ECharts** (vía `ngx-echarts`) y soportan:

| Tipo | Variable | Descripción |
|------|----------|-------------|
| Barras | Categórica | Distribución de frecuencias |
| Pie/Donut | Categórica | Proporciones relativas |
| Histograma | Numérica | Distribución por rangos |
| Línea | Fecha | Series temporales |
| Scatter | Numérica × Numérica | Correlación entre variables |
| Heatmap | Categórica × Categórica | Tabla cruzada como mapa de calor |
| Nube de palabras | Texto | Frecuencia de términos (NLP) |
| Panel de insights | Texto | Sentiment, keywords, n-gramas |

Todos los gráficos son interactivos con zoom, tooltips y exportación.

---

## 🛣️ Rutas principales

### Panel administrativo (`/admin/...`) — Requiere autenticación
| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/admin/dashboard` | DashboardComponent | KPIs y resumen general |
| `/admin/datasets` | DatasetListComponent | Lista de datasets |
| `/admin/datasets/nuevo` | DatasetUploadComponent | Subir nuevo Excel |
| `/admin/datasets/:id` | DatasetViewComponent | Detalle y datos del dataset |
| `/admin/datasets/:id/variable/:varId` | AdminVariableAnalysis | Análisis de variable con gráficos |
| `/admin/departamentos/nuevo` | DepartamentoFormComponent | Crear departamento |
| `/admin/usuarios` | UsuariosComponent | Gestión de usuarios |

### Portal público (`/publico/...`) — Sin autenticación
| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/publico/departamentos` | PublicDepartamentos | Explorar observatorios |
| `/publico/departamentos/:id` | PublicDepartamentoDetail | Datasets de un observatorio |
| `/publico/datasets/:id` | PublicDatasetView | Ver datos y variables |
| `/publico/datasets/:id/variable/:varId` | PublicVariableAnalysis | Gráficos y análisis público |
| `/publico/barometro/:codigo` | BarometerView | Vista del barómetro |

---

## 🚀 Instalación y desarrollo

### Requisitos

- **Node.js 20+** o **Bun 1.3+**

### Usando los scripts del proyecto (recomendado)

```bash
# Desde la raíz del monorepo (Observatorio/):

./scripts/frontend.sh install   # Instala dependencias (auto-detecta Bun o npm)
./scripts/frontend.sh start     # Inicia dev server en puerto 4200
./scripts/frontend.sh build     # Build de producción
./scripts/frontend.sh test      # Ejecutar tests
./scripts/frontend.sh lint      # Linter
```

### Instalación manual

```bash
cd frontend

# Con Bun (más rápido)
bun install
bun start

# O con npm
npm install
npm start
```

El servidor de desarrollo estará disponible en **http://localhost:4200** con hot-reload automático.

---

## 🌐 Internacionalización

El proyecto usa **@ngx-translate** para soporte multi-idioma:

- Archivos de traducción en `src/assets/i18n/`
- Uso en templates con el pipe `| translate`
- Soporte para español (por defecto) e inglés

---

## 🧪 Testing

```bash
cd frontend
npm test          # Ejecutar tests con Vitest
npm run lint      # Ejecutar ESLint
```

El proyecto usa **Vitest 4** como test runner, compatible con la configuración de Angular 21.

---

## 🚢 Despliegue

### Vercel (configurado)

El proyecto incluye `vercel.json` con la configuración necesaria para desplegar en Vercel con SSR:

```bash
# Build de producción
./scripts/frontend.sh build

# El output se genera en dist/ listo para Vercel
```

### Variables de entorno

```typescript
// src/environments/environment.ts (desarrollo)
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api'
};

// src/environments/environment.prod.ts (producción)
export const environment = {
  production: true,
  apiUrl: 'https://tu-backend.com/api'
};
```

---

## 📄 Licencia

Software de código abierto bajo la [Licencia MIT](https://opensource.org/licenses/MIT).
