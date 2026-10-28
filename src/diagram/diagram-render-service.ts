import { IMermaidAdapter } from './mermaid-adapter.ts';

export class DiagramRenderService {
  private adapter: IMermaidAdapter;

  constructor(adapter: IMermaidAdapter) {
    this.adapter = adapter;
  }

  async renderDiagramsInContainer(container: HTMLElement, themeName: string = 'default'): Promise<void> {
    const codeBlocks = Array.from(container.querySelectorAll<HTMLElement>('code.language-mermaid'));

    for (let index = 0; index < codeBlocks.length; index += 1) {
      const codeElement = codeBlocks[index];
      const rawCode = (codeElement.textContent || '').trim();
      const parentElement = codeElement.closest('pre') || codeElement;

      await this.renderSingleDiagram(parentElement, rawCode, themeName, index);
    }
  }

  private async renderSingleDiagram(
    targetElement: HTMLElement,
    rawCode: string,
    themeName: string,
    index: number
  ): Promise<void> {
    try {
      const diagramId = `parchment-diagram-${index}-${Math.random().toString(36).substring(2, 7)}`;
      const svg = await this.adapter.render(diagramId, rawCode, themeName);
      const wrapper = document.createElement('div');
      wrapper.className = 'parchment-diagram-container';
      wrapper.innerHTML = svg;
      targetElement.replaceWith(wrapper);
    } catch (error) {
      const errorBox = this.createErrorBox(rawCode, error);
      targetElement.replaceWith(errorBox);
    }
  }

  private createErrorBox(rawCode: string, error: unknown): HTMLElement {
    const errorBox = document.createElement('div');
    errorBox.className = 'parchment-diagram-error';

    const errorMsg = error instanceof Error ? error.message : String(error);
    errorBox.innerHTML = `
      <p class="error-msg">Mermaid Diagram Error: Unable to render syntax</p>
      <details>
        <summary>View raw diagram source and error</summary>
        <pre><code>${this.escapeHtml(rawCode)}</code></pre>
        <p class="error-cause">${this.escapeHtml(errorMsg)}</p>
      </details>
    `;
    return errorBox;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
