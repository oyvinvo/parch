import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TauriIpcAdapter } from './tauri-ipc-adapter.ts';

describe('TauriIpcAdapter', () => {
  let adapter: TauriIpcAdapter;

  beforeEach(() => {
    adapter = new TauriIpcAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('compiles markdown via backend when fetch succeeds', async () => {
    const mockPayload = {
      canonicalPath: 'test.md',
      displayName: 'test.md',
      rawMarkdown: '# Title',
      sanitizedHtml: '<h1 id="title">Title</h1>',
      outline: [{ id: 'title', title: 'Title', level: 1, lineNumber: 1, children: [] }],
      byteSize: 7,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockPayload,
    } as Response);

    const result = await adapter.compileMarkdown('test.md', '# Title');
    expect(result.displayName).toBe('test.md');
    expect(result.sanitizedHtml).toBe('<h1 id="title">Title</h1>');
    expect(result.outline.length).toBe(1);
  });

  it('uses client-side fallback compiler when backend fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const raw = '# Fallback Heading\n> [!NOTE]\n> Alert text\n\n**Bold** text with `code`';
    const result = await adapter.compileMarkdown('notes.md', raw);

    expect(result.displayName).toBe('notes.md');
    expect(result.sanitizedHtml).toContain('<h1 id="fallback-heading">');
    expect(result.sanitizedHtml).toContain('markdown-alert-note');
    expect(result.sanitizedHtml).toContain('<strong>Bold</strong>');
    expect(result.sanitizedHtml).toContain('<code>code</code>');
    expect(result.outline).toEqual([
      { id: 'fallback-heading', title: 'Fallback Heading', level: 1, lineNumber: 1, children: [] },
    ]);
  });

  it('builds hierarchical outline with nested children in fallback compiler', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const raw = '# Chapter 1\n## Section 1.1\n### Detail 1.1.1\n## Section 1.2\n# Chapter 2';
    const result = await adapter.compileMarkdown('hierarchy.md', raw);

    expect(result.outline.length).toBe(2);
    expect(result.outline[0].title).toBe('Chapter 1');
    expect(result.outline[0].children.length).toBe(2);
    expect(result.outline[0].children[0].title).toBe('Section 1.1');
    expect(result.outline[0].children[0].children.length).toBe(1);
    expect(result.outline[0].children[0].children[0].title).toBe('Detail 1.1.1');
    expect(result.outline[0].children[1].title).toBe('Section 1.2');
    expect(result.outline[1].title).toBe('Chapter 2');
  });

  it('disambiguates identical heading slugs in fallback compiler', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const raw = '# Section\n## Section\n### Section';
    const result = await adapter.compileMarkdown('duplicate.md', raw);

    expect(result.outline[0].id).toBe('section');
    expect(result.outline[0].children[0].id).toBe('section-1');
    expect(result.outline[0].children[0].children[0].id).toBe('section-2');
  });

  it('retrieves initial state including systemDark', async () => {
    const mockInitial = {
      path: '/tmp/test.md',
      cliTheme: null,
      payload: null,
      preferences: { theme_mode: 'system' },
      systemDark: true,
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockInitial,
    } as Response);

    const state = await adapter.getInitialState();
    expect(state).not.toBeNull();
    expect(state?.systemDark).toBe(true);
    expect(state?.preferences.theme_mode).toBe('system');
  });

  it('checks for update successfully when endpoint responds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        updateAvailable: true,
        currentVersion: '0.1.0',
        latestVersion: '0.2.0',
      }),
    } as Response);

    const update = await adapter.checkUpdate();
    expect(update.updateAvailable).toBe(true);
    expect(update.latestVersion).toBe('0.2.0');
  });

  it('handles offline state safely in checkUpdate', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'));

    const update = await adapter.checkUpdate();
    expect(update.updateAvailable).toBe(false);
    expect(update.latestVersion).toBeNull();
  });

  it('triggers update and returns result', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Updated to v0.2.0',
      }),
    } as Response);

    const result = await adapter.triggerUpdate();
    expect(result.success).toBe(true);
    expect(result.message).toBe('Updated to v0.2.0');
  });

  it('calls /api/open-external on openExternal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    await adapter.openExternal('https://example.com');
    expect(fetchSpy).toHaveBeenCalledWith('/api/open-external', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ url: 'https://example.com' }),
    }));
  });

  it('handles mailto scheme safely in openExternal', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    await adapter.openExternal('mailto:user@example.com');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith('mailto:user@example.com', '_self');
  });
});
