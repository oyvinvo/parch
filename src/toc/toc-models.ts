export interface HeadingOffset {
  id: string;
  offsetTop: number;
}

export interface TocItem {
  id: string;
  title: string;
  level: number;
  lineNumber: number;
  children: TocItem[];
}
