#!/bin/bash
# ============================================
# Backend Scripts (Laravel/PHP)
# Uso: ./scripts/backend.sh <comando>
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PATH="$SCRIPT_DIR/../backend"

cd "$BACKEND_PATH" || exit 1

case "$1" in
    start)
        echo "🚀 Iniciando servidor PHP en http://127.0.0.1:8000..."
        php -S 127.0.0.1:8000 -t public
        ;;
    install)
        echo "📥 Instalando dependencias con Composer..."
        composer install
        ;;
    migrate)
        echo "🗄️ Ejecutando migraciones..."
        php artisan migrate
        ;;
    migrate-fresh)
        echo "🗄️ Reseteando base de datos y ejecutando migraciones..."
        php artisan migrate:fresh
        ;;
    cache-clear)
        echo "🧹 Limpiando cachés..."
        php artisan config:clear
        php artisan cache:clear
        php artisan route:clear
        php artisan view:clear
        echo "✅ Caché limpiado"
        ;;
    swagger)
        echo "📚 Generando documentación Swagger..."
        php artisan l5-swagger:generate
        ;;
    routes)
        echo "🛤️ Listando rutas API..."
        php artisan route:list --path=api
        ;;
    tinker)
        echo "🔧 Iniciando Tinker (REPL)..."
        php artisan tinker
        ;;
    help|*)
        echo "Backend Scripts - Comandos disponibles:"
        echo "  start         - Iniciar servidor PHP (puerto 8000)"
        echo "  install       - Instalar dependencias (composer)"
        echo "  migrate       - Ejecutar migraciones"
        echo "  migrate-fresh - Resetear BD y migrar"
        echo "  cache-clear   - Limpiar todas las cachés"
        echo "  swagger       - Generar documentación Swagger"
        echo "  routes        - Listar rutas API"
        echo "  tinker        - Iniciar Tinker REPL"
        echo ""
        echo "Uso: ./scripts/backend.sh <comando>"
        ;;
esac
