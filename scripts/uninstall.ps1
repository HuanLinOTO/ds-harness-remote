# Removes the DSH Remote service and plugins. Node.js and credentials are kept.
$ErrorActionPreference = 'Stop'
$profile = if ($env:DSH_PROFILE) { $env:DSH_PROFILE } else { 'web' }
$serviceName = if ($env:DSH_SERVICE_NAME) { $env:DSH_SERVICE_NAME } else { 'DSHRemote' }

Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
sc.exe delete $serviceName 2>$null | Out-Null
if (Get-Command dsh.cmd -ErrorAction SilentlyContinue) {
  dsh.cmd plugin --profile $profile remove ds-harness-remote *> $null
  dsh.cmd plugin --profile $profile remove dsh-file-viewer *> $null
}
Write-Host "[dsh-install] Removed service and plugins from the $profile profile. Node.js and credentials were kept."
