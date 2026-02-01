#!/bin/bash
# ============================================
# Frontend Scripts (Angular)
# Uso: ./scripts/frontend.sh <comando>
# Detecta automáticamente bun o npm
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_PATH="$SCRIPT_DIR/../frontend"

# Detectar package manager
get_package_manager() {
    if command -v bun &> /dev/null; then
        echo "bun"
    else
        echo "npm"
    fi
}

PM=$(get_package_manager)
echo "📦 Usando: $PM"

cd "$FRONTEND_PATH" || exit 1

case "$1" in
    start)
        echo "🚀 Iniciando servidor de desarrollo..."
        $PM run start
        ;;
    install)
        echo "📥 Instalando dependencias..."
        $PM install
        ;;
    build)
        echo "🏗️ Construyendo para producción..."
        $PM run build
        ;;
    test)
        echo "🧪 Ejecutando tests..."
        $PM run test
        ;;
    lint)
        echo "🔍 Ejecutando linter..."
        $PM run lint
        ;;
    help|*)
        echo "Frontend Scripts - Comandos disponibles:"
        echo "  start   - Iniciar servidor de desarrollo"
        echo "  install - Instalar dependencias"
        echo "  build   - Build de producción"
        echo "  test    - Ejecutar tests"
        echo "  lint    - Ejecutar linter"
        echo ""
        echo "Uso: ./scripts/frontend.sh <comando>"
        ;;
esac
