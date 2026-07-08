#!/bin/bash
# ============================================
# Backend Scripts (Laravel/PHP 8.4 via Docker)
# Uso: ./scripts/backend.sh <comando>
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PATH="$SCRIPT_DIR/../backend"
IMAGE_NAME="backend-backend"
CONTAINER_NAME="observatorio-backend-dev"
DATABASE_CONTAINER_NAME="observatorio_db"
ENV_FILE="$BACKEND_PATH/.env"

cd "$BACKEND_PATH" || exit 1

ensure_backend_image() {
    if ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
        echo "🐳 Imagen $IMAGE_NAME no encontrada. Construyendo..."
        docker build -t "$IMAGE_NAME" -f Dockerfile .
    fi
}

get_database_network() {
    local network
    network=$(docker inspect "$DATABASE_CONTAINER_NAME" --format '{{range $k, $_ := .NetworkSettings.Networks}}{{println $k}}{{end}}' 2>/dev/null | head -n 1)
    if [[ -z "$network" ]]; then
        echo "No se pudo detectar la red del contenedor PostgreSQL $DATABASE_CONTAINER_NAME. Inicia la base de datos primero." >&2
        exit 1
    fi

    printf '%s' "$network"
}

run_artisan() {
    ensure_backend_image
    local database_network
    database_network=$(get_database_network)
    docker run --rm \
        --network "$database_network" \
        --env-file "$ENV_FILE" \
        -e DB_HOST="$DATABASE_CONTAINER_NAME" \
        --entrypoint php \
        "$IMAGE_NAME" artisan "$@"
}

COMMAND="${1:-help}"

case "$COMMAND" in
    start)
        ensure_backend_image
        echo "🚀 Iniciando backend en http://127.0.0.1:8000 con PHP 8.4 (Docker)..."
        docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
        database_network=$(get_database_network)
        docker run -d \
            --name "$CONTAINER_NAME" \
            --rm \
            -p 8000:8000 \
            --network "$database_network" \
            --env-file "$ENV_FILE" \
            -e DB_HOST="$DATABASE_CONTAINER_NAME" \
            --entrypoint php \
            "$IMAGE_NAME" artisan serve --host=0.0.0.0 --port=8000 >/dev/null
        echo "✅ Backend iniciado. Usa './scripts/backend.sh logs' para ver salida."
        ;;
    stop)
        echo "⏹️ Deteniendo backend..."
        docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
        echo "✅ Backend detenido"
        ;;
    logs)
        echo "📜 Mostrando logs del backend..."
        docker logs -f "$CONTAINER_NAME"
        ;;
    install)
        echo "📥 Construyendo imagen backend (incluye Composer install en Dockerfile)..."
        docker build -t "$IMAGE_NAME" -f Dockerfile .
        ;;
    migrate)
        echo "🗄️ Ejecutando migraciones..."
        run_artisan migrate --force
        ;;
    seed)
        echo "🌱 Ejecutando seeders..."
        run_artisan db:seed --force
        ;;
    migrate-fresh)
        echo "🗄️ Reseteando base de datos y ejecutando migraciones..."
        run_artisan migrate:fresh --force
        ;;
    migrate-fresh-seed)
        echo "🗄️ Reseteando base de datos + seeders..."
        run_artisan migrate:fresh --seed --force
        ;;
    cache-clear)
        echo "🧹 Limpiando cachés..."
        run_artisan config:clear
        run_artisan cache:clear
        run_artisan route:clear
        run_artisan view:clear
        echo "✅ Caché limpiado"
        ;;
    swagger)
        echo "📚 Generando documentación Swagger..."
        run_artisan l5-swagger:generate
        ;;
    routes)
        echo "🛤️ Listando rutas API..."
        run_artisan route:list --path=api
        ;;
    tinker)
        echo "🔧 Iniciando Tinker (REPL)..."
        run_artisan tinker
        ;;
    help|*)
        echo "Backend Scripts - Comandos disponibles:"
        echo "  start              - Iniciar backend en Docker (PHP 8.4)"
        echo "  stop               - Detener backend en Docker"
        echo "  logs               - Ver logs del backend"
        echo "  install            - Construir imagen backend (Composer)"
        echo "  migrate            - Ejecutar migraciones"
        echo "  seed               - Ejecutar seeders"
        echo "  migrate-fresh      - Resetear BD y migrar"
        echo "  migrate-fresh-seed - Resetear BD, migrar y seed"
        echo "  cache-clear        - Limpiar todas las cachés"
        echo "  swagger            - Generar documentación Swagger"
        echo "  routes             - Listar rutas API"
        echo "  tinker             - Iniciar Tinker REPL"
        echo ""
        echo "Uso: ./scripts/backend.sh <comando>"
        ;;
esac
