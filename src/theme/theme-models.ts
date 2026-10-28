export type ThemeMode = 'system' | 'light' | 'dark' | 'sepia';
export type ResolvedTheme = 'light' | 'dark' | 'sepia';

export interface ThemePalette {
  name: ResolvedTheme;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  codeBackground: string;
}
