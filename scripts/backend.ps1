# ============================================
# Backend Scripts (Laravel/PHP 8.4 via Docker)
# Uso: .\scripts\backend.ps1 [comando]
# ============================================

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "logs", "install", "migrate", "seed", "migrate-fresh", "migrate-fresh-seed", "cache-clear", "swagger", "routes", "tinker", "help")]
    [string]$Command = "help"
)

$BackendPath = Join-Path $PSScriptRoot "..\backend"
$ImageName = "backend-backend"
$ContainerName = "observatorio-backend-dev"
$EnvFile = Join-Path $BackendPath ".env"

# El backend corre DENTRO de un contenedor: 127.0.0.1/localhost apuntan al propio
# contenedor, no al host. Igual que hacemos con DB_HOST, reescribimos el host de la
# MONGODB_URI a host.docker.internal para alcanzar el contenedor de Mongo (publicado
# en el puerto 27017 del host). Las credenciales se leen del .env, no se hardcodean.
function Get-DockerMongoUri {
    $line = Select-String -Path $EnvFile -Pattern '^\s*MONGODB_URI\s*=\s*(.+)$' | Select-Object -First 1
    if (-not $line) {
        return "mongodb://root:secret123@host.docker.internal:27017/?authSource=admin"
    }
    $uri = $line.Matches[0].Groups[1].Value.Trim().Trim('"')
    return ($uri -replace '@(127\.0\.0\.1|localhost):', '@host.docker.internal:')
}

function Ensure-BackendImage {
    $exists = docker image inspect $ImageName 2>$null
    if (-not $?) {
        Write-Host "Imagen $ImageName no encontrada. Construyendo..." -ForegroundColor Yellow
        docker build -t $ImageName -f Dockerfile .
    }
}

function Run-Artisan {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )

    Ensure-BackendImage
    $MongoUri = Get-DockerMongoUri
    docker run --rm `
      --add-host=host.docker.internal:host-gateway `
      --env-file "$EnvFile" `
      -e DB_HOST=host.docker.internal `
      -e "MONGODB_URI=$MongoUri" `
      --entrypoint php `
      $ImageName artisan @Args
}

Push-Location $BackendPath

try {
    switch ($Command) {
        "start" {
            Ensure-BackendImage
            $MongoUri = Get-DockerMongoUri
            Write-Host "Iniciando backend en http://127.0.0.1:8000 con PHP 8.4 (Docker)..." -ForegroundColor Green
            docker rm -f $ContainerName 2>$null | Out-Null
            docker run -d `
              --name $ContainerName `
              --rm `
              -p 8000:8000 `
              --add-host=host.docker.internal:host-gateway `
              --env-file "$EnvFile" `
              -e DB_HOST=host.docker.internal `
              -e "MONGODB_URI=$MongoUri" `
              --entrypoint php `
              $ImageName artisan serve --host=0.0.0.0 --port=8000 | Out-Null
            Write-Host "Backend iniciado. Usa '.\scripts\backend.ps1 logs' para ver salida." -ForegroundColor Green
        }
        "stop" {
            Write-Host "Deteniendo backend..." -ForegroundColor Yellow
            docker rm -f $ContainerName 2>$null | Out-Null
            Write-Host "Backend detenido" -ForegroundColor Green
        }
        "logs" {
            Write-Host "Mostrando logs del backend..." -ForegroundColor Green
            docker logs -f $ContainerName
        }
        "install" {
            Write-Host "Construyendo imagen backend (incluye Composer install en Dockerfile)..." -ForegroundColor Green
            docker build -t $ImageName -f Dockerfile .
        }
        "migrate" {
            Write-Host "Ejecutando migraciones..." -ForegroundColor Green
            Run-Artisan migrate --force
        }
        "seed" {
            Write-Host "Ejecutando seeders..." -ForegroundColor Green
            Run-Artisan db:seed --force
        }
        "migrate-fresh" {
            Write-Host "Reseteando base de datos y ejecutando migraciones..." -ForegroundColor Yellow
            Run-Artisan migrate:fresh --force
        }
        "migrate-fresh-seed" {
            Write-Host "Reseteando base de datos + seeders..." -ForegroundColor Yellow
            Run-Artisan migrate:fresh --seed --force
        }
        "cache-clear" {
            Write-Host "Limpiando caches..." -ForegroundColor Green
            Run-Artisan config:clear
            Run-Artisan cache:clear
            Run-Artisan route:clear
            Run-Artisan view:clear
            Write-Host "Cache limpiado" -ForegroundColor Green
        }
        "swagger" {
            Write-Host "Generando documentacion Swagger..." -ForegroundColor Green
            Run-Artisan l5-swagger:generate
        }
        "routes" {
            Write-Host "Listando rutas API..." -ForegroundColor Green
            Run-Artisan route:list --path=api
        }
        "tinker" {
            Write-Host "Iniciando Tinker (REPL)..." -ForegroundColor Green
            Run-Artisan tinker
        }
        "help" {
            Write-Host "Backend Scripts - Comandos disponibles:" -ForegroundColor Yellow
            Write-Host "  start              - Iniciar backend en Docker (PHP 8.4)"
            Write-Host "  stop               - Detener backend en Docker"
            Write-Host "  logs               - Ver logs del backend"
            Write-Host "  install            - Construir imagen backend (Composer)"
            Write-Host "  migrate            - Ejecutar migraciones"
            Write-Host "  seed               - Ejecutar seeders"
            Write-Host "  migrate-fresh      - Resetear BD y migrar"
            Write-Host "  migrate-fresh-seed - Resetear BD, migrar y seed"
            Write-Host "  cache-clear        - Limpiar todas las caches"
            Write-Host "  swagger            - Generar documentacion Swagger"
            Write-Host "  routes             - Listar rutas API"
            Write-Host "  tinker             - Iniciar Tinker REPL"
            Write-Host ""
            Write-Host "Uso: .\scripts\backend.ps1 [comando]" -ForegroundColor Cyan
        }
    }
} finally {
    Pop-Location
}
