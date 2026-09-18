#!/usr/bin/env bash
set -euo pipefail

DSH_PROFILE="${DSH_PROFILE:-web}"
SERVICE_NAME="${DSH_SERVICE_NAME:-dsh-remote}"

case "$(uname -s)" in
  Linux)
    systemctl --user disable --now "${SERVICE_NAME}.service" >/dev/null 2>&1 || true
    rm -f "${HOME}/.config/systemd/user/${SERVICE_NAME}.service"
    systemctl --user daemon-reload >/dev/null 2>&1 || true
    ;;
  Darwin)
    launchctl bootout "gui/$(id -u)" "${HOME}/Library/LaunchAgents/${SERVICE_NAME}.plist" >/dev/null 2>&1 || true
    rm -f "${HOME}/Library/LaunchAgents/${SERVICE_NAME}.plist"
    ;;
esac

if command -v dsh >/dev/null 2>&1; then
  dsh plugin --profile "$DSH_PROFILE" remove ds-harness-remote >/dev/null 2>&1 || true
  dsh plugin --profile "$DSH_PROFILE" remove dsh-file-viewer >/dev/null 2>&1 || true
fi
printf '[dsh-install] Removed service and plugins from the %s profile. Node.js and credentials were kept.\n' "$DSH_PROFILE"
