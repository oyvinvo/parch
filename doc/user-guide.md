# User Guide: Parch Markdown Viewer

**Target Audience**: Linux Desktop Users, Technical Writers, Developers, Researchers, and Curators  
**Version**: 0.1.0  
**Last Updated**: 2026-10-28  

---

## 1. Overview & Purpose

**Parch** is a crisp, literary, distraction-free desktop Markdown viewer engineered specifically for Linux desktop environments (GNOME / Ubuntu, KDE Plasma, XFCE, and XDG-compliant distros). Built with Rust, Tauri v2, and TypeScript, Parch replaces bulky editors and noisy browser tabs with an elegant, instant-launch reading surface designed around typography, reading ergonomics, and privacy.

### Key Capabilities
- **Native Linux Desktop Integration**: Seamlessly launch files from GNOME Files (Nautilus) right-click "Open With" context menus, file manager associations, or direct terminal invocation (`parch <path>`).
- **Complete GitHub-Flavored Markdown (GFM)**: High-contrast tables, interactive task lists, syntax-highlighted code blocks with 1-click clipboard copy, and GitHub-style callouts (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`).
- **Client-Side Diagrams & Mathematical Typesetting**: Embedded Mermaid diagrams (`flowchart`, `sequenceDiagram`, `stateDiagram`) rendered into theme-aware SVGs and KaTeX LaTeX formulas (inline `$E=mc^2$` and centered display blocks `$$...$$`).
- **Reading Ergonomics & Navigation**: Auto-generated collapsible Table of Contents (TOC) with scroll-spy active heading tracking, alongside instant in-document text search (`Ctrl+F`).
- **Live Inotify Auto-Reload**: Watches open Markdown files on disk; when external editors or git branches modify the document, Parch updates the DOM in $< 200\text{ ms}$ while preserving your exact reading scroll ratio.
- **Strict Privacy & Sandboxing**: Dual-layer HTML sanitization (`ammonia` + `DOMPurify`) with outbound network calls blocked via Content Security Policy (`connect-src 'none'`), protecting your system from malicious or untrusted files.

---

## 2. Prerequisites & Access

### System Requirements
- **Operating System**: Linux (Ubuntu 22.04/24.04+, Debian 12+, Fedora 39+, Arch Linux, or any Freedesktop/XDG-compliant desktop environment).
- **Display Server**: Wayland or X11.
- **Runtime Libraries**: Standard WebKitGTK and GTK 3 libraries (`libwebkit2gtk-4.1-0` and `libgtk-3-0`), pre-installed on most modern Linux distributions.

### Access & Installation
Parch provides automated desktop integration scripts to configure your local user environment (`~/.local/`) without requiring root/sudo privileges:

```bash
# Clone or navigate to the Parch repository
cd /home/oyvind/code/personal/parch

# Run the user-level desktop installer
./scripts/install-desktop.sh
```

The installation script:
1. Installs the `parch` executable launcher into `~/.local/bin/`.
2. Registers the XDG desktop entry `parch.desktop` in `~/.local/share/applications/`.
3. Registers the shared MIME types (`text/markdown`, `text/x-markdown`) in `~/.local/share/mime/packages/parch-mime.xml`.
4. Installs the high-resolution scalable vector icon in `~/.local/share/icons/hicolor/scalable/apps/parch.svg`.
5. Updates the desktop and MIME databases (`update-desktop-database`, `update-mime-database`, `xdg-mime`).

To remove desktop integration at any time:
```bash
./scripts/uninstall-desktop.sh
```

---

## 3. Step-by-Step User Workflows

### 3.1 Opening Documents from GNOME Files (Nautilus)
1. Open your graphical file manager (GNOME Files / Nautilus, Dolphin, or Thunar).
2. Navigate to any folder containing Markdown files (`.md`, `.markdown`, `.mkd`).
3. Right-click the file and select **Open With...**.
4. Choose **Parch** from the application list (or double-click if Parch is set as default).
5. *Expected Result*: Parch opens instantly in a distraction-free window displaying the document title in the header, an outline in the sidebar, and rendered Markdown on the reading canvas.

### 3.2 Launching from the Terminal (CLI)
You can launch Parch directly from your shell or scripts:

```bash
# Open a specific Markdown file
parch /path/to/documentation.md

# Open with an initial theme override
parch --theme sepia notes/architecture.md

# Open the showcase welcome document
parch examples/welcome.md

# Open without arguments to enter the Empty State
parch
```

### 3.3 Running in Local Development Mode
Developers can launch the interactive development environment with live hot-reloading:

```bash
# 1. Install frontend dependencies
npm install

# 2. Run the Vite local dev server
npm run dev

# 3. Or run the full desktop application
npm run dev
```

### 3.4 Navigating with the Collapsible Table of Contents (TOC)
1. When viewing a document, Parch automatically inspects all headings (`#` through `######`) and generates a structured hierarchy in the left sidebar.
2. Click any heading in the TOC to smoothly scroll directly to that section.
3. As you read or scroll through the document, the TOC sidebar automatically highlights your current active section (scroll-spy tracking).
4. To collapse or expand the TOC sidebar to maximize reading area, click the **TOC** button in the top toolbar or press <kbd>Ctrl</kbd>+<kbd>\</kbd>.

### 3.5 Finding Text in the Document (`Ctrl+F`)
1. Press <kbd>Ctrl</kbd>+<kbd>F</kbd> or click the **Search** button in the top toolbar.
2. A floating search bar appears in the upper right. Type your search term.
3. Matching terms across the document are instantly highlighted with distinct yellow markers.
4. The search bar displays the match counter (e.g. `1 of 14 matches`).
5. Press <kbd>Enter</kbd> (or click **▼**) to jump to the next match.
6. Press <kbd>Shift</kbd>+<kbd>Enter</kbd> (or click **▲**) to jump to the previous match.
7. Press <kbd>Esc</kbd> (or click **✕**) to dismiss search and clear highlights. Focus returns to the search button.

### 3.6 Switching Themes (<kbd>F10</kbd>)
Parch includes four carefully crafted, WCAG 2.1/2.2 AA compliant color palettes:
- **System** (Default): Automatically tracks your desktop environment's dark/light appearance setting via `prefers-color-scheme`.
- **Light**: High-contrast, clean white surface with deep charcoal typography.
- **Dark**: Subdued slate canvas with soft off-white typography for low-light environments.
- **Sepia**: Warm, literary amber paper background with dark brown ink designed for extended reading comfort.

To change themes:
1. Press <kbd>F10</kbd> or click the **Theme** button in the top toolbar.
2. The canvas immediately updates and your preference is persisted to `~/.config/parch/config.json`.

### 3.7 Working with Live Auto-Reload
Parch acts as a live companion to your favorite text editor:
1. Open a Markdown file in Parch (`parch draft.md`).
2. Open `draft.md` in Vim, Neovim, Emacs, VS Code, or Helix.
3. Save changes in your editor or switch git branches.
4. Parch automatically re-reads the file from disk via `inotify` within 150ms.
5. The view updates smoothly **without resetting your scroll position**, allowing you to stay focused on the paragraph you are reading.
6. If the file is renamed or temporarily deleted, Parch displays a gentle non-destructive banner (`"File was moved or deleted from disk. Keeping current buffer."`) without closing your document.

---

## 4. Key UI Elements & Keyboard Shortcut Glossary

### Toolbar Controls

| Control | Icon / Label | Keyboard Shortcut | Function |
| :--- | :--- | :--- | :--- |
| **Open File** | Folder icon (`Open`) | <kbd>Ctrl</kbd>+<kbd>O</kbd> | Opens the native Linux file dialog to select a Markdown document. |
| **Toggle TOC** | Sidebar icon (`TOC`) | <kbd>Ctrl</kbd>+<kbd>\</kbd> | Expands or collapses the Table of Contents navigation sidebar. |
| **Search** | Magnifier icon (`Search`) | <kbd>Ctrl</kbd>+<kbd>F</kbd> | Opens the in-document search bar and focuses input. |
| **Cycle Theme** | Sun/Moon icon (`Theme: ...`) | <kbd>F10</kbd> | Cycles through `System` ➔ `Light` ➔ `Dark` ➔ `Sepia`. |
| **Close Search** | `✕` button | <kbd>Esc</kbd> | Dismisses the search bar and clears all DOM highlights. |
| **Next Match** | `▼` button | <kbd>Enter</kbd> | Jumps to the next search match in the document. |
| **Previous Match**| `▲` button | <kbd>Shift</kbd>+<kbd>Enter</kbd> | Jumps to the previous search match in the document. |
| **Copy Code** | Top-right code button | Click / <kbd>Tab</kbd>+<kbd>Enter</kbd> | Copies fenced code block to clipboard with "Copied! ✓" feedback. |

### Supported Markdown Syntax Highlights

| Syntax | Example / Notation | Rendered Behavior |
| :--- | :--- | :--- |
| **Alert Callouts** | `> [!NOTE]`<br>`> [!TIP]`<br>`> [!IMPORTANT]`<br>`> [!WARNING]`<br>`> [!CAUTION]` | Formatted as distinct colored callout blocks with corresponding iconography and title badges. |
| **GFM Tables** | `\| Heading 1 \| Heading 2 \|` | High-contrast tables with borders, padding, and alternating row zebra striping. |
| **Task Lists** | `- [x] Done`<br>`- [ ] Todo` | Formatted interactive-style checkboxes with strikethrough for completed items. |
| **Mermaid Diagrams**| ```` ```mermaid ```` | Fenced diagrams dynamically rendered into interactive theme-aware SVGs. |
| **KaTeX Math** | `$E = mc^2$`<br>`$$\frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$` | Typeset inline formulas and centered mathematical equations. |
| **Relative Images** | `![Diagram](./images/arch.png)` | Scoped local asset resolution relative to the active document directory. |

---

## 5. Frequently Asked Questions & Troubleshooting

### Q: Why didn't Parch appear in GNOME Files' "Open With" menu?
**A**: Ensure you have executed `./scripts/install-desktop.sh`. This script registers `parch.desktop` and updates the XDG desktop database. If you recently installed, you can restart Nautilus using `nautilus -q`.

### Q: Does Parch support editing Markdown files?
**A**: Parch is strictly an ultra-fast, distraction-free **reader and viewer**. It is designed to work side-by-side with your preferred text editor (Vim, VS Code, Helix, etc.) via its live auto-reload engine.

### Q: How does Parch protect against malicious Markdown files?
**A**: Parch employs dual-layer defense-in-depth sanitization:
1. Rust backend sanitizes Markdown output with `ammonia` using a strict HTML tag and attribute allowlist.
2. Frontend applies `DOMPurify` before inserting content into the DOM.
3. Content Security Policy (`connect-src 'none'`) blocks all outgoing network traffic, preventing any data exfiltration.
4. Asset path resolution rejects directory traversal attempts (`../../../../etc/shadow`).

### Q: What happens if a Mermaid diagram or KaTeX formula has invalid syntax?
**A**: Parch isolates diagrams and formulas inside dedicated error boundaries. An invalid diagram displays a clean warning box (`[Mermaid Diagram Error: Unable to render syntax]`) with an expandable raw snippet toggle. The rest of the document continues to render normally.

### Q: Where are user settings saved?
**A**: In accordance with the XDG Base Directory specification, user configuration is saved to `~/.config/parch/config.json`.
