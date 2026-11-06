param([string]$GodotPath = $env:GODOT_PATH, [switch]$Test)
$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
if (-not $GodotPath) {
    $runningEditor = Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^Godot.*mono.*\.exe$' } | Select-Object -First 1
    if ($runningEditor) { $GodotPath = $runningEditor.ExecutablePath }
}
if (-not $GodotPath -or -not (Test-Path -LiteralPath $GodotPath)) { throw 'Specify -GodotPath pointing to Godot 4.7.2 .NET, or set GODOT_PATH.' }
$consolePath = Join-Path (Split-Path -Parent $GodotPath) (([System.IO.Path]::GetFileNameWithoutExtension($GodotPath)) + '_console.exe')
if (Test-Path -LiteralPath $consolePath) { $GodotPath = $consolePath }
Push-Location $projectDirectory
try {
    dotnet build BloxDungoen.csproj
    if ($LASTEXITCODE -ne 0) { throw 'C# compilation failed.' }
    & $GodotPath --headless --path $projectDirectory --editor --import --quit
    if ($LASTEXITCODE -ne 0) { throw 'Godot import failed.' }
    if ($Test) {
        & $GodotPath --headless --path $projectDirectory -- --self-test
        if ($LASTEXITCODE -ne 0) { throw 'Godot rule tests failed.' }
    }
    New-Item -ItemType Directory -Force -Path (Join-Path $projectDirectory 'builds/windows') | Out-Null
    $exportLog = Join-Path $projectDirectory '.godot/windows-export.log'
    & $GodotPath --headless --path $projectDirectory --export-release 'Windows Desktop' *> $exportLog
    $exportExit = $LASTEXITCODE
    Get-Content -LiteralPath $exportLog -Tail 15
    if ($exportExit -ne 0 -or (Select-String -LiteralPath $exportLog -Pattern '^ERROR:' -Quiet)) { throw 'Windows export failed. Check .godot/windows-export.log and install the matching .NET export templates.' }
    $assembly = Join-Path $projectDirectory 'builds/windows/data_BloxDungoen_windows_x86_64/BloxDungoen.dll'
    if (-not (Test-Path -LiteralPath $assembly)) { throw 'The exported .NET assembly is missing.' }
    Write-Output ('Game ready: ' + (Join-Path $projectDirectory 'builds/windows/BloxDungoen.exe'))
} finally { Pop-Location }
