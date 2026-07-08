# ============================================
# OBSERVATORIO ULEAM - Script de Inicio
# Para Windows PowerShell
# ============================================

param(
    [Parameter(Position = 0)]
    [ValidateSet('all', 'docker', 'backend', 'frontend', 'setup', 'stop', 'restart', 'migrate', 'clean', 'help')]
    [string]$Command = 'help'
)

$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Observatorio ULEAM'
$RootPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$DockerScript = Join-Path $PSScriptRoot 'docker.ps1'
$BackendScript = Join-Path $PSScriptRoot 'backend.ps1'
$FrontendScript = Join-Path $PSScriptRoot 'frontend.ps1'
$BackendPath = Join-Path $RootPath 'backend'

function Show-Banner {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ' OBSERVATORIO ULEAM - DevTools' -ForegroundColor Cyan
    Write-Host ' Sistema de Gestion de Datos Universitarios' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
}

function Show-Help {
    Show-Banner
    Write-Host 'USO: .\scripts\start.ps1 <comando>' -ForegroundColor Yellow
    Write-Host ''
    Write-Host 'COMANDOS DISPONIBLES:' -ForegroundColor Green
    Write-Host '  all       - Inicia Docker, Backend y Frontend'
    Write-Host '  docker    - Solo inicia PostgreSQL en Docker'
    Write-Host '  backend   - Solo inicia el backend Laravel en Docker'
    Write-Host '  frontend  - Solo inicia el servidor Angular'
    Write-Host '  setup     - Instalacion inicial: Docker, backend, migraciones y frontend'
    Write-Host '  stop      - Detiene backend, frontend y PostgreSQL'
    Write-Host '  restart   - Reinicia todos los servicios'
    Write-Host '  migrate   - Ejecuta migraciones de base de datos'
    Write-Host '  clean     - Limpia caches del backend'
    Write-Host '  help      - Muestra esta ayuda'
    Write-Host ''
    Write-Host 'EJEMPLOS:' -ForegroundColor Green
    Write-Host '  .\scripts\start.ps1 all'
    Write-Host '  .\scripts\start.ps1 setup'
    Write-Host '  .\scripts\start.ps1 backend'
    Write-Host ''
    Write-Host 'URLs:' -ForegroundColor Green
    Write-Host '  Frontend: http://localhost:4200'
    Write-Host '  Backend:  http://localhost:8000'
    Write-Host '  API:      http://localhost:8000/api'
    Write-Host '  Swagger:  http://localhost:8000/api/docs'
    Write-Host ''
}

function Invoke-Script {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ScriptPath,
        [Parameter(Mandatory = $true)]
        [string]$ScriptCommand
    )

    & powershell -ExecutionPolicy Bypass -File $ScriptPath $ScriptCommand
}

function Ensure-BackendEnv {
    $envFile = Join-Path $BackendPath '.env'
    $exampleFile = Join-Path $BackendPath '.env.example'

    if ((-not (Test-Path $envFile)) -and (Test-Path $exampleFile)) {
        Copy-Item $exampleFile $envFile
        Write-Host 'Archivo backend\.env creado desde backend\.env.example.' -ForegroundColor Yellow
    }
}

function Start-DockerService {
    Invoke-Script $DockerScript 'up'
}

function Start-BackendService {
    Ensure-BackendEnv
    Invoke-Script $BackendScript 'start'
}

function Start-FrontendService {
    Write-Host 'Iniciando frontend en una nueva ventana...' -ForegroundColor Green
    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-ExecutionPolicy', 'Bypass',
        '-File', "`"$FrontendScript`"",
        'start'
    ) -WorkingDirectory $RootPath
}

function Stop-AllServices {
    Invoke-Script $BackendScript 'stop'
    Invoke-Script $DockerScript 'down'

    Get-Process -Name 'node' -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Name 'bun' -ErrorAction SilentlyContinue | Stop-Process -Force

    Write-Host 'Servicios detenidos.' -ForegroundColor Green
}

function Start-AllServices {
    Show-Banner
    Start-DockerService
    Start-Sleep -Seconds 3
    Start-BackendService
    Start-FrontendService
    Write-Host ''
    Write-Host 'Servicios iniciados.' -ForegroundColor Green
    Write-Host 'Frontend: http://localhost:4200' -ForegroundColor Cyan
    Write-Host 'Backend:  http://localhost:8000' -ForegroundColor Magenta
    Write-Host 'Swagger:  http://localhost:8000/api/docs' -ForegroundColor Yellow
}

function Start-InitialSetup {
    Show-Banner
    Write-Host 'Ejecutando configuracion inicial...' -ForegroundColor Yellow
    Ensure-BackendEnv
    Start-DockerService
    Start-Sleep -Seconds 5
    Invoke-Script $BackendScript 'install'
    Invoke-Script $BackendScript 'migrate'
    Invoke-Script $FrontendScript 'install'
    Write-Host ''
    Write-Host 'Setup completado. Ahora ejecuta: .\scripts\start.ps1 all' -ForegroundColor Green
}

Push-Location $RootPath

try {
    switch ($Command) {
        'all' {
            Start-AllServices
        }
        'docker' {
            Show-Banner
            Start-DockerService
        }
        'backend' {
            Show-Banner
            Start-DockerService
            Start-Sleep -Seconds 3
            Start-BackendService
        }
        'frontend' {
            Show-Banner
            Start-FrontendService
        }
        'setup' {
            Start-InitialSetup
        }
        'stop' {
            Show-Banner
            Stop-AllServices
        }
        'restart' {
            Show-Banner
            Stop-AllServices
            Start-Sleep -Seconds 2
            Start-DockerService
            Start-Sleep -Seconds 3
            Start-BackendService
            Start-FrontendService
        }
        'migrate' {
            Show-Banner
            Ensure-BackendEnv
            Start-DockerService
            Invoke-Script $BackendScript 'migrate'
        }
        'clean' {
            Show-Banner
            Ensure-BackendEnv
            Start-DockerService
            Invoke-Script $BackendScript 'cache-clear'
        }
        'help' {
            Show-Help
        }
        default {
            Show-Help
        }
    }
} finally {
    Pop-Location
}

