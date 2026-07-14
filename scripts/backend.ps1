# ============================================
# Backend Scripts (Laravel/PHP local)
# Uso: .\scripts\backend.ps1 [comando]
# ============================================

param(
    [Parameter(Position=0)]
    [ValidateSet("start", "stop", "logs", "install", "migrate", "seed", "migrate-fresh", "migrate-fresh-seed", "cache-clear", "swagger", "routes", "tinker", "help")]
    [string]$Command = "help"
)

$BackendPath = Join-Path $PSScriptRoot "..\backend"
$ImageName = "backend-backend"
$DevImageName = "backend-backend-dev"
$ContainerName = "observatorio-backend-dev"
$EnvFile = Join-Path $BackendPath ".env"
$DockerNetwork = "observatirio_default"

# El backend corre DENTRO de un contenedor: 127.0.0.1/localhost apuntan al propio
# contenedor, no al host. Igual que hacemos con DB_HOST, reescribimos el host de la
# MONGODB_URI a host.docker.internal para alcanzar el contenedor de Mongo (publicado
# en el puerto 27017 del host). Las credenciales se leen del .env, no se hardcodean.
function Get-DockerMongoUri {
    $line = Select-String -Path $EnvFile -Pattern '^\s*MONGODB_URI\s*=\s*(.+)$' | Select-Object -First 1
    if (-not $line) {
        return "mongodb://root:secret123@observatorio_mongo:27017/?authSource=admin"
    }
    $uri = $line.Matches[0].Groups[1].Value.Trim().Trim('"')
    return ($uri -replace '@(127\.0\.0\.1|localhost):', '@observatorio_mongo:')
}

function Ensure-BackendStorage {
    $storagePaths = @(
        (Join-Path $BackendPath "storage"),
        (Join-Path $BackendPath "storage\app"),
        (Join-Path $BackendPath "storage\app\private"),
        (Join-Path $BackendPath "storage\app\private\publicaciones"),
        (Join-Path $BackendPath "storage\app\public"),
        (Join-Path $BackendPath "storage\framework"),
        (Join-Path $BackendPath "storage\logs")
    )

    foreach ($path in $storagePaths) {
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
        }
    }
}

function Ensure-BackendImage {
    $exists = docker image inspect $DevImageName 2>$null
    if (-not $?) {
        $exists = docker image inspect $ImageName 2>$null
    }
    if (-not $?) {
        Write-Host "Imagen $ImageName no encontrada. Construyendo..." -ForegroundColor Yellow
        docker build -t $ImageName -f Dockerfile .
    }
}

function Get-BackendImage {
    docker image inspect $DevImageName 2>$null | Out-Null
    if ($?) {
        return $DevImageName
    }

    return $ImageName
}

function Run-Artisan {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )

    Ensure-BackendImage
    Ensure-BackendStorage
    $RunImageName = Get-BackendImage
    $MongoUri = Get-DockerMongoUri
    docker run --rm `
      --network $DockerNetwork `
      --add-host=host.docker.internal:host-gateway `
      --env-file "$EnvFile" `
      -v "${BackendPath}\storage:/var/www/html/storage" `
      -e DB_HOST=observatorio_db `
      -e DB_PORT=5432 `
      -e "MONGODB_URI=$MongoUri" `
      --entrypoint php `
      $RunImageName artisan @Args
}

Push-Location $BackendPath

try {
    switch ($Command) {
        "start" {
            if (Test-Path (Join-Path $BackendPath "vendor/autoload.php")) {
                Write-Host "Iniciando backend en http://127.0.0.1:8000 con PHP local..." -ForegroundColor Green
                php artisan serve --host=127.0.0.1 --port=8000
            } else {
                Write-Host "vendor no existe localmente. Iniciando backend con Docker en http://127.0.0.1:8000..." -ForegroundColor Yellow
                Ensure-BackendImage
                Ensure-BackendStorage
                $RunImageName = Get-BackendImage
                $MongoUri = Get-DockerMongoUri
                docker rm -f $ContainerName 2>$null | Out-Null
                docker run -d `
                  --name $ContainerName `
                  --network $DockerNetwork `
                  --add-host=host.docker.internal:host-gateway `
                  --env-file "$EnvFile" `
                  -v "${BackendPath}\storage:/var/www/html/storage" `
                  -e DB_HOST=observatorio_db `
                  -e DB_PORT=5432 `
                  -e "MONGODB_URI=$MongoUri" `
                  -p 127.0.0.1:8000:8000 `
                  --entrypoint php `
                  $RunImageName artisan serve --host=0.0.0.0 --port=8000 | Out-Null
                Write-Host "Backend iniciado con Docker en http://127.0.0.1:8000" -ForegroundColor Green
            }
        }
        "stop" {
            Write-Host "Deteniendo backend..." -ForegroundColor Yellow
            $listenPids = netstat -ano -p tcp |
                Select-String '127\.0\.0\.1:8000\s+0\.0\.0\.0:0\s+LISTENING' |
                ForEach-Object { ($_ -split '\s+')[-1] } |
                Sort-Object -Unique

            foreach ($processId in $listenPids) {
                Stop-Process -Id ([int] $processId) -Force -ErrorAction SilentlyContinue
            }

            if (Get-Command docker -ErrorAction SilentlyContinue) {
                docker rm -f $ContainerName 2>$null | Out-Null
            }

            Write-Host "Backend detenido" -ForegroundColor Green
        }
        "logs" {
            Write-Host "El backend local escribe logs en backend/storage/logs/laravel.log" -ForegroundColor Green
            Get-Content -LiteralPath (Join-Path $BackendPath 'storage/logs/laravel.log') -Tail 80 -Wait
        }
        "install" {
            Write-Host "Construyendo imagen backend de desarrollo con codigo local..." -ForegroundColor Green
            docker build -t $DevImageName -f Dockerfile.devpatch .
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
            Write-Host "  start              - Iniciar backend local en http://127.0.0.1:8000"
            Write-Host "  stop               - Detener backend local en el puerto 8000"
            Write-Host "  logs               - Ver logs del backend"
            Write-Host "  install            - Construir imagen backend de desarrollo con codigo local"
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
