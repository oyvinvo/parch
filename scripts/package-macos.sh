#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

VERSION="${1:-}"
if [ -z "${VERSION}" ]; then
  if [ -f "package.json" ]; then
    VERSION=$(node -p "require('./package.json').version" 2>/dev/null || grep -m1 '"version"' package.json | awk -F'"' '{print $4}')
  else
    VERSION="0.1.0"
  fi
fi

VERSION="${VERSION#v}"

echo "=========================================================="
echo " Packaging Parch macOS Release v${VERSION}"
echo "=========================================================="

DIST_DIR="${REPO_ROOT}/release-dist"
mkdir -p "${DIST_DIR}"

# 1. Build Frontend if dist/index.html is missing
if [ ! -f "${REPO_ROOT}/dist/index.html" ]; then
  echo "Building frontend with npm run build..."
  npm run build
fi

# 2. Build Release Binary
RELEASE_BIN="${REPO_ROOT}/src-tauri/target/release/parch"
if [ ! -f "${RELEASE_BIN}" ]; then
  echo "Building release binary with cargo build --release..."
  cargo build --release --manifest-path src-tauri/Cargo.toml
fi

STAGE_DIR="${DIST_DIR}/macos_stage"
rm -rf "${STAGE_DIR}"
mkdir -p "${STAGE_DIR}"

# 3. Create macOS Parch.app Bundle
echo "--- Assembling Parch.app Bundle ---"
APP_DIR="${STAGE_DIR}/Parch.app"
mkdir -p "${APP_DIR}/Contents/MacOS"
mkdir -p "${APP_DIR}/Contents/Resources"

cp -f "${RELEASE_BIN}" "${APP_DIR}/Contents/MacOS/parch"
chmod 755 "${APP_DIR}/Contents/MacOS/parch"

# Info.plist registering document types for Finder "Open With"
cat <<EOF > "${APP_DIR}/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleExecutable</key>
    <string>parch</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>com.kulturit.parch</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>Parch</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>${VERSION}</string>
    <key>CFBundleVersion</key>
    <string>${VERSION}</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>CFBundleDocumentTypes</key>
    <array>
        <dict>
            <key>CFBundleTypeName</key>
            <string>Markdown Document</string>
            <key>CFBundleTypeRole</key>
            <string>Viewer</string>
            <key>LSHandlerRank</key>
            <string>Alternate</string>
            <key>CFBundleTypeExtensions</key>
            <array>
                <string>md</string>
                <string>markdown</string>
                <string>mdown</string>
                <string>mkd</string>
            </array>
            <key>LSItemContentTypes</key>
            <array>
                <string>net.daringfireball.markdown</string>
                <string>public.plain-text</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
EOF
chmod 644 "${APP_DIR}/Contents/Info.plist"

# 4. Zip Parch.app
echo "--- Compressing Parch.app (.zip) ---"
ZIP_OUT="${DIST_DIR}/Parch-v${VERSION}-macos-arm64.zip"
(
  cd "${STAGE_DIR}"
  zip -q -r "${ZIP_OUT}" "Parch.app"
)
echo "✓ Created ${ZIP_OUT}"

# 5. Create Standalone CLI Tarball
echo "--- Creating CLI Tarball (.tar.gz) ---"
TARBALL_OUT="${DIST_DIR}/parch-v${VERSION}-macos-arm64.tar.gz"
mkdir -p "${STAGE_DIR}/cli"
cp -f "${RELEASE_BIN}" "${STAGE_DIR}/cli/parch"
cp -f "${REPO_ROOT}/README.md" "${STAGE_DIR}/cli/README.md"
tar -czf "${TARBALL_OUT}" -C "${STAGE_DIR}/cli" .
echo "✓ Created ${TARBALL_OUT}"

rm -rf "${STAGE_DIR}"

# 6. Checksums for macOS artifacts
(
  cd "${DIST_DIR}"
  sha256sum "Parch-v${VERSION}-macos-arm64.zip" "parch-v${VERSION}-macos-arm64.tar.gz" > SHA256SUMS-macos.txt
)
echo "✓ Created ${DIST_DIR}/SHA256SUMS-macos.txt"

echo "=========================================================="
echo " macOS Packaging Complete!"
echo " Artifacts in: ${DIST_DIR}"
echo "=========================================================="
