@echo off
setlocal

cd /d "%~dp0"

where docker >nul 2>nul
if errorlevel 1 (
  echo [run-local] No se encontro "docker" en PATH.
  echo [run-local] Instala Docker Desktop y reintenta.
  pause
  exit /b 1
)

docker version >nul 2>nul
if errorlevel 1 (
  echo [run-local] Docker CLI no puede conectarse al Engine.
  echo [run-local] Abri Docker Desktop y espera a que inicie el engine.
  echo [run-local] Si estas en Windows containers, cambia a Linux containers en Docker Desktop: "Switch to Linux containers".
  pause
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo [run-local] "docker compose" no esta disponible.
  echo [run-local] Actualiza Docker Desktop o instala el plugin de Compose.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [run-local] No existe .env. Copiando desde .env.example...
  copy /y ".env.example" ".env" >nul
  echo [run-local] Edita .env para cambiar credenciales/secretos.
)

echo [run-local] Levantando servicios (db, backend, frontend, db_backup)...
docker compose --env-file .env up -d --build
if errorlevel 1 (
  echo [run-local] Fallo docker compose up. Revisa Docker Desktop y el archivo .env.
  pause
  exit /b 1
)

echo [run-local] Abriendo navegador...
start "" "http://localhost:8080"

echo [run-local] Siguiendo logs (Ctrl+C para salir de logs)...
docker compose --env-file .env logs -f
