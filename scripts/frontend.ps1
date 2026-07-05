# ============================================
# Frontend Scripts (Angular)
# Uso: .\scripts\frontend.ps1 [comando]
# Detecta automaticamente bun o npm
# ============================================

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "install", "build", "test", "lint", "help")]
    [string]$Command = "help"
)

$FrontendPath = Join-Path $PSScriptRoot "..\frontend"

# Detectar package manager
function Get-PackageManager {
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        return "bun"
    } else {
        return "npm"
    }
}

$PM = Get-PackageManager
Write-Host "Usando: $PM" -ForegroundColor Cyan

Push-Location $FrontendPath

try {
    switch ($Command) {
        "start" {
            Write-Host "Iniciando servidor de desarrollo..." -ForegroundColor Green
            if ($PM -eq "bun") { bun run start } else { npm run start }
        }
        "install" {
            Write-Host "Instalando dependencias..." -ForegroundColor Green
            if ($PM -eq "bun") { bun install } else { npm install }
        }
        "build" {
            Write-Host "Construyendo para produccion..." -ForegroundColor Green
            if ($PM -eq "bun") { bun run build } else { npm run build }
        }
        "test" {
            Write-Host "Ejecutando tests..." -ForegroundColor Green
            if ($PM -eq "bun") { bun run test } else { npm run test }
        }
        "lint" {
            Write-Host "Ejecutando linter..." -ForegroundColor Green
            if ($PM -eq "bun") { bun run lint } else { npm run lint }
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

