import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiagramRenderService } from './diagram-render-service.ts';
import { IMermaidAdapter } from './mermaid-adapter.ts';

describe('DiagramRenderService', () => {
  let mockAdapter: IMermaidAdapter;
  let service: DiagramRenderService;
  let container: HTMLElement;

  beforeEach(() => {
    mockAdapter = {
      render: vi.fn(),
    };
    service = new DiagramRenderService(mockAdapter);
    container = document.createElement('div');
  });

  it('renders valid mermaid diagram into inline responsive SVG container', async () => {
    container.innerHTML = `
      <pre><code class="language-mermaid">graph TD\n  A --> B</code></pre>
    `;
    vi.mocked(mockAdapter.render).mockResolvedValue('<svg id="m1"><g></g></svg>');

    await service.renderDiagramsInContainer(container, 'dark');

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(mockAdapter.render).toHaveBeenCalled();
  });

  it('renders isolated error boundary with expandable raw snippet on invalid syntax without crashing', async () => {
    container.innerHTML = `
      <pre><code class="language-mermaid">graph Broken --> %% error</code></pre>
    `;
    vi.mocked(mockAdapter.render).mockRejectedValue(new Error('Parse error on line 1'));

    await service.renderDiagramsInContainer(container, 'default');

    const errorBox = container.querySelector('.parchment-diagram-error');
    expect(errorBox).not.toBeNull();
    expect(errorBox?.textContent).toContain('Mermaid Diagram Error: Unable to render syntax');

    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    expect(details?.textContent).toContain('graph Broken --> %% error');
    expect(details?.textContent).toContain('Parse error on line 1');
  });

  it('uses default theme name and creates diagram container wrapper with correct class', async () => {
    container.innerHTML = `<code class="language-mermaid">graph LR\n X --> Y</code>`;
    vi.mocked(mockAdapter.render).mockResolvedValue('<svg id="m2"></svg>');

    await service.renderDiagramsInContainer(container);

    expect(mockAdapter.render).toHaveBeenCalledWith(
      expect.stringContaining('parchment-diagram-0-'),
      'graph LR\n X --> Y',
      'default'
    );
    const wrapper = container.querySelector('.parchment-diagram-container');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.innerHTML).toBe('<svg id="m2"></svg>');
  });

  it('handles non-Error rejection and escapes HTML in raw snippet and error cause', async () => {
    container.innerHTML = `<pre><code class="language-mermaid">A &lt; B --> C & D</code></pre>`;
    vi.mocked(mockAdapter.render).mockRejectedValue('String error & failure');

    await service.renderDiagramsInContainer(container, 'sepia');

    const errorBox = container.querySelector('.parchment-diagram-error');
    expect(errorBox).not.toBeNull();
    expect(errorBox?.querySelector('.error-cause')?.textContent).toContain('String error & failure');
    expect(errorBox?.querySelector('summary')?.textContent).toBe('View raw diagram source and error');
  });
});
