export interface SearchMatch {
  index: number;
  startOffset: number;
  endOffset: number;
}

export interface SearchState {
  query: string;
  totalMatches: number;
  activeMatchIndex: number;
  isOpen: boolean;
}
