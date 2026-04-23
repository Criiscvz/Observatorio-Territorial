# Despliegue con Docker - Observatorio ULEAM Backend

## Requisitos

- Docker 20.10+
- Docker Compose 2.0+

## Configuración Rápida

### 1. Crear archivo de variables de entorno

```bash
cp .env.example .env.docker
```

### 2. Editar `.env.docker` con valores de producción

```env
APP_NAME="Observatorio ULEAM"
APP_ENV=production
APP_KEY=base64:TU_CLAVE_GENERADA
APP_DEBUG=false
APP_URL=https://tu-dominio.com

DB_DATABASE=observatorio_uleam
DB_USERNAME=postgres
DB_PASSWORD=TU_PASSWORD_SEGURA

SEED_TOKEN=TU_TOKEN_SEGURO
ADMIN_EMAIL=admin@uleam.edu.ec
ADMIN_PASSWORD=TU_PASSWORD_ADMIN

SANCTUM_STATEFUL_DOMAINS=tu-dominio.com,localhost:4200
```

### 3. Construir y ejecutar

```bash
# Construir imagen
docker-compose -f docker-compose.prod.yml --env-file .env.docker build

# Iniciar servicios
docker-compose -f docker-compose.prod.yml --env-file .env.docker up -d

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f backend
```

## Comandos Útiles

### Ver estado de los servicios

```bash
docker-compose -f docker-compose.prod.yml ps
```

### Ejecutar migraciones manualmente

```bash
docker-compose -f docker-compose.prod.yml exec backend php artisan migrate
```

### Crear usuario administrador

```bash
# Via API (requiere SEED_TOKEN configurado)
curl -X POST http://localhost:8000/api/seed/admin \
  -H "X-Seed-Token: TU_SEED_TOKEN"

# O directamente en el contenedor
docker-compose -f docker-compose.prod.yml exec backend php artisan db:seed --class=AdminUserSeeder
```

### Limpiar caché

```bash
docker-compose -f docker-compose.prod.yml exec backend php artisan cache:clear
docker-compose -f docker-compose.prod.yml exec backend php artisan config:clear
docker-compose -f docker-compose.prod.yml exec backend php artisan route:clear
docker-compose -f docker-compose.prod.yml exec backend php artisan view:clear
```

### Generar documentación Swagger

```bash
docker-compose -f docker-compose.prod.yml exec backend php artisan swagger:generate
```

### Acceder al shell del contenedor

```bash
docker-compose -f docker-compose.prod.yml exec backend sh
```

### Detener servicios

```bash
docker-compose -f docker-compose.prod.yml down
```

### Eliminar todo (incluyendo volúmenes)

```bash
docker-compose -f docker-compose.prod.yml down -v
```

## Despliegue en Servicios Cloud

### Railway

1. Crear nuevo proyecto en [Railway](https://railway.app)
2. Agregar servicio PostgreSQL
3. Agregar servicio desde Docker
4. Configurar variables de entorno
5. Railway detectará automáticamente el Dockerfile

### Render

1. Crear nuevo Web Service en [Render](https://render.com)
2. Seleccionar "Docker" como ambiente
3. Conectar repositorio Git
4. Configurar:
   - Docker Build Context: `./backend`
   - Dockerfile Path: `./backend/Dockerfile`
5. Agregar PostgreSQL como servicio adicional
6. Configurar variables de entorno

### DigitalOcean App Platform

1. Crear nueva App
2. Seleccionar repositorio
3. Configurar componente:
   - Type: Web Service
   - Source: Dockerfile
   - Dockerfile Path: backend/Dockerfile
4. Agregar base de datos PostgreSQL
5. Configurar variables de entorno

## Estructura del Contenedor

```
/var/www/html/          # Código de la aplicación
├── storage/
│   ├── app/public/     # Archivos subidos (avatares, etc.)
│   ├── logs/           # Logs de Laravel
│   └── api-docs/       # Documentación Swagger generada
├── public/
│   └── storage -> ../storage/app/public  # Enlace simbólico
└── ...
```

## Puertos

| Puerto | Servicio    |
| ------ | ----------- |
| 8000   | Nginx + PHP |
| 5432   | PostgreSQL  |

## Healthcheck

El contenedor incluye un healthcheck que verifica:
- Endpoint: `http://localhost:8000/api/documentation`
- Intervalo: 30 segundos
- Timeout: 10 segundos
- Reintentos: 3

## Volúmenes

| Volumen           | Descripción                   |
| ----------------- | ----------------------------- |
| `postgres-data`   | Datos de PostgreSQL           |
| `backend-storage` | Archivos subidos              |
| `backend-logs`    | Logs de Laravel               |

## Solución de Problemas

### Error de conexión a base de datos

```bash
# Verificar que PostgreSQL esté corriendo
docker-compose -f docker-compose.prod.yml ps postgres

# Ver logs de PostgreSQL
docker-compose -f docker-compose.prod.yml logs postgres
```

### Error de permisos en storage

```bash
docker-compose -f docker-compose.prod.yml exec backend chown -R www:www /var/www/html/storage
docker-compose -f docker-compose.prod.yml exec backend chmod -R 775 /var/www/html/storage
```

### Regenerar caché después de cambios

```bash
docker-compose -f docker-compose.prod.yml exec backend php artisan config:cache
docker-compose -f docker-compose.prod.yml exec backend php artisan route:cache
docker-compose -f docker-compose.prod.yml exec backend php artisan view:cache
```
