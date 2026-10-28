import { describe, it, expect } from 'vitest';
import { ScrollSpyCalculator } from './scroll-spy-calculator.ts';
import { HeadingOffset } from './toc-models.ts';

describe('ScrollSpyCalculator (Pure Calculation)', () => {
  const calculator = new ScrollSpyCalculator();

  const headings: HeadingOffset[] = [
    { id: 'intro', offsetTop: 100 },
    { id: 'features', offsetTop: 500 },
    { id: 'installation', offsetTop: 1000 },
    { id: 'license', offsetTop: 1800 },
  ];

  it('returns null when no headings exist', () => {
    expect(calculator.calculateActiveHeading([], 200)).toBeNull();
  });

  it('selects first heading when scrolled before or near first heading', () => {
    // Current scroll 120 with viewportOffset 80 (scroll target 200 >= 100)
    const active = calculator.calculateActiveHeading(headings, 50, 80);
    expect(active).toBe('intro');
  });

  it('selects middle heading when scrolled between features and installation', () => {
    // Scrolled to 600, target 680 (>= 500 and < 1000)
    const active = calculator.calculateActiveHeading(headings, 600, 80);
    expect(active).toBe('features');
  });

  it('selects heading on exact scrollTarget boundary (<= operator)', () => {
    // Exactly at 500: currentScrollTop 420 + viewportOffset 80 = 500
    const active = calculator.calculateActiveHeading(headings, 420, 80);
    expect(active).toBe('features');
  });

  it('uses addition for scrollTarget and kills subtraction mutant', () => {
    // 450 + 60 = 510 >= 500 ('features'). If subtraction: 450 - 60 = 390 < 500 ('intro').
    const active = calculator.calculateActiveHeading(headings, 450, 60);
    expect(active).toBe('features');
  });

  it('uses default viewportOffset of 80 when parameter is omitted', () => {
    // 420 + default 80 = 500 ('features')
    const active = calculator.calculateActiveHeading(headings, 420);
    expect(active).toBe('features');
  });

  it('selects last heading when scrolled to bottom of document', () => {
    const active = calculator.calculateActiveHeading(headings, 2500, 80);
    expect(active).toBe('license');
  });

  it('delegates findActiveHeadingId to calculateActiveHeading', () => {
    const active = calculator.findActiveHeadingId(headings, 600, 80);
    expect(active).toBe('features');
  });
});
