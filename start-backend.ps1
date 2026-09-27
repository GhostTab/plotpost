# One-command local backend (SQLite + Supabase Auth JWT).
# Usage from repo root OR backend/:
#   .\start-backend.ps1

$ErrorActionPreference = "Stop"
$BackendDir = if (Test-Path ".\backend\app\main.py") {
    Resolve-Path ".\backend"
} elseif (Test-Path ".\app\main.py") {
    Resolve-Path "."
} else {
    throw "Run from repo root or backend/"
}

Set-Location $BackendDir
$Python = Join-Path $BackendDir ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    throw "Missing venv. Run: python -m venv .venv; .\.venv\Scripts\pip install -e `".[dev]`""
}

Write-Host "Starting MOVIESITE API on http://127.0.0.1:8000 ..."
Write-Host "Docs: http://127.0.0.1:8000/docs"
& $Python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
