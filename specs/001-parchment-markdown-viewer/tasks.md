# Tasks Breakdown: 001-parchment-markdown-viewer — Parchment Markdown Viewer

- **Feature ID**: `001-parchment-markdown-viewer`
- **Status**: ACCEPTED
- **Specification**: [`specs/001-parchment-markdown-viewer/spec.md`](spec.md)
- **Technical Plan**: [`specs/001-parchment-markdown-viewer/plan.md`](plan.md)
- **ADR References**:
  - [`doc/adr/0001-tauri-rust-typescript-architecture.md`](../../doc/adr/0001-tauri-rust-typescript-architecture.md)
  - [`doc/adr/0002-markdown-rendering-and-xss-sanitization-pipeline.md`](../../doc/adr/0002-markdown-rendering-and-xss-sanitization-pipeline.md)
  - [`doc/adr/0003-linux-xdg-desktop-and-file-watcher-integration.md`](../../doc/adr/0003-linux-xdg-desktop-and-file-watcher-integration.md)

---

## Phase 1 & 1.5: Specification, Architecture & Sign-Off

- [x] **Task 0.1**: Author functional specification with 7 vertical slices and acceptance criteria in `specs/001-parchment-markdown-viewer/spec.md` (`domain-expert`).
- [x] **Task 0.2**: Author C4 architecture diagrams (`doc/context.puml`, `doc/container.puml`, `doc/component.puml`), ADRs (`doc/adr/0001..0003`), and technical plan in `specs/001-parchment-markdown-viewer/plan.md` (`architect`).
- [x] **Task 0.3**: 🛑 Obtain **Human Approval Gate** sign-off via Team Orchestrator and transition ADRs and plan status to `ACCEPTED`.
- [x] **Task 0.4**: Generate sequential implementation tasks in `specs/001-parchment-markdown-viewer/tasks.md` and initial quality checklists in `specs/001-parchment-markdown-viewer/checklists/` (`tester`).

---

## Phase 2: TDD Test Suite & Implementation (Sequential Small Batches)

> [!IMPORTANT]
> Execute tasks sequentially in small vertical slices using strict **Red ➔ Green ➔ Refactor** TDD:
> 1. Write failing unit/integration tests derived from `spec.md` acceptance criteria (`tester`).
> 2. Implement minimal clean domain code & adapters adhering to package-by-feature layout (`coder`).
> 3. Run mutation testing (`cargo-mutants` / `@stryker-mutator/core`, target **≥ 80%**) and verify hybrid CRAP limits (**$\text{CRAP} \le 8$** new functions, $CC \le 7$; never hand-estimated) (`tester` & `coder`).

### Batch 1: Slice 1 — Document Loading, CLI & Linux Desktop Integration (Scenarios 1.1, 1.2, 1.3)
- [x] **Task 1.1 (TDD RED - Rust Backend)**: Write failing unit and integration tests for CLI argument parsing (`src-tauri/src/cli/cli_argument_parser.rs`), document models, and file reader (`src-tauri/src/document/fs_document_reader.rs`) covering CLI flags (`[FILE]`, `--theme`, `--help`, `--version`), exit codes (0, 1, 2, 3), canonical path resolution, regular file verification, and 10 MiB limit (`tester`).
- [x] **Task 1.2 (TDD GREEN - Rust Backend)**: Implement `CliArgumentParser`, `FsDocumentReader`, `DocumentService`, and the `open_document` Tauri IPC command in `src-tauri/src/cli/` and `src-tauri/src/document/` (`coder`).
- [x] **Task 1.3 (Desktop Integration Artifacts)**: Create XDG desktop entry `packaging/parchment.desktop`, MIME registration `packaging/parchment-mime.xml`, application icon `packaging/icons/parchment.svg`, and shell scripts `scripts/install-desktop.sh` and `scripts/uninstall-desktop.sh` (`coder`).
- [x] **Task 1.4 (TDD RED - TypeScript Frontend)**: Write failing unit and component tests for `TauriIpcAdapter` and `DocumentSessionManager` (`src/document/document-session-manager.test.ts`) covering initial document loading, window title formatting (`readme.md - Parchment`), Empty State view (`Ctrl+O`), and native file picker triggering (`tester`).
- [x] **Task 1.5 (TDD GREEN - TypeScript Frontend)**: Implement `DocumentSessionManager`, `TauriIpcAdapter`, and minimal viewer shell HTML/DOM bindings in `src/document/` and `src/main.ts` (`coder`).
- [x] **Task 1.6 (TDD REFACTOR & Quality Gate)**: Run `cargo test` and `vitest run`, execute mutation tests, verify $\text{CRAP} \le 8$ ($CC \le 7$), enforce newspaper code structure, and verify zero commented-out code (`tester` & `coder`).

### Batch 2: Slice 2 — GitHub-Flavored Markdown (GFM) Rendering & Asset Resolution (Scenarios 2.1, 2.2, 2.3, 2.4)
- [x] **Task 2.1 (TDD RED - GFM & Alert Compiler)**: Write failing unit tests for `MarkdownCompiler` (`src-tauri/src/document/markdown_compiler.rs`) verifying pulldown-cmark parsing of GFM tables, task lists (`- [ ]`, `- [x]`), strikethrough, and GitHub alert callouts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`) into semantic `<aside class="markdown-alert ...">` blocks (`tester`).
- [x] **Task 2.2 (TDD GREEN - GFM & Alert Compiler)**: Implement `MarkdownCompiler` in `src-tauri/src/document/markdown_compiler.rs` with full GFM extensions and alert callout extraction (`coder`).
- [x] **Task 2.3 (TDD RED - Asset Path Resolver)**: Write failing unit tests for `AssetPathResolver` (`src-tauri/src/document/asset_path_resolver.rs`) testing relative image resolution against document parent directory, scoped `asset://` URI generation, broken image handling, and path traversal rejection (`tester`).
- [x] **Task 2.4 (TDD GREEN - Asset Path Resolver & IPC)**: Implement `AssetPathResolver` and `resolve_asset_path` Tauri command in `src-tauri/src/document/` (`coder`).
- [x] **Task 2.5 (TDD RED - Code Copy & Alert Builder Frontend)**: Write failing unit tests for `AlertCalloutBuilder` (`src/document/alert-callout-builder.test.ts`) and `CodeBlockManager` (`src/document/code-block-manager.test.ts`) covering accessible alert badges/icons, syntax highlighting initialization, hover "Copy" button, clipboard copy, and "Copied! ✓" 2,000ms feedback (`tester`).
- [x] **Task 2.6 (TDD GREEN - Code Copy & Alert Builder Frontend)**: Implement `AlertCalloutBuilder`, `CodeBlockManager`, and GFM styles (tables, zebra striping, blockquotes) in `src/document/` and `src/styles/parchment.css` (`coder`).
- [x] **Task 2.7 (TDD REFACTOR & Quality Gate)**: Verify all GFM test suites pass, run mutation verification ($\ge 80\%$), check CRAP scores ($\le 8$), and confirm zero lint warnings (`tester` & `coder`).

### Batch 3: Slice 3 — Theme Management & System Color-Scheme Sync (Scenarios 3.1, 3.2)
- [x] **Task 3.1 (TDD RED - Preferences & XDG Store)**: Write failing unit tests for `PreferencesService` and `XdgConfigStoreAdapter` (`src-tauri/src/preferences/preferences_service.rs`) testing persistence to `$XDG_CONFIG_HOME/parchment/config.json`, schema defaults, and IPC commands `get_user_preferences` and `set_user_preference` (`tester`).
- [x] **Task 3.2 (TDD GREEN - Preferences & XDG Store)**: Implement `UserPreferences`, `XdgConfigStoreAdapter`, and `PreferencesService` in `src-tauri/src/preferences/` (`coder`).
- [x] **Task 3.3 (TDD RED - Frontend Theme Engine)**: Write failing unit tests for `ThemeResolver` (`src/theme/theme-resolver.test.ts`) and `ThemeManager` (`src/theme/theme-manager.test.ts`) testing pure mapping of `ThemeMode` + OS dark state to `ResolvedTheme` (`System`, `Light`, `Dark`, `Sepia`), `matchMedia` listener, `system-theme-changed` IPC listener, `F10` keyboard shortcut, and DOM `data-theme` attribute updating (`tester`).
- [x] **Task 3.4 (TDD GREEN - Frontend Theme Engine & CSS Palettes)**: Implement `ThemeResolver`, `ThemeManager`, and CSS theme tokens in `src/theme/` and `src/styles/parchment.css` with verified $\ge 4.5:1$ WCAG AA contrast across all four themes (`coder`).
- [x] **Task 3.5 (TDD REFACTOR & Quality Gate)**: Verify theme test suites pass, validate mutation score $\ge 80\%$, check CRAP $\le 8$, and verify no CSS regressions (`tester` & `coder`).

### Batch 4: Slice 4 — Navigation, Collapsible TOC & In-Document Search (Scenarios 4.1, 4.2, 4.3)
- [x] **Task 4.1 (TDD RED - Outline Generator)**: Write failing unit tests for heading outline extraction in `MarkdownCompiler` (`src-tauri/src/document/markdown_compiler.rs`) verifying hierarchical `Vec<TocItem>` nesting (`h1`..`h6`) and deterministic slug disambiguation for identical headings (`id`, `id-1`, `id-2`) (`tester`).
- [x] **Task 4.2 (TDD GREEN - Outline Generator)**: Implement heading extraction and slug disambiguation in `src-tauri/src/document/markdown_compiler.rs` (`coder`).
- [x] **Task 4.3 (TDD RED - Scroll-Spy & TOC Manager)**: Write failing unit tests for `ScrollSpyCalculator` (`src/toc/scroll-spy-calculator.test.ts`) and `TocNavigationManager` (`src/toc/toc-navigation-manager.test.ts`) testing active heading detection from scroll offsets, collapsible sidebar toggle (`Ctrl+\`), smooth scrolling on heading click, and TOC auto-scrolling (`tester`).
- [x] **Task 4.4 (TDD GREEN - Scroll-Spy & TOC Manager)**: Implement `ScrollSpyCalculator` and `TocNavigationManager` in `src/toc/` (`coder`).
- [x] **Task 4.5 (TDD RED - In-Document Search Engine)**: Write failing unit tests for `TextMatchCalculator` (`src/search/text-match-calculator.test.ts`) and `SearchSessionManager` (`src/search/search-session-manager.test.ts`) testing case-insensitive substring matching, match navigation cycling (Next/Prev via Enter/Shift+Enter), DOM `<mark>` highlighting, `aria-live` match counter (`1 of 14` / `0 matches`), and `Esc` dismissal (`tester`).
- [x] **Task 4.6 (TDD GREEN - In-Document Search Engine)**: Implement `TextMatchCalculator` and `SearchSessionManager` in `src/search/` (`coder`).
- [x] **Task 4.7 (TDD REFACTOR & Quality Gate)**: Verify TOC and search suites pass, confirm search latency $< 50\text{ ms}$, ensure mutation score $\ge 80\%$, and verify $\text{CRAP} \le 8$ (`tester` & `coder`).

### Batch 5: Slice 5 — Client-Side Mermaid Diagrams & LaTeX Math (KaTeX) (Scenarios 5.1, 5.2, 5.3)
- [x] **Task 5.1 (TDD RED - Mermaid Diagram Service)**: Write failing unit tests for `MermaidAdapter` and `DiagramRenderService` (`src/diagram/diagram-render-service.test.ts`) testing conversion of `mermaid` code fences to inline SVGs matching active theme palettes, along with isolated error boundaries rendering `[Mermaid Diagram Error: Unable to render syntax]` with expandable `<details>` raw snippet disclosures (`tester`).
- [x] **Task 5.2 (TDD GREEN - Mermaid Diagram Service)**: Implement `MermaidAdapter` and `DiagramRenderService` in `src/diagram/` (`coder`).
- [x] **Task 5.3 (TDD RED - KaTeX Math Service)**: Write failing unit tests for `KatexAdapter` and `MathRenderService` (`src/diagram/math-render-service.test.ts`) testing inline math (`$...$`) and display block math (`$$...$$`), non-crashing inline red fallback on invalid syntax (`throwOnError: false`), and theme integration (`tester`).
- [x] **Task 5.4 (TDD GREEN - KaTeX Math Service)**: Implement `KatexAdapter` and `MathRenderService` in `src/diagram/` (`coder`).
- [x] **Task 5.5 (TDD REFACTOR & Quality Gate)**: Verify diagram and math test suites pass, confirm mutation score $\ge 80\%$, ensure error boundary isolation prevents application crashes, and verify $\text{CRAP} \le 8$ (`tester` & `coder`).

### Batch 6: Slice 6 — Live Auto-Reload & Disk Synchronization (Scenarios 6.1, 6.2)
- [x] **Task 6.1 (TDD RED - File Watcher Backend)**: Write failing unit and integration tests for `NotifyWatcherAdapter` and `FileWatcherService` (`src-tauri/src/watcher/file_watcher_service.rs`) testing parent directory monitoring, target file filtering, 150ms debounce window coalescing, event emissions (`document-file-changed`, `document-file-deleted`), and automatic re-watching upon file recreation (`tester`).
- [x] **Task 6.2 (TDD GREEN - File Watcher Backend)**: Implement `NotifyWatcherAdapter` and `FileWatcherService` in `src-tauri/src/watcher/` using the `notify` crate (`coder`).
- [x] **Task 6.3 (TDD RED - Live Reload Frontend Sync)**: Write failing unit tests for `DocumentSessionManager` (`src/document/document-session-manager.test.ts`) live-reload handlers testing exact scroll ratio preservation (`scrollTop / scrollHeight`) across document reloads, heading anchor preservation, and gentle non-destructive warning banner display when a file is moved/deleted (`tester`).
- [x] **Task 6.4 (TDD GREEN - Live Reload Frontend Sync)**: Implement live reload event listeners and DOM patching with scroll position restoration in `src/document/document-session-manager.ts` (`coder`).
- [x] **Task 6.5 (TDD REFACTOR & Quality Gate)**: Run end-to-end reload simulation tests, verify reload latency $< 200\text{ ms}$, ensure mutation score $\ge 80\%$, and verify $\text{CRAP} \le 8$ (`tester` & `coder`).

### Batch 7: Slice 7 — Security Hardening, Error Handling & Edge Cases (Scenarios 7.1, 7.2, 7.3, 7.4)
- [x] **Task 7.1 (TDD RED - Dual-Layer Sanitization & Sandboxing)**: Write failing unit tests for Rust `HtmlSanitizer` (`src-tauri/src/document/html_sanitizer.rs`), frontend `HtmlSanitizerAdapter` (`src/document/html-sanitizer-adapter.test.ts`), and `AssetPathResolver` testing stripping of `<script>`, `<iframe>`, `<object>`, `onerror`, `javascript:` schemes, directory traversal rejection (`../../../../etc/shadow`), 8 KiB null byte / binary detection (`BINARY_FILE_DETECTED`), and missing file handling (`FILE_NOT_FOUND`) (`tester`).
- [x] **Task 7.2 (TDD GREEN - Dual-Layer Sanitization & Sandboxing)**: Implement `HtmlSanitizer` (ammonia allowlist) in `src-tauri/src/document/html_sanitizer.rs`, `HtmlSanitizerAdapter` (DOMPurify defense-in-depth) in `src/document/html-sanitizer-adapter.ts`, binary detection in `FsDocumentReader`, and strict Tauri CSP in `src-tauri/tauri.conf.json` (`coder`).
- [x] **Task 7.3 (TDD GREEN - Error Views & User Recovery)**: Implement user-facing error views in `src/document/document-session-manager.ts` for missing files (`FILE_NOT_FOUND`) with "Open Another File" button and binary file detection (`BINARY_FILE_DETECTED`) (`coder`).
- [x] **Task 7.4 (TDD REFACTOR & Quality Gate)**: Verify 100% mutation kill rate on security sanitizers and asset path resolvers, verify $\text{CRAP} \le 8$, and confirm zero OWASP vulnerabilities (`tester` & `coder`).

---

## Phase 3: Parallel Triple Quality Audit Gate

- [x] **Task 3.1**: Code Quality, Architecture & Hybrid CRAP Audit (`reviewer`) ➔ `specs/001-parchment-markdown-viewer/checklists/reviewer-audit.md`.
- [x] **Task 3.2**: OWASP Top 10, Secrets & Dependency CVE Audit (`security-expert`) ➔ `specs/001-parchment-markdown-viewer/checklists/security-audit.md`.
- [x] **Task 3.3**: WCAG 2.1/2.2 AA & Reading Ergonomics UX Audit (`ux-expert`) ➔ `specs/001-parchment-markdown-viewer/checklists/ux-audit.md`.

---

## Phase 4: Operations & Release Readiness

- [x] **Task 4.1**: Verify desktop integration packaging, install scripts, CI/CD workflows, PlantUML rendering, and release manifest (`operations`) ➔ `specs/001-parchment-markdown-viewer/checklists/operations-verification.md`.
- [x] **Task 4.2**: Validate running system against `spec.md` acceptance criteria and author `doc/user-guide.md` (`domain-expert`).

---

## Phase 5: Track B (Fast-Track) Bug Fixes & Refinements

- [x] **Task 5.1 (GNOME Dark Mode & System Theme)**: GTK3 dark theme detection in `native_window_launcher.rs`, `detect_system_dark_mode()` in `embedded_server.rs`, `systemDark` in `InitialStateData` and initial state sync in `main.ts`.
- [x] **Task 5.2 (TOC Subheaders & Scrolling)**: Full heading hierarchy in `tauri-ipc-adapter.ts`, non-compounding CSS indentation and wrapping in `parchment.css`, click-to-scroll and scroll-spy in `main.ts` and `scroll-spy-calculator.ts`.
- [x] **Task 5.3 (HTTP Streaming & Desktop Integration)**: Full `Content-Length` body reading in `embedded_server.rs`, frontend build, and desktop integration install script verification.

---

## Phase 6: Project Rename to Parch & Asset Embedding

- [x] **Task 6.1 (Project Rename to Parch)**: Rename package name to `parch`, `parch-core` in `package.json` & `Cargo.toml`, update CLI help/env to `parch` / `PARCH_HEADLESS`, update XDG config to `parch/config.json`, rename desktop packaging to `parch.desktop`, `parch-mime.xml`, `parch.svg`.
- [x] **Task 6.2 (Asset Embedding in Binary)**: Implement `build.rs` code generator embedding `dist/` into `$OUT_DIR/embedded_assets.rs`, serve via `get_embedded_file` in `embedded_server.rs`, and update `install-desktop.sh` to install the standalone native binary.

---

## Phase 7: CLI Self-Updater, Toolbar Release Notification & Cross-Platform macOS Support

- [x] **Task 7.1 (CLI Self-Update & Argument Parsing)**: Add `CliAction::SelfUpdate`, `-u`/`--update` flags and documentation to `CliArgumentParser`, wire in `main.rs`, and add unit tests.
- [x] **Task 7.2 (Self-Update Service & SemVer Engine)**: Implement `SelfUpdateService` with `parse_latest_tag`, `is_newer_version`, target platform detection (`linux-x86_64`, `macos-arm64`, `macos-x86_64`), release extraction, and installation runner adhering to $CC \le 7$.
- [x] **Task 7.3 (Cross-Platform macOS Support)**: Add AppleInterfaceStyle dark mode detection, native macOS Finder `osascript` file selection dialog, Chrome/Brave/Edge `--app=` or fallback `open` window launcher in `embedded_server.rs` and `native_window_launcher.rs`.
- [x] **Task 7.4 (Toolbar Release Notification Pill & API)**: Add `/api/check-update` and `/api/trigger-update` endpoints in `embedded_server.rs`, update badge in `index.html`, `parchment.css`, `tauri-ipc-adapter.ts`, and `main.ts`.

---

## Subagent 4-Line Summary Card Contract

Every subagent completing a task batch or phase MUST return ONLY this 4-line summary card to the Team Orchestrator:

```text
STATUS: [PASS | FAIL | N/A]
ARTIFACT FILE: specs/001-parchment-markdown-viewer/tasks.md
KEY METRIC: [e.g. Tasks Completed: X/Y | Tests: PASS | Mutation: 85% | CRAP: max 5.1]
ACTION ITEMS: [None | Count and brief summary of blocking items]
```
