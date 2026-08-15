# Start the backend and frontend in development mode on Windows PowerShell.
# Run from the project root:  .\start-dev.ps1

$root = $PSScriptRoot
if (-not $root) { $root = Get-Location }

$backendJob = Start-Job -ScriptBlock {
    param($ProjectRoot)
    Set-Location -Path "$ProjectRoot\backend"
    .\venv\Scripts\Activate.ps1
    uvicorn app.main:app --reload --port 8002
} -ArgumentList $root

$frontendJob = Start-Job -ScriptBlock {
    param($ProjectRoot)
    Set-Location -Path "$ProjectRoot\frontend"
    npm run dev
} -ArgumentList $root

Write-Host "Backend job ID: $($backendJob.Id)"
Write-Host "Frontend job ID: $($frontendJob.Id)"
Write-Host "Open http://localhost:5173"

# Stream output from both jobs
while ($backendJob.State -eq 'Running' -or $frontendJob.State -eq 'Running') {
    Receive-Job -Job $backendJob -Keep
    Receive-Job -Job $frontendJob -Keep
    Start-Sleep -Seconds 1
}

Receive-Job -Job $backendJob
Receive-Job -Job $frontendJob
