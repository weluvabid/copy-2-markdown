import { describe, expect, it } from 'vitest';
import { formatShortcut } from '../../src/shared/shortcuts';

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
});
