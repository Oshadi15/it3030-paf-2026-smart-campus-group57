param(
    [int]$BackendPort = 8081,
    [int]$FrontendPort = 3000
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Launching backend and frontend in separate PowerShell windows..."

Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location `"$root\\backend`"; .\\run-backend.ps1 -Port $BackendPort"
Start-Process powershell -ArgumentList "-NoExit","-Command","Set-Location `"$root\\frontend`"; .\\run-frontend.ps1 -Port $FrontendPort"
