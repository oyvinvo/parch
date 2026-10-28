import { describe, it, expect } from 'vitest';
import { HtmlSanitizerAdapter } from './html-sanitizer-adapter.ts';

describe('HtmlSanitizerAdapter (Frontend Defense-in-Depth Sanitizer)', () => {
  const sanitizer = new HtmlSanitizerAdapter();

  it('strips script tags completely from untrusted markdown html', () => {
    const dirty = '<p>Safe text</p><script>alert("xss")</script>';
    const clean = sanitizer.sanitize(dirty);

    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('alert("xss")');
    expect(clean).toContain('Safe text');
  });

  it('strips onerror and event handlers from image tags', () => {
    const dirty = '<img src="x" onerror="window.pwned=true" alt="test" />';
    const clean = sanitizer.sanitize(dirty);

    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('pwned');
    expect(clean).toContain('<img');
  });

  it('neutralizes javascript: URIs in anchor links', () => {
    const dirty = '<a href="javascript:alert(1)">Click me</a>';
    const clean = sanitizer.sanitize(dirty);

    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('Click me');
  });

  it('preserves valid GFM tags, attributes, and semantic alert asides', () => {
    const safe = '<aside class="markdown-alert markdown-alert-note" data-alert-type="note"><p>Info</p></aside>';
    const clean = sanitizer.sanitize(safe);

    expect(clean).toContain('markdown-alert-note');
    expect(clean).toContain('data-alert-type="note"');
    expect(clean).toContain('Info');
  });
});
