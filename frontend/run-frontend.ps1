param(
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

Write-Host "Checking for existing process on port $Port..."

$existingPids = @(
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
)

foreach ($procId in $existingPids) {
    if ($procId -and $procId -ne $PID) {
        Write-Host "Stopping process $procId on port $Port..."
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}

$env:PORT = "$Port"
Write-Host "Starting frontend on port $Port..."
npm start
