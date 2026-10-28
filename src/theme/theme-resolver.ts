import { ResolvedTheme, ThemeMode, ThemePalette } from './theme-models.ts';

export class ThemeResolver {
  /**
   * Pure mapping from user preference + OS dark state to active theme.
   */
  resolveTheme(mode: ThemeMode, systemIsDark: boolean): ResolvedTheme {
    if (mode === 'sepia') {
      return 'sepia';
    }
    if (mode === 'dark') {
      return 'dark';
    }
    if (mode === 'light') {
      return 'light';
    }
    return systemIsDark ? 'dark' : 'light';
  }

  getPalette(theme: ResolvedTheme): ThemePalette | null {
    if (theme === 'sepia') {
      return this.getSepiaPalette();
    }
    if (theme === 'dark') {
      return this.getDarkPalette();
    }
    if (theme === 'light') {
      return this.getLightPalette();
    }
    return null;
  }

  private getSepiaPalette(): ThemePalette {
    return {
      name: 'sepia',
      backgroundColor: '#FBF0D9',
      textColor: '#2C221E',
      accentColor: '#8C4303',
      codeBackground: '#F0E2C8',
    };
  }

  private getDarkPalette(): ThemePalette {
    return {
      name: 'dark',
      backgroundColor: '#0D1117',
      textColor: '#E6EDF3',
      accentColor: '#2F81F7',
      codeBackground: '#161B22',
    };
  }

  private getLightPalette(): ThemePalette {
    return {
      name: 'light',
      backgroundColor: '#FFFFFF',
      textColor: '#1A1A1A',
      accentColor: '#0969DA',
      codeBackground: '#F6F8FA',
    };
  }
}
