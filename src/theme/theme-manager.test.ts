import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeManager } from './theme-manager.ts';
import { ThemeResolver } from './theme-resolver.ts';
import { IIpcAdapter } from '../document/tauri-ipc-adapter.ts';

describe('ThemeManager', () => {
  let mockIpc: IIpcAdapter;
  let resolver: ThemeResolver;
  let manager: ThemeManager;

  beforeEach(() => {
    mockIpc = {
      openDocument: vi.fn(),
      resolveAssetPath: vi.fn(),
      getPreference: vi.fn(),
      setPreference: vi.fn().mockResolvedValue(undefined),
      listen: vi.fn().mockReturnValue(() => {}),
    };
    resolver = new ThemeResolver();
    // Stub resolver for test isolation
    vi.spyOn(resolver, 'resolveTheme').mockImplementation((mode, isDark) => {
      if (mode === 'sepia') return 'sepia';
      if (mode === 'dark') return 'dark';
      if (mode === 'light') return 'light';
      return isDark ? 'dark' : 'light';
    });

    manager = new ThemeManager(resolver, mockIpc);
    document.documentElement.removeAttribute('data-theme');
  });

  it('initializes in system mode and sets data-theme to light when system is light', () => {
    manager.setSystemDark(false);
    expect(manager.getMode()).toBe('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('updates data-theme attribute when system dark mode toggles', () => {
    manager.setSystemDark(true);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    manager.setSystemDark(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('sets explicit theme mode, updates data-theme, and persists via IPC', () => {
    manager.setThemeMode('sepia');
    expect(manager.getMode()).toBe('sepia');
    expect(document.documentElement.getAttribute('data-theme')).toBe('sepia');
    expect(mockIpc.setPreference).toHaveBeenCalledWith('theme_mode', 'sepia');
  });

  it('does not persist preference via IPC when persist is false', () => {
    manager.setThemeMode('dark', false);
    expect(manager.getMode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(mockIpc.setPreference).not.toHaveBeenCalled();
  });

  it('cycles theme through System -> Light -> Dark -> Sepia on F10', () => {
    expect(manager.cycleTheme()).toBe('light');
    expect(manager.cycleTheme()).toBe('dark');
    expect(manager.cycleTheme()).toBe('sepia');
    expect(manager.cycleTheme()).toBe('system');
  });

  it('supports default constructor without parameters and handles null IPC', () => {
    const standaloneManager = new ThemeManager();
    expect(standaloneManager.getMode()).toBe('system');
    expect(standaloneManager.getEffectiveTheme()).toBe('light');

    expect(() => standaloneManager.setThemeMode('dark')).not.toThrow();
    expect(standaloneManager.getMode()).toBe('dark');
    expect(standaloneManager.getEffectiveTheme()).toBe('dark');
  });
});
