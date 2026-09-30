$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Manager = Join-Path $ScriptDir "mindmap_manager.py"

if (Get-Command py.exe -ErrorAction SilentlyContinue) {
    & py.exe -3 $Manager
    exit $LASTEXITCODE
}

if (Get-Command python.exe -ErrorAction SilentlyContinue) {
    & python.exe $Manager
    exit $LASTEXITCODE
}

Write-Host "Python 3 is missing. Install Python from https://www.python.org/downloads/windows/"
Write-Host "Enable the option 'Add Python to PATH' during setup."
Read-Host "Press Enter to close"
exit 1
