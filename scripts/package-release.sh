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

# Strip leading 'v' if present for deb package naming
VERSION="${VERSION#v}"

echo "=========================================================="
echo " Packaging Parch Release v${VERSION}"
echo "=========================================================="

DIST_DIR="${REPO_ROOT}/release-dist"
rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

# 1. Build Frontend if dist/index.html is missing
if [ ! -f "${REPO_ROOT}/dist/index.html" ]; then
  echo "Building frontend with npm run build..."
  npm run build
else
  echo "Frontend already built at dist/."
fi

# 2. Build Release Binary if missing or out of date
RELEASE_BIN="${REPO_ROOT}/src-tauri/target/release/parch"
if [ ! -f "${RELEASE_BIN}" ]; then
  echo "Building release binary with cargo build --release..."
  cargo build --release --manifest-path src-tauri/Cargo.toml
else
  echo "Release binary found at ${RELEASE_BIN}."
fi

# 3. Build Debian / Ubuntu package (.deb)
echo "--- Building Debian / Ubuntu .deb package ---"
DEB_STAGE="${DIST_DIR}/parch_${VERSION}_amd64"
rm -rf "${DEB_STAGE}"
mkdir -p "${DEB_STAGE}/DEBIAN"
mkdir -p "${DEB_STAGE}/usr/bin"
mkdir -p "${DEB_STAGE}/usr/share/applications"
mkdir -p "${DEB_STAGE}/usr/share/mime/packages"
mkdir -p "${DEB_STAGE}/usr/share/icons/hicolor/scalable/apps"

# Copy binary (755)
cp -f "${RELEASE_BIN}" "${DEB_STAGE}/usr/bin/parch"
chmod 755 "${DEB_STAGE}/usr/bin/parch"

# Copy desktop entry (644 with Exec=/usr/bin/parch %F and Icon=parch)
sed -e "s|^Exec=.*|Exec=/usr/bin/parch %F|" \
    -e "s|^Icon=.*|Icon=parch|" \
    "${REPO_ROOT}/packaging/parch.desktop" > "${DEB_STAGE}/usr/share/applications/parch.desktop"
chmod 644 "${DEB_STAGE}/usr/share/applications/parch.desktop"

# Copy MIME registration (644)
cp -f "${REPO_ROOT}/packaging/parch-mime.xml" "${DEB_STAGE}/usr/share/mime/packages/parch-mime.xml"
chmod 644 "${DEB_STAGE}/usr/share/mime/packages/parch-mime.xml"

# Copy Icon (644)
cp -f "${REPO_ROOT}/packaging/icons/parch.svg" "${DEB_STAGE}/usr/share/icons/hicolor/scalable/apps/parch.svg"
chmod 644 "${DEB_STAGE}/usr/share/icons/hicolor/scalable/apps/parch.svg"

# Control file (644)
cat <<EOF > "${DEB_STAGE}/DEBIAN/control"
Package: parch
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: amd64
Depends: python3-gi, gir1.2-gtk-3.0, gir1.2-webkit2-4.1, xdg-utils, shared-mime-info, desktop-file-utils
Maintainer: Oyvind Volden
Description: Parch — Fast, distraction-free Markdown viewer for Linux desktops
EOF
chmod 644 "${DEB_STAGE}/DEBIAN/control"

# postinst script (755)
cat <<'EOF' > "${DEB_STAGE}/DEBIAN/postinst"
#!/bin/sh
set -e
if command -v update-mime-database >/dev/null 2>&1; then
  update-mime-database /usr/share/mime || true
fi
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications || true
fi
EOF
chmod 755 "${DEB_STAGE}/DEBIAN/postinst"

# postrm script (755)
cat <<'EOF' > "${DEB_STAGE}/DEBIAN/postrm"
#!/bin/sh
set -e
if command -v update-mime-database >/dev/null 2>&1; then
  update-mime-database /usr/share/mime || true
fi
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications || true
fi
EOF
chmod 755 "${DEB_STAGE}/DEBIAN/postrm"

# Build deb using dpkg-deb
dpkg-deb --build --root-owner-group "${DEB_STAGE}" "${DIST_DIR}/parch_${VERSION}_amd64.deb"
rm -rf "${DEB_STAGE}"
echo "✓ Created ${DIST_DIR}/parch_${VERSION}_amd64.deb"

# 4. Build Universal Linux Tarball (.tar.gz)
echo "--- Building Universal Linux Tarball ---"
TARBALL_STAGE="${DIST_DIR}/parch-v${VERSION}-linux-x86_64"
rm -rf "${TARBALL_STAGE}"
mkdir -p "${TARBALL_STAGE}/packaging/icons"
mkdir -p "${TARBALL_STAGE}/scripts"

cp -f "${RELEASE_BIN}" "${TARBALL_STAGE}/parch"
chmod 755 "${TARBALL_STAGE}/parch"

cp -f "${REPO_ROOT}/packaging/parch.desktop" "${TARBALL_STAGE}/packaging/parch.desktop"
cp -f "${REPO_ROOT}/packaging/parch-mime.xml" "${TARBALL_STAGE}/packaging/parch-mime.xml"
cp -f "${REPO_ROOT}/packaging/icons/parch.svg" "${TARBALL_STAGE}/packaging/icons/parch.svg"

cp -f "${REPO_ROOT}/scripts/install-desktop.sh" "${TARBALL_STAGE}/scripts/install-desktop.sh"
chmod 755 "${TARBALL_STAGE}/scripts/install-desktop.sh"

cp -f "${REPO_ROOT}/scripts/uninstall-desktop.sh" "${TARBALL_STAGE}/scripts/uninstall-desktop.sh"
chmod 755 "${TARBALL_STAGE}/scripts/uninstall-desktop.sh"

cp -f "${REPO_ROOT}/README.md" "${TARBALL_STAGE}/README.md"

TARBALL_OUT="${DIST_DIR}/parch-v${VERSION}-linux-x86_64.tar.gz"
tar -czf "${TARBALL_OUT}" -C "${TARBALL_STAGE}" .
rm -rf "${TARBALL_STAGE}"
echo "✓ Created ${TARBALL_OUT}"

# 5. Build RPM package if alien is available
if command -v alien >/dev/null 2>&1; then
  echo "--- Building RPM package with alien ---"
  (
    cd "${DIST_DIR}"
    alien -r --scripts "parch_${VERSION}_amd64.deb" || true
  )
fi

# 6. Generate SHA256SUMS
echo "--- Generating Checksums ---"
(
  cd "${DIST_DIR}"
  find . -maxdepth 1 \( -name "*.deb" -o -name "*.tar.gz" -o -name "*.rpm" \) -exec sha256sum {} + | sed 's| \./| |' | sort -k2 > SHA256SUMS
)
echo "✓ Created ${DIST_DIR}/SHA256SUMS"
cat "${DIST_DIR}/SHA256SUMS"

echo "=========================================================="
echo " Packaging Complete!"
echo " Artifacts in: ${DIST_DIR}"
echo "=========================================================="
