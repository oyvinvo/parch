import { SearchMatch } from './search-models.ts';

export class TextMatchCalculator {
  /**
   * Pure calculation finding all substring occurrences case-insensitively.
   */
  findMatches(text: string, query: string): SearchMatch[] {
    if (!text || !query) {
      return [];
    }

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matches: SearchMatch[] = [];
    let matchIndex = 0;
    let searchPosition = lowerText.indexOf(lowerQuery, 0);

    while (searchPosition !== -1) {
      matches.push({
        index: matchIndex,
        startOffset: searchPosition,
        endOffset: searchPosition + query.length,
      });
      matchIndex += 1;
      searchPosition = lowerText.indexOf(lowerQuery, searchPosition + query.length);
    }

    return matches;
  }

  calculateNextIndex(currentIndex: number, totalMatches: number): number {
    if (totalMatches <= 0) {
      return 0;
    }
    return (currentIndex + 1) % totalMatches;
  }

  calculatePrevIndex(currentIndex: number, totalMatches: number): number {
    if (totalMatches <= 0) {
      return 0;
    }
    return (currentIndex - 1 + totalMatches) % totalMatches;
  }

  formatMatchCounter(activeMatchIndex: number, totalMatches: number): string {
    if (totalMatches <= 0) {
      return '0 matches';
    }
    return `${activeMatchIndex + 1} of ${totalMatches}`;
  }
}
