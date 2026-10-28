import { SearchState } from './search-models.ts';
import { TextMatchCalculator } from './text-match-calculator.ts';

export class SearchSessionManager {
  private calculator: TextMatchCalculator;
  private state: SearchState;
  private contentContainer: HTMLElement | null = null;

  constructor(calculator?: TextMatchCalculator) {
    this.calculator = calculator ?? new TextMatchCalculator();
    this.state = {
      query: '',
      totalMatches: 0,
      activeMatchIndex: 0,
      isOpen: false,
    };
  }

  attachContainer(container: HTMLElement): void {
    this.contentContainer = container;
  }

  getState(): SearchState {
    return { ...this.state };
  }

  openSearch(): void {
    this.state.isOpen = true;
  }

  closeSearch(): void {
    this.state.isOpen = false;
    this.clearHighlights();
    this.state.query = '';
    this.state.totalMatches = 0;
    this.state.activeMatchIndex = 0;
  }

  search(query: string): void {
    this.clearHighlights();
    this.state.query = query;

    if (!query || !this.contentContainer) {
      this.state.totalMatches = 0;
      this.state.activeMatchIndex = 0;
      return;
    }

    const marks = this.highlightMatchesInContainer(this.contentContainer, query);
    this.state.totalMatches = marks.length;
    this.state.activeMatchIndex = 0;

    if (marks.length > 0) {
      marks[0].classList.add('active');
    }
  }

  nextMatch(): void {
    if (this.state.totalMatches <= 0) {
      return;
    }
    this.state.activeMatchIndex = this.calculator.calculateNextIndex(
      this.state.activeMatchIndex,
      this.state.totalMatches
    );
    this.updateActiveMarkClass();
  }

  prevMatch(): void {
    if (this.state.totalMatches <= 0) {
      return;
    }
    this.state.activeMatchIndex = this.calculator.calculatePrevIndex(
      this.state.activeMatchIndex,
      this.state.totalMatches
    );
    this.updateActiveMarkClass();
  }

  getCalculator(): TextMatchCalculator {
    return this.calculator;
  }

  private updateActiveMarkClass(): void {
    if (!this.contentContainer) {
      return;
    }
    const marks = this.contentContainer.querySelectorAll<HTMLElement>('mark.parchment-search-match');
    marks.forEach((mark, index) => {
      mark.classList.toggle('active', index === this.state.activeMatchIndex);
    });
  }

  private clearHighlights(): void {
    if (!this.contentContainer) {
      return;
    }
    const marks = this.contentContainer.querySelectorAll('mark.parchment-search-match');
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });
  }

  private highlightMatchesInContainer(container: HTMLElement, query: string): HTMLElement[] {
    const textNodes = this.collectTextNodes(container);
    const createdMarks: HTMLElement[] = [];

    for (const node of textNodes) {
      const text = node.nodeValue || '';
      const matches = this.calculator.findMatches(text, query);
      if (matches.length > 0) {
        const marks = this.splitNodeAndWrapMatches(node, text, matches);
        createdMarks.push(...marks);
      }
    }

    return createdMarks;
  }

  private collectTextNodes(root: Node): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let currentNode = walker.nextNode();

    while (currentNode) {
      textNodes.push(currentNode as Text);
      currentNode = walker.nextNode();
    }

    return textNodes;
  }

  private splitNodeAndWrapMatches(
    node: Text,
    text: string,
    matches: Array<{ startOffset: number; endOffset: number }>
  ): HTMLElement[] {
    const fragment = document.createDocumentFragment();
    const marks: HTMLElement[] = [];
    let lastIndex = 0;

    for (const match of matches) {
      if (match.startOffset > lastIndex) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.startOffset)));
      }

      const mark = document.createElement('mark');
      mark.className = 'parchment-search-match';
      mark.textContent = text.substring(match.startOffset, match.endOffset);
      fragment.appendChild(mark);
      marks.push(mark);

      lastIndex = match.endOffset;
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    node.parentNode?.replaceChild(fragment, node);
    return marks;
  }
}
