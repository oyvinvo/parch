import { TocItem } from './toc-models.ts';
import { ScrollSpyCalculator } from './scroll-spy-calculator.ts';

export class TocNavigationManager {
  private isVisible: boolean = true;
  private activeId: string | null = null;
  private scrollSpy: ScrollSpyCalculator;
  private container: HTMLElement | null = null;

  constructor(scrollSpy?: ScrollSpyCalculator) {
    this.scrollSpy = scrollSpy ?? new ScrollSpyCalculator();
  }

  isSidebarVisible(): boolean {
    return this.isVisible;
  }

  getActiveId(): string | null {
    return this.activeId;
  }

  toggleSidebar(): boolean {
    this.isVisible = !this.isVisible;
    return this.isVisible;
  }

  renderToc(container: HTMLElement, outline: TocItem[]): void {
    this.container = container;
    container.innerHTML = '';

    const listElement = document.createElement('ul');
    listElement.className = 'parchment-toc-list';
    this.renderTocItems(listElement, outline);
    container.appendChild(listElement);
  }

  updateActiveHeading(activeId: string): void {
    this.activeId = activeId;
    if (!this.container) {
      return;
    }

    const links = this.container.querySelectorAll<HTMLAnchorElement>('a.parchment-toc-link');
    const targetHref = `#${activeId}`;
    links.forEach((link) => {
      const isMatch = link.getAttribute('href') === targetHref;
      link.classList.toggle('active', isMatch);
      if (isMatch) {
        link.setAttribute('aria-current', 'location');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  getScrollSpy(): ScrollSpyCalculator {
    return this.scrollSpy;
  }

  private renderTocItems(parent: HTMLElement, items: TocItem[]): void {
    for (const item of items) {
      const listItem = document.createElement('li');
      listItem.className = `parchment-toc-item parchment-toc-depth-${item.level}`;

      const link = document.createElement('a');
      link.className = 'parchment-toc-link';
      link.href = `#${item.id}`;
      link.textContent = item.title;
      listItem.appendChild(link);

      if (item.children.length > 0) {
        const nestedList = document.createElement('ul');
        nestedList.className = 'parchment-toc-list';
        this.renderTocItems(nestedList, item.children);
        listItem.appendChild(nestedList);
      }

      parent.appendChild(listItem);
    }
  }
}
