param(
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

Write-Host "Stopping frontend on port $Port..."

$existingPids = @(
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
)

if (-not $existingPids) {
    Write-Host "No frontend process found on port $Port."
    return
}

foreach ($procId in $existingPids) {
    if ($procId -and $procId -ne $PID) {
        Write-Host "Stopping process $procId on port $Port..."
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "Frontend stop complete."
