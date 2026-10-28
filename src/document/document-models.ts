export interface TocItem {
  id: string;
  title: string;
  level: number;
  lineNumber: number;
  children: TocItem[];
}

export interface DocumentPayload {
  canonicalPath: string;
  displayName: string;
  rawMarkdown: string;
  sanitizedHtml: string;
  outline: TocItem[];
  byteSize: number;
}

export interface IpcErrorPayload {
  status: 'error';
  code: string;
  message: string;
}

export interface DocumentSessionState {
  currentDocument: DocumentPayload | null;
  scrollRatio: number;
  isEmptyState: boolean;
  errorMessage: string | null;
  warningBanner: string | null;
}
