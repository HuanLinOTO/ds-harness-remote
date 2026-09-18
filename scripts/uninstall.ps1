# Removes the DSH Remote autostart and plugins. Node.js and credentials are kept.
$ErrorActionPreference = 'Stop'
$profile = if ($env:DSH_PROFILE) { $env:DSH_PROFILE } else { 'web' }
$serviceName = if ($env:DSH_SERVICE_NAME) { $env:DSH_SERVICE_NAME } else { 'DSHRemote' }

if (Get-ScheduledTask -TaskName $serviceName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $serviceName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $serviceName -Confirm:$false
}
# Machine service registered by an earlier release.
if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) {
  Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
  sc.exe delete $serviceName 2>$null | Out-Null
}
if (Get-Command dsh.cmd -ErrorAction SilentlyContinue) {
  dsh.cmd plugin --profile $profile remove ds-harness-remote *> $null
  dsh.cmd plugin --profile $profile remove dsh-file-viewer *> $null
}
if (Get-Command npm.cmd -ErrorAction SilentlyContinue) {
  npm.cmd uninstall --global ds-harness-remote @deepseek-ai/dsh *> $null
}
Write-Host "[dsh-install] Removed autostart, CLI, and plugins from the $profile profile. Node.js and credentials were kept."
