# ============================================
# OBSERVATORIO ULEAM - Script de Inicio
# Para Windows PowerShell
# ============================================

param(
    [Parameter(Position=0)]
    [ValidateSet('all', 'docker', 'backend', 'frontend', 'setup', 'stop', 'restart', 'migrate', 'clean', 'help')]
    [string]$Command = 'help'
)

# Colores para la consola
$Host.UI.RawUI.WindowTitle = "Observatorio ULEAM"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Show-Banner {
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║       OBSERVATORIO ULEAM - DevTools          ║" -ForegroundColor Cyan
    Write-Host "  ║   Sistema de Gestión de Datos Universitarios ║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Show-Help {
    Show-Banner
    Write-Host "  USO: .\start.ps1 <comando>" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  COMANDOS DISPONIBLES:" -ForegroundColor Green
    Write-Host ""
    Write-Host "    all       " -NoNewline -ForegroundColor White
    Write-Host "- Inicia Docker, Backend y Frontend" -ForegroundColor Gray
    Write-Host "    docker    " -NoNewline -ForegroundColor White
    Write-Host "- Solo inicia PostgreSQL en Docker" -ForegroundColor Gray
    Write-Host "    backend   " -NoNewline -ForegroundColor White
    Write-Host "- Solo inicia el servidor Laravel" -ForegroundColor Gray
    Write-Host "    frontend  " -NoNewline -ForegroundColor White
    Write-Host "- Solo inicia el servidor Angular" -ForegroundColor Gray
    Write-Host "    setup     " -NoNewline -ForegroundColor White
    Write-Host "- Instalación inicial (deps + migraciones)" -ForegroundColor Gray
    Write-Host "    stop      " -NoNewline -ForegroundColor White
    Write-Host "- Detiene todos los servicios" -ForegroundColor Gray
    Write-Host "    restart   " -NoNewline -ForegroundColor White
    Write-Host "- Reinicia todos los servicios" -ForegroundColor Gray
    Write-Host "    migrate   " -NoNewline -ForegroundColor White
    Write-Host "- Ejecuta las migraciones de BD" -ForegroundColor Gray
    Write-Host "    clean     " -NoNewline -ForegroundColor White
    Write-Host "- Limpia caché del backend" -ForegroundColor Gray
    Write-Host "    help      " -NoNewline -ForegroundColor White
    Write-Host "- Muestra esta ayuda" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  EJEMPLOS:" -ForegroundColor Green
    Write-Host "    .\start.ps1 all      # Inicia todo el proyecto" -ForegroundColor DarkGray
    Write-Host "    .\start.ps1 setup    # Primera vez (instala dependencias)" -ForegroundColor DarkGray
    Write-Host "    .\start.ps1 backend  # Solo backend para desarrollo" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  URLs:" -ForegroundColor Green
    Write-Host "    Frontend:  http://localhost:4200" -ForegroundColor DarkGray
    Write-Host "    Backend:   http://localhost:8000" -ForegroundColor DarkGray
    Write-Host "    Swagger:   http://localhost:8000/api/docs" -ForegroundColor DarkGray
    Write-Host ""
}

function Start-Docker {
    Write-Host "[Docker] " -NoNewline -ForegroundColor Blue
    Write-Host "Iniciando PostgreSQL..." -ForegroundColor White
    
    Set-Location $PSScriptRoot\..
    docker-compose up -d
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[Docker] " -NoNewline -ForegroundColor Green
        Write-Host "PostgreSQL iniciado correctamente" -ForegroundColor White
        Write-Host "         Host: localhost:5432" -ForegroundColor DarkGray
    } else {
        Write-Host "[Docker] " -NoNewline -ForegroundColor Red
        Write-Host "Error al iniciar PostgreSQL" -ForegroundColor White
        exit 1
    }
}

function Start-Backend {
    Write-Host "[Backend] " -NoNewline -ForegroundColor Magenta
    Write-Host "Iniciando servidor Laravel..." -ForegroundColor White
    
    Set-Location $PSScriptRoot\..\backend
    
    # Verificar si .env existe
    if (-not (Test-Path ".env")) {
        Write-Host "[Backend] " -NoNewline -ForegroundColor Yellow
        Write-Host "Copiando .env.example a .env..." -ForegroundColor White
        Copy-Item ".env.example" ".env"
    }
    
    Start-Process -NoNewWindow powershell -ArgumentList "-Command", "cd '$PSScriptRoot\..\backend'; php -S 127.0.0.1:8000 -t public"
    
    Write-Host "[Backend] " -NoNewline -ForegroundColor Green
    Write-Host "Servidor Laravel iniciado" -ForegroundColor White
    Write-Host "          URL: http://localhost:8000" -ForegroundColor DarkGray
    Write-Host "          API: http://localhost:8000/api" -ForegroundColor DarkGray
}

function Start-Frontend {
    Write-Host "[Frontend] " -NoNewline -ForegroundColor Cyan
    Write-Host "Iniciando servidor Angular..." -ForegroundColor White
    
    Set-Location $PSScriptRoot\..\frontend
    
    Start-Process -NoNewWindow powershell -ArgumentList "-Command", "cd '$PSScriptRoot\..\frontend'; bun run start"
    
    Write-Host "[Frontend] " -NoNewline -ForegroundColor Green
    Write-Host "Servidor Angular iniciado" -ForegroundColor White
    Write-Host "           URL: http://localhost:4200" -ForegroundColor DarkGray
}

function Stop-All {
    Write-Host "[Stop] " -NoNewline -ForegroundColor Yellow
    Write-Host "Deteniendo servicios..." -ForegroundColor White
    
    # Detener Docker
    Set-Location $PSScriptRoot\..
    docker-compose down
    
    # Matar procesos de PHP y Node
    Get-Process -Name "php" -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Name "bun" -ErrorAction SilentlyContinue | Stop-Process -Force
    
    Write-Host "[Stop] " -NoNewline -ForegroundColor Green
    Write-Host "Todos los servicios detenidos" -ForegroundColor White
}

function Start-Setup {
    Show-Banner
    Write-Host "[Setup] Iniciando configuración inicial..." -ForegroundColor Yellow
    Write-Host ""
    
    # 1. Docker
    Start-Docker
    Write-Host ""
    
    # Esperar a que PostgreSQL esté listo
    Write-Host "[Setup] Esperando a que PostgreSQL esté listo..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # 2. Backend dependencies
    Write-Host "[Backend] " -NoNewline -ForegroundColor Magenta
    Write-Host "Instalando dependencias de Composer..." -ForegroundColor White
    Set-Location $PSScriptRoot\..\backend
    
    if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
    }
    
    composer install
    php artisan key:generate
    
    Write-Host ""
    
    # 3. Migraciones
    Write-Host "[Backend] " -NoNewline -ForegroundColor Magenta
    Write-Host "Ejecutando migraciones..." -ForegroundColor White
    php artisan migrate
    
    Write-Host ""
    
    # 4. Frontend dependencies
    Write-Host "[Frontend] " -NoNewline -ForegroundColor Cyan
    Write-Host "Instalando dependencias de Node..." -ForegroundColor White
    Set-Location $PSScriptRoot\..\frontend
    bun install
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════" -ForegroundColor Green
    Write-Host " ✓ Setup completado exitosamente!" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host " Para iniciar el proyecto ejecuta:" -ForegroundColor Yellow
    Write-Host "   .\start.ps1 all" -ForegroundColor White
    Write-Host ""
}

function Run-Migrations {
    Write-Host "[Migrate] " -NoNewline -ForegroundColor Magenta
    Write-Host "Ejecutando migraciones..." -ForegroundColor White
    
    Set-Location $PSScriptRoot\..\backend
    php artisan migrate
    
    Write-Host "[Migrate] " -NoNewline -ForegroundColor Green
    Write-Host "Migraciones ejecutadas" -ForegroundColor White
}

function Clear-Cache {
    Write-Host "[Clean] " -NoNewline -ForegroundColor Yellow
    Write-Host "Limpiando caché del backend..." -ForegroundColor White
    
    Set-Location $PSScriptRoot\..\backend
    php artisan config:clear
    php artisan cache:clear
    php artisan route:clear
    php artisan view:clear
    
    Write-Host "[Clean] " -NoNewline -ForegroundColor Green
    Write-Host "Caché limpiado" -ForegroundColor White
}

# Main switch
switch ($Command) {
    'all' {
        Show-Banner
        Start-Docker
        Write-Host ""
        Start-Sleep -Seconds 3
        Start-Backend
        Write-Host ""
        Start-Frontend
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════" -ForegroundColor Green
        Write-Host " ✓ Todos los servicios iniciados!" -ForegroundColor Green
        Write-Host "═══════════════════════════════════════════════" -ForegroundColor Green
        Write-Host ""
        Write-Host " Frontend:  http://localhost:4200" -ForegroundColor Cyan
        Write-Host " Backend:   http://localhost:8000" -ForegroundColor Magenta
        Write-Host " Swagger:   http://localhost:8000/api/docs" -ForegroundColor Yellow
        Write-Host ""
    }
    'docker' {
        Show-Banner
        Start-Docker
    }
    'backend' {
        Show-Banner
        Start-Backend
    }
    'frontend' {
        Show-Banner
        Start-Frontend
    }
    'setup' {
        Start-Setup
    }
    'stop' {
        Show-Banner
        Stop-All
    }
    'restart' {
        Show-Banner
        Stop-All
        Write-Host ""
        Start-Sleep -Seconds 2
        Start-Docker
        Write-Host ""
        Start-Sleep -Seconds 3
        Start-Backend
        Write-Host ""
        Start-Frontend
        Write-Host ""
        Write-Host "═══════════════════════════════════════════════" -ForegroundColor Green
        Write-Host " ✓ Servicios reiniciados!" -ForegroundColor Green
        Write-Host "═══════════════════════════════════════════════" -ForegroundColor Green
    }
    'migrate' {
        Show-Banner
        Run-Migrations
    }
    'clean' {
        Show-Banner
        Clear-Cache
    }
    'help' {
        Show-Help
    }
    default {
        Show-Help
    }
}

