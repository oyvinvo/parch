import { ResolvedTheme, ThemeMode } from './theme-models.ts';
import { ThemeResolver } from './theme-resolver.ts';
import { IIpcAdapter } from '../document/tauri-ipc-adapter.ts';

export class ThemeManager {
  private mode: ThemeMode = 'system';
  private systemIsDark: boolean = false;
  private resolver: ThemeResolver;
  private ipc: IIpcAdapter | null = null;

  constructor(resolver?: ThemeResolver, ipc?: IIpcAdapter) {
    this.resolver = resolver ?? new ThemeResolver();
    this.ipc = ipc ?? null;
    this.applyTheme();
  }

  getMode(): ThemeMode {
    return this.mode;
  }

  getEffectiveTheme(): ResolvedTheme {
    return this.resolver.resolveTheme(this.mode, this.systemIsDark);
  }

  setSystemDark(isDark: boolean): void {
    this.systemIsDark = isDark;
    this.applyTheme();
  }

  setThemeMode(mode: ThemeMode, persist: boolean = true): void {
    this.mode = mode;
    this.applyTheme();
    if (this.ipc && persist) {
      void this.ipc.setPreference('theme_mode', mode);
    }
  }

  cycleTheme(): ThemeMode {
    const cycleOrder: ThemeMode[] = ['system', 'light', 'dark', 'sepia'];
    const currentIdx = cycleOrder.indexOf(this.mode);
    const nextIdx = (currentIdx + 1) % cycleOrder.length;
    const nextMode = cycleOrder[nextIdx];
    this.setThemeMode(nextMode);
    return nextMode;
  }

  applyTheme(): void {
    const effectiveTheme = this.getEffectiveTheme();
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }
}
