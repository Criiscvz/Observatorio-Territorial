@echo off
REM ============================================
REM OBSERVATORIO ULEAM - Script de Inicio
REM Para Windows CMD
REM ============================================

setlocal enabledelayedexpansion
title Observatorio ULEAM - DevTools

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%\.."

if "%1"=="" goto help
if "%1"=="help" goto help
if "%1"=="all" goto all
if "%1"=="docker" goto docker
if "%1"=="backend" goto backend
if "%1"=="frontend" goto frontend
if "%1"=="setup" goto setup
if "%1"=="stop" goto stop
if "%1"=="restart" goto restart
if "%1"=="migrate" goto migrate
if "%1"=="clean" goto clean
goto help

:banner
echo.
echo   ================================================
echo        OBSERVATORIO ULEAM - DevTools
echo    Sistema de Gestion de Datos Universitarios
echo   ================================================
echo.
goto :eof

:help
call :banner
echo   USO: start.bat ^<comando^>
echo.
echo   COMANDOS DISPONIBLES:
echo.
echo     all       - Inicia Docker, Backend y Frontend
echo     docker    - Solo inicia PostgreSQL en Docker
echo     backend   - Solo inicia el servidor Laravel
echo     frontend  - Solo inicia el servidor Angular
echo     setup     - Instalacion inicial (deps + migraciones)
echo     stop      - Detiene todos los servicios
echo     restart   - Reinicia todos los servicios
echo     migrate   - Ejecuta las migraciones de BD
echo     clean     - Limpia cache del backend
echo     help      - Muestra esta ayuda
echo.
echo   URLs:
echo     Frontend:  http://localhost:4200
echo     Backend:   http://localhost:8000
echo     Swagger:   http://localhost:8000/api/docs
echo.
goto :eof

:docker
call :banner
echo [Docker] Iniciando PostgreSQL...
cd /d "%PROJECT_DIR%"
docker-compose up -d
if %errorlevel%==0 (
    echo [Docker] PostgreSQL iniciado correctamente
    echo          Host: localhost:5432
) else (
    echo [Docker] Error al iniciar PostgreSQL
)
goto :eof

:backend
call :banner
echo [Backend] Iniciando servidor Laravel...
cd /d "%PROJECT_DIR%\backend"
if not exist ".env" (
    echo [Backend] Copiando .env.example a .env...
    copy .env.example .env
)
start "Laravel Server" cmd /c "php -S 127.0.0.1:8000 -t public"
echo [Backend] Servidor Laravel iniciado
echo           URL: http://localhost:8000
goto :eof

:frontend
call :banner
echo [Frontend] Iniciando servidor Angular...
cd /d "%PROJECT_DIR%\frontend"
start "Angular Server" cmd /c "bun run start"
echo [Frontend] Servidor Angular iniciado
echo            URL: http://localhost:4200
goto :eof

:all
call :banner
call :docker
echo.
timeout /t 3 /nobreak >nul
call :backend
echo.
call :frontend
echo.
echo   ===============================================
echo    Todos los servicios iniciados!
echo   ===============================================
echo.
echo    Frontend:  http://localhost:4200
echo    Backend:   http://localhost:8000
echo    Swagger:   http://localhost:8000/api/docs
echo.
goto :eof

:stop
call :banner
echo [Stop] Deteniendo servicios...
cd /d "%PROJECT_DIR%"
docker-compose down
taskkill /f /im php.exe 2>nul
taskkill /f /im node.exe 2>nul
taskkill /f /im bun.exe 2>nul
echo [Stop] Todos los servicios detenidos
goto :eof

:setup
call :banner
echo [Setup] Iniciando configuracion inicial...
echo.

call :docker
echo.
echo [Setup] Esperando a que PostgreSQL este listo...
timeout /t 5 /nobreak >nul

echo [Backend] Instalando dependencias de Composer...
cd /d "%PROJECT_DIR%\backend"
if not exist ".env" copy .env.example .env
call composer install
call php artisan key:generate

echo.
echo [Backend] Ejecutando migraciones...
call php artisan migrate

echo.
echo [Frontend] Instalando dependencias de Node...
cd /d "%PROJECT_DIR%\frontend"
call bun install

echo.
echo   ===============================================
echo    Setup completado exitosamente!
echo   ===============================================
echo.
echo    Para iniciar el proyecto ejecuta:
echo      start.bat all
echo.
goto :eof

:restart
call :banner
call :stop
echo.
timeout /t 2 /nobreak >nul
call :all
goto :eof

:migrate
call :banner
echo [Migrate] Ejecutando migraciones...
cd /d "%PROJECT_DIR%\backend"
call php artisan migrate
echo [Migrate] Migraciones ejecutadas
goto :eof

:clean
call :banner
echo [Clean] Limpiando cache del backend...
cd /d "%PROJECT_DIR%\backend"
call php artisan config:clear
call php artisan cache:clear
call php artisan route:clear
call php artisan view:clear
echo [Clean] Cache limpiado
goto :eof
