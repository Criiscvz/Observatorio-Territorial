#!/bin/bash
# ============================================
# Docker Scripts
# Uso: ./scripts/docker.sh <comando>
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_PATH="$SCRIPT_DIR/.."

cd "$ROOT_PATH" || exit 1

case "$1" in
    up)
        echo "🐳 Iniciando contenedores Docker..."
        docker-compose up -d
        echo "✅ Contenedores iniciados"
        ;;
    down)
        echo "🛑 Deteniendo contenedores Docker..."
        docker-compose down
        echo "✅ Contenedores detenidos"
        ;;
    restart)
        echo "🔄 Reiniciando contenedores Docker..."
        docker-compose restart
        echo "✅ Contenedores reiniciados"
        ;;
    logs)
        echo "📋 Mostrando logs de PostgreSQL..."
        docker-compose logs -f postgres
        ;;
    status)
        echo "📊 Estado de contenedores:"
        docker-compose ps
        ;;
    help|*)
        echo "Docker Scripts - Comandos disponibles:"
        echo "  up      - Iniciar contenedores (detached)"
        echo "  down    - Detener contenedores"
        echo "  restart - Reiniciar contenedores"
        echo "  logs    - Ver logs de PostgreSQL (follow)"
        echo "  status  - Ver estado de contenedores"
        echo ""
        echo "Uso: ./scripts/docker.sh <comando>"
        ;;
esac
