# Cómo levantar Observatorio ULEAM (Windows / PowerShell)

Ruta del proyecto:
`C:\Users\andre\OneDrive\Escritorio\Observatorio\Observatirio`

Requisitos: Docker Desktop abierto, PHP en el PATH, Composer, bun.

---

## Forma rápida (todo de una vez)

```powershell
docker stop observatorio-backend-dev   # solo si ese contenedor ocupa el :8000
cd C:\Users\andre\OneDrive\Escritorio\Observatorio\Observatirio
.\scripts\start.ps1 all
```

Comandos del script: `all`, `docker`, `backend`, `frontend`, `setup`, `stop`, `restart`, `migrate`, `clean`.

---

## Forma manual (servicio por servicio)

### 1. Base de datos (PostgreSQL en Docker, puerto 5433)
```powershell
cd C:\Users\andre\OneDrive\Escritorio\Observatorio\Observatirio
docker compose up -d
```

### 2. Backend (Laravel → http://localhost:8000)
```powershell
cd C:\Users\andre\OneDrive\Escritorio\Observatorio\Observatirio\backend
php artisan serve
```

### 3. Frontend (Angular → http://localhost:4200) — en OTRA terminal
```powershell
cd C:\Users\andre\OneDrive\Escritorio\Observatorio\Observatirio\frontend
bun run start
```

---

## Seed de datos (desde la carpeta `backend`, con la BD levantada)

```powershell
cd C:\Users\andre\OneDrive\Escritorio\Observatorio\Observatirio\backend
php artisan migrate --seed         # crea tablas que falten y siembra
```

Variantes:
- `php artisan db:seed`            → solo vuelve a sembrar
- `php artisan migrate:fresh --seed` → BORRA todo, recrea tablas y siembra desde cero

---

## Acceso
- URL: http://localhost:4200
- Email: `admin@uleam.edu.ec`
- Contraseña: `Admin12345`

## Notas / configuración propia de esta máquina
- Postgres de Docker está en el puerto **5433** (hay un PostgreSQL nativo en el 5432).
- Si `php`/`composer` "no se reconocen": cierra y reabre la terminal (o VS Code) para refrescar el PATH.
- El proyecto pide **PHP 8.4**; con PHP 8.5 usar `composer install --ignore-platform-req=php`.
- Para detener todo: `.\scripts\start.ps1 stop`.
```
