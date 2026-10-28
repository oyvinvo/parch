# Parch 📜

> A crisp, literary, distraction-free Markdown viewer for the Linux desktop.

[![CI](https://github.com/oyvinvo/parch/actions/workflows/ci.yml/badge.svg)](https://github.com/oyvinvo/parch/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![WCAG 2.1/2.2 AA](https://img.shields.io/badge/WCAG%20AA-Compliant-brightgreen)](specs/001-parchment-markdown-viewer/checklists/ux-audit.md)
[![Mutation Score](https://img.shields.io/badge/Mutation%20Score-89.5%25-brightgreen)](specs/001-parchment-markdown-viewer/checklists/reviewer-audit.md)
[![Max CRAP](https://img.shields.io/badge/Max%20CRAP-7.00%20(%E2%89%A4%208.0)-brightgreen)](specs/001-parchment-markdown-viewer/checklists/reviewer-audit.md)

**Parch** is a native Linux desktop application engineered in **Rust**, **Tauri v2**, and **TypeScript**. It offers an instant-launch, distraction-free reading experience for technical documentation, notes, literary manuscripts, architecture decision records (ADRs), and README files.

---

## ✨ Key Features

- **🚀 Sub-300ms Cold Startup**: Instantaneous native launch powered by Rust and system WebKitGTK.
- **🐧 Linux Desktop & XDG Integration**:
  - Fully integrated into GNOME Files (Nautilus), Dolphin, Thunar, and XDG application menus via `parch.desktop`.
  - Right-click any `.md` or `.markdown` file and select **Open With Parch**.
  - Direct command-line interface (`parch /path/to/file.md`) and empty state file picker (`Ctrl+O`).
- **📝 GitHub-Flavored Markdown (GFM)**:
  - Formatted tables with zebra striping and horizontal overflow containment.
  - Interactive-style task lists (`- [x]` / `- [ ]`).
  - GitHub-style callouts (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`) with dedicated icons and badges.
  - Syntax-highlighted code blocks with discreet hover/focus **Copy** button and 2-second confirmation.
  - Scoped local relative image resolution (`![Diagram](./images/arch.png)`).
- **📊 Mermaid Diagrams & LaTeX Math (KaTeX)**:
  - Client-side rendering of fenced `mermaid` blocks into responsive, theme-aware SVGs.
  - Inline mathematical notation (`$E=mc^2$`) and centered display blocks (`$$\int ...$$`) via KaTeX.
  - Non-crashing error boundaries with expandable raw snippets on syntax errors.
- **🎨 System Theme Sync & Manual Palettes**:
  - Automatically matches your desktop's dark/light preference (`prefers-color-scheme`).
  - Instant manual cycling (<kbd>F10</kbd>) between **System**, **Light**, **Dark**, and **Sepia**.
  - Persisted to `$XDG_CONFIG_HOME/parch/config.json`.
- **📑 Collapsible TOC & Scroll-Spy**:
  - Hierarchical Table of Contents automatically generated from headings (`h1`–`h6`).
  - Active section scroll-spy tracking with auto-scrolling sidebar.
  - Toggle sidebar with <kbd>Ctrl</kbd>+<kbd>\</kbd>.
- **🔍 In-Document Search (`Ctrl+F`)**:
  - Instant text matching with yellow highlights and live match counter (`1 of 14`).
  - Navigate forward with <kbd>Enter</kbd> / backward with <kbd>Shift</kbd>+<kbd>Enter</kbd>.
  - Dismiss cleanly with <kbd>Esc</kbd>.
- **🔄 Live Inotify Auto-Reload**:
  - File system watcher (`notify`) automatically detects external changes on disk within 150ms.
  - Updates the DOM while **preserving your exact reading scroll ratio**.
  - Gentle non-destructive warning banner if an active document is deleted or moved.
- **🛡️ Security & Privacy Sandboxing**:
  - Dual-layer sanitization: Rust backend (`ammonia` allowlist) + frontend (`DOMPurify`).
  - Strict Content Security Policy (`connect-src 'none'`) blocks all outgoing network requests.
  - Scoped asset protocol prevents directory traversal (`../../../../etc/shadow`).

---

## 🚀 Installation & Desktop Integration

### 1. One-Line Installer (Linux & macOS)
Install the latest release with full desktop integration via a single command:
```bash
curl -fsSL https://raw.githubusercontent.com/oyvinvo/parch/main/scripts/get-parch.sh | bash
```

### 2. Ubuntu / Debian / Mint / Pop!_OS (`.deb`)
Download the `.deb` package from [Releases](https://github.com/oyvinvo/parch/releases/latest) and install via `apt`:
```bash
sudo apt install ./parch_0.1.0_amd64.deb
```

### 3. Arch Linux / Manjaro (`PKGBUILD`)
Install from the included Arch packaging definition:
```bash
git clone https://github.com/oyvinvo/parch.git
cd parch/packaging/arch
makepkg -si
```

### 4. Build & Install from Source
```bash
git clone https://github.com/oyvinvo/parch.git
cd parch

# Install dependencies and compile
npm ci
npm run build
cargo build --release --manifest-path src-tauri/Cargo.toml

# Install user-local desktop integration
./scripts/install-desktop.sh
```

To remove desktop integration at any time:
```bash
./scripts/uninstall-desktop.sh
```

---

## 🏃 Launching Parch

### From GNOME Files (Nautilus), Dolphin & Thunar:
- Right-click any Markdown file (`.md`, `.markdown`, `.mkd`) ➔ select **Open With...** ➔ **Parch**.

### From the Command Line (CLI):
```bash
# Open a specific file
parch /path/to/notes.md

# Open with an initial theme override
parch --theme sepia docs/spec.md

# Open the showcase demo file
parch examples/welcome.md

# Open without arguments (Empty State)
parch
```

### In Development Mode:
```bash
# Install frontend dependencies
npm install

# Start Vite frontend dev server
npm run dev
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>O</kbd> | **Open File** | Triggers native Linux file chooser for Markdown files. |
| <kbd>Ctrl</kbd> + <kbd>\</kbd> | **Toggle TOC** | Expands or collapses the Table of Contents sidebar. |
| <kbd>Ctrl</kbd> + <kbd>F</kbd> | **Search** | Opens floating in-document search bar with autofocus. |
| <kbd>Enter</kbd> | **Next Match** | Jumps to the next search occurrence in the document. |
| <kbd>Shift</kbd> + <kbd>Enter</kbd> | **Previous Match** | Jumps to the previous search occurrence in the document. |
| <kbd>Esc</kbd> | **Close Search** | Closes search bar and removes highlights from the DOM. |
| <kbd>F10</kbd> | **Cycle Theme** | Cycles between System ➔ Light ➔ Dark ➔ Sepia. |

---

## 📖 Showcase Example Document

Parch includes a comprehensive test document demonstrating all features:
```bash
parch examples/welcome.md
```

This showcase document verifies:
1. GFM tables with zebra striping
2. Task lists with completed checkboxes
3. All five GitHub alert callouts (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`)
4. Rust and TypeScript syntax-highlighted code blocks with 1-click clipboard copy
5. Responsive Mermaid diagrams (`flowchart LR`)
6. Inline (`$E=mc^2$`) and centered block LaTeX formulas (`$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$`)
7. Inotify live auto-reload

---

## 🏛️ Architecture & Quality

Parch is engineered under **Spec-Driven Development**:
- **Specification**: [`specs/001-parchment-markdown-viewer/spec.md`](specs/001-parchment-markdown-viewer/spec.md)
- **Technical Plan & C4 Diagrams**: [`specs/001-parchment-markdown-viewer/plan.md`](specs/001-parchment-markdown-viewer/plan.md)
- **User Guide**: [`doc/user-guide.md`](doc/user-guide.md)
- **Architecture Decision Records (ADRs)**:
  - [ADR-0001: Tauri v2, Rust & TypeScript Architecture](doc/adr/0001-tauri-rust-typescript-architecture.md)
  - [ADR-0002: Markdown Rendering & XSS Sanitization Pipeline](doc/adr/0002-markdown-rendering-and-xss-sanitization-pipeline.md)
  - [ADR-0003: Linux XDG Desktop & File Watcher Integration](doc/adr/0003-linux-xdg-desktop-and-file-watcher-integration.md)

### Verification Metrics
- **Tests**: 79/79 passing (100% pass rate in Vitest & Cargo test suites).
- **Mutation Testing**: **89.51%** overall mutation score via Stryker (100% on core domain calculators).
- **Hybrid CRAP Metric**: Worst-case function CRAP = **7.00** (strict compliance with $\text{CRAP} \le 8$, Cyclomatic Complexity $CC \le 7$).
- **Accessibility**: 100% WCAG 2.1/2.2 AA compliant contrast (up to 17.35:1) and full keyboard operability.
- **Security**: 0 OWASP defects, 0 hardcoded secrets, 0 production CVEs, and strict `connect-src 'none'` CSP sandboxing.

---

## 📄 License

MIT © 2026 Parch Contributors
