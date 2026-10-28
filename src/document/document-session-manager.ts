import { DocumentPayload, DocumentSessionState } from './document-models.ts';
import { IIpcAdapter } from './tauri-ipc-adapter.ts';
import { ISanitizerAdapter, HtmlSanitizerAdapter } from './html-sanitizer-adapter.ts';

export class DocumentSessionManager {
  private ipc: IIpcAdapter;
  private sanitizer: ISanitizerAdapter;
  private lastDeletedPath: string | null = null;
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
  }
}
