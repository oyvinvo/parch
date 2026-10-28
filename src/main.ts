import './styles/parchment.css';
import { ThemeManager } from './theme/theme-manager.ts';
import { ThemeResolver } from './theme/theme-resolver.ts';
import { ThemeMode } from './theme/theme-models.ts';
import { TauriIpcAdapter, InitialStateData } from './document/tauri-ipc-adapter.ts';
import { DocumentSessionManager } from './document/document-session-manager.ts';
import { HtmlSanitizerAdapter } from './document/html-sanitizer-adapter.ts';
import { AlertCalloutBuilder } from './document/alert-callout-builder.ts';
import { CodeBlockManager } from './document/code-block-manager.ts';
import { TocNavigationManager } from './toc/toc-navigation-manager.ts';
import { HeadingOffset } from './toc/toc-models.ts';
import { SearchSessionManager } from './search/search-session-manager.ts';
import { DiagramRenderService } from './diagram/diagram-render-service.ts';
import { MermaidAdapter } from './diagram/mermaid-adapter.ts';
import { MathRenderService } from './diagram/math-render-service.ts';
import { KatexAdapter } from './diagram/katex-adapter.ts';
import { DocumentPayload } from './document/document-models.ts';

class ParchApplication {
  private ipc: TauriIpcAdapter;
  private themeManager: ThemeManager;
  private sessionManager: DocumentSessionManager;
  private tocManager: TocNavigationManager;
  private searchManager: SearchSessionManager;
  private diagramService: DiagramRenderService;
  private mathService: MathRenderService;
  private alertBuilder: AlertCalloutBuilder;
  private codeManager: CodeBlockManager;

  constructor() {
    this.ipc = new TauriIpcAdapter();
    this.themeManager = new ThemeManager(new ThemeResolver(), this.ipc);
    this.sessionManager = new DocumentSessionManager(this.ipc, new HtmlSanitizerAdapter());
    this.tocManager = new TocNavigationManager();
    this.searchManager = new SearchSessionManager();
    this.diagramService = new DiagramRenderService(new MermaidAdapter());
    this.mathService = new MathRenderService(new KatexAdapter());
    this.alertBuilder = new AlertCalloutBuilder();
    this.codeManager = new CodeBlockManager();
  }

  async bootstrap(): Promise<void> {
    this.setupTheme();
    this.setupShortcuts();
    this.setupToolbarActions();
    this.setupDocumentLinkInterceptor();
    this.setupTocActions();
    this.setupSearchActions();
    this.setupFileWatcherListeners();
    await this.loadInitialBackendState();
    void this.checkForUpdates();
  }

  private setupTheme(): void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.themeManager.setSystemDark(mediaQuery.matches);
    mediaQuery.addEventListener('change', (e) => {
      this.themeManager.setSystemDark(e.matches);
      this.updateThemeButtonLabel();
    });
    this.updateThemeButtonLabel();
  }

  private updateThemeButtonLabel(): void {
    const label = document.getElementById('theme-label');
    if (label) {
      const mode = this.themeManager.getMode();
      const capMode = mode.charAt(0).toUpperCase() + mode.slice(1);
      label.textContent = `Theme: ${capMode}`;
    }
  }

  private setupShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      if (this.handleNavigationShortcuts(e)) {
        return;
      }
      if (this.handleCtrlKeyShortcuts(e)) {
        return;
      }
      this.handleFunctionKeyShortcuts(e);
    });
  }

  private handleNavigationShortcuts(e: KeyboardEvent): boolean {
    if (!e.altKey) {
      return false;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.handleNavigateBack();
      return true;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.handleNavigateForward();
      return true;
    }
    return false;
  }

  private handleCtrlKeyShortcuts(e: KeyboardEvent): boolean {
    if (!e.ctrlKey && !e.metaKey) {
      return false;
    }
    const key = e.key.toLowerCase();
    if (key === 'o') {
      e.preventDefault();
      void this.triggerFileOpen();
      return true;
    }
    if (e.key === '\\') {
      e.preventDefault();
      this.toggleTocSidebar();
      return true;
    }
    if (key === 'f') {
      e.preventDefault();
      this.openSearchBar();
      return true;
    }
    return false;
  }

  private handleFunctionKeyShortcuts(e: KeyboardEvent): boolean {
    if (e.key === 'F10') {
      e.preventDefault();
      this.themeManager.cycleTheme();
      this.updateThemeButtonLabel();
      return true;
    }
    if (e.key === 'Escape') {
      this.closeSearchBar();
      return true;
    }
    return false;
  }

  private setupToolbarActions(): void {
    this.setupHistoryToolbarActions();
    this.setupFileToolbarActions();
    this.setupSidebarToolbarActions();
  }

  private setupHistoryToolbarActions(): void {
    document.getElementById('btn-nav-back')?.addEventListener('click', () => {
      this.handleNavigateBack();
    });
    document.getElementById('btn-nav-forward')?.addEventListener('click', () => {
      this.handleNavigateForward();
    });
  }

  private setupFileToolbarActions(): void {
    document.getElementById('btn-open-file')?.addEventListener('click', () => {
      void this.triggerFileOpen();
    });
    document.getElementById('btn-empty-open')?.addEventListener('click', () => {
      void this.triggerFileOpen();
    });
    document.getElementById('btn-load-sample')?.addEventListener('click', () => this.loadShowcaseSample());
    this.setupUpdateBadgeAction();
    this.setupFileInput();
  }

  private setupSidebarToolbarActions(): void {
    document.getElementById('btn-toggle-toc')?.addEventListener('click', () => this.toggleTocSidebar());
    document.getElementById('btn-toggle-search')?.addEventListener('click', () => this.toggleSearchBar());
    document.getElementById('btn-theme-selector')?.addEventListener('click', () => {
      this.themeManager.cycleTheme();
      this.updateThemeButtonLabel();
    });
  }

  private setupUpdateBadgeAction(): void {
    const badge = document.getElementById('btn-update-badge');
    badge?.addEventListener('click', () => {
      void this.handleTriggerUpdate();
    });
  }

  private async checkForUpdates(): Promise<void> {
    const res = await this.ipc.checkUpdate?.();
    if (res?.updateAvailable && res.latestVersion) {
      const badge = document.getElementById('btn-update-badge');
      if (badge) {
        badge.textContent = `⬆ Update to v${res.latestVersion}`;
        badge.removeAttribute('hidden');
      }
    }
  }

  private async handleTriggerUpdate(): Promise<void> {
    const badge = document.getElementById('btn-update-badge') as HTMLButtonElement | null;
    if (!badge) {
      return;
    }
    badge.textContent = 'Updating...';
    badge.disabled = true;
    const res = await this.ipc.triggerUpdate?.();
    if (res?.success) {
      badge.textContent = '✓ Updated! Restart Parch';
    } else {
      badge.textContent = 'Update failed';
      badge.disabled = false;
    }
  }

  private setupFileInput(): void {
    const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) {
        this.readFileInBrowser(file);
      }
    });
  }

  private async triggerFileOpen(): Promise<void> {
    const nativePath = await this.ipc.pickFile?.();
    if (nativePath) {
      const viewer = document.getElementById('document-viewer');
      await this.sessionManager.navigateToDocument(nativePath, viewer?.scrollTop ?? 0);
      const state = this.sessionManager.getState();
      if (state.currentDocument) {
        this.renderDocument(state.currentDocument);
      }
      return;
    }

    const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
    fileInput?.click();
  }

  private toggleTocSidebar(): void {
    const sidebar = document.getElementById('toc-sidebar');
    const btn = document.getElementById('btn-toggle-toc');
    const isVisible = this.tocManager.toggleSidebar();
    if (sidebar) {
      sidebar.hidden = !isVisible;
    }
    btn?.setAttribute('aria-expanded', String(isVisible));
  }

  private toggleSearchBar(): void {
    const searchBar = document.getElementById('search-bar');
    if (searchBar?.hidden) {
      this.openSearchBar();
    } else {
      this.closeSearchBar();
    }
  }

  private openSearchBar(): void {
    const searchBar = document.getElementById('search-bar');
    const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
    const searchBtn = document.getElementById('btn-toggle-search');
    if (searchBar) {
      searchBar.hidden = false;
      this.searchManager.openSearch();
      searchBtn?.setAttribute('aria-expanded', 'true');
      searchInput?.focus();
      searchInput?.select();
    }
  }

  private closeSearchBar(): void {
    const searchBar = document.getElementById('search-bar');
    const searchBtn = document.getElementById('btn-toggle-search');
    if (searchBar && !searchBar.hidden) {
      searchBar.hidden = true;
      this.searchManager.closeSearch();
      searchBtn?.setAttribute('aria-expanded', 'false');
      this.updateSearchCounter();
    }
  }

  private setupTocActions(): void {
    const container = document.getElementById('toc-container');
    container?.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a.parchment-toc-link');
      if (!link) {
        return;
      }
      e.preventDefault();
      const href = link.getAttribute('href');
      if (!href || !href.startsWith('#')) {
        return;
      }
      const targetId = href.slice(1);
      const headingEl = document.getElementById(targetId);
      if (headingEl) {
        headingEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        this.tocManager.updateActiveHeading(targetId);
      }
    });

    const viewer = document.getElementById('document-viewer');
    viewer?.addEventListener('scroll', () => {
      this.handleViewerScroll();
    });
  }

  private handleViewerScroll(): void {
    const content = document.getElementById('document-content');
    const viewer = document.getElementById('document-viewer');
    if (!content || !viewer) {
      return;
    }

    const headings = content.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) {
      return;
    }

    const headingOffsets: HeadingOffset[] = [];
    headings.forEach((h) => {
      if (h.id) {
        headingOffsets.push({ id: h.id, offsetTop: h.offsetTop });
      }
    });

    const activeId = this.tocManager
      .getScrollSpy()
      .findActiveHeadingId(headingOffsets, viewer.scrollTop);
    if (activeId) {
      this.tocManager.updateActiveHeading(activeId);
    }
  }

  private setupSearchActions(): void {
    const container = document.getElementById('document-content');
    if (container) {
      this.searchManager.attachContainer(container);
    }

    const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
    searchInput?.addEventListener('input', () => {
      this.searchManager.search(searchInput.value);
      this.updateSearchCounter();
    });

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleSearchEnter(e.shiftKey);
      }
    });

    document.getElementById('btn-search-prev')?.addEventListener('click', () => {
      this.searchManager.prevMatch();
      this.updateSearchCounter();
    });

    document.getElementById('btn-search-next')?.addEventListener('click', () => {
      this.searchManager.nextMatch();
      this.updateSearchCounter();
    });

    document.getElementById('btn-search-close')?.addEventListener('click', () => this.closeSearchBar());
  }

  private handleSearchEnter(isShift: boolean): void {
    if (isShift) {
      this.searchManager.prevMatch();
    } else {
      this.searchManager.nextMatch();
    }
    this.updateSearchCounter();
  }

  private updateSearchCounter(): void {
    const counter = document.getElementById('search-counter');
    if (counter) {
      const state = this.searchManager.getState();
      const text = this.searchManager.getCalculator().formatMatchCounter(state.activeMatchIndex, state.totalMatches);
      counter.textContent = text;
    }
  }

  private setupFileWatcherListeners(): void {
    this.ipc.listen<DocumentPayload>('document-file-changed', (doc) => {
      this.renderDocument(doc, true);
    });

    this.ipc.listen<{ path: string }>('document-file-deleted', (payload) => {
      this.sessionManager.handleFileDeleted(payload.path);
      this.renderWarningBanner();
    });
  }

  private async loadInitialBackendState(): Promise<void> {
    const initialState = await this.ipc.getInitialState?.();
    if (!initialState) {
      return;
    }
    this.applyInitialTheme(initialState);
    await this.applyInitialDocument(initialState);
  }

  private applyInitialTheme(initialState: InitialStateData): void {
    if (typeof initialState.systemDark === 'boolean') {
      this.themeManager.setSystemDark(initialState.systemDark);
    }

    if (initialState.cliTheme) {
      this.themeManager.setThemeMode(initialState.cliTheme as ThemeMode, false);
      this.updateThemeButtonLabel();
      return;
    }

    const prefMode = initialState.preferences?.theme_mode;
    if (this.isValidThemeMode(prefMode)) {
      this.themeManager.setThemeMode(prefMode, false);
      this.updateThemeButtonLabel();
    }
  }

  private isValidThemeMode(mode: unknown): mode is ThemeMode {
    return mode === 'system' || mode === 'light' || mode === 'dark' || mode === 'sepia';
  }

  private async applyInitialDocument(initialState: InitialStateData): Promise<void> {
    if (initialState.payload) {
      this.renderDocument(initialState.payload);
      return;
    }
    if (initialState.path) {
      await this.sessionManager.loadDocument(initialState.path);
      const state = this.sessionManager.getState();
      if (state.currentDocument) {
        this.renderDocument(state.currentDocument);
      }
    }
  }

  private renderWarningBanner(): void {
    const banner = document.getElementById('warning-banner');
    const state = this.sessionManager.getState();
    if (banner && state.warningBanner) {
      banner.textContent = state.warningBanner;
      banner.hidden = false;
    }
  }

  private renderDocument(doc: DocumentPayload, preserveScroll = false): void {
    const viewer = document.getElementById('document-viewer');
    const oldScroll = viewer?.scrollTop ?? 0;
    const oldHeight = viewer?.scrollHeight ?? 1;

    this.sessionManager.updateDocument(doc);
    this.updateActiveFileName(doc.displayName);
    this.updateContentBody(doc.sanitizedHtml);
    this.updateTocOutline(doc);
    this.updateViewerScroll(viewer, oldScroll, oldHeight, preserveScroll);
    this.updateHistoryButtons();
  }

  private setupDocumentLinkInterceptor(): void {
    const content = document.getElementById('document-content');
    content?.addEventListener('click', (e) => {
      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');
      if (!link) {
        return;
      }
      const href = link.getAttribute('href');
      if (!href) {
        return;
      }
      this.handleAnchorClick(e, href);
    });
  }

  private handleAnchorClick(e: MouseEvent, href: string): void {
    if (href.startsWith('#')) {
      e.preventDefault();
      this.scrollToAnchor(href.slice(1));
      return;
    }
    if (this.isExternalUrl(href)) {
      e.preventDefault();
      void this.ipc.openExternal?.(href);
      return;
    }
    e.preventDefault();
    void this.handleLocalDocumentLink(href);
  }

  private isExternalUrl(href: string): boolean {
    return href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:');
  }

  private scrollToAnchor(anchorId: string): void {
    const targetEl = document.getElementById(anchorId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private async handleLocalDocumentLink(href: string): Promise<void> {
    const [filePath, hashAnchor] = this.splitHrefAnchor(href);
    await this.openLinkedMarkdown(filePath, hashAnchor);
  }

  private splitHrefAnchor(href: string): [string, string | undefined] {
    const hashIdx = href.indexOf('#');
    if (hashIdx === -1) {
      return [href, undefined];
    }
    return [href.slice(0, hashIdx), href.slice(hashIdx + 1)];
  }

  private async openLinkedMarkdown(filePath: string, hashAnchor?: string): Promise<void> {
    const viewer = document.getElementById('document-viewer');
    const currentScroll = viewer?.scrollTop ?? 0;

    await this.sessionManager.navigateToDocument(filePath, currentScroll);
    const state = this.sessionManager.getState();
    if (!state.currentDocument) {
      return;
    }

    this.renderDocument(state.currentDocument, false);

    if (hashAnchor) {
      this.scrollToAnchor(hashAnchor);
    } else if (viewer) {
      viewer.scrollTop = 0;
    }
  }

  private handleNavigateBack(): void {
    const viewer = document.getElementById('document-viewer');
    const prev = this.sessionManager.goBack(viewer?.scrollTop ?? 0);
    if (!prev) {
      return;
    }
    this.renderDocument(prev.doc, false);
    if (viewer) {
      viewer.scrollTop = prev.scrollTop;
    }
    void this.ipc.openDocument(prev.doc.canonicalPath).catch(() => {});
  }

  private handleNavigateForward(): void {
    const viewer = document.getElementById('document-viewer');
    const next = this.sessionManager.goForward(viewer?.scrollTop ?? 0);
    if (!next) {
      return;
    }
    this.renderDocument(next.doc, false);
    if (viewer) {
      viewer.scrollTop = next.scrollTop;
    }
    void this.ipc.openDocument(next.doc.canonicalPath).catch(() => {});
  }

  private updateHistoryButtons(): void {
    const btnBack = document.getElementById('btn-nav-back') as HTMLButtonElement | null;
    const btnForward = document.getElementById('btn-nav-forward') as HTMLButtonElement | null;
    if (btnBack) {
      btnBack.disabled = !this.sessionManager.canGoBack();
    }
    if (btnForward) {
      btnForward.disabled = !this.sessionManager.canGoForward();
    }
  }

  private updateActiveFileName(displayName: string): void {
    const activeFile = document.getElementById('active-filename');
    if (activeFile) {
      activeFile.textContent = displayName;
    }
  }

  private updateContentBody(sanitizedHtml: string): void {
    const content = document.getElementById('document-content');
    if (content) {
      content.innerHTML = sanitizedHtml;
      this.enhanceRenderedContent(content);
    }
  }

  private updateTocOutline(doc: DocumentPayload): void {
    const tocContainer = document.getElementById('toc-container');
    if (tocContainer) {
      this.tocManager.renderToc(tocContainer, doc.outline);
    }
  }

  private updateViewerScroll(
    viewer: HTMLElement | null,
    oldScroll: number,
    oldHeight: number,
    preserveScroll: boolean
  ): void {
    if (preserveScroll && viewer) {
      const newScroll = this.sessionManager.calculatePreservedScrollTop(oldScroll, oldHeight, viewer.scrollHeight);
      viewer.scrollTop = newScroll;
    }
  }

  private enhanceRenderedContent(container: HTMLElement): void {
    this.alertBuilder.enhanceContainer(container);
    this.codeManager.enhanceCodeBlocks(container);
    this.mathService.renderMathInContainer(container);
    void this.diagramService.renderDiagramsInContainer(container, this.themeManager.getEffectiveTheme());
  }

  private readFileInBrowser(file: File): void {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawText = (e.target?.result as string) || '';
      const payload = this.ipc.compileMarkdown
        ? await this.ipc.compileMarkdown(file.name, rawText)
        : {
            canonicalPath: file.name,
            displayName: file.name,
            rawMarkdown: rawText,
            sanitizedHtml: `<h1>${file.name}</h1><p>${rawText}</p>`,
            outline: [],
            byteSize: file.size,
          };
      this.renderDocument(payload);
    };
    reader.readAsText(file);
  }

  private loadShowcaseSample(): void {
    const sampleDoc: DocumentPayload = {
      canonicalPath: 'examples/welcome.md',
      displayName: 'welcome.md',
      rawMarkdown: '# Welcome to Parch',
      sanitizedHtml: `
        <h1 id="welcome-to-parch">Welcome to Parch</h1>
        <p>Parch is a native, distraction-free Markdown viewer for Linux.</p>
        <aside class="markdown-alert markdown-alert-tip" data-alert-type="tip"><p>Enjoy seamless keyboard navigation and reading ergonomics.</p></aside>
        <h2 id="features">Features</h2>
        <table>
          <thead><tr><th>Feature</th><th>Status</th></tr></thead>
          <tbody><tr><td>GFM Tables</td><td>Ready</td></tr><tr><td>Alert Callouts</td><td>Ready</td></tr></tbody>
        </table>
        <h2 id="math-and-diagrams">Mathematics & Diagrams</h2>
        <p>Einstein formula: $E = mc^2$ and quadratic: $$\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$</p>
        <pre><code class="language-mermaid">graph LR\n  A[Write Markdown] --> B(Parch) --> C{Enjoy Reading}</code></pre>
      `,
      outline: [
        {
          id: 'welcome-to-parch',
          title: 'Welcome to Parch',
          level: 1,
          lineNumber: 1,
          children: [
            { id: 'features', title: 'Features', level: 2, lineNumber: 5, children: [] },
            { id: 'math-and-diagrams', title: 'Mathematics & Diagrams', level: 2, lineNumber: 12, children: [] },
          ],
        },
      ],
      byteSize: 2048,
    };
    this.renderDocument(sampleDoc);
  }
}

const app = new ParchApplication();
void app.bootstrap();
