#!/usr/bin/env bash
set -euo pipefail

# Usage: install.sh

NODE_VERSION="${NODE_VERSION:-22.14.0}"
DSH_VERSION="${DSH_VERSION:-latest}"
REMOTE_VERSION="${REMOTE_VERSION:-0.4.14}"
FILE_VIEWER_VERSION="${FILE_VIEWER_VERSION:-latest}"
DSH_PROFILE="${DSH_PROFILE:-web}"
NODE_HOME="${DSH_NODE_HOME:-${HOME}/.local/share/dsh-node/node-v${NODE_VERSION}}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
SERVICE_NAME="${DSH_SERVICE_NAME:-dsh-remote}"
SERVICE_COMMAND="${DSH_SERVICE_COMMAND:-}"

say() { printf '[dsh-install] %s\n' "$*"; }
die() { printf '[dsh-install] error: %s\n' "$*" >&2; exit 1; }

install_node() {
  command -v curl >/dev/null 2>&1 || die 'curl is required to install Node.js automatically.'
  local os arch archive url tmp extract_dir
  case "$(uname -s)" in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    *) die 'This script supports Linux and macOS. Use scripts/install.ps1 on Windows.' ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) arch=x64 ;;
    aarch64|arm64) arch=arm64 ;;
    *) die "Unsupported CPU architecture: $(uname -m)" ;;
  esac
  archive="node-v${NODE_VERSION}-${os}-${arch}.tar.gz"
  url="https://npmmirror.com/mirrors/node/v${NODE_VERSION}/${archive}"
  tmp="$(mktemp -d)"
  say "Node.js not found; downloading ${NODE_VERSION} from npmmirror.com"
  curl --fail --location --retry 3 --output "$tmp/$archive" "$url"
  mkdir -p "$(dirname "$NODE_HOME")"
  tar -xzf "$tmp/$archive" -C "$(dirname "$NODE_HOME")"
  extract_dir="$(dirname "$NODE_HOME")/node-v${NODE_VERSION}-${os}-${arch}"
  if [[ "$extract_dir" != "$NODE_HOME" ]]; then
    rm -rf "$NODE_HOME"
    mv "$extract_dir" "$NODE_HOME"
  fi
  export PATH="$NODE_HOME/bin:$PATH"
  rm -rf "$tmp"
  say "Node.js installed at $NODE_HOME"
}

if ! command -v node >/dev/null 2>&1; then install_node; fi
command -v npm >/dev/null 2>&1 || die 'npm was not found next to Node.js.'

say "Installing @deepseek-ai/dsh (${DSH_VERSION})"
npm --registry "$NPM_REGISTRY" install --global "@deepseek-ai/dsh@${DSH_VERSION}"
say "Installing ds-harness-remote CLI (${REMOTE_VERSION})"
npm --registry "$NPM_REGISTRY" install --global "ds-harness-remote@${REMOTE_VERSION}"
REMOTE_PACKAGE_DIR="$(npm root --global)/ds-harness-remote"
[[ -f "$REMOTE_PACKAGE_DIR/package.json" ]] || die "Global ds-harness-remote package was not found at $REMOTE_PACKAGE_DIR"

say "Adding ds-harness-remote@${REMOTE_VERSION} to the ${DSH_PROFILE} profile"
dsh plugin --profile "$DSH_PROFILE" add "$REMOTE_PACKAGE_DIR"
say "Adding dsh-file-viewer@${FILE_VIEWER_VERSION} to the ${DSH_PROFILE} profile"
npm_config_registry="$NPM_REGISTRY" dsh plugin --profile "$DSH_PROFILE" add "dsh-file-viewer@${FILE_VIEWER_VERSION}"

say 'Installation complete. Restart DSH to load the plugins.'

executable="${SERVICE_COMMAND:-}"
  if [[ -z "$executable" ]]; then
    executable="$(command -v dsh-tui || command -v dsh || true)"
  fi
  [[ -n "$executable" ]] || die 'Cannot find dsh or dsh-tui. Set DSH_SERVICE_COMMAND to its executable.'
  case "$(uname -s)" in
    Linux)
      unit_dir="${HOME}/.config/systemd/user"
      mkdir -p "$unit_dir"
      cat >"$unit_dir/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=DSH Remote Host
After=network-online.target

[Service]
ExecStart=${executable}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF
      systemctl --user daemon-reload
      systemctl --user enable --now "${SERVICE_NAME}.service"
      say "Installed and started systemd user service ${SERVICE_NAME}."
      ;;
    Darwin)
      plist_dir="${HOME}/Library/LaunchAgents"
      plist_path="$plist_dir/${SERVICE_NAME}.plist"
      mkdir -p "$plist_dir"
      escaped_command="${executable//&/&amp;}"
      cat >"$plist_path" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${SERVICE_NAME}</string>
<key>ProgramArguments</key><array><string>/bin/sh</string><string>-lc</string><string>${escaped_command}</string></array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
</dict></plist>
EOF
      launchctl bootstrap "gui/$(id -u)" "$plist_path"
      say "Installed and started launchd user agent ${SERVICE_NAME}."
      ;;
    *) die 'Service installation supports Linux systemd and macOS launchd.' ;;
esac

printf '\n'
say 'The ds-harness-remote CLI is ready to use. Examples:'
printf '  ds-harness-remote login zhihu     # sign in with a Zhihu QR code (default)\n'
printf '  ds-harness-remote login github    # sign in with GitHub\n'
printf '  ds-harness-remote status          # show login and Host status\n'
printf '  ds-harness-remote logout          # sign out this device\n'
say 'Inside dsh-TUI the equivalents are /remote login, /remote status, /remote logout.'
