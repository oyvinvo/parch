import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeBlockManager, IClipboardAdapter } from './code-block-manager.ts';

describe('CodeBlockManager', () => {
  let mockClipboard: IClipboardAdapter;
  let manager: CodeBlockManager;
  let container: HTMLElement;

  beforeEach(() => {
    mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    manager = new CodeBlockManager(mockClipboard);
    container = document.createElement('div');
  });

  it('attaches accessible copy button to code blocks', () => {
    container.innerHTML = `
      <pre><code class="language-rust">fn main() { println!("Hello"); }</code></pre>
    `;

    manager.enhanceCodeBlocks(container);
    const button = container.querySelector('button.parchment-copy-button');

    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBe('Copy code to clipboard');
    expect(button?.textContent?.trim()).toBe('Copy');
  });

  it('copies code text to clipboard on button click and provides 2s visual feedback', async () => {
    vi.useFakeTimers();

    container.innerHTML = `
      <pre><code class="language-typescript">const x: number = 42;</code></pre>
    `;

    manager.enhanceCodeBlocks(container);
    const button = container.querySelector('button.parchment-copy-button') as HTMLButtonElement;
    expect(button).not.toBeNull();

    button.click();

    expect(mockClipboard.writeText).toHaveBeenCalledWith('const x: number = 42;');
    expect(button.textContent).toContain('Copied!');
    expect(button.getAttribute('aria-label')).toBe('Copied to clipboard');

    // Fast-forward 2 seconds
    vi.advanceTimersByTime(2000);
    expect(button.textContent?.trim()).toBe('Copy');
    expect(button.getAttribute('aria-label')).toBe('Copy code to clipboard');

    vi.useRealTimers();
  });

  it('sets relative positioning on pre and avoids duplicate copy buttons when run repeatedly', () => {
    container.innerHTML = `<pre><code class="language-js">console.log(1);</code></pre>`;
    manager.enhanceCodeBlocks(container);
    manager.enhanceCodeBlocks(container);

    const pre = container.querySelector('pre');
    expect(pre?.style.position).toBe('relative');
    const buttons = container.querySelectorAll('button.parchment-copy-button');
    expect(buttons.length).toBe(1);
  });

  it('supports DefaultClipboardAdapter and default constructor', async () => {
    const defaultManager = new CodeBlockManager();
    expect(defaultManager).toBeDefined();

    const clipboardWriteMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: clipboardWriteMock },
    });

    const defaultAdapter = new (await import('./code-block-manager.ts')).DefaultClipboardAdapter();
    await defaultAdapter.writeText('sample');
    expect(clipboardWriteMock).toHaveBeenCalledWith('sample');
  });
});
