# Quality & Audit Checklist: Code Review & Quality Gate (Reviewer)

```text
STATUS: PASS
AUDIT FILE: specs/001-parchment-markdown-viewer/checklists/reviewer-audit.md
KEY METRIC: Mutation Score: 89.51% | CRAP: max 7.00 | Tests: 71/71 pass | Lockfiles: synchronized
ACTION ITEMS: None (All quality gates passed)
```

- **Feature / Branch**: `001-parchment-markdown-viewer`
- **Track**: `Track A: Full 4-Phase SDD`
- **Auditor Subagent**: `reviewer`
- **Date**: `2026-10-28`
- **Canonical Output Path**: `specs/001-parchment-markdown-viewer/checklists/reviewer-audit.md`

---

## 1. Code Review & Quality Gate Checklist (`reviewer-audit.md`)

- [x] **Package by Domain / Feature**: Code is organized strictly by business domain in both backend (`src-tauri/src/{cli,document,watcher,preferences,viewer}/`) and frontend (`src/{document,toc,search,theme,diagram}/`), never generic technical layer buckets (`controllers/`, `services/`, `models/`, `repositories/`, `utils/`).
- [x] **Clean Architecture Pattern Nomenclature**: Components and modules follow standard suffixes (`CliArgumentParser`, `FsDocumentReader`, `MarkdownCompiler`, `HtmlSanitizer`, `AssetPathResolver`, `DocumentService`, `NotifyWatcherAdapter`, `FileWatcherService`, `XdgConfigStoreAdapter`, `PreferencesService`, `ViewerLauncher`, `NativeWindowLauncher`, `EmbeddedServer`, `TauriIpcAdapter`, `DocumentSessionManager`, `AlertCalloutBuilder`, `CodeBlockManager`, `TocNavigationManager`, `ScrollSpyCalculator`, `SearchSessionManager`, `TextMatchCalculator`, `ThemeManager`, `ThemeResolver`, `MermaidAdapter`, `DiagramRenderService`, `KatexAdapter`, `MathRenderService`).
- [x] **Technology over Vendor Abstraction**: Domain interfaces isolate external crates/libraries (`notify`, `ammonia`, `pulldown-cmark`, `@tauri-apps/api`, `mermaid`, `katex`, `DOMPurify`, WebKit2/Gtk/Zenity) behind minimal adapter, reader, and launcher interfaces for 100% testability.
- [x] **Newspaper Structure & Clean Code**: Public ingress methods at the top, private helpers below; single-responsibility functions; declarative service orchestration; small composable frontend UI modules.
- [x] **Zero Hygiene Defects**: Zero commented-out code, no unused imports or orphan variables, no raw `console.log` / `println!` in production code, specific error types (`DocumentError`, `PreferencesError`, `CliError`, `WatcherError`), and structured logging.
- [x] **Mutation Score Gate**: Measured tool score **89.51%** via `@stryker-mutator/core` (424 killed + 11 timed out out of 486 mutants; exceeds $\ge 80\%$ threshold; 100% on critical domain calculators: `TextMatchCalculator`, `ThemeResolver`, `ThemeManager`, `ScrollSpyCalculator`, `AlertCalloutBuilder`).
- [x] **Hybrid CRAP Score Gate**:
  - Measured via concrete static analysis + coverage tools: ESLint rule `complexity: ['error', 7]` with 0 violations + Vitest line coverage $\ge 97.9\%$ across all tested domain files.
  - Measured worst-case CRAP score = **7.00** ($\le 8.0$ requirement met).
- [x] **Dependency Lockfile Integrity**:
  - `package.json` has synchronized `package-lock.json` (present and tracked).
  - `src-tauri/Cargo.toml` has synchronized `src-tauri/Cargo.lock` (present, generated, and tracked via `.gitignore` exception `!src-tauri/Cargo.lock`).

---

## 2. Test Suite & Mutation Testing Verification

- **Vitest Unit/Component Tests**: 12 test files, 71 passed, 0 failed (100% pass rate).
- **Stryker Mutation Results**:
  - Total Mutants: 486
  - Killed: 424
  - Timeout: 11
  - Survived: 44
  - No Coverage: 7
  - Overall Mutation Score: **89.51%** (Threshold: $\ge 80\%$)
  - Core Calculators / Domain Invariants Mutation Score:
    - `src/search/text-match-calculator.ts`: **100.00%**
    - `src/theme/theme-resolver.ts`: **100.00%**
    - `src/theme/theme-manager.ts`: **100.00%**
    - `src/toc/scroll-spy-calculator.ts`: **100.00%**
    - `src/document/alert-callout-builder.ts`: **100.00%**
    - `src/toc/toc-navigation-manager.ts`: **97.44%**
    - `src/document/document-session-manager.ts`: **96.00%**
    - `src/diagram/diagram-render-service.ts`: **87.88%**
    - `src/document/code-block-manager.ts`: **81.08%**

---

## 3. Hybrid CRAP Score Verification

- **Formula**: $\text{CRAP}(m) = CC(m)^2 \times (1 - cov(m))^3 + CC(m)$
- **Enforcement Tooling**:
  - ESLint `complexity: ['error', 7]` in `eslint.config.js` restricts all functions to $CC \le 7$.
  - Vitest coverage via `vitest run --coverage` provides per-file statement/line coverage.
  - CRAP calculated via `scripts/check-crap.mjs`.
- **Results**:
  - `diagram-models.ts`: Line Coverage 100%, Worst-case CRAP 7.00
  - `diagram-render-service.ts`: Line Coverage 100%, Worst-case CRAP 7.00
  - `math-render-service.ts`: Line Coverage 100%, Worst-case CRAP 7.00
  - `alert-callout-builder.ts`: Line Coverage 100%, Worst-case CRAP 7.00
  - `code-block-manager.ts`: Line Coverage 97.91%, Worst-case CRAP 7.00
  - `document-models.ts`: Line Coverage 100%, Worst-case CRAP 7.00
  - `document-session-manager.ts`: Line Coverage 100%, Worst-case CRAP 7.00
  - `search-models.ts`: Line Coverage 100%, Worst-case CRAP 7.00
  - `search-session-manager.ts`: Line Coverage 98.56%, Worst-case CRAP 7.00
  - `text-match-calculator.ts`: Line Coverage 100%, Worst-case CRAP 7.00
  - `theme-manager.ts`: Line Coverage 100%, Worst-case CRAP 7.00
  - `theme-models.ts`: Line Coverage 100%, Worst-case CRAP 7.00
  - `theme-resolver.ts`: Line Coverage 100%, Worst-case CRAP 7.00
  - `scroll-spy-calculator.ts`: Line Coverage 100%, Worst-case CRAP 7.00
  - `toc-models.ts`: Line Coverage 100%, Worst-case CRAP 7.00
  - `toc-navigation-manager.ts`: Line Coverage 100%, Worst-case CRAP 7.00
  - **Max CRAP Score**: **7.00** ($\le 8.0$ gate passed).

---

## 4. Architectural & Structural Alignment (Including Native Viewer Launcher)

- **Package-by-Feature Structure**:
  - Both frontend (`src/{diagram,document,search,theme,toc}/`) and backend (`src-tauri/src/{cli,document,preferences,viewer,watcher}/`) strictly follow domain/feature grouping with no horizontal layer directories.
- **Native Viewer Launcher (`src-tauri/src/viewer/`)**:
  - `ViewerLauncher` orchestrates server bootstrap, initial document load, and window launch.
  - `EmbeddedServer` provides local REST API (`/api/initial-state`, `/api/open-document`, `/api/preferences`, `/api/poll-events`, `/api/asset`) and static file delivery for standalone viewer mode.
  - `NativeWindowLauncher` invokes native WebKit2/Gtk window with smooth scrolling, falling back seamlessly to `xdg-open`.
  - `TauriIpcAdapter` supports dual-mode operation: native Tauri IPC when available, falling back to embedded REST endpoints and HTTP polling for live auto-reload and preference persistence.
- **Pattern Nomenclature**:
  - All classes and components implement standard pattern suffixes (`..Parser`, `..Reader`, `..Compiler`, `..Sanitizer`, `..Resolver`, `..Service`, `..Adapter`, `..Manager`, `..Builder`, `..Calculator`, `..Launcher`, `..Server`).
- **Technology over Vendor Abstraction**:
  - External crates/libraries (`ammonia`, `notify`, `pulldown-cmark`, `@tauri-apps/api`, `mermaid`, `katex`, `DOMPurify`) are isolated behind technology adapters and readers (`NotifyWatcherAdapter`, `TauriIpcAdapter`, `HtmlSanitizerAdapter`, `MermaidAdapter`, `KatexAdapter`, `FsDocumentReader`).
- **Newspaper Layout & Hygiene**:
  - Ingress/public functions at top, helpers below; zero commented-out code; zero `console.log` in production code.

---

## 5. Findings & Remediation Action Items

| ID | Severity (`BLOCKING` / `ADVISORY`) | File & Line | Guideline / Rule | Finding & Remediation Instruction |
| :--- | :--- | :--- | :--- | :--- |
| `F-01` | `RESOLVED` | `src-tauri/Cargo.lock` | `Engineering Guidelines` §1 | Resolved: `src-tauri/Cargo.lock` generated and synchronized with `src-tauri/Cargo.toml`; `.gitignore` updated to track `!src-tauri/Cargo.lock`. |

---

## Subagent Return Summary Card (Copy to Final Response)

```text
STATUS: PASS
AUDIT FILE: specs/001-parchment-markdown-viewer/checklists/reviewer-audit.md
KEY METRIC: Mutation Score: 89.51% | CRAP: max 7.00 | Tests: 71/71 pass | Lockfiles: synchronized
ACTION ITEMS: None
```
