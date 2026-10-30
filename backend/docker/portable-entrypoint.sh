#!/bin/sh
set -eu
umask 077
if [ -z "${APP_KEY:-}" ] || [ "$APP_KEY" = "base64:" ]; then
    echo "APP_KEY is required; use the private rehearsal environment file." >&2
    exit 1
fi
mkdir -p storage/app/private storage/app/public/avatars storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs storage/api-docs bootstrap/cache
# Cache only. Schema changes are an explicit, separately invoked Compose task.
if [ "${1:-}" = "php-fpm" ]; then
    php artisan package:discover --ansi
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
fi
exec "$@"
