#!/usr/bin/env bash
set -euo pipefail

echo "=========================================================="
echo " Installing Parch (Fast Markdown Viewer)"
echo "=========================================================="

OS="$(uname -s)"
ARCH="$(uname -m)"

if [ "$OS" != "Linux" ] && [ "$OS" != "Darwin" ]; then
  echo "Error: Parch supports Linux and macOS (detected: $OS)." >&2
  exit 1
fi

REPO="oyvinvo/parch"
TMP_DIR="$(mktemp -d -t parch-install-XXXXXX)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "Resolving latest Parch release from GitHub..."
LATEST_TAG=""

# Try finding redirect location from /releases/latest
if command -v curl >/dev/null 2>&1; then
  LATEST_URL=$(curl -sSL -I -o /dev/null -w '%{url_effective}' "https://github.com/${REPO}/releases/latest" 2>/dev/null || true)
  if [[ "$LATEST_URL" =~ /releases/tag/([^/]+)$ ]]; then
    LATEST_TAG="${BASH_REMATCH[1]}"
  fi
fi

# Fallback: query GitHub API
if [ -z "$LATEST_TAG" ] && command -v curl >/dev/null 2>&1; then
  LATEST_TAG=$(curl -sSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null | grep '"tag_name":' | head -1 | sed -E 's/.*"([^"]+)".*/\1/' || true)
fi

# Fallback: default to v0.1.0
if [ -z "$LATEST_TAG" ]; then
  echo "Could not resolve latest release tag automatically, defaulting to v0.1.0..."
  LATEST_TAG="v0.1.0"
fi

VERSION="${LATEST_TAG#v}"

download_file() {
  local url="$1"
  local dest="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fL --progress-bar -o "$dest" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -q --show-progress -O "$dest" "$url"
  else
    echo "Error: curl or wget is required." >&2
    exit 1
  fi
}

if [ "$OS" = "Linux" ]; then
  if [ "$ARCH" != "x86_64" ] && [ "$ARCH" != "amd64" ]; then
    echo "Error: Prebuilt Linux binaries are currently available for x86_64 (detected: $ARCH)." >&2
    echo "You can build from source: https://github.com/oyvinvo/parch" >&2
    exit 1
  fi

  TARBALL_NAME="parch-v${VERSION}-linux-x86_64.tar.gz"
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${TARBALL_NAME}"

  echo "Downloading Parch ${LATEST_TAG} (${TARBALL_NAME})..."
  if ! download_file "$DOWNLOAD_URL" "${TMP_DIR}/${TARBALL_NAME}"; then
    FALLBACK_URL="https://github.com/${REPO}/releases/latest/download/${TARBALL_NAME}"
    download_file "$FALLBACK_URL" "${TMP_DIR}/${TARBALL_NAME}"
  fi

  echo "Extracting release archive..."
  mkdir -p "${TMP_DIR}/extracted"
  tar -xzf "${TMP_DIR}/${TARBALL_NAME}" -C "${TMP_DIR}/extracted"

  echo "Installing desktop integration and launcher..."
  chmod +x "${TMP_DIR}/extracted/scripts/install-desktop.sh"
  (cd "${TMP_DIR}/extracted" && ./scripts/install-desktop.sh)

  echo "=========================================================="
  echo " Parch ${LATEST_TAG} installed successfully!"
  echo " You can now run 'parch [FILE.md]' from your terminal,"
  echo " or right-click any Markdown file in your file manager"
  echo " and choose 'Open With Parch'!"
  echo "=========================================================="

elif [ "$OS" = "Darwin" ]; then
  echo "Detected macOS (${ARCH})..."

  MACOS_ZIP="Parch-v${VERSION}-macos-arm64.zip"
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${LATEST_TAG}/${MACOS_ZIP}"

  echo "Downloading Parch ${LATEST_TAG} (${MACOS_ZIP})..."
  if ! download_file "$DOWNLOAD_URL" "${TMP_DIR}/${MACOS_ZIP}"; then
    FALLBACK_URL="https://github.com/${REPO}/releases/latest/download/${MACOS_ZIP}"
    download_file "$FALLBACK_URL" "${TMP_DIR}/${MACOS_ZIP}"
  fi

  echo "Extracting Parch.app bundle..."
  mkdir -p "${TMP_DIR}/extracted"
  unzip -q "${TMP_DIR}/${MACOS_ZIP}" -d "${TMP_DIR}/extracted"

  TARGET_APP_DIR="/Applications"
  if [ ! -w "$TARGET_APP_DIR" ]; then
    TARGET_APP_DIR="$HOME/Applications"
    mkdir -p "$TARGET_APP_DIR"
  fi

  echo "Installing Parch.app to ${TARGET_APP_DIR}/Parch.app..."
  rm -rf "${TARGET_APP_DIR}/Parch.app"
  cp -R "${TMP_DIR}/extracted/Parch.app" "${TARGET_APP_DIR}/"

  # Also install CLI launcher symlink
  CLI_DIR="/usr/local/bin"
  if [ ! -w "$CLI_DIR" ] 2>/dev/null; then
    CLI_DIR="$HOME/.local/bin"
    mkdir -p "$CLI_DIR"
  fi

  ln -sf "${TARGET_APP_DIR}/Parch.app/Contents/MacOS/parch" "${CLI_DIR}/parch"
  echo "✓ Installed CLI link: ${CLI_DIR}/parch -> ${TARGET_APP_DIR}/Parch.app/Contents/MacOS/parch"

  echo "=========================================================="
  echo " Parch ${LATEST_TAG} installed successfully on macOS!"
  echo " App installed to: ${TARGET_APP_DIR}/Parch.app"
  echo " CLI available at: ${CLI_DIR}/parch"
  echo " You can now open Markdown files via Finder or run 'parch [FILE.md]'!"
  echo "=========================================================="
fi
