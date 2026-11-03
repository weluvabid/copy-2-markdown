export const COMMANDS = {
  page: 'copy-page-markdown',
  selection: 'copy-selection-markdown',
  link: 'copy-link-markdown',
} as const;

export type CopyCommand = keyof typeof COMMANDS;
export type ShortcutMap = Partial<Record<CopyCommand, string>>;

export function formatShortcut(
  shortcut: string,
  platform = navigator.platform || navigator.userAgent,
): string {
  const parts = shortcut.split('+').map((part) => part.trim());

  if (!platform.toLowerCase().includes('mac')) {
    return parts.join(' + ');
  }

  const symbols: Record<string, string> = {
    alt: '⌥',
    option: '⌥',
    shift: '⇧',
    ctrl: '⌃',
    control: '⌃',
    macctrl: '⌃',
    command: '⌘',
    cmd: '⌘',
  };

  return parts.map((part) => symbols[part.toLowerCase()] ?? part.toUpperCase()).join(' ');
}

export async function getShortcutMap(): Promise<ShortcutMap> {
  const commands = await chrome.commands.getAll();
  const shortcuts: ShortcutMap = {};

  for (const [action, commandName] of Object.entries(COMMANDS) as [CopyCommand, string][]) {
    const command = commands.find((candidate) => candidate.name === commandName);

    if (command?.shortcut) {
      shortcuts[action] = formatShortcut(command.shortcut);
    }
  }

  return shortcuts;
}
