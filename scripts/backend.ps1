# ============================================
# Backend Scripts (Laravel/PHP)
# Uso: .\scripts\backend.ps1 [comando]
# ============================================

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "install", "migrate", "migrate-fresh", "cache-clear", "swagger", "routes", "tinker", "help")]
    [string]$Command = "help"
)

$BackendPath = Join-Path $PSScriptRoot "..\backend"

Push-Location $BackendPath

try {
    switch ($Command) {
        "start" {
            Write-Host "Iniciando servidor PHP en http://127.0.0.1:8000..." -ForegroundColor Green
            php -S 127.0.0.1:8000 -t public
        }
        "install" {
            Write-Host "Instalando dependencias con Composer..." -ForegroundColor Green
            composer install
        }
        "migrate" {
            Write-Host "Ejecutando migraciones..." -ForegroundColor Green
            php artisan migrate
        }
        "migrate-fresh" {
            Write-Host "Reseteando base de datos y ejecutando migraciones..." -ForegroundColor Yellow
            php artisan migrate:fresh
        }
        "cache-clear" {
            Write-Host "Limpiando caches..." -ForegroundColor Green
            php artisan config:clear
            php artisan cache:clear
            php artisan route:clear
            php artisan view:clear
            Write-Host "Cache limpiado" -ForegroundColor Green
        }
        "swagger" {
            Write-Host "Generando documentacion Swagger..." -ForegroundColor Green
            php artisan l5-swagger:generate
        }
        "routes" {
            Write-Host "Listando rutas API..." -ForegroundColor Green
            php artisan route:list --path=api
        }
        "tinker" {
            Write-Host "Iniciando Tinker (REPL)..." -ForegroundColor Green
            php artisan tinker
        }
        "help" {
            Write-Host "Backend Scripts - Comandos disponibles:" -ForegroundColor Yellow
            Write-Host "  start         - Iniciar servidor PHP (puerto 8000)"
            Write-Host "  install       - Instalar dependencias (composer)"
            Write-Host "  migrate       - Ejecutar migraciones"
            Write-Host "  migrate-fresh - Resetear BD y migrar"
            Write-Host "  cache-clear   - Limpiar todas las caches"
            Write-Host "  swagger       - Generar documentacion Swagger"
            Write-Host "  routes        - Listar rutas API"
            Write-Host "  tinker        - Iniciar Tinker REPL"
            Write-Host ""
            Write-Host "Uso: .\scripts\backend.ps1 [comando]" -ForegroundColor Cyan
        }
    }
} finally {
    Pop-Location
}
