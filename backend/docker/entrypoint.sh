#!/bin/sh
set -eu

echo "Starting Observatorio ULEAM Laravel backend"

mkdir -p \
    /var/log/supervisor \
    /var/run \
    /var/www/html/storage/framework/cache/data \
    /var/www/html/storage/framework/sessions \
    /var/www/html/storage/framework/views \
    /var/www/html/storage/logs \
    /var/www/html/storage/api-docs \
    /var/www/html/bootstrap/cache

chown -R www:www /var/www/html/storage /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache

# Render injects PORT. The fallback keeps local Docker useful without fixing a
# production port in the image.
PORT="${PORT:-10000}"
sed -i "s/__PORT__/${PORT}/g" /etc/nginx/http.d/default.conf

if [ -z "${APP_KEY:-}" ] || [ "$APP_KEY" = "base64:" ]; then
    echo "APP_KEY must be configured as an environment variable." >&2
    exit 1
fi

php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Swagger is generated at boot/deploy time. Migrations are intentionally
# manual (`php artisan migrate --force`) so an application restart never
# changes production data or runs seeders.
php artisan l5-swagger:generate

exec "$@"
