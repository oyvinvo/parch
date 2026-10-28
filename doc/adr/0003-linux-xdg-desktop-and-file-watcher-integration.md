# ADR-0003: Linux XDG Desktop Integration, Theme Sync, and Debounced File Watcher

- **Status**: ACCEPTED
- **Deciders**: Architect (`architect`), Lead Dev, Operations
- **Date**: 2026-10-28
- **Technical Story / Ticket**: `specs/001-parchment-markdown-viewer/spec.md`

---

## 1. Context and Problem Statement
Parchment must feel like a first-class citizen on Linux desktop environments (GNOME/Ubuntu, KDE Plasma, XFCE, and other XDG-compliant distributions/VMs). Specifically:
1. Users must be able to right-click any `.md` or `.markdown` file in their desktop file manager (e.g., GNOME Files / Nautilus) and select **"Open With Parchment"**, or run `parchment [OPTIONS] [FILE]` from a terminal with POSIX exit codes (`0`, `1`, `2`, `3`).
2. User preferences (`theme_mode`, `toc_visible`, `font_size_px`, `line_width_ch`, `auto_reload`) must persist in `$XDG_CONFIG_HOME/parchment/config.json` (defaulting to `~/.config/parchment/config.json`).
3. External modifications to the open file on disk (e.g., from Neovim, VS Code, or `git pull`) must automatically trigger a re-render within 200ms (with a 150ms debounce window) while preserving the reader's exact vertical scroll ratio, and file deletions/moves must surface a non-destructive warning banner without losing the in-memory view.

---

## 2. Decision Drivers
- **Seamless "Open With" Linux File Manager Integration (Scenario 1.2)**: Standard XDG `.desktop` entry and MIME type registration (`text/markdown`, `text/x-markdown`) installable both system-wide and per-user (`~/.local/share/applications` & `~/.local/share/mime`).
- **Reliable Atomic Save Watching (Scenarios 6.1 & 6.2)**: Many Linux editors (Vim, Neovim, Emacs, JetBrains) save files atomically via write-temp-and-rename (`mv .draft.md.swp draft.md`), which replaces the inode. Watching only the file inode directly can break after the first atomic save.
- **Instant OS Theme Synchronization (Scenario 3.1)**: Detect Freedesktop / GNOME dark/light mode changes immediately without page reloads.

---

## 3. Considered Options
1. **Option 1: Parent-Directory Filtered `notify` (inotify) Watcher with 150ms Debouncer + Standard XDG Packaging Artifacts (`packaging/parchment.desktop`, `packaging/parchment-mime.xml`, `scripts/install-desktop.sh`) + XDG Config Adapter**.
2. **Option 2: Direct Single-File Inode Watching via `inotify` without Parent Directory Monitoring**.
3. **Option 3: Periodic File Polling every 500ms**.

---

## 4. Decision Outcome
Chosen option: **Option 1 (Parent-Directory Filtered `notify` Watcher with 150ms Debouncer + XDG Desktop & MIME Registration Scripts + `$XDG_CONFIG_HOME` Config Store)**, because watching the canonical parent directory and filtering events for the target filename reliably captures both in-place writes and atomic rename-overwrites, while XDG packaging scripts make "Open With Parchment" work out-of-the-box on GNOME/Ubuntu and any XDG-compliant Linux system.

### Positive Consequences:
- Survives atomic file saves (`rename` / inode replacement) used by Vim, Neovim, Helix, and VS Code, solving Scenario 6.1 & 6.2 cleanly.
- If a file is deleted (`rm draft.md`), `FileWatcherService` emits `document-file-deleted` so the UI shows the non-destructive warning banner; if recreated at the same path inside the watched parent directory, live watching resumes automatically without re-registering the watch descriptor.
- Provides self-contained `packaging/parchment.desktop`, `packaging/parchment-mime.xml`, `scripts/install-desktop.sh`, and `scripts/uninstall-desktop.sh` that run `desktop-file-validate`, `update-desktop-database`, and `update-mime-database`.

### Negative Consequences / Trade-offs:
- Watching the parent directory receives raw events for sibling files in the same directory before filtering.
- **Mitigation**: `FileWatcherService` immediately filters events by exact canonical filename in O(1) before entering the 150ms debounce state machine.

---

## 5. Pros and Cons of the Options

### Option 1: Parent-Directory Filtered `notify` Watcher + 150ms Debouncer + XDG Packaging
- **Good**, because handles both in-place truncation/write and atomic temp-file rename saves seamlessly.
- **Good**, because automatically detects file recreation after deletion at the same path (Scenario 6.2).
- **Good**, because standard XDG `.desktop` (`Exec=parchment %F`, `MimeType=text/markdown;text/x-markdown;text/plain;`) integrates natively with GNOME Files / Nautilus, KDE Dolphin, and XFCE Thunar.
- **Bad**, because requires filtering out sibling file events in the parent directory (trivial path comparison).

### Option 2: Direct Single-File Inode Watching
- **Good**, because kernel only emits events for that single inode.
- **Bad**, because atomic saves replace the inode and silently break subsequent live reloads, and deleted-then-recreated files cannot be detected.

### Option 3: Periodic File Polling
- **Good**, because trivial to implement.
- **Bad**, because wastes CPU cycles/battery and either violates the `< 200ms` latency SLA or polls too aggressively.

---

## 6. Human Review & Approval
- **Approved by**: Pending Human Review
- **Notes / Modifications**: Awaiting sign-off to transition from `PROPOSED` to `ACCEPTED`.
