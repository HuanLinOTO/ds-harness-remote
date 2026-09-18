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
if (-not (Get-Command pnpm.cmd -ErrorAction SilentlyContinue)) {
  Say 'Installing pnpm (required by the DSH plugin manager)'
  # pnpm >= 11 is what DSH profiles are written for: their pnpm-workspace.yaml
  # carries pnpm 11 settings and their packageManager pins pnpm@11.
  npm.cmd --registry $registry install --global pnpm@11.21.0
  if ($LASTEXITCODE -ne 0) { throw 'pnpm installation failed.' }
}
Say "Installing @deepseek-ai/dsh ($dshVersion)"
npm.cmd --registry $registry install --global "@deepseek-ai/dsh@$dshVersion"
if ($LASTEXITCODE -ne 0) { throw 'Installation command failed; service setup aborted.' }
Say "Installing ds-harness-remote CLI ($remoteVersion)"
npm.cmd --registry $registry install --global "ds-harness-remote@$remoteVersion"
if ($LASTEXITCODE -ne 0) { throw 'Installation command failed; service setup aborted.' }
$remotePackageDir = Join-Path ((npm.cmd root --global).Trim()) 'ds-harness-remote'
if (-not (Test-Path (Join-Path $remotePackageDir 'package.json'))) { throw "Global ds-harness-remote package was not found at $remotePackageDir" }
Say "Adding ds-harness-remote@$remoteVersion to the $profile profile"
$env:npm_config_registry = $registry
# -w is required: a DSH profile is itself a pnpm workspace, and pnpm < 11
# refuses to add a dependency to a workspace root without it
# (ERR_PNPM_ADDING_TO_ROOT), which aborts the install before the service step.
dsh.cmd plugin --profile $profile add -w $remotePackageDir
if ($LASTEXITCODE -ne 0) { throw 'Installation command failed; service setup aborted.' }
Say "Adding dsh-file-viewer@$fileViewerVersion to the $profile profile"
dsh.cmd plugin --profile $profile add -w "dsh-file-viewer@$fileViewerVersion"
if ($LASTEXITCODE -ne 0) { throw 'Installation command failed; service setup aborted.' }
Say 'Installation complete. Restart DSH to load the plugins.'

$command = if ($env:DSH_SERVICE_COMMAND) { $env:DSH_SERVICE_COMMAND } else { (Get-Command dsh.cmd -ErrorAction SilentlyContinue | Select-Object -First 1).Source }
if (-not $command) { throw 'Cannot find dsh.cmd. Set DSH_SERVICE_COMMAND to its executable.' }
# Host credentials live in the current user's DSH_HOME, so the entry point has to
# run as that user with their profile loaded. A machine service runs as
# LocalSystem, which sees a different DSH_HOME and no login state at all, so
# register a logon task instead: same user, no stored password, starts on every
# sign-in. It must pass --profile as well, because a bare `dsh` exits 1 with
# "--profile <name> is required".
if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
  Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
  sc.exe delete $serviceName 2>$null | Out-Null
}
# A bare $env:USERNAME as the logon trigger UserId fails with 0x80070057
# ("参数错误"/invalid argument) when the name cannot be resolved unambiguously
# (domain-joined machine or Microsoft account), so always qualify it with the
# computer or domain name.
$taskUser = if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME }
$cmd = Join-Path $env:SystemRoot 'System32\cmd.exe'
$action = New-ScheduledTaskAction -Execute $cmd -Argument "/d /c `"`"$command`" --profile $profile`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $taskUser
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $serviceName -Action $action -Trigger $trigger -Settings $settings `
  -Description 'DSH Remote Host' -Force | Out-Null
Start-ScheduledTask -TaskName $serviceName
$state = (Get-ScheduledTask -TaskName $serviceName).State
if ($state -eq 'Running') {
  Say "Host task $serviceName is running and starts at sign-in ($taskUser)."
} else {
  $info = Get-ScheduledTaskInfo -TaskName $serviceName
  Write-Warning "[dsh-install] Host task $serviceName was registered but reports state '$state' (last result $($info.LastTaskResult)). Inspect it in Task Scheduler."
}

Write-Host ''
Say 'The ds-harness-remote CLI is ready to use. Examples:'
Write-Host '  ds-harness-remote login zhihu     # sign in with a Zhihu QR code (default)'
Write-Host '  ds-harness-remote login github    # sign in with GitHub'
Write-Host '  ds-harness-remote status          # show login and Host status'
Write-Host '  ds-harness-remote logout          # sign out this device'
Say 'Inside dsh-TUI the equivalents are /remote login, /remote status, /remote logout.'
