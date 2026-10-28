import { describe, it, expect } from 'vitest';
import { ThemeResolver } from './theme-resolver.ts';

describe('ThemeResolver (Pure Theme Mapping)', () => {
  const resolver = new ThemeResolver();

  it('resolves system mode to dark when OS is dark', () => {
    expect(resolver.resolveTheme('system', true)).toBe('dark');
  });

  it('resolves system mode to light when OS is not dark', () => {
    expect(resolver.resolveTheme('system', false)).toBe('light');
  });

  it('respects explicit light mode regardless of OS preference', () => {
    expect(resolver.resolveTheme('light', true)).toBe('light');
    expect(resolver.resolveTheme('light', false)).toBe('light');
  });

  it('respects explicit dark mode regardless of OS preference', () => {
    expect(resolver.resolveTheme('dark', true)).toBe('dark');
    expect(resolver.resolveTheme('dark', false)).toBe('dark');
  });

  it('respects explicit sepia mode regardless of OS preference', () => {
    expect(resolver.resolveTheme('sepia', true)).toBe('sepia');
    expect(resolver.resolveTheme('sepia', false)).toBe('sepia');
  });

  it('provides WCAG AA compliant contrast palette tokens for sepia', () => {
    const palette = resolver.getPalette('sepia');
    expect(palette).not.toBeNull();
    expect(palette?.name).toBe('sepia');
    expect(palette?.backgroundColor).toBe('#FBF0D9');
    expect(palette?.textColor).toBe('#2C221E');
    expect(palette?.accentColor).toBe('#8C4303');
    expect(palette?.codeBackground).toBe('#F0E2C8');
  });

  it('provides WCAG AA compliant contrast palette tokens for light', () => {
    const palette = resolver.getPalette('light');
    expect(palette).not.toBeNull();
    expect(palette?.name).toBe('light');
    expect(palette?.backgroundColor).toBe('#FFFFFF');
    expect(palette?.textColor).toBe('#1A1A1A');
    expect(palette?.accentColor).toBe('#0969DA');
    expect(palette?.codeBackground).toBe('#F6F8FA');
  });

  it('provides WCAG AA compliant contrast palette tokens for dark', () => {
    const palette = resolver.getPalette('dark');
    expect(palette).not.toBeNull();
    expect(palette?.name).toBe('dark');
    expect(palette?.backgroundColor).toBe('#0D1117');
    expect(palette?.textColor).toBe('#E6EDF3');
    expect(palette?.accentColor).toBe('#2F81F7');
    expect(palette?.codeBackground).toBe('#161B22');
  });

  it('verifies contrast ratio >= 4.5:1 for normal text across all palettes', () => {
    function srgbToLin(c: number): number {
      const norm = c / 255.0;
      return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
    }
    function relativeLuminance(hex: string): number {
      const clean = hex.replace('#', '');
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
    }
    function contrastRatio(hex1: string, hex2: string): number {
      const l1 = relativeLuminance(hex1);
      const l2 = relativeLuminance(hex2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    const themes: Array<'light' | 'dark' | 'sepia'> = ['light', 'dark', 'sepia'];
    for (const theme of themes) {
      const p = resolver.getPalette(theme)!;
      const textContrast = contrastRatio(p.textColor, p.backgroundColor);
      expect(textContrast).toBeGreaterThanOrEqual(4.5);

      const accentContrast = contrastRatio(p.accentColor, p.backgroundColor);
      expect(accentContrast).toBeGreaterThanOrEqual(3.0);
    }
  });

  it('returns null for unknown theme palette', () => {
    expect(resolver.getPalette('unknown' as any)).toBeNull();
  });
});
