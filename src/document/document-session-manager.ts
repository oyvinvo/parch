import { DocumentPayload, DocumentSessionState } from './document-models.ts';
import { IIpcAdapter } from './tauri-ipc-adapter.ts';
import { ISanitizerAdapter, HtmlSanitizerAdapter } from './html-sanitizer-adapter.ts';

export interface HistoryEntry {
  doc: DocumentPayload;
  scrollTop: number;
}

export class DocumentSessionManager {
  private ipc: IIpcAdapter;
  private sanitizer: ISanitizerAdapter;
  private lastDeletedPath: string | null = null;
  private backStack: HistoryEntry[] = [];
  private forwardStack: HistoryEntry[] = [];
  private state: DocumentSessionState = {
    currentDocument: null,
    scrollRatio: 0,
    isEmptyState: true,
    errorMessage: null,
    warningBanner: null,
  };

  constructor(ipc: IIpcAdapter, sanitizer?: ISanitizerAdapter) {
    this.ipc = ipc;
    this.sanitizer = sanitizer ?? new HtmlSanitizerAdapter();
  }

  getState(): DocumentSessionState {
    return { ...this.state };
  }

  getLastDeletedPath(): string | null {
    return this.lastDeletedPath;
  }

  canGoBack(): boolean {
    return this.backStack.length > 0;
  }

  canGoForward(): boolean {
    return this.forwardStack.length > 0;
  }

  async loadDocument(path: string): Promise<void> {
    try {
      const doc = await this.ipc.openDocument(path);
      doc.sanitizedHtml = this.sanitizer.sanitize(doc.sanitizedHtml);
      this.state.isEmptyState = false;
      this.state.currentDocument = doc;
      this.state.errorMessage = null;
      this.state.warningBanner = null;
    } catch (error) {
      this.state.isEmptyState = false;
      this.state.currentDocument = null;
      this.state.errorMessage = error instanceof Error ? error.message : String(error);
    }
  }

  async navigateToDocument(path: string, currentScrollTop = 0): Promise<void> {
    if (this.state.currentDocument) {
      this.backStack.push({ doc: this.state.currentDocument, scrollTop: currentScrollTop });
      this.forwardStack = [];
    }
    await this.loadDocument(path);
  }

  goBack(currentScrollTop = 0): HistoryEntry | null {
    if (!this.canGoBack()) {
      return null;
    }
    const prev = this.backStack.pop()!;
    if (this.state.currentDocument) {
      this.forwardStack.push({ doc: this.state.currentDocument, scrollTop: currentScrollTop });
    }
    this.applyHistoryDoc(prev.doc);
    return prev;
  }

  goForward(currentScrollTop = 0): HistoryEntry | null {
    if (!this.canGoForward()) {
      return null;
    }
    const next = this.forwardStack.pop()!;
    if (this.state.currentDocument) {
      this.backStack.push({ doc: this.state.currentDocument, scrollTop: currentScrollTop });
    }
    this.applyHistoryDoc(next.doc);
    return next;
  }

  updateDocument(updatedDoc: DocumentPayload): void {
    updatedDoc.sanitizedHtml = this.sanitizer.sanitize(updatedDoc.sanitizedHtml);
    this.state.currentDocument = updatedDoc;
    this.state.errorMessage = null;
    this.state.warningBanner = null;
  }

  handleFileDeleted(path: string): void {
    this.lastDeletedPath = path;
    this.state.warningBanner = 'File was moved or deleted from disk. Keeping current buffer.';
  }

  calculatePreservedScrollTop(
    currentScrollTop: number,
    oldScrollHeight: number,
    newScrollHeight: number
  ): number {
    if (oldScrollHeight <= 0) {
      return 0;
    }
    const ratio = currentScrollTop / oldScrollHeight;
    return Math.round(ratio * newScrollHeight);
  }

  resetToEmptyState(): void {
    this.state.currentDocument = null;
    this.state.isEmptyState = true;
    this.state.errorMessage = null;
    this.state.warningBanner = null;
    this.backStack = [];
    this.forwardStack = [];
  }

  private applyHistoryDoc(doc: DocumentPayload): void {
    this.state.isEmptyState = false;
    this.state.currentDocument = doc;
    this.state.errorMessage = null;
    this.state.warningBanner = null;
  }
}
