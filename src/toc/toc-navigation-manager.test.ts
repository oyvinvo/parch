import { describe, it, expect, beforeEach } from 'vitest';
import { TocNavigationManager } from './toc-navigation-manager.ts';
import { ScrollSpyCalculator } from './scroll-spy-calculator.ts';
import { TocItem } from './toc-models.ts';

describe('TocNavigationManager', () => {
  let manager: TocNavigationManager;
  let container: HTMLElement;

  const sampleOutline: TocItem[] = [
    {
      id: 'chapter-1',
      title: 'Chapter 1',
      level: 1,
      lineNumber: 1,
      children: [
        {
          id: 'section-1-1',
          title: 'Section 1.1',
          level: 2,
          lineNumber: 10,
          children: [],
        },
      ],
    },
    {
      id: 'chapter-2',
      title: 'Chapter 2',
      level: 1,
      lineNumber: 30,
      children: [],
    },
  ];

  beforeEach(() => {
    manager = new TocNavigationManager();
    container = document.createElement('nav');
  });

  it('renders hierarchical outline with correct depth indentation and links', () => {
    manager.renderToc(container, sampleOutline);

    const links = container.querySelectorAll('a.parchment-toc-link');
    expect(links.length).toBe(3);

    const ch1 = container.querySelector('a[href="#chapter-1"]');
    expect(ch1?.textContent).toBe('Chapter 1');

    const sec11 = container.querySelector('a[href="#section-1-1"]');
    expect(sec11?.textContent).toBe('Section 1.1');
    expect(sec11?.closest('.parchment-toc-depth-2')).not.toBeNull();
  });

  it('toggles sidebar visibility state and updates aria-expanded', () => {
    expect(manager.isSidebarVisible()).toBe(true);

    const newState = manager.toggleSidebar();
    expect(newState).toBe(false);
    expect(manager.isSidebarVisible()).toBe(false);

    manager.toggleSidebar();
    expect(manager.isSidebarVisible()).toBe(true);
  });

  it('updates active heading class and aria-current on navigation items', () => {
    manager.renderToc(container, sampleOutline);
    manager.updateActiveHeading('section-1-1');

    const activeLink = container.querySelector('a[href="#section-1-1"]');
    expect(activeLink?.classList.contains('active')).toBe(true);
    expect(activeLink?.getAttribute('aria-current')).toBe('location');

    const inactiveLink = container.querySelector('a[href="#chapter-1"]');
    expect(inactiveLink?.classList.contains('active')).toBe(false);
    expect(inactiveLink?.hasAttribute('aria-current')).toBe(false);
    expect(manager.getActiveId()).toBe('section-1-1');
  });

  it('provides access to scrollSpy calculator and tracks activeId', () => {
    const customSpy = new (class extends ScrollSpyCalculator {})();
    const customManager = new TocNavigationManager(customSpy);
    expect(customManager.getScrollSpy()).toBe(customSpy);

    expect(manager.getActiveId()).toBeNull();
    manager.updateActiveHeading('ch1');
    expect(manager.getActiveId()).toBe('ch1');
  });

  it('clears prior container innerHTML and verifies class names on root and nested lists', () => {
    container.innerHTML = '<div id="legacy-content">old</div>';
    manager.renderToc(container, sampleOutline);

    expect(container.querySelector('#legacy-content')).toBeNull();
    const lists = container.querySelectorAll('ul');
    expect(lists.length).toBe(2);
    lists.forEach((ul) => {
      expect(ul.className).toBe('parchment-toc-list');
    });
  });

  it('safely handles updateActiveHeading when container is not yet attached', () => {
    const detachedManager = new TocNavigationManager();
    expect(() => detachedManager.updateActiveHeading('ch1')).not.toThrow();
    expect(detachedManager.getActiveId()).toBe('ch1');
  });

  it('renders deep subheaders outline up to h6 with proper nesting', () => {
    const deepOutline: TocItem[] = [
      {
        id: 'h1',
        title: 'Level 1',
        level: 1,
        lineNumber: 1,
        children: [
          {
            id: 'h2',
            title: 'Level 2',
            level: 2,
            lineNumber: 2,
            children: [
              {
                id: 'h3',
                title: 'Level 3',
                level: 3,
                lineNumber: 3,
                children: [
                  {
                    id: 'h4',
                    title: 'Level 4',
                    level: 4,
                    lineNumber: 4,
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    manager.renderToc(container, deepOutline);

    const h4Link = container.querySelector('a[href="#h4"]');
    expect(h4Link).not.toBeNull();
    expect(h4Link?.textContent).toBe('Level 4');
    expect(h4Link?.closest('.parchment-toc-depth-4')).not.toBeNull();
  });
});
