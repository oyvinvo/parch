import { describe, it, expect, beforeEach } from 'vitest';
import { AlertCalloutBuilder } from './alert-callout-builder.ts';

describe('AlertCalloutBuilder', () => {
  let builder: AlertCalloutBuilder;
  let container: HTMLElement;

  beforeEach(() => {
    builder = new AlertCalloutBuilder();
    container = document.createElement('div');
  });

  it('enhances note alert with svg icon, title badge and accessibility role', () => {
    container.innerHTML = `
      <aside class="markdown-alert markdown-alert-note" data-alert-type="note">
        <p>This is important context.</p>
      </aside>
    `;

    builder.enhanceContainer(container);
    const alert = container.querySelector('.markdown-alert-note') as HTMLElement;

    expect(alert).not.toBeNull();
    expect(alert.getAttribute('role')).toBe('region');
    expect(alert.getAttribute('aria-label')).toBe('Note');
    expect(alert.querySelector('.markdown-alert-title')?.textContent?.trim()).toBe('Note');
    expect(alert.querySelector('svg')).not.toBeNull();
  });

  it('enhances warning alert with warning title and distinct styling', () => {
    container.innerHTML = `
      <aside class="markdown-alert markdown-alert-warning" data-alert-type="warning">
        <p>Do not run this in production!</p>
      </aside>
    `;

    builder.enhanceContainer(container);
    const alert = container.querySelector('.markdown-alert-warning') as HTMLElement;

    expect(alert).not.toBeNull();
    expect(alert.getAttribute('aria-label')).toBe('Warning');
    expect(alert.querySelector('.markdown-alert-title')?.textContent?.trim()).toBe('Warning');
  });

  it('leaves standard blockquotes unenhanced', () => {
    container.innerHTML = `<blockquote><p>Normal quotation text.</p></blockquote>`;
    builder.enhanceContainer(container);

    const bq = container.querySelector('blockquote');
    expect(bq?.querySelector('.markdown-alert-title')).toBeNull();
    expect(bq?.getAttribute('role')).toBeNull();
  });

  it('returns valid metadata for all 5 GitHub alert types', () => {
    const types = ['note', 'tip', 'important', 'warning', 'caution'] as const;
    for (const type of types) {
      const meta = builder.getAlertMetadata(type);
      expect(meta).not.toBeNull();
      expect(meta?.type).toBe(type);
      expect(meta?.title.length).toBeGreaterThan(0);
      expect(meta?.iconSvg).toContain('<svg');
    }
  });

  it('handles unknown alert types and avoids duplicating existing titles', () => {
    container.innerHTML = `
      <aside class="markdown-alert" data-alert-type="unknown"><p>Unknown</p></aside>
      <aside class="markdown-alert markdown-alert-tip" data-alert-type="tip">
        <div class="markdown-alert-title">Existing Tip</div>
        <p>Tip text</p>
      </aside>
    `;

    builder.enhanceContainer(container);
    const unknownAlert = container.querySelector('[data-alert-type="unknown"]');
    expect(unknownAlert?.querySelector('.markdown-alert-title')).toBeNull();

    const tipAlert = container.querySelector('[data-alert-type="tip"]');
    const titles = tipAlert?.querySelectorAll('.markdown-alert-title');
    expect(titles?.length).toBe(1);
    expect(titles?.[0]?.textContent?.trim()).toBe('Existing Tip');
    expect(builder.getAlertMetadata('unknown' as any)).toBeNull();
  });
});
