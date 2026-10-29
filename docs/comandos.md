# Comandos del Proyecto - Observatorio ULEAM

Este documento contiene todos los comandos necesarios para ejecutar y desarrollar el proyecto.

---

## Inicio Rápido

### Usando VS Code Tasks (Recomendado)

Presiona `Ctrl+Shift+P` y escribe "Tasks: Run Task" para ver todas las tareas disponibles:

| Tarea | Descripción |
|-------|-------------|
| 🚀 Iniciar TODO | Inicia Docker, Backend y Frontend |
| ⏹️ Detener TODO | Detiene todos los servicios |
| 🔧 Setup inicial | Primera instalación del proyecto |
| Docker: Iniciar PostgreSQL | Solo inicia la base de datos |
| Backend: Iniciar servidor | Solo inicia Laravel |
| Frontend: Iniciar servidor dev | Solo inicia Angular |

### Usando Scripts

**PowerShell (Windows):**
```powershell
# Ir a la carpeta scripts
cd scripts

# Ver ayuda
.\start.ps1 help

# Iniciar todo
.\start.ps1 all

# Primera vez (setup)
.\start.ps1 setup
```

**CMD (Windows):**
```cmd
cd scripts
start.bat all
```

**Bash (Linux/Mac):**
```bash
cd scripts
chmod +x start.sh
./start.sh all
```

---

## Comandos por Servicio

### Docker (PostgreSQL)

```bash
# Iniciar PostgreSQL
docker-compose up -d

# Detener PostgreSQL
docker-compose down

# Ver logs
docker-compose logs -f postgres

# Reiniciar
docker-compose restart

# Acceder a la consola de PostgreSQL
docker exec -it observatorio-postgres psql -U postgres -d observatorio_uleam
```

### Backend (Laravel)

```bash
cd backend

# Instalar dependencias
composer install

# Copiar archivo de configuración
cp .env.example .env

# Generar clave de aplicación
php artisan key:generate

# Iniciar servidor de desarrollo
php artisan serve --host=localhost --port=8000

# Ejecutar migraciones
php artisan migrate

# Resetear base de datos
php artisan migrate:fresh

# Limpiar caché
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Generar documentación Swagger
php artisan l5-swagger:generate

# Ver rutas API
php artisan route:list --path=api

# Consola interactiva (Tinker)
php artisan tinker
```

### Frontend (Angular)

```bash
cd frontend

# Instalar dependencias (usando Bun)
bun install

# O con npm
npm install

# Iniciar servidor de desarrollo
bun run start
# o
npm start

# Build de producción
bun run build

# Ejecutar tests
bun run test

# Linting
bun run lint
```

---

## URLs del Proyecto

| Servicio | URL |
|----------|-----|
| Frontend Angular | http://localhost:4200 |
| Backend Laravel API | http://localhost:8000/api |
| Swagger Documentation | http://localhost:8000/api/docs |
| PostgreSQL | localhost:5432 |

---

## Configuración de Base de Datos

**Conexión local (Docker, sin contraseña predeterminada):**

```
Host: localhost
Puerto: 5432
Base de datos: observatorio_uleam
Usuario: postgres
Contraseña: definida mediante DB_PASSWORD en tu entorno local protegido
```

**Cadena de conexión:**

Define `DATABASE_URL` en el entorno protegido, o usa las variables `DB_HOST`,
`DB_PORT`, `DB_DATABASE`, `DB_USERNAME` y `DB_PASSWORD`. No copies contraseñas
a este documento ni al repositorio. No hay una URI lista para pegar con una
clave compartida. Para conectar por TCP al servicio del Compose raíz, usa el
nombre del contenedor, no su socket local ni su dirección loopback:

```powershell
docker exec -it observatorio_db psql -h observatorio_db -p 5432 -U postgres -d observatorio_uleam -W
```

La opción `-W` solo solicita la clave; no verifica por sí misma que el servidor
la utilice. Sin `-h`, `psql` dentro del contenedor Linux usa un socket Unix.
También `-h 127.0.0.1` puede usar una regla local `trust`: en ambos casos, entrar
no demuestra que la contraseña sea correcta.

El nombre `observatorio_db` resuelve a una dirección no-loopback en el Compose
revisado. Para interpretar una conexión correcta como validación de la clave,
la primera regla aplicable de `pg_hba.conf` para esa dirección, usuario y base
debe exigir autenticación por contraseña, por ejemplo `scram-sha-256`. En la
configuración local revisada, esa ruta TCP usa `scram-sha-256`; si tu volumen
conserva una configuración distinta o la regla efectiva es `trust`, este ejemplo
no acredita la clave. No cambies las reglas para omitir la autenticación.

Cuando la ruta exige contraseña, esta debe coincidir con la configurada cuando
se inicializó el volumen. Cambiar una variable de Compose no actualiza por sí
solo la clave de una base ya creada. No elimines el volumen para resolverlo:
revisa primero el respaldo y el procedimiento de cambio de credenciales.

Referencias: [opción `-W` y conexiones de psql](https://www.postgresql.org/docs/16/app-psql.html#APP-PSQL-OPTION-PASSWORD)
y [selección de reglas de `pg_hba.conf`](https://www.postgresql.org/docs/16/auth-pg-hba-conf.html).

---

## Flujo de Desarrollo

### Primera vez (Setup completo)

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd Observatorio

# 2. Iniciar PostgreSQL
docker-compose up -d

# 3. Configurar Backend
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate

# 4. Configurar Frontend
cd ../frontend
bun install

# 5. Iniciar servidores (en terminales separadas)
# Terminal 1: Backend
cd backend && php artisan serve

# Terminal 2: Frontend
cd frontend && bun run start
```

### Día a día

```powershell
# Opción 1: VS Code Task
# Ctrl+Shift+P → "Tasks: Run Task" → "🚀 Iniciar TODO"

# Opción 2: Script
cd scripts
.\start.ps1 all
```

---

## Solución de Problemas

### Error de conexión a PostgreSQL
```bash
# Verificar que Docker está corriendo
docker ps

# Reiniciar contenedor
docker-compose restart
```

### Error de permisos en PowerShell
```powershell
# Ejecutar como Administrador
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### Puerto ocupado
```bash
# Encontrar proceso usando el puerto 8000
netstat -ano | findstr :8000

# Matar proceso
taskkill /PID <numero_pid> /F
```

### Limpiar caché completo
```bash
cd backend
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
composer dump-autoload
```

---

## Atajos de VS Code

| Atajo | Acción |
|-------|--------|
| `Ctrl+Shift+P` | Paleta de comandos |
| `Ctrl+Shift+B` | Ejecutar tarea por defecto |
| `Ctrl+`` ` | Abrir terminal |
| `F5` | Debug (si está configurado) |

---

**Última actualización:** Enero 2026
