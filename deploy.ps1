# Reconstruye backend y frontend con los últimos cambios y reinicia los contenedores.
# Ejecutar desde la raíz del proyecto: .\deploy.ps1

Set-Location $PSScriptRoot

Write-Host "Reconstruyendo backend y frontend..." -ForegroundColor Cyan
docker-compose build backend frontend

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error en build. Revisa los logs arriba." -ForegroundColor Red
    exit 1
}

Write-Host "Reiniciando contenedores backend y frontend..." -ForegroundColor Cyan
docker-compose up -d backend frontend

Write-Host "Listo. Espera unos segundos y recarga la pagina (Ctrl+F5)." -ForegroundColor Green
Write-Host "  App: http://localhost:8080" -ForegroundColor Gray
