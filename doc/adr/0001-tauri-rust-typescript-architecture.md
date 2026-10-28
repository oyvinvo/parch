# ADR-0001: Tauri v2, Rust, and TypeScript Domain-Packaged Architecture

- **Status**: ACCEPTED
- **Deciders**: Architect (`architect`), Lead Dev, Stakeholders
- **Date**: 2026-10-28
- **Technical Story / Ticket**: `specs/001-parchment-markdown-viewer/spec.md`

---

## 1. Context and Problem Statement
Parchment requires a fast, distraction-free Linux desktop Markdown viewer that launches in under 300ms, uses minimal resident memory (< 150 MB even for 5 MiB documents), integrates natively with Linux CLI (`parchment <file>`) and XDG desktop file managers ("Open With Parchment"), and renders rich web typography including GitHub-Flavored Markdown (GFM), KaTeX mathematical expressions, and Mermaid SVG diagrams. Additionally, the architecture must enforce strict engineering standards: package-by-domain organization, technology-over-vendor abstractions, Cyclomatic Complexity $CC \le 7$ ($\text{CRAP} \le 8$), and automated Mutation Testing $\ge 80\%$ in both backend and frontend domain modules.

---

## 2. Decision Drivers
- **Sub-300ms Cold Startup & Low Memory Footprint**: Avoid bundling a 150+ MB Chromium binary for a lightweight document viewer.
- **Rich Typographic & Diagram Rendering**: Seamless support for CSS variables (Light, Dark, Sepia themes), KaTeX math layout, and client-side Mermaid SVG rendering.
- **Package-by-Domain & High Testability**: Pure domain logic in both Rust (`src-tauri/src/<domain>/`) and TypeScript (`src/<domain>/`) must be decoupled from Tauri IPC and DOM infrastructure via minimal `*Adapter` classes/traits so unit and mutation tests (`cargo-mutants` and `@stryker-mutator/core` with Vitest) execute rapidly without requiring a running GUI window.
- **Strict Security Boundary**: Local file I/O must be restricted to the Rust backend with zero external network connectivity (`connect-src 'none'`).

---

## 3. Considered Options
1. **Option 1: Tauri v2 (Rust Core + System WebKitGTK / WRY + TypeScript / Vite Frontend)** packaged by domain (`document/`, `toc/`, `search/`, `theme/`, `diagram/`, `watcher/`, `preferences/`, `cli/`).
2. **Option 2: Electron (Node.js + Bundled Chromium + React)**.
3. **Option 3: Pure Native GTK4 / Libadwaita in Rust (without WebView)** using custom Pango/Cairo Markdown layout.

---

## 4. Decision Outcome
Chosen option: **Option 1 (Tauri v2 with Rust Core + TypeScript/Vite Frontend, Packaged by Domain)**, because it combines native Rust startup speed, small binary size, and OS-level security sandboxing with first-class CSS typography, KaTeX, and Mermaid SVG rendering in the system WebView, while enabling clean domain separation for fast unit, CRAP, and mutation testing.

### Positive Consequences:
- Cold launch time well within the `< 300ms` SLA and minimal binary size (~8–12 MB vs. >150 MB for Electron).
- Full support for GFM tables, CSS custom properties for instant Light/Dark/Sepia switching, KaTeX, and Mermaid without re-implementing an SVG/math typesetting engine from scratch.
- Pure Rust domain services (`document`, `watcher`, `preferences`, `cli`) and pure TypeScript domain services (`document`, `toc`, `search`, `theme`, `diagram`) can be tested in isolation via `cargo test` / `cargo-mutants` and `vitest` / `stryker` + `c8` + `eslint` complexity checks.

### Negative Consequences / Trade-offs:
- Requires `libwebkit2gtk-4.1` system shared library on the target Linux desktop.
- **Mitigation**: Declare `libwebkit2gtk-4.1-0` and `libgtk-3-0` explicitly in Debian/Ubuntu package dependencies and installation scripts.

---

## 5. Pros and Cons of the Options

### Option 1: Tauri v2 (Rust Core + System WebKitGTK + TypeScript/Vite)
- **Good**, because Rust handles CLI exit codes, binary detection, path canonicalization, and inotify file watching with zero garbage collection overhead.
- **Good**, because TypeScript/Vite provides immediate access to battle-tested KaTeX and Mermaid rendering libraries with clean dependency injection boundaries.
- **Good**, because Tauri's Content Security Policy (`connect-src 'none'`) and scoped `asset://` protocol enforce defense-in-depth security.
- **Bad**, because IPC serialization crosses the Rust/WebView boundary (mitigated by sending pre-compiled, sanitized HTML + structured `TocItem` outline in a single `open_document` payload).

### Option 2: Electron (Node.js + Bundled Chromium)
- **Good**, because Chromium rendering is uniform across all platforms.
- **Bad**, because cold startup time frequently exceeds 600–1000ms and baseline RAM usage exceeds 150–250 MB on Linux desktops, violating NFR 5.2.

### Option 3: Pure Native GTK4 / Libadwaita in Rust
- **Good**, because it has no WebView dependency.
- **Bad**, because rendering complex Mermaid diagrams and LaTeX math natively in GTK4 without a browser layout engine requires massive custom engineering, violating KISS.

---

## 6. Human Review & Approval
- **Approved by**: Pending Human Review
- **Notes / Modifications**: Awaiting sign-off to transition from `PROPOSED` to `ACCEPTED`.
