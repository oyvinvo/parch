# Quality & Audit Checklist: Operations & Release Readiness (Operations)

```text
STATUS: PASS
AUDIT FILE: specs/001-parchment-markdown-viewer/checklists/operations-verification.md
KEY METRIC: Desktop Packaging: PASS | CI/CD: PASS | Multi-OS Release: Linux (.deb, .tar.gz, .rpm, Arch PKGBUILD) & macOS (Parch.app)
ACTION ITEMS: None
```

- **Feature / Branch**: `001-parchment-markdown-viewer`
- **Track**: `Track A: Full 4-Phase SDD`
- **Auditor Subagent**: `operations`
- **Date**: `2026-10-28`
- **Canonical Output Path**: `specs/001-parchment-markdown-viewer/checklists/operations-verification.md`

---

## 4. Operations & Release Readiness Checklist (`operations-verification.md`)

- [x] **Linux Desktop & XDG MIME Integration**:
  - `packaging/parch.desktop` conforms strictly to Freedesktop Desktop Entry Specification:
    - `Exec=parch %F` enables seamless "Open With Parch" from file managers (GNOME Files / Nautilus, Dolphin, Thunar).
    - `MimeType=text/markdown;text/x-markdown;text/plain;` registered.
    - Validated cleanly via `desktop-file-validate packaging/parch.desktop` (0 warnings).
  - `packaging/parch-mime.xml` associates `*.md`, `*.markdown`, `*.mdown`, and `*.mkd` glob patterns with `text/markdown` via XDG `shared-mime-info`.
  - Scalable vector icon `packaging/icons/parch.svg` placed in `hicolor/scalable/apps/`.

- [x] **Multi-Distribution Packaging & Automation Deliverables**:
  - `scripts/package-release.sh` (`chmod +x`):
    - Automatically builds frontend (`npm run build`) and release binary (`cargo build --release`).
    - Produces Debian/Ubuntu `.deb` package (`release-dist/parch_${VERSION}_amd64.deb`) using `dpkg-deb --build --root-owner-group` with full `DEBIAN/control`, `postinst`, and `postrm` maintenance scripts.
    - Produces Universal Linux Tarball (`release-dist/parch-v${VERSION}-linux-x86_64.tar.gz`) containing root binary, packaging metadata, icons, and desktop installers.
    - Builds `.rpm` package via `alien` or `rpmbuild` when available.
    - Generates cryptographic checksum manifest `release-dist/SHA256SUMS`.
  - `packaging/arch/PKGBUILD`:
    - Full Arch Linux / Manjaro package specification (`parch-bin`) supporting standard `makepkg -si`.
  - `scripts/package-macos.sh` & macOS support:
    - Packages `Parch.app` bundle with `Contents/Info.plist` registering `.md` / `.markdown` document types for Finder "Open With" integration.
    - Builds `Parch-v${VERSION}-macos-arm64.zip` and standalone CLI archive `parch-v${VERSION}-macos-arm64.tar.gz`.

- [x] **Universal One-Line Installer (`scripts/get-parch.sh`)**:
  - Robust one-line installer (`curl -fsSL https://raw.githubusercontent.com/oyvinvo/parch/main/scripts/get-parch.sh | bash`):
    - Automatically detects OS (`Linux` vs `Darwin`) and Architecture (`x86_64` vs `arm64`).
    - On Linux: downloads release tarball, extracts, and runs user-level `./scripts/install-desktop.sh`.
    - On macOS: downloads `Parch.app` zip, extracts to `/Applications` (or `~/Applications`), and symlinks CLI to `/usr/local/bin/parch` (or `~/.local/bin/parch`).

- [x] **CI/CD & GitHub Actions Release Pipeline**:
  - `.github/workflows/ci.yml`:
    - Executes Node.js tests, ESLint, CRAP metric verification, and Stryker mutation tests.
    - Builds frontend `dist/` **before** compiling Rust backend, guaranteeing `src-tauri/build.rs` embeds web assets into the standalone binary.
    - Executes `cargo test` and `cargo clippy -- -D warnings`.
  - `.github/workflows/release.yml`:
    - Integrated with `release-please` for SemVer version bumps and changelog updates.
    - Dedicated `build-linux-assets` job (Ubuntu) creating `.deb`, `.tar.gz`, `.rpm`, and `SHA256SUMS`.
    - Dedicated `build-macos-assets` job (macOS) compiling and packaging `Parch.app` (.zip) and CLI (.tar.gz).
    - Publishes all assets to GitHub Releases via `softprops/action-gh-release@v2`.
    - No proprietary or hardcoded GitHub App ID dependencies; seamlessly falls back to `secrets.GITHUB_TOKEN`.
  - `.github/workflows/plantuml-wiki.yml`:
    - Automatically compiles C4 diagrams from `doc/*.puml` to high-resolution PNGs on GitHub Wiki.

- [x] **Installation Lifecycle & Documentation**:
  - Updated `README.md` with explicit Installation section covering the One-Line installer, Debian/Ubuntu `.deb`, Arch Linux `makepkg`, and source builds.
  - `scripts/install-desktop.sh` updated to support both git repository checkouts and extracted release tarball directories.

---

## 5. Findings & Remediation Action Items

| ID | Severity (`BLOCKING` / `ADVISORY`) | File & Line | Guideline / Rule | Finding & Remediation Instruction |
| :--- | :--- | :--- | :--- | :--- |
| `F-01` | `NONE` | `-` | Operations Guidelines | All packaging, one-line installer, CI/CD, and multi-OS release pipelines verified. Zero blocking defects. |

---

## Subagent Return Summary Card (Copy to Final Response)

```text
STATUS: PASS
AUDIT FILE: specs/001-parchment-markdown-viewer/checklists/operations-verification.md
KEY METRIC: Desktop Packaging: PASS | CI/CD: PASS | Multi-OS Release: Linux (.deb, .tar.gz, .rpm, Arch PKGBUILD) & macOS (Parch.app)
ACTION ITEMS: None
```
