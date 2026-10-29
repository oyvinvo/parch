import { DocumentPayload, TocItem } from './document-models.ts';

export interface InitialStateData {
  path: string | null;
  cliTheme: string | null;
  payload: DocumentPayload | null;
  preferences: Record<string, unknown>;
  systemDark?: boolean;
}

export interface CheckUpdateResponse {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string | null;
}

export interface TriggerUpdateResponse {
  success: boolean;
  message: string;
}

export interface IIpcAdapter {
  openDocument(path: string): Promise<DocumentPayload>;
  resolveAssetPath(documentPath: string, relativeAsset: string): Promise<string>;
  getPreference<T>(key: string): Promise<T>;
  setPreference<T>(key: string, value: T): Promise<void>;
  listen<T>(event: string, handler: (payload: T) => void): () => void;
  getInitialState?(): Promise<InitialStateData | null>;
  pickFile?(): Promise<string | null>;
  compileMarkdown?(filename: string, rawMarkdown: string): Promise<DocumentPayload>;
  checkUpdate?(): Promise<CheckUpdateResponse>;
  triggerUpdate?(): Promise<TriggerUpdateResponse>;
  openExternal?(url: string): Promise<void>;
}

export class TauriIpcAdapter implements IIpcAdapter {
  private eventListeners: Map<string, Set<(payload: unknown) => void>> = new Map();
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;

  async openDocument(path: string): Promise<DocumentPayload> {
    const tauri = this.getTauriCore();
    if (tauri) {
      return await tauri.invoke<DocumentPayload>('open_document', { path });
    }

    const response = await fetch('/api/open-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });

    if (!response.ok) {
      const errorMsg = await response.text();
      throw new Error(`Failed to open document: ${errorMsg}`);
    }

    return (await response.json()) as DocumentPayload;
  }

  async resolveAssetPath(documentPath: string, relativeAsset: string): Promise<string> {
    const tauri = this.getTauriCore();
    if (tauri) {
      return await tauri.invoke<string>('resolve_asset_path', { documentPath, relativeAsset });
    }

    const encDoc = encodeURIComponent(documentPath);
    const encRel = encodeURIComponent(relativeAsset);
    return `/api/asset?doc=${encDoc}&rel=${encRel}`;
  }

  async getPreference<T>(key: string): Promise<T> {
    const tauri = this.getTauriCore();
    if (tauri) {
      return await tauri.invoke<T>('get_user_preference', { key });
    }

    const response = await fetch('/api/preferences');
    if (!response.ok) {
      throw new Error(`Failed to read preferences: ${response.statusText}`);
    }
    const prefs = (await response.json()) as Record<string, unknown>;
    return prefs[key] as T;
  }

  async setPreference<T>(key: string, value: T): Promise<void> {
    const tauri = this.getTauriCore();
    if (tauri) {
      await tauri.invoke('set_user_preference', { key, value });
      return;
    }

    await fetch('/api/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: String(value) }),
    });
  }

  listen<T>(event: string, handler: (payload: T) => void): () => void {
    const tauriEvent = this.getTauriEvent();
    if (tauriEvent) {
      return this.listenTauri(tauriEvent, event, handler);
    }
    return this.listenHttpPoll(event, handler as (payload: unknown) => void);
  }

  async getInitialState(): Promise<InitialStateData | null> {
    try {
      const response = await fetch('/api/initial-state');
      if (response.ok) {
        return (await response.json()) as InitialStateData;
      }
    } catch {
      // Backend server not reachable
    }
    return null;
  }

  async pickFile(): Promise<string | null> {
    try {
      const response = await fetch('/api/pick-file', { method: 'POST' });
      if (response.ok) {
        const data = (await response.json()) as { path: string | null };
        return data.path;
      }
    } catch {
      // Picker unavailable
    }
    return null;
  }

  async compileMarkdown(filename: string, rawMarkdown: string): Promise<DocumentPayload> {
    try {
      const response = await fetch('/api/compile-markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, rawMarkdown }),
      });
      if (response.ok) {
        return (await response.json()) as DocumentPayload;
      }
    } catch {
      // Backend not available; fallback to client-side compiler
    }

    return this.fallbackCompileMarkdown(filename, rawMarkdown);
  }

  async checkUpdate(): Promise<CheckUpdateResponse> {
    try {
      const response = await fetch('/api/check-update');
      if (response.ok) {
        return (await response.json()) as CheckUpdateResponse;
      }
    } catch {
      // Backend not available or offline
    }
    return {
      updateAvailable: false,
      currentVersion: '0.2.0',
      latestVersion: null,
    };
  }

  async triggerUpdate(): Promise<TriggerUpdateResponse> {
    try {
      const response = await fetch('/api/trigger-update', { method: 'POST' });
      if (response.ok) {
        return (await response.json()) as TriggerUpdateResponse;
      }
      return { success: false, message: response.statusText };
    } catch (err) {
      return { success: false, message: String(err) };
    }
  }

  async openExternal(url: string): Promise<void> {
    if (url.startsWith('mailto:')) {
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(url, '_self');
      }
      return;
    }

    try {
      await fetch('/api/open-external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
    } catch {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  }

  private fallbackCompileMarkdown(filename: string, rawMarkdown: string): DocumentPayload {
    const lines = rawMarkdown.split('\n');
    const flatOutline: TocItem[] = [];
    const htmlLines: string[] = [];
    const slugCounts = new Map<string, number>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const heading = this.parseHeading(line, i + 1, slugCounts);
      if (heading) {
        flatOutline.push(heading.tocItem);
        htmlLines.push(heading.headingHtml);
      } else if (line.startsWith('>')) {
        htmlLines.push(this.parseBlockquote(line));
      } else if (line.trim().length === 0) {
        htmlLines.push('');
      } else {
        htmlLines.push(`<p>${this.formatInline(line)}</p>`);
      }
    }

    const outline = this.buildHierarchy(flatOutline);

    return {
      canonicalPath: filename,
      displayName: filename,
      rawMarkdown,
      sanitizedHtml: htmlLines.join('\n'),
      outline,
      byteSize: new TextEncoder().encode(rawMarkdown).length,
    };
  }

  private parseHeading(
    line: string,
    lineNumber: number,
    slugCounts: Map<string, number>
  ): { headingHtml: string; tocItem: TocItem } | null {
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (!match) {
      return null;
    }
    const level = match[1].length;
    const title = match[2].trim();
    const id = this.generateSlug(title, slugCounts);
    return {
      headingHtml: `<h${level} id="${id}">${this.formatInline(title)}</h${level}>`,
      tocItem: { id, title, level, lineNumber, children: [] },
    };
  }

  private generateSlug(title: string, slugCounts: Map<string, number>): string {
    const base = title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || 'section';
    const count = slugCounts.get(base) ?? 0;
    slugCounts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  }

  private buildHierarchy(flatItems: TocItem[]): TocItem[] {
    const root: TocItem[] = [];
    const stack: TocItem[] = [];

    for (const item of flatItems) {
      const current: TocItem = { ...item, children: [] };
      while (stack.length > 0 && stack[stack.length - 1].level >= current.level) {
        stack.pop();
      }
      if (stack.length === 0) {
        root.push(current);
      } else {
        stack[stack.length - 1].children.push(current);
      }
      stack.push(current);
    }

    return root;
  }

  private parseBlockquote(line: string): string {
    const alertMatch = line.match(/^>\s+\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
    if (alertMatch) {
      const alertType = alertMatch[1].toLowerCase();
      return `<aside class="markdown-alert markdown-alert-${alertType}" data-alert-type="${alertType}">`;
    }
    return `<blockquote><p>${this.formatInline(line.replace(/^>\s*/, ''))}</p></blockquote>`;
  }

  private formatInline(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  private listenTauri<T>(
    tauriEvent: { listen: <E>(ev: string, cb: (e: { payload: E }) => void) => Promise<() => void> },
    event: string,
    handler: (payload: T) => void
  ): () => void {
    let unlistenFn: (() => void) | null = null;
    void tauriEvent.listen<T>(event, (e) => handler(e.payload)).then((unlisten) => {
      unlistenFn = unlisten;
    });
    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }

  private listenHttpPoll(event: string, handler: (payload: unknown) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(handler);

    if (!this.pollIntervalId && typeof window !== 'undefined') {
      this.pollIntervalId = setInterval(() => {
        void this.pollServerEvents();
      }, 500);
    }

    return () => {
      this.eventListeners.get(event)?.delete(handler);
    };
  }

  private async pollServerEvents(): Promise<void> {
    try {
      const response = await fetch('/api/poll-events');
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as {
        event: 'none' | 'changed' | 'deleted';
        payload?: DocumentPayload;
        path?: string;
      };
      this.dispatchPollEvent(data);
    } catch {
      // Server unreachable during poll
    }
  }

  private dispatchPollEvent(data: {
    event: 'none' | 'changed' | 'deleted';
    payload?: DocumentPayload;
    path?: string;
  }): void {
    if (data.event === 'changed' && data.payload) {
      const listeners = this.eventListeners.get('document-file-changed');
      listeners?.forEach((fn) => fn(data.payload));
    } else if (data.event === 'deleted' && data.path) {
      const listeners = this.eventListeners.get('document-file-deleted');
      listeners?.forEach((fn) => fn({ path: data.path }));
    }
  }

  private getTauriCore(): { invoke: <R>(cmd: string, args?: Record<string, unknown>) => Promise<R> } | null {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      return (window as unknown as { __TAURI_INTERNALS__: { invoke: <R>(cmd: string, args?: Record<string, unknown>) => Promise<R> } }).__TAURI_INTERNALS__;
    }
    return null;
  }

  private getTauriEvent(): { listen: <T>(event: string, cb: (e: { payload: T }) => void) => Promise<() => void> } | null {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      return (window as unknown as { __TAURI__: { event: { listen: <T>(event: string, cb: (e: { payload: T }) => void) => Promise<() => void> } } }).__TAURI__.event;
    }
    return null;
  }
}
