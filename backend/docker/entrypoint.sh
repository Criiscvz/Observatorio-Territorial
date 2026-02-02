#!/bin/sh
set -e

echo "=========================================="
echo "  Observatorio ULEAM - Backend Laravel"
echo "=========================================="

# Crear directorios de logs si no existen
mkdir -p /var/log/supervisor
mkdir -p /var/log/nginx

# Esperar a que la base de datos esté disponible
if [ -n "$DB_HOST" ]; then
    echo "Esperando a que la base de datos esté disponible..."
    max_tries=30
    counter=0
    until php -r "new PDO('pgsql:host=$DB_HOST;port=${DB_PORT:-5432};dbname=$DB_DATABASE', '$DB_USERNAME', '$DB_PASSWORD');" 2>/dev/null; do
        counter=$((counter + 1))
        if [ $counter -gt $max_tries ]; then
            echo "Error: No se pudo conectar a la base de datos después de $max_tries intentos"
            exit 1
        fi
        echo "Intento $counter/$max_tries - Base de datos no disponible, esperando..."
        sleep 2
    done
    echo "Base de datos conectada!"
fi

# Generar clave de aplicación si no existe
if [ -z "$APP_KEY" ] || [ "$APP_KEY" = "base64:" ]; then
    echo "Generando APP_KEY..."
    php artisan key:generate --force
fi

# Cachear configuración para producción
echo "Cacheando configuración..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Ejecutar migraciones
echo "Ejecutando migraciones..."
php artisan migrate --force

# Generar documentación Swagger
echo "Generando documentación Swagger..."
php artisan swagger:generate || true

# Crear enlace de storage si no existe
if [ ! -L "/var/www/html/public/storage" ]; then
    echo "Creando enlace de storage..."
    php artisan storage:link || true
fi

# Establecer permisos correctos
echo "Estableciendo permisos..."
chown -R www:www /var/www/html/storage
chown -R www:www /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage
chmod -R 775 /var/www/html/bootstrap/cache

echo "=========================================="
echo "  Iniciando servicios..."
echo "=========================================="

# Ejecutar el comando pasado (supervisor)
exec "$@"
