import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatShortcut, getShortcutMap } from '../../src/shared/shortcuts';

describe('formatShortcut', () => {
  it('formats macOS modifier keys as symbols', () => {
    expect(formatShortcut('Alt+Shift+M', 'MacIntel')).toBe('⌥ ⇧ M');
  });

  it('supports control and command modifiers', () => {
    expect(formatShortcut('Ctrl+Command+K', 'MacIntel')).toBe('⌃ ⌘ K');
  });

  it('preserves non-modifier key names in uppercase on macOS', () => {
    expect(formatShortcut('Alt+F1', 'MacIntel')).toBe('⌥ F1');
  });

  it('uses platform-native modifier names on Windows', () => {
    expect(formatShortcut('Alt+Shift+M', 'Win32')).toBe('Alt + Shift + M');
  });

  it('uses platform-native modifier names on Linux', () => {
    expect(formatShortcut('Alt+Shift+M', 'Linux x86_64')).toBe('Alt + Shift + M');
  });

  it('recognises the macOS user-agent platform name', () => {
    expect(formatShortcut('Alt+Shift+K', 'macOS')).toBe('⌥ ⇧ K');
  });

  it('formats command shortcuts using the actual assigned modifiers', () => {
    expect(formatShortcut('Ctrl+Shift+M', 'Win32')).toBe('Ctrl + Shift + M');
    expect(formatShortcut('Command+Shift+M', 'MacIntel')).toBe('⌘ ⇧ M');
  });
});

describe('getShortcutMap', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the shortcuts Chrome actually assigned and omits unassigned commands', async () => {
    vi.stubGlobal('navigator', {
      platform: 'MacIntel',
      userAgent: 'Mozilla/5.0 (Macintosh)',
    });
    vi.stubGlobal('chrome', {
      commands: {
        getAll: vi.fn().mockResolvedValue([
          { name: 'copy-page-markdown', shortcut: 'Alt+Shift+M' },
          { name: 'copy-selection-markdown', shortcut: '' },
          { name: 'copy-link-markdown', shortcut: 'Alt+Shift+K' },
        ]),
      },
    });

    await expect(getShortcutMap()).resolves.toEqual({
      page: '⌥ ⇧ M',
      link: '⌥ ⇧ K',
    });
  });
});
