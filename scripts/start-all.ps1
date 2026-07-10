# ============================================
# Inicia backend y frontend en ventanas separadas
# ============================================

$root = Split-Path -Parent $PSScriptRoot
$backendScript = Join-Path $root 'scripts/backend.ps1'
$frontendDir = Join-Path $root 'frontend'

Write-Host 'Iniciando backend y frontend...' -ForegroundColor Green

Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File', $backendScript, 'start' | Out-Null
Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-Command', "Set-Location '$frontendDir'; npx ng serve --host 0.0.0.0 --project frontend" | Out-Null

Write-Host 'Backend: http://127.0.0.1:8000/api' -ForegroundColor Cyan
Write-Host 'Frontend: http://localhost:4200' -ForegroundColor Cyan
