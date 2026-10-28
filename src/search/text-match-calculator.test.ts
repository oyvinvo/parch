import { describe, it, expect } from 'vitest';
import { TextMatchCalculator } from './text-match-calculator.ts';

describe('TextMatchCalculator (Pure Calculation)', () => {
  const calculator = new TextMatchCalculator();

  it('finds case-insensitive occurrences of query in text', () => {
    const text = 'Parchment is a fast Markdown reader. parchment is distraction-free.';
    const matches = calculator.findMatches(text, 'parchment');

    expect(matches.length).toBe(2);
    expect(matches[0].startOffset).toBe(0);
    expect(matches[0].endOffset).toBe(9);
    expect(matches[1].startOffset).toBe(37);
    expect(matches[1].endOffset).toBe(46);
  });

  it('returns empty array when query is empty or not found', () => {
    expect(calculator.findMatches('Sample text', '')).toEqual([]);
    expect(calculator.findMatches('', 'query')).toEqual([]);
    expect(calculator.findMatches('Sample text', 'nonexistent')).toEqual([]);
  });

  it('accurately indexes adjacent non-overlapping occurrences', () => {
    const matches = calculator.findMatches('aaaa', 'aa');
    expect(matches.length).toBe(2);
    expect(matches[0]).toEqual({ index: 0, startOffset: 0, endOffset: 2 });
    expect(matches[1]).toEqual({ index: 1, startOffset: 2, endOffset: 4 });
  });

  it('cycles next index with wrap-around', () => {
    expect(calculator.calculateNextIndex(0, 3)).toBe(1);
    expect(calculator.calculateNextIndex(1, 3)).toBe(2);
    expect(calculator.calculateNextIndex(2, 3)).toBe(0); // wrap around
    expect(calculator.calculateNextIndex(0, 0)).toBe(0);
  });

  it('cycles previous index with wrap-around', () => {
    expect(calculator.calculatePrevIndex(0, 3)).toBe(2); // wrap around to last
    expect(calculator.calculatePrevIndex(2, 3)).toBe(1);
    expect(calculator.calculatePrevIndex(1, 3)).toBe(0);
    expect(calculator.calculatePrevIndex(0, 0)).toBe(0);
  });

  it('formats match counter string accurately', () => {
    expect(calculator.formatMatchCounter(0, 14)).toBe('1 of 14');
    expect(calculator.formatMatchCounter(5, 14)).toBe('6 of 14');
    expect(calculator.formatMatchCounter(0, 0)).toBe('0 matches');
  });
});
