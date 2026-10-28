#!/usr/bin/env bash
set -euo pipefail

DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
BIN_DIR="${HOME}/.local/bin"
APPS_DIR="${DATA_HOME}/applications"
MIME_DIR="${DATA_HOME}/mime/packages"
ICONS_DIR="${DATA_HOME}/icons/hicolor/scalable/apps"

echo "=== Uninstalling Parch Linux Desktop Integration ==="

rm -f "${APPS_DIR}/parch.desktop" "${APPS_DIR}/parchment.desktop"
rm -f "${MIME_DIR}/parch-mime.xml" "${MIME_DIR}/parchment-mime.xml"
rm -f "${ICONS_DIR}/parch.svg" "${ICONS_DIR}/parchment.svg"
rm -f "${BIN_DIR}/parch" "${BIN_DIR}/parchment"

if command -v update-mime-database >/dev/null 2>&1; then
  update-mime-database "${DATA_HOME}/mime" 2>/dev/null || true
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${APPS_DIR}" 2>/dev/null || true
fi

echo "=== Parch Desktop Integration Uninstalled Cleanly! ==="
