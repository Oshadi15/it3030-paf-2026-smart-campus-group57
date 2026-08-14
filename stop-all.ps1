param(
    [int]$BackendPort = 8081,
    [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Stopping backend and frontend..."

Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location `"$root\\backend`"; .\\stop-backend.ps1 -Port $BackendPort"
Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location `"$root\\frontend`"; .\\stop-frontend.ps1 -Port $FrontendPort"
