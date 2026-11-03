import { FileText, Code, Info, Link, LoaderCircle, Check, X, createElement } from 'lucide';
import copy from '../shared/copy.json';
import { copyPopupAction, type ActivePageTab, type PopupAction } from './operations';

type ToastType = 'success' | 'error';

function getCopyText(path: string): string {
  const value = path.split('.').reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return undefined;
    }

    return Reflect.get(current, key);
  }, copy);

  return typeof value === 'string' ? value : '';
}

document.querySelectorAll<HTMLElement>('[data-copy]').forEach((element) => {
  const key = element.dataset['copy'];

  if (key) {
    element.textContent = getCopyText(key);
  }
});

const status = document.querySelector<HTMLElement>('#status');
const statusSlot = document.querySelector<HTMLElement>('.status-slot');
const toast = document.querySelector<HTMLElement>('#popup-toast');
const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action]'));
const shortcutLabels = Array.from(document.querySelectorAll<HTMLElement>('[data-shortcut]'));
let toastTimer = 0;
let operationInFlight = false;
let activeTab: ActivePageTab | undefined;

function setIcon(target: Element | null, icon: typeof FileText, size = 18): void {
  if (!target) {
    return;
  }

  target.replaceChildren(
    createElement(icon, {
      width: String(size),
      height: String(size),
      'aria-hidden': 'true',
    }),
  );
}

setIcon(document.querySelector('#brand-icon'), FileText, 20);
setIcon(document.querySelector('#source-icon'), Code, 15);
setIcon(document.querySelector('#status-icon'), Info, 13);
setIcon(document.querySelector('#shortcut-info-icon'), Info, 16);

for (const button of buttons) {
  setIcon(
    button.querySelector('.action-icon'),
    button.dataset['action'] === 'page' ? FileText : Link,
    20,
  );
}

function showToast(message: string, type: ToastType): void {
  if (!toast) {
    return;
  }

  window.clearTimeout(toastTimer);
  const messageNode = toast.querySelector<HTMLElement>('.popup-toast-message');
  const iconNode = toast.querySelector<HTMLElement>('.popup-toast-icon');

  if (messageNode) {
    messageNode.textContent = message;
  }

  setIcon(iconNode, type === 'error' ? X : Check, 17);
  toast.dataset['type'] = type;
  toast.hidden = false;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
  toastTimer = window.setTimeout(
    () => {
      toast.hidden = true;
    },
    type === 'error' ? 3200 : 1800,
  );
}

function formatShortcut(shortcut: string): string {
  if (!shortcut) {
    return copy.notifications.shortcutUnavailable;
  }

  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  const replacements: Record<string, string> = isMac
    ? { Alt: '⌥', Shift: '⇧', Ctrl: '⌃', Command: '⌘' }
    : { Alt: 'Alt', Shift: 'Shift', Ctrl: 'Ctrl', Command: '⌘' };

  return shortcut
    .split('+')
    .map((part) => replacements[part] ?? part.toUpperCase())
    .join(' ');
}

async function loadShortcuts(): Promise<void> {
  try {
    const commands = await chrome.commands.getAll();
    const shortcuts = new Map(commands.map((command) => [command.name, command.shortcut]));

    for (const element of shortcutLabels) {
      const command = element.dataset['shortcut'];

      element.textContent = formatShortcut(command ? (shortcuts.get(command) ?? '') : '');
    }
  } catch (error) {
    console.error('Copy 2 Markdown could not load keyboard shortcuts.', error);

    shortcutLabels.forEach((element) => {
      element.textContent = copy.notifications.shortcutUnavailable;
    });
  }
}

function showUnavailable(message = copy.states.unavailable): void {
  if (!status) {
    return;
  }

  const label = status.querySelector<HTMLElement>('.status-label');
  const iconHost = status.querySelector<HTMLElement>('.status-icon');

  if (label) {
    label.textContent = message;
  }

  if (iconHost) {
    setIcon(iconHost, Info, 13);
  }

  status.hidden = false;
  status.dataset['state'] = 'unavailable';
  statusSlot?.classList.add('is-visible');
}

function hideStatus(): void {
  if (status) {
    status.hidden = true;
  }

  statusSlot?.classList.remove('is-visible');
}

function restoreButton(button: HTMLButtonElement): void {
  const icon = button.querySelector('.action-icon');
  const label = button.querySelector<HTMLElement>('.action-label');

  if (!icon || !label) {
    return;
  }

  setIcon(icon, button.dataset['action'] === 'page' ? FileText : Link, 20);
  label.textContent =
    button.dataset['action'] === 'page' ? copy.actions.copyPage : copy.actions.copyLink;
  delete button.dataset['state'];
}

function userFacingError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const knownMessages = Object.values(copy.errors);

  return knownMessages.includes(message) ? message : copy.errors.copyFailed;
}

async function resolveActiveTab(): Promise<void> {
  buttons.forEach((button) => {
    button.disabled = true;
  });
  hideStatus();

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

    if (typeof tab?.id !== 'number' || typeof tab.url !== 'string') {
      activeTab = undefined;
      buttons.forEach((button) => {
        button.disabled = true;
        button.title = copy.states.unavailable;
      });
      showUnavailable();

      return;
    }

    activeTab = { ...tab, id: tab.id, url: tab.url };
    const pageSupported = isSupportedPage(tab.url);

    buttons.forEach((button) => {
      const isPageAction = button.dataset['action'] === 'page';

      button.disabled = isPageAction && !pageSupported;
      button.removeAttribute('title');
    });

    if (!pageSupported) {
      showUnavailable(copy.states.pageUnavailable);
    }
  } catch (error) {
    activeTab = undefined;
    buttons.forEach((button) => {
      button.disabled = true;
      button.title = copy.states.unavailable;
    });
    showUnavailable();
    console.error('Copy 2 Markdown could not resolve the active tab.', error);
  }
}

function isSupportedPage(url: string | undefined): url is string {
  if (!url || !/^https?:\/\//i.test(url)) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    return !(
      (host === 'chrome.google.com' && parsed.pathname.startsWith('/webstore')) ||
      host === 'chromewebstore.google.com'
    );
  } catch {
    return false;
  }
}

async function runAction(button: HTMLButtonElement, action: PopupAction): Promise<void> {
  if (operationInFlight || !activeTab) {
    return;
  }

  operationInFlight = true;
  buttons.forEach((candidate) => {
    candidate.disabled = true;
    candidate.setAttribute('aria-busy', 'true');
  });
  button.dataset['state'] = 'loading';
  setIcon(button.querySelector('.action-icon'), LoaderCircle, 20);

  const label = button.querySelector<HTMLElement>('.action-label');

  if (label) {
    label.textContent = copy.states.preparing;
  }

  try {
    await copyPopupAction(activeTab, action);
    showToast(copy.notifications.copied, 'success');
  } catch (error) {
    showToast(userFacingError(error), 'error');

    const message = error instanceof Error ? error.message : '';

    if (!Object.values(copy.errors).includes(message)) {
      console.error('Copy 2 Markdown popup action failed.', error);
    }
  } finally {
    restoreButton(button);
    operationInFlight = false;
    buttons.forEach((candidate) => {
      candidate.disabled =
        !activeTab || (candidate.dataset['action'] === 'page' && !isSupportedPage(activeTab.url));
      candidate.setAttribute('aria-busy', 'false');
    });
  }
}

for (const button of buttons) {
  button.addEventListener('click', async () => {
    const action = button.dataset['action'];

    if (action === 'page' || action === 'link') {
      await runAction(button, action);
    }
  });
}

loadShortcuts().catch((error: unknown) => {
  console.error('Copy 2 Markdown could not initialise keyboard shortcuts.', error);
  shortcutLabels.forEach((element) => {
    element.textContent = copy.notifications.shortcutUnavailable;
  });
});

resolveActiveTab().catch((error: unknown) => {
  console.error('Copy 2 Markdown could not initialise the popup.', error);
  activeTab = undefined;
  buttons.forEach((button) => {
    button.disabled = true;
    button.title = copy.states.unavailable;
  });
  showUnavailable();
  showToast(copy.errors.copyFailed, 'error');
});
