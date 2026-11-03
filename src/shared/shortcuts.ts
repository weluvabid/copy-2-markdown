export const COMMANDS = {
  page: 'copy-page-markdown',
  selection: 'copy-selection-markdown',
  link: 'copy-link-markdown',
} as const;

export type CopyCommand = keyof typeof COMMANDS;
export type ShortcutMap = Partial<Record<CopyCommand, string>>;

function getPlatform(): string {
  const userAgentData = Reflect.get(navigator, 'userAgentData') as
    | { platform?: unknown }
    | undefined;

  if (typeof userAgentData?.platform === 'string') {
    return userAgentData.platform;
  }

  return navigator.platform || navigator.userAgent;
}

export function formatShortcut(shortcut: string, platform = getPlatform()): string {
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

  for (const action of Object.keys(COMMANDS) as CopyCommand[]) {
    const commandName = COMMANDS[action];
    const command = commands.find((candidate) => candidate.name === commandName);

    if (command?.shortcut) {
      shortcuts[action] = formatShortcut(command.shortcut);
    }
  }

  return shortcuts;
}
