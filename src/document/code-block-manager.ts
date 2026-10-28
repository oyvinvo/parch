import hljs from 'highlight.js';

export interface IClipboardAdapter {
  writeText(text: string): Promise<void>;
}

export class DefaultClipboardAdapter implements IClipboardAdapter {
  async writeText(text: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
  }
}

export class CodeBlockManager {
  private clipboard: IClipboardAdapter;

  constructor(clipboard?: IClipboardAdapter) {
    this.clipboard = clipboard ?? new DefaultClipboardAdapter();
  }

  enhanceCodeBlocks(container: HTMLElement): void {
    const codeBlocks = container.querySelectorAll<HTMLElement>('pre > code');

    codeBlocks.forEach((codeElement) => {
      this.highlightCodeBlock(codeElement);
      this.attachCopyButton(codeElement);
    });
  }

  private highlightCodeBlock(codeElement: HTMLElement): void {
    try {
      hljs.highlightElement(codeElement);
    } catch {
      // Graceful fallback if language is unsupported or highlight fails
    }
  }

  private attachCopyButton(codeElement: HTMLElement): void {
    const preElement = codeElement.parentElement;
    if (!preElement || preElement.querySelector('.parchment-copy-button')) {
      return;
    }

    const button = document.createElement('button');
    button.className = 'parchment-copy-button';
    button.setAttribute('aria-label', 'Copy code to clipboard');
    button.textContent = 'Copy';

    button.addEventListener('click', () => {
      button.textContent = 'Copied! ✓';
      button.setAttribute('aria-label', 'Copied to clipboard');
      void this.clipboard.writeText(codeElement.textContent || '');
      setTimeout(() => {
        button.textContent = 'Copy';
        button.setAttribute('aria-label', 'Copy code to clipboard');
      }, 2000);
    });

    preElement.style.position = 'relative';
    preElement.appendChild(button);
  }
}
