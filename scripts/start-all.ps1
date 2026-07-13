# ============================================
# Inicia Docker, backend y frontend sin duplicar servicios
# ============================================

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$backendScript = Join-Path $root 'scripts/backend.ps1'
$frontendScript = Join-Path $root 'scripts/frontend.ps1'

function Test-PortInUse {
    param([Parameter(Mandatory = $true)][int]$Port)

    return [bool](Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
}

Write-Host 'Verificando servicios del Observatorio...' -ForegroundColor Green

Write-Host 'Asegurando PostgreSQL y MongoDB con Docker Compose...' -ForegroundColor Green
Push-Location $root
try {
    docker compose up -d
} finally {
    Pop-Location
}

if (Test-PortInUse 8000) {
    Write-Host 'Backend ya esta corriendo en http://127.0.0.1:8000; no se inicia otra instancia.' -ForegroundColor Yellow
} else {
    Write-Host 'Iniciando backend...' -ForegroundColor Green
    Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File', $backendScript, 'start' | Out-Null
}

if (Test-PortInUse 4200) {
    Write-Host 'Frontend ya esta corriendo en http://localhost:4200; no se inicia otra instancia.' -ForegroundColor Yellow
} else {
    Write-Host 'Iniciando frontend...' -ForegroundColor Green
    Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File', $frontendScript, 'start' | Out-Null
}

Write-Host 'Backend:  http://127.0.0.1:8000/api' -ForegroundColor Cyan
Write-Host 'Frontend: http://localhost:4200' -ForegroundColor Cyan
