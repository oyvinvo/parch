#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "${SCRIPT_DIR}/../packaging" ] || [ -f "${SCRIPT_DIR}/../parch" ] || [ -d "${SCRIPT_DIR}/../src-tauri" ]; then
  REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
  REPO_ROOT="${SCRIPT_DIR}"
fi

DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
BIN_DIR="${HOME}/.local/bin"
APPS_DIR="${DATA_HOME}/applications"
MIME_DIR="${DATA_HOME}/mime/packages"
ICONS_DIR="${DATA_HOME}/icons/hicolor/scalable/apps"

echo "=== Installing Parch Linux Desktop Integration ==="

mkdir -p "${BIN_DIR}" "${APPS_DIR}" "${MIME_DIR}" "${ICONS_DIR}"

# Clean up any legacy parchment integration
rm -f "${BIN_DIR}/parchment" "${APPS_DIR}/parchment.desktop" "${MIME_DIR}/parchment-mime.xml" "${ICONS_DIR}/parchment.svg"

# Locate packaging files (support both repo structure and extracted tarball root)
if [ -d "${REPO_ROOT}/packaging" ]; then
  PKG_DIR="${REPO_ROOT}/packaging"
else
  PKG_DIR="${REPO_ROOT}"
fi

DESKTOP_SRC="${PKG_DIR}/parch.desktop"
MIME_SRC="${PKG_DIR}/parch-mime.xml"

if [ -f "${PKG_DIR}/icons/parch.svg" ]; then
  ICON_SRC="${PKG_DIR}/icons/parch.svg"
elif [ -f "${PKG_DIR}/parch.svg" ]; then
  ICON_SRC="${PKG_DIR}/parch.svg"
else
  ICON_SRC="${REPO_ROOT}/packaging/icons/parch.svg"
fi

# 1. Install / update parch binary or launcher
LAUNCHER_TARGET="${BIN_DIR}/parch"

if [ -f "${REPO_ROOT}/parch" ]; then
  cp -f "${REPO_ROOT}/parch" "${LAUNCHER_TARGET}"
  chmod +x "${LAUNCHER_TARGET}"
  echo "✓ Installed standalone parch binary from tarball to ${LAUNCHER_TARGET}"
elif [ -f "${REPO_ROOT}/src-tauri/target/release/parch" ]; then
  cp -f "${REPO_ROOT}/src-tauri/target/release/parch" "${LAUNCHER_TARGET}"
  chmod +x "${LAUNCHER_TARGET}"
  echo "✓ Installed standalone parch binary from target/release to ${LAUNCHER_TARGET}"
else
  cat <<EOF > "${LAUNCHER_TARGET}"
#!/usr/bin/env bash
REPO_DIR="${REPO_ROOT}"
export PARCH_DIST_DIR="\${REPO_DIR}/dist"
if [ -f "\${REPO_DIR}/src-tauri/target/release/parch" ]; then
  exec "\${REPO_DIR}/src-tauri/target/release/parch" "\$@"
elif [ -f "\${REPO_DIR}/parch" ]; then
  exec "\${REPO_DIR}/parch" "\$@"
else
  exec cargo run --manifest-path "\${REPO_DIR}/src-tauri/Cargo.toml" --quiet -- "\$@"
fi
EOF
  chmod +x "${LAUNCHER_TARGET}"
  echo "✓ Installed parch launcher script to ${LAUNCHER_TARGET}"
fi

# 2. Install Desktop Entry
sed -e "s|^Exec=.*|Exec=${LAUNCHER_TARGET} %F|" \
    -e "s|^Icon=.*|Icon=${ICONS_DIR}/parch.svg|" \
    "${DESKTOP_SRC}" > "${APPS_DIR}/parch.desktop"
echo "✓ Installed XDG desktop entry to ${APPS_DIR}/parch.desktop"

# 3. Install MIME Registration
cp -f "${MIME_SRC}" "${MIME_DIR}/parch-mime.xml"
echo "✓ Installed shared-mime-info definition to ${MIME_DIR}/parch-mime.xml"

# 4. Install Application Icon
cp -f "${ICON_SRC}" "${ICONS_DIR}/parch.svg"
echo "✓ Installed scalable SVG icon to ${ICONS_DIR}/parch.svg"

# 5. Refresh XDG Databases
if command -v update-mime-database >/dev/null 2>&1; then
  update-mime-database "${DATA_HOME}/mime"
  echo "✓ Updated user MIME database"
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "${APPS_DIR}"
  echo "✓ Updated user desktop database"
fi

if command -v xdg-mime >/dev/null 2>&1; then
  xdg-mime default parch.desktop text/markdown text/x-markdown
  echo "✓ Set parch.desktop as default handler for text/markdown"
fi

echo "=== Parch Desktop Integration Installed Successfully! ==="
