# ADR-0002: Hybrid Markdown Rendering, Alert Callouts, and Dual-Layer XSS Sanitization Pipeline

- **Status**: ACCEPTED
- **Deciders**: Architect (`architect`), Lead Dev, Security Expert
- **Date**: 2026-10-28
- **Technical Story / Ticket**: `specs/001-parchment-markdown-viewer/spec.md`

---

## 1. Context and Problem Statement
Parchment opens Markdown files from potentially untrusted sources (e.g., downloaded repositories, email attachments, third-party documentation). These files may contain raw HTML, embedded `<script>` tags, malicious `onerror` / `onload` attributes, `javascript:` links, or path-traversal image links (`../../../../etc/shadow`). At the same time, Parchment must faithfully render GitHub-Flavored Markdown (tables, task lists, strikethrough), GitHub-style alert callouts (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`), syntax-highlighted code blocks with copy buttons, inline/block KaTeX math (`$...$`, `$$...$$`), and Mermaid diagrams (` ```mermaid `) with graceful syntax-error boundaries.

---

## 2. Decision Drivers
- **Zero XSS Execution (Scenario 7.1)**: Strip `<script>`, `<iframe>`, `<object>`, `<embed>`, inline event handlers (`onerror`, `onload`), and `javascript:` / `vbscript:` / `data:text/html` URIs before any HTML touches the DOM.
- **Directory Traversal Sandboxing (Scenario 7.4)**: Prevent relative image references from reading files outside the opened document's parent directory hierarchy.
- **High Performance on Large Files (NFR 5.2)**: Parse GFM and generate the hierarchical Table of Contents (`DocumentOutline`) with deterministic unique anchor slugs (`id`) quickly and deterministically.
- **Graceful Degradation (Scenarios 5.2 & 5.3)**: Malformed Mermaid diagrams or invalid LaTeX math formulas must render user-friendly inline error boxes rather than crashing the document view.

---

## 3. Considered Options
1. **Option 1: Rust Backend GFM Compilation (`pulldown-cmark`) + Ammonia HTML Sanitization + Sandboxed Asset Resolution, paired with Frontend DOMPurify Defense-in-Depth + Client-Side KaTeX / Mermaid / Shiki/Highlight.js Enhancement**.
2. **Option 2: 100% Frontend Parsing (`marked` or `markdown-it` in JS) with raw Markdown string only from Rust**.
3. **Option 3: 100% Rust Rendering (including server-side headless SVG generation for Mermaid and math)**.

---

## 4. Decision Outcome
Chosen option: **Option 1 (Hybrid Pipeline: Rust `pulldown-cmark` + `ammonia` Sanitizer + Sandboxed Asset Resolver + Frontend `DOMPurify` + Client-Side KaTeX/Mermaid/Syntax Post-Processors)**, because it satisfies the `open_document` IPC contract (`raw_markdown`, `sanitized_html`, and `outline` returned from Rust), guarantees dual-layer XSS defense (Rust `ammonia` + browser `DOMPurify`), and allows theme-reactive Mermaid SVG and syntax highlighting in the UI.

### Positive Consequences:
- **Dual-Layer XSS Sanitization**: Rust `HtmlSanitizer` (backed by `ammonia` with an explicit tag/attribute allowlist) strips dangerous tags and `javascript:` URLs before data even crosses the IPC bridge, and Frontend `HtmlSanitizerAdapter` (backed by `DOMPurify`) enforces a second sanitization pass before DOM insertion.
- **Deterministic Heading Slugs & TOC**: Rust `MarkdownCompiler` extracts heading levels (`1..=6`), line numbers, and collision-free slugs (`section`, `section-1`, `section-2`) in a single streaming pass.
- **Sandboxed Asset Resolution**: Rust `AssetPathResolver` canonicalizes relative image paths against `document.parent_dir` and rejects any path that escapes the allowed root (`DIRECTORY_TRAVERSAL_PROHIBITED`).
- **Isolated Error Boundaries**: Each Mermaid block (`DiagramRenderService`) and KaTeX expression (`MathRenderService`) is processed inside an isolated `try/catch` boundary (`renderOnError: false` for KaTeX; `mermaid.parse` validation + expandable `<details>` error box for Mermaid).

### Negative Consequences / Trade-offs:
- Requires coordinating custom `data-*` attributes or safe class names through the `ammonia` and `DOMPurify` allowlists for GitHub Alerts, task list checkboxes, math blocks, and Mermaid code fences.
- **Mitigation**: Explicitly configure and unit-test the shared allowlist in both `src-tauri/src/document/html_sanitizer.rs` and `src/document/html-sanitizer-adapter.ts`.

---

## 5. Pros and Cons of the Options

### Option 1: Hybrid Rust (`pulldown-cmark` + `ammonia`) + Frontend (`DOMPurify` + KaTeX + Mermaid)
- **Good**, because directly fulfills the `open_document` contract in `spec.md` (§3.2.1) which specifies returning both `sanitized_html` and `outline` from the backend while keeping frontend enhancers modular and testable.
- **Good**, because native Rust Markdown parsing handles 5 MiB documents in a few milliseconds without blocking the UI thread.
- **Bad**, because requires maintaining allowlist parity between `ammonia` and `DOMPurify`.

### Option 2: 100% Frontend Parsing
- **Good**, because all rendering happens in a single language.
- **Bad**, because it violates the `open_document` IPC contract in `spec.md` (§3.2.1) and blocks the main WebView thread when parsing multi-megabyte Markdown files.

### Option 3: 100% Rust Rendering (including Mermaid & Math)
- **Good**, because the frontend only receives static HTML/SVG.
- **Bad**, because Mermaid relies on browser DOM layout metrics (`getBBox()`) for accurate node sizing and theme switching.

---

## 6. Human Review & Approval
- **Approved by**: Pending Human Review
- **Notes / Modifications**: Awaiting sign-off to transition from `PROPOSED` to `ACCEPTED`.
