#!/bin/bash

# ============================================
# OBSERVATORIO ULEAM - Script de Inicio
# Para Linux/Mac (Bash)
# ============================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Directorio del script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

show_banner() {
    echo ""
    echo -e "${CYAN}  ╔══════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}  ║       OBSERVATORIO ULEAM - DevTools          ║${NC}"
    echo -e "${CYAN}  ║   Sistema de Gestión de Datos Universitarios ║${NC}"
    echo -e "${CYAN}  ╚══════════════════════════════════════════════╝${NC}"
    echo ""
}

show_help() {
    show_banner
    echo -e "  ${YELLOW}USO: ./start.sh <comando>${NC}"
    echo ""
    echo -e "  ${GREEN}COMANDOS DISPONIBLES:${NC}"
    echo ""
    echo -e "    ${WHITE}all${NC}       ${GRAY}- Inicia Docker, Backend y Frontend${NC}"
    echo -e "    ${WHITE}docker${NC}    ${GRAY}- Solo inicia PostgreSQL en Docker${NC}"
    echo -e "    ${WHITE}backend${NC}   ${GRAY}- Solo inicia el servidor Laravel${NC}"
    echo -e "    ${WHITE}frontend${NC}  ${GRAY}- Solo inicia el servidor Angular${NC}"
    echo -e "    ${WHITE}setup${NC}     ${GRAY}- Instalación inicial (deps + migraciones)${NC}"
    echo -e "    ${WHITE}stop${NC}      ${GRAY}- Detiene todos los servicios${NC}"
    echo -e "    ${WHITE}restart${NC}   ${GRAY}- Reinicia todos los servicios${NC}"
    echo -e "    ${WHITE}migrate${NC}   ${GRAY}- Ejecuta las migraciones de BD${NC}"
    echo -e "    ${WHITE}clean${NC}     ${GRAY}- Limpia caché del backend${NC}"
    echo -e "    ${WHITE}help${NC}      ${GRAY}- Muestra esta ayuda${NC}"
    echo ""
    echo -e "  ${GREEN}EJEMPLOS:${NC}"
    echo -e "    ${GRAY}./start.sh all      # Inicia todo el proyecto${NC}"
    echo -e "    ${GRAY}./start.sh setup    # Primera vez (instala dependencias)${NC}"
    echo -e "    ${GRAY}./start.sh backend  # Solo backend para desarrollo${NC}"
    echo ""
    echo -e "  ${GREEN}URLs:${NC}"
    echo -e "    ${GRAY}Frontend:  http://localhost:4200${NC}"
    echo -e "    ${GRAY}Backend:   http://localhost:8000${NC}"
    echo -e "    ${GRAY}Swagger:   http://localhost:8000/api/docs${NC}"
    echo ""
}

start_docker() {
    echo -e "${BLUE}[Docker]${NC} ${WHITE}Iniciando PostgreSQL...${NC}"
    
    cd "$PROJECT_DIR"
    docker-compose up -d
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}[Docker]${NC} ${WHITE}PostgreSQL iniciado correctamente${NC}"
        echo -e "         ${GRAY}Host: localhost:5432${NC}"
    else
        echo -e "${RED}[Docker]${NC} ${WHITE}Error al iniciar PostgreSQL${NC}"
        exit 1
    fi
}

start_backend() {
    echo -e "${MAGENTA}[Backend]${NC} ${WHITE}Iniciando servidor Laravel...${NC}"
    
    cd "$PROJECT_DIR/backend"
    
    # Verificar si .env existe
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}[Backend]${NC} ${WHITE}Copiando .env.example a .env...${NC}"
        cp .env.example .env
    fi
    
    php artisan serve --host=localhost --port=8000 &
    
    echo -e "${GREEN}[Backend]${NC} ${WHITE}Servidor Laravel iniciado${NC}"
    echo -e "          ${GRAY}URL: http://localhost:8000${NC}"
    echo -e "          ${GRAY}API: http://localhost:8000/api${NC}"
}

start_frontend() {
    echo -e "${CYAN}[Frontend]${NC} ${WHITE}Iniciando servidor Angular...${NC}"
    
    cd "$PROJECT_DIR/frontend"
    
    # Usar npm si bun no está disponible
    if command -v bun &> /dev/null; then
        bun run start &
    else
        npm run start &
    fi
    
    echo -e "${GREEN}[Frontend]${NC} ${WHITE}Servidor Angular iniciado${NC}"
    echo -e "           ${GRAY}URL: http://localhost:4200${NC}"
}

stop_all() {
    echo -e "${YELLOW}[Stop]${NC} ${WHITE}Deteniendo servicios...${NC}"
    
    # Detener Docker
    cd "$PROJECT_DIR"
    docker-compose down
    
    # Matar procesos
    pkill -f "php artisan serve" 2>/dev/null
    pkill -f "ng serve" 2>/dev/null
    pkill -f "node.*angular" 2>/dev/null
    
    echo -e "${GREEN}[Stop]${NC} ${WHITE}Todos los servicios detenidos${NC}"
}

run_setup() {
    show_banner
    echo -e "${YELLOW}[Setup] Iniciando configuración inicial...${NC}"
    echo ""
    
    # 1. Docker
    start_docker
    echo ""
    
    # Esperar a que PostgreSQL esté listo
    echo -e "${YELLOW}[Setup] Esperando a que PostgreSQL esté listo...${NC}"
    sleep 5
    
    # 2. Backend dependencies
    echo -e "${MAGENTA}[Backend]${NC} ${WHITE}Instalando dependencias de Composer...${NC}"
    cd "$PROJECT_DIR/backend"
    
    if [ ! -f ".env" ]; then
        cp .env.example .env
    fi
    
    composer install
    php artisan key:generate
    
    echo ""
    
    # 3. Migraciones
    echo -e "${MAGENTA}[Backend]${NC} ${WHITE}Ejecutando migraciones...${NC}"
    php artisan migrate
    
    echo ""
    
    # 4. Frontend dependencies
    echo -e "${CYAN}[Frontend]${NC} ${WHITE}Instalando dependencias de Node...${NC}"
    cd "$PROJECT_DIR/frontend"
    
    if command -v bun &> /dev/null; then
        bun install
    else
        npm install
    fi
    
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo -e "${GREEN} ✓ Setup completado exitosamente!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo ""
    echo -e " ${YELLOW}Para iniciar el proyecto ejecuta:${NC}"
    echo -e "   ${WHITE}./start.sh all${NC}"
    echo ""
}

run_migrations() {
    echo -e "${MAGENTA}[Migrate]${NC} ${WHITE}Ejecutando migraciones...${NC}"
    
    cd "$PROJECT_DIR/backend"
    php artisan migrate
    
    echo -e "${GREEN}[Migrate]${NC} ${WHITE}Migraciones ejecutadas${NC}"
}

clear_cache() {
    echo -e "${YELLOW}[Clean]${NC} ${WHITE}Limpiando caché del backend...${NC}"
    
    cd "$PROJECT_DIR/backend"
    php artisan config:clear
    php artisan cache:clear
    php artisan route:clear
    php artisan view:clear
    
    echo -e "${GREEN}[Clean]${NC} ${WHITE}Caché limpiado${NC}"
}

# Main
case "${1:-help}" in
    all)
        show_banner
        start_docker
        echo ""
        sleep 3
        start_backend
        echo ""
        start_frontend
        echo ""
        echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
        echo -e "${GREEN} ✓ Todos los servicios iniciados!${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
        echo ""
        echo -e " ${CYAN}Frontend:${NC}  http://localhost:4200"
        echo -e " ${MAGENTA}Backend:${NC}   http://localhost:8000"
        echo -e " ${YELLOW}Swagger:${NC}   http://localhost:8000/api/docs"
        echo ""
        ;;
    docker)
        show_banner
        start_docker
        ;;
    backend)
        show_banner
        start_backend
        ;;
    frontend)
        show_banner
        start_frontend
        ;;
    setup)
        run_setup
        ;;
    stop)
        show_banner
        stop_all
        ;;
    restart)
        show_banner
        stop_all
        echo ""
        sleep 2
        start_docker
        echo ""
        sleep 3
        start_backend
        echo ""
        start_frontend
        echo ""
        echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
        echo -e "${GREEN} ✓ Servicios reiniciados!${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
        ;;
    migrate)
        show_banner
        run_migrations
        ;;
    clean)
        show_banner
        clear_cache
        ;;
    help|*)
        show_help
        ;;
esac
