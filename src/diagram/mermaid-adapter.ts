import mermaid from 'mermaid';

export interface IMermaidAdapter {
  render(id: string, code: string, theme: string): Promise<string>;
}

export class MermaidAdapter implements IMermaidAdapter {
  private isInitialized = false;

  async render(id: string, code: string, theme: string): Promise<string> {
    if (!this.isInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: this.mapTheme(theme),
        securityLevel: 'strict',
      });
      this.isInitialized = true;
    }
    const { svg } = await mermaid.render(id, code);
    return svg;
  }

  private mapTheme(theme: string): 'default' | 'dark' | 'neutral' {
    if (theme === 'dark') {
      return 'dark';
    }
    if (theme === 'sepia') {
      return 'neutral';
    }
    return 'default';
  }
}
