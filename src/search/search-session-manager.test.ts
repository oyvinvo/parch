import { describe, it, expect, beforeEach } from 'vitest';
import { SearchSessionManager } from './search-session-manager.ts';

describe('SearchSessionManager', () => {
  let manager: SearchSessionManager;
  let container: HTMLElement;

  beforeEach(() => {
    manager = new SearchSessionManager();
    container = document.createElement('article');
    container.innerHTML = `
      <p>Parchment renders markdown quickly. With Parchment, reading is clean.</p>
    `;
    manager.attachContainer(container);
  });

  it('opens and closes search bar state', () => {
    expect(manager.getState().isOpen).toBe(false);

    manager.openSearch();
    expect(manager.getState().isOpen).toBe(true);

    manager.closeSearch();
    expect(manager.getState().isOpen).toBe(false);
  });

  it('highlights occurrences with mark tags and updates match counts', () => {
    manager.openSearch();
    manager.search('Parchment');

    const state = manager.getState();
    expect(state.totalMatches).toBe(2);
    expect(state.activeMatchIndex).toBe(0);

    const marks = container.querySelectorAll('mark.parchment-search-match');
    expect(marks.length).toBe(2);
    expect(marks[0].classList.contains('active')).toBe(true);
  });

  it('cycles active match forward on nextMatch', () => {
    manager.openSearch();
    manager.search('Parchment');

    manager.nextMatch();
    expect(manager.getState().activeMatchIndex).toBe(1);

    const marks = container.querySelectorAll('mark.parchment-search-match');
    expect(marks[1].classList.contains('active')).toBe(true);
    expect(marks[0].classList.contains('active')).toBe(false);
  });

  it('removes all mark tags from DOM on closeSearch', () => {
    manager.openSearch();
    manager.search('Parchment');
    expect(container.querySelectorAll('mark.parchment-search-match').length).toBe(2);

    manager.closeSearch();
    expect(container.querySelectorAll('mark.parchment-search-match').length).toBe(0);
    expect(container.textContent).toContain('Parchment renders markdown quickly.');
    expect(manager.getState().query).toBe('');
    expect(manager.getState().totalMatches).toBe(0);
    expect(manager.getState().activeMatchIndex).toBe(0);
  });

  it('navigates previous match and handles zero totalMatches guard', () => {
    manager.openSearch();
    manager.nextMatch(); // totalMatches is 0
    manager.prevMatch(); // totalMatches is 0
    expect(manager.getState().activeMatchIndex).toBe(0);

    manager.search('Parchment');
    expect(manager.getState().activeMatchIndex).toBe(0);
    manager.prevMatch(); // cycles to last match (index 1)
    expect(manager.getState().activeMatchIndex).toBe(1);

    const marks = container.querySelectorAll('mark.parchment-search-match');
    expect(marks[1].classList.contains('active')).toBe(true);

    manager.search(''); // empty search clears
    expect(manager.getState().totalMatches).toBe(0);
    expect(manager.getState().activeMatchIndex).toBe(0);
  });

  it('supports calculator access and detached container operations', () => {
    const detached = new SearchSessionManager();
    expect(detached.getCalculator()).toBeDefined();

    expect(() => {
      detached.search('test');
      detached.nextMatch();
      detached.prevMatch();
      detached.closeSearch();
    }).not.toThrow();
  });

  it('correctly slices surrounding text when match is at start, middle, and end of text node', () => {
    container.innerHTML = '<p>Parchment and more Parchment text here</p>';
    manager.search('Parchment');

    const marks = container.querySelectorAll('mark.parchment-search-match');
    expect(marks.length).toBe(2);
    expect(marks[0].textContent).toBe('Parchment');
    expect(marks[1].textContent).toBe('Parchment');

    // Verify surrounding text nodes
    expect(container.textContent).toBe('Parchment and more Parchment text here');
  });
});
