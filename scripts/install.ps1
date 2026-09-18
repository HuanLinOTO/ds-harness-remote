# Usage: install.ps1
# Optional overrides: $env:NODE_VERSION, $env:DSH_VERSION, $env:REMOTE_VERSION,
# $env:FILE_VIEWER_VERSION, $env:DSH_PROFILE, and $env:NPM_REGISTRY.
$ErrorActionPreference = 'Stop'

$nodeVersion = if ($env:NODE_VERSION) { $env:NODE_VERSION } else { '22.14.0' }
$dshVersion = if ($env:DSH_VERSION) { $env:DSH_VERSION } else { 'latest' }
$remoteVersion = if ($env:REMOTE_VERSION) { $env:REMOTE_VERSION } else { '0.4.14' }
$fileViewerVersion = if ($env:FILE_VIEWER_VERSION) { $env:FILE_VIEWER_VERSION } else { 'latest' }
$profile = if ($env:DSH_PROFILE) { $env:DSH_PROFILE } else { 'web' }
$registry = if ($env:NPM_REGISTRY) { $env:NPM_REGISTRY } else { 'https://registry.npmmirror.com' }
$serviceName = if ($env:DSH_SERVICE_NAME) { $env:DSH_SERVICE_NAME } else { 'DSHRemote' }

function Say([string]$Message) { Write-Host "[dsh-install] $Message" }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  $arch = if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -eq 'Arm64') { 'arm64' } else { 'x64' }
  $nodeHome = if ($env:DSH_NODE_HOME) { $env:DSH_NODE_HOME } else { Join-Path $env:LOCALAPPDATA "dsh-node\node-v$nodeVersion-win-$arch" }
  $archive = "node-v$nodeVersion-win-$arch.zip"
  $url = "https://npmmirror.com/mirrors/node/v$nodeVersion/$archive"
  $tmp = Join-Path ([System.IO.Path]::GetTempPath()) "dsh-node-$([guid]::NewGuid())"
  New-Item -ItemType Directory -Path $tmp | Out-Null
  try {
    Say "Node.js not found; downloading $nodeVersion from npmmirror.com"
    $zip = Join-Path $tmp $archive
    Invoke-WebRequest -Uri $url -OutFile $zip
    $parent = Split-Path $nodeHome -Parent
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    Move-Item -Path (Join-Path $tmp "node-v$nodeVersion-win-$arch") -Destination $nodeHome -Force
    $env:Path = "$nodeHome;$env:Path"
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not (($userPath -split ';') -contains $nodeHome)) {
      [Environment]::SetEnvironmentVariable('Path', (($userPath.TrimEnd(';') + ';' + $nodeHome).Trim(';')), 'User')
    }
    Say "Node.js installed at $nodeHome"
  } finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  }
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm was not found next to Node.js.' }
Say "Installing @deepseek-ai/dsh ($dshVersion)"
npm.cmd --registry $registry install --global "@deepseek-ai/dsh@$dshVersion"
Say "Adding ds-harness-remote@$remoteVersion to the $profile profile"
$env:npm_config_registry = $registry
dsh.cmd plugin --profile $profile add "ds-harness-remote@$remoteVersion"
Say "Adding dsh-file-viewer@$fileViewerVersion to the $profile profile"
dsh.cmd plugin --profile $profile add "dsh-file-viewer@$fileViewerVersion"
Say 'Installation complete. Restart DSH to load the plugins.'

$command = if ($env:DSH_SERVICE_COMMAND) { $env:DSH_SERVICE_COMMAND } else { (Get-Command dsh-tui.cmd,dsh.cmd -ErrorAction SilentlyContinue | Select-Object -First 1).Source }
if (-not $command) { throw 'Cannot find dsh.cmd or dsh-tui.cmd. Set DSH_SERVICE_COMMAND to its executable.' }
$cmd = Join-Path $env:SystemRoot 'System32\cmd.exe'
$binaryPath = "`"$cmd`" /d /c `"`"$command`"`""
Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
sc.exe delete $serviceName 2>$null | Out-Null
New-Service -Name $serviceName -BinaryPathName $binaryPath -DisplayName 'DSH Remote Host' -StartupType Automatic | Out-Null
Start-Service -Name $serviceName
Say "Installed and started Windows service $serviceName."
