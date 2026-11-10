# ============================================
# Frontend Scripts (Angular)
# Uso: .\scripts\frontend.ps1 [comando]
# Usa npm y el lockfile del proyecto.
# ============================================

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "install", "build", "test", "lint", "help")]
    [string]$Command = "help"
)

$FrontendPath = Join-Path $PSScriptRoot "..\frontend"

Write-Host "Usando: npm" -ForegroundColor Cyan

Push-Location $FrontendPath

try {
    switch ($Command) {
        "start" {
            Write-Host "Iniciando servidor de desarrollo..." -ForegroundColor Green
            npm run start
        }
        "install" {
            Write-Host "Instalando dependencias..." -ForegroundColor Green
            npm ci
        }
        "build" {
            Write-Host "Construyendo para produccion..." -ForegroundColor Green
            npm run build
        }
        "test" {
            Write-Host "Ejecutando tests..." -ForegroundColor Green
            npm run test
        }
        "lint" {
            Write-Host "Ejecutando linter..." -ForegroundColor Green
            npm run lint
        }
        "help" {
            Write-Host "Frontend Scripts - Comandos disponibles:" -ForegroundColor Yellow
            Write-Host "  start   - Iniciar servidor de desarrollo"
            Write-Host "  install - Instalar dependencias"
            Write-Host "  build   - Build de produccion"
            Write-Host "  test    - Ejecutar tests"
            Write-Host "  lint    - Ejecutar linter"
            Write-Host ""
            Write-Host "Uso: .\scripts\frontend.ps1 [comando]" -ForegroundColor Cyan
        }
    }
} finally {
    Pop-Location
}

