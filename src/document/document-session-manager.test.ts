import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentSessionManager } from './document-session-manager.ts';
import { IIpcAdapter } from './tauri-ipc-adapter.ts';
import { ISanitizerAdapter } from './html-sanitizer-adapter.ts';
import { DocumentPayload } from './document-models.ts';

describe('DocumentSessionManager', () => {
  let mockIpc: IIpcAdapter;
  let mockSanitizer: ISanitizerAdapter;
  let sessionManager: DocumentSessionManager;

  const sampleDoc: DocumentPayload = {
    canonicalPath: '/home/user/docs/readme.md',
    displayName: 'readme.md',
    rawMarkdown: '# Hello World\nContent here',
    sanitizedHtml: '<h1 id="hello-world">Hello World</h1><p>Content here</p>',
    outline: [{ id: 'hello-world', title: 'Hello World', level: 1, lineNumber: 1, children: [] }],
    byteSize: 1024,
  };

  beforeEach(() => {
    mockIpc = {
      openDocument: vi.fn(),
      resolveAssetPath: vi.fn(),
      getPreference: vi.fn(),
      setPreference: vi.fn(),
      listen: vi.fn().mockReturnValue(() => {}),
    };
    mockSanitizer = {
      sanitize: vi.fn((html) => html),
    };
    sessionManager = new DocumentSessionManager(mockIpc, mockSanitizer);
  });

  it('starts in empty state when no document is provided', () => {
    const state = sessionManager.getState();
    expect(state.isEmptyState).toBe(true);
    expect(state.currentDocument).toBeNull();
    expect(state.errorMessage).toBeNull();
  });

  it('loads valid markdown document and transitions out of empty state', async () => {
    vi.mocked(mockIpc.openDocument).mockResolvedValue(sampleDoc);

    await sessionManager.loadDocument('/home/user/docs/readme.md');
    const state = sessionManager.getState();

    expect(state.isEmptyState).toBe(false);
    expect(state.currentDocument?.displayName).toBe('readme.md');
    expect(state.errorMessage).toBeNull();
  });

  it('handles missing file error and transitions to error view', async () => {
    vi.mocked(mockIpc.openDocument).mockRejectedValue(new Error('File not found: /missing.md'));

    await sessionManager.loadDocument('/missing.md');
    const state = sessionManager.getState();

    expect(state.isEmptyState).toBe(false);
    expect(state.errorMessage).toContain('File not found');
  });

  it('displays non-destructive warning banner when active file is deleted on disk', () => {
    sessionManager.handleFileDeleted('/home/user/docs/readme.md');
    const state = sessionManager.getState();

    expect(state.warningBanner).toContain('File was moved or deleted from disk. Keeping current buffer.');
    expect(sessionManager.getLastDeletedPath()).toBe('/home/user/docs/readme.md');
  });

  it('calculates preserved vertical scroll position accurately across DOM reload', () => {
    const newScroll = sessionManager.calculatePreservedScrollTop(500, 1000, 1200);
    expect(newScroll).toBe(600);
    expect(sessionManager.calculatePreservedScrollTop(10, 0, 1200)).toBe(0);
  });

  it('updates document buffer and resets to empty state properly', () => {
    sessionManager.updateDocument(sampleDoc);
    expect(sessionManager.getState().currentDocument?.displayName).toBe('readme.md');

    sessionManager.resetToEmptyState();
    expect(sessionManager.getState().isEmptyState).toBe(true);
    expect(sessionManager.getState().currentDocument).toBeNull();
  });

  it('supports default constructor and non-Error rejection handling', async () => {
    const defaultManager = new DocumentSessionManager(mockIpc);
    expect(defaultManager).toBeDefined();

    vi.mocked(mockIpc.openDocument).mockRejectedValue('Plain string error');
    await defaultManager.loadDocument('/fail.md');
    expect(defaultManager.getState().errorMessage).toBe('Plain string error');
  });
});
