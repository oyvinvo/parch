import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MathRenderService } from './math-render-service.ts';
import { IKatexAdapter } from './katex-adapter.ts';

describe('MathRenderService', () => {
  let mockAdapter: IKatexAdapter;
  let service: MathRenderService;
  let container: HTMLElement;

  beforeEach(() => {
    mockAdapter = {
      renderToString: vi.fn(),
    };
    service = new MathRenderService(mockAdapter);
    container = document.createElement('div');
  });

  it('renders inline math expressions with KaTeX typography', () => {
    container.innerHTML = '<p>Energy formula: $E = mc^2$ in physics.</p>';
    vi.mocked(mockAdapter.renderToString).mockReturnValue('<span class="katex">E=mc^2</span>');

    service.renderMathInContainer(container);

    expect(mockAdapter.renderToString).toHaveBeenCalledWith(
      'E = mc^2',
      { displayMode: false, throwOnError: false, errorColor: '#cc0000' }
    );
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.textContent).toContain('Energy formula: ');
    expect(container.textContent).toContain(' in physics.');
  });

  it('renders display block math expressions centered with displayMode true', () => {
    container.innerHTML = '<p>Quadratic formula: $$\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$</p>';
    vi.mocked(mockAdapter.renderToString).mockReturnValue('<div class="katex-display">quadratic</div>');

    service.renderMathInContainer(container);

    expect(mockAdapter.renderToString).toHaveBeenCalledWith(
      '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
      { displayMode: true, throwOnError: false, errorColor: '#cc0000' }
    );
    expect(container.querySelector('.katex-display')).not.toBeNull();
  });

  it('skips math parsing inside code and pre tags', () => {
    container.innerHTML = '<pre><code>$not_math$</code></pre><p><code>$also_not_math$</code></p>';
    service.renderMathInContainer(container);

    expect(mockAdapter.renderToString).not.toHaveBeenCalled();
    expect(container.textContent).toContain('$not_math$');
  });

  it('safely handles text with unmatched dollar sign and preserves plain text', () => {
    container.innerHTML = '<p>Cost is $50 only and no formula.</p>';
    service.renderMathInContainer(container);

    expect(mockAdapter.renderToString).not.toHaveBeenCalled();
    expect(container.textContent).toBe('Cost is $50 only and no formula.');
  });

  it('renders multiple math expressions in a single text node with correct text fragmentation', () => {
    container.innerHTML = '<p>Before $a$ Middle $$b$$ After</p>';
    vi.mocked(mockAdapter.renderToString).mockImplementation((expr, opts) => {
      return opts.displayMode ? `<div class="katex-display">${expr}</div>` : `<span class="katex">${expr}</span>`;
    });

    service.renderMathInContainer(container);

    expect(mockAdapter.renderToString).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.katex')?.textContent).toBe('a');
    expect(container.querySelector('.katex-display')?.textContent).toBe('b');
    expect(container.textContent).toContain('Before ');
    expect(container.textContent).toContain(' Middle ');
    expect(container.textContent).toContain(' After');
  });

  it('handles invalid math syntax with non-crashing red fallback without throwing', () => {
    container.innerHTML = '<p>Broken formula: $\\frac{1}{$</p>';
    vi.mocked(mockAdapter.renderToString).mockReturnValue(
      '<span class="katex-error" style="color:#cc0000">\\frac{1}{</span>'
    );

    expect(() => service.renderMathInContainer(container)).not.toThrow();
    expect(container.querySelector('.katex-error')).not.toBeNull();
  });
});
