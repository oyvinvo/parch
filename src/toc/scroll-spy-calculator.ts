import { HeadingOffset } from './toc-models.ts';

export class ScrollSpyCalculator {
  /**
   * Pure calculation determining active heading slug from scroll position and heading offsets.
   */
  calculateActiveHeading(
    headings: HeadingOffset[],
    currentScrollTop: number,
    viewportOffset: number = 80
  ): string | null {
    if (headings.length === 0) {
      return null;
    }

    const scrollTarget = currentScrollTop + viewportOffset;
    let activeId: string = headings[0].id;

    for (const heading of headings) {
      if (heading.offsetTop <= scrollTarget) {
        activeId = heading.id;
      }
    }

    return activeId;
  }

  findActiveHeadingId(
    headings: HeadingOffset[],
    currentScrollTop: number,
    viewportOffset: number = 80
  ): string | null {
    return this.calculateActiveHeading(headings, currentScrollTop, viewportOffset);
  }
}
