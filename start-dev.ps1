# Start the backend and frontend in development mode on Windows PowerShell.
$backendJob = Start-Job -ScriptBlock {
    Set-Location -Path backend
    .\venv\Scripts\Activate.ps1
    uvicorn app.main:app --reload --port 8002
}

$frontendJob = Start-Job -ScriptBlock {
    Set-Location -Path frontend
    npm run dev
}

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
