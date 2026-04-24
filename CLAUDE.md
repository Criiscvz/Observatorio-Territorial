# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Monorepo with three independent moving parts:

- `backend/` — Laravel 12 REST API (PHP 8.2+, follows DDD)
- `frontend/` — Angular 21 SPA with SSR (Bun preferred, npm fallback)
- `scripts/` — Cross-platform dev helpers (`.sh` for bash, `.ps1` for PowerShell, plus `start.bat`)
- `docker-compose.yml` at root — PostgreSQL 16 only (the full-stack dev workflow is script-driven, not compose-driven)

The scripts and the `.vscode/tasks.json` are the canonical entry points for everything. Prefer invoking them over running `php artisan`/`ng` directly so the Docker layering below stays consistent.

## Development workflow

### The Docker layering (important)

`scripts/backend.sh` runs the Laravel backend **inside a Docker container** (image `backend-backend`, built from `backend/Dockerfile`, PHP 8.4). PostgreSQL runs in its own container via `docker-compose.yml` at the repo root. The backend container talks to the Postgres container through `host.docker.internal` — so `.env`'s `DB_HOST` is overridden to `host.docker.internal` at runtime by the script, regardless of what's in the file.

Consequence: running `php artisan ...` directly on the host only works if you have PHP 8.2+ installed locally. Using `./scripts/backend.sh <cmd>` is the safer default — it shells into the container. The README instructions that show `composer install` / `php artisan serve` directly are the "manual fallback" path.

The frontend is **not** containerised for dev — it runs on the host via Bun or npm.

### Starting everything

```bash
./scripts/start.sh                  # Postgres + backend container + Angular dev server
# or from VS Code: Ctrl+Shift+P → "Tasks: Run Task" → "🚀 Iniciar TODO"
```

Individual pieces:

```bash
./scripts/docker.sh up              # Postgres only
./scripts/backend.sh install        # builds the backend Docker image (includes composer install)
./scripts/backend.sh migrate        # artisan migrate inside container
./scripts/backend.sh migrate-fresh-seed  # drop + migrate + seed
./scripts/backend.sh start          # backend at http://127.0.0.1:8000
./scripts/backend.sh logs           # tail container logs
./scripts/backend.sh swagger        # regenerate OpenAPI doc (served at /api/documentation)
./scripts/backend.sh routes         # list all API routes
./scripts/backend.sh tinker         # Laravel REPL inside container
./scripts/backend.sh cache-clear    # config/cache/route/view clear
./scripts/frontend.sh start         # Angular dev server at http://localhost:4200
./scripts/frontend.sh build         # prod build (output in frontend/dist/)
```

All of these have `.ps1` twins for Windows PowerShell — VS Code tasks auto-dispatch to the right one per platform.

### URLs

| Service | URL |
| --- | --- |
| Frontend | http://localhost:4200 |
| API | http://localhost:8000/api |
| Swagger JSON | http://localhost:8000/api/documentation |
| Swagger UI | http://localhost:8000/api/docs |
| Postgres | localhost:5432 (`postgres` / `secret123` / `observatorio_uleam`) |

### Tests

Backend — PHPUnit 11, split into `tests/Unit/` and `tests/Feature/`:

```bash
cd backend
php artisan test                            # all tests
php artisan test --filter=Unit              # only unit
php artisan test --filter=Feature           # only feature
php artisan test --filter=SomeTestClass     # one class
php artisan test --filter=SomeTestClass::testMethod   # one method
```

Frontend — Vitest 4:

```bash
cd frontend
bun run test    # or: npm test
```

There is no `lint` script declared in `frontend/package.json` even though `./scripts/frontend.sh lint` exists — running it will fail unless a `lint` script is added first.

## Backend architecture (DDD, 4 layers)

```
backend/app/
├── Domain/          # Pure domain: entities, repository interfaces, value objects. No framework deps.
├── Application/     # Use cases + DTOs, one folder per bounded context (Auth, Dashboard, Dataset, Public, ...).
├── Infrastructure/  # Eloquent repository impls, StatisticsService, TextProcessingService, ExcelReaderService, Providers/RepositoryServiceProvider
├── Presentation/    # HTTP layer: Controllers/Api, FormRequests, API Resources, Transformers
└── Models/          # Eloquent models (UUID PKs) — used only by Infrastructure
```

**Dependency injection binds domain interfaces to Eloquent implementations** in `app/Infrastructure/Providers/RepositoryServiceProvider.php`. When you add a new repository interface in `Domain/*/Repositories/`, you must also (1) create an `Eloquent*Repository` in `Infrastructure/Persistence/Eloquent/Repositories/`, and (2) register the binding in `$bindings` on `RepositoryServiceProvider`. `StatisticsServiceInterface` is also bound here; `TextProcessingService` is bound as a singleton.

### The JSONB trick (read this before touching data)

Excel uploads are stored in the `registros_datos` table with the row content in a `JSONB` column named `data` (GIN-indexed). That is **the whole point** of this codebase — departments can upload Excels with any column structure and the schema never changes. Column-type detection lives in `VariableMetadato` records, which describe each logical column of a dataset (its detected type, options, etc.).

When writing queries against registros, expect JSONB operators (`->>`, `->`, `@>`) rather than typed columns. Statistics are computed in SQL over JSONB inside `Infrastructure/Services/StatisticsService.php` — per-variable strategies dispatched by detected type (numeric / categorical / date / text).

### NLP pipeline

`TextProcessingService` is pure PHP — no Python, no external NLP service. It does tokenization, Spanish/English stopwords, stemming, n-grams, TF-IDF, sentiment (Spanish lexicon), and wordcloud weights. All tunables live in `backend/config/nlp.php` (n-gram sizes, max records processed, custom stopwords, etc.). The frontend's `TextInsightsPanel` consumes this.

### Routes are modular

`backend/routes/api.php` is a thin manifest — real routes live in `backend/routes/modules/*.php` (`auth.php`, `datasets.php`, `stats.php`, `publico.php`, `users.php`, `variables.php`, `departamentos.php`, `categorias.php`, `fuentes.php`, `graficos.php`, `seed.php`, `profile.php`). Each module file typically wraps its routes in `Route::middleware('auth:sanctum')` (and often a nested `Route::middleware('role:ADMIN')` for mutations) — public endpoints live under the `publico` prefix.

The `/api/publico/*` routes are the **unauthenticated** portal — keep that in mind when adding middleware. The seeder endpoint (`/api/seed/*`) is gated by an `X-Seed-Token` header matching `SEED_TOKEN` in `.env`.

Authentication is Laravel Sanctum (token-based for the SPA). `SANCTUM_STATEFUL_DOMAINS` must include the frontend origin.

### Roles

Two levels:

- **Global role** on `users.rol` — `ADMIN` or `USER`. Enforced by the `role:` middleware.
- **Per-department role** via pivot `usuario_departamento` — `ADMIN | EDITOR | LECTOR`. A user can belong to multiple departments with different roles.

## Frontend architecture

Angular 21 standalone components throughout (no NgModules). Layout:

```
frontend/src/app/
├── core/           # Singleton services (ApiService, AuthService, DashboardService, DatasetService), models, guards, interceptors, infrastructure/providers
├── features/       # Lazy-loaded feature areas: auth, dashboard, datasets, departamentos, usuarios, profile, public
├── presentation/   # ViewModels (MVVM) + presentation-only components
├── shared/         # Reusable UI: main-layout, variable-analysis, text-insights-panel, charts, directives
└── routes/         # admin.routes.ts, auth.routes.ts, public.routes.ts — wired into app.routes.ts
```

**MVVM is the convention** — feature components delegate state and side effects to a ViewModel from `presentation/viewmodels/` (e.g. `DatasetAnalysisViewModel`, `AuthViewModel`). New feature work should follow that split, not push logic into components. Reactive state uses Angular signals (`signal`, `computed`, `effect`) rather than RxJS subjects where possible.

Routing uses `loadComponent()` everywhere — keep new routes lazy. Three route trees are composed in `app.routes.ts`:

- `/` → public home
- `/publico/*` → public portal (no auth)
- `/auth/*` → login/register
- `/admin/*` → behind `authGuard`, wrapped in `MainLayoutComponent` (sidebar + header)
- `/perfil` → behind `authGuard`

Auth state is attached to API calls via the interceptor in `core/interceptors/` (Sanctum token).

### Visualisations

ECharts via `ngx-echarts`. Wordcloud uses `echarts-wordcloud`. The `variable-analysis` shared component picks the chart type from the variable's detected kind (numeric → histogram/scatter, categorical → bar/pie, date → line, categorical × categorical → heatmap, text → wordcloud + `text-insights-panel`).

### Package manager

`package.json` declares `"packageManager": "bun@1.3.0"`. Prefer `bun` locally, but `./scripts/frontend.sh` auto-detects and falls back to `npm` if Bun isn't installed.

### Environments

`src/environments/environment.ts` (dev, `apiUrl: http://localhost:8000/api`) and `environment.prod.ts` — changing these is the correct way to point the SPA at a different backend.

### SSR

Angular SSR is configured (`app.config.server.ts`, `app.routes.server.ts`, `server.mjs` output). Prod serve: `node dist/frontend/server/server.mjs`. Vercel deploy config lives in `frontend/vercel.json`.

## Conventions

- **i18n:** `@ngx-translate` with assets in `frontend/src/assets/i18n/`. Use the `| translate` pipe; don't hard-code Spanish/English strings in templates.
- **Design system:** Glassmorphism + Neo-SaaS. Palette: ULEAM red `#C8102E`, primary indigo `#6366F1`. Theme toggle lives in `ThemeService`. Details in `docs/diseño.md`.
- **Swagger:** After adding/modifying annotated controllers, run `./scripts/backend.sh swagger` so `storage/api-docs/api-docs.json` (served at `/api/documentation`) is fresh.
- **Migrations:** Timestamped `2026_MM_DD_...` naming is the existing convention. UUID PKs throughout.
- **Commits:** Spanish `feat:` / `fix:` / `refactor:` / `chore:` conventional commits (see `git log`).
