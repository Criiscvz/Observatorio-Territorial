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

# `optimize:clear` removes the file-cache hierarchy. SharePoint caches its
# Microsoft Graph token, so recreate the cache root before serving requests.
mkdir -p /var/www/html/storage/framework/cache/data
chown -R www:www /var/www/html/storage/framework/cache
chmod -R 775 /var/www/html/storage/framework/cache

php artisan config:cache

# Render Free does not provide an interactive Shell. Enable this flag only for
# a deployment that includes new migrations, then disable it again after the
# deployment succeeds. `migrate --force` is incremental and never runs seeders.
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "Running pending database migrations"
    php artisan migrate --force
else
    # This release reads the delegated capability columns during authentication.
    # Apply its additive migration before serving traffic, even when the general
    # migration switch is off. Laravel records it once; later boots are a no-op.
    echo "Ensuring supervisor access schema is current"
    php artisan migrate --force --path=database/migrations/2026_10_27_000001_add_observatory_administrator.php
    # Publication responses and review forms read these additive columns.
    # Ensure they exist before the new code starts accepting requests.
    php artisan migrate --force --path=database/migrations/2026_10_28_000001_add_review_observation_to_publications.php
    php artisan migrate --force --path=database/migrations/2026_10_28_000002_add_observatory_photo.php
    # Access predicates reference these nullable fields; create schema before serving.
    # This adds no imported rows and never enables the disposable rehearsal.
    php artisan migrate --force --path=database/migrations/2026_10_29_000001_preserve_legacy_publication_access.php
fi

php artisan route:cache
php artisan view:cache

# Swagger is generated at boot/deploy time.
php artisan l5-swagger:generate

exec "$@"
