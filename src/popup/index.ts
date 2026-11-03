import { FileText, Code, Info, Link, LoaderCircle, Check, X, createElement } from 'lucide';
import copy from '../shared/copy.json';
import { getShortcutMap } from '../shared/shortcuts';
import { getPageSupport } from '../shared/page-support';
import { copyPopupAction, type ActivePageTab, type PopupAction } from './operations';

type ToastType = 'success' | 'error';

const MINIMUM_LOADING_MS = 300;

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
const shortcutCard = document.querySelector<HTMLElement>('.shortcut-card');
const toast = document.querySelector<HTMLElement>('#popup-toast');
const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action]'));
const shortcutLabels = Array.from(document.querySelectorAll<HTMLElement>('[data-shortcut]'));
let toastTimer = 0;
let operationInFlight = false;
let activeTab: ActivePageTab | undefined;
let pageActionAvailable = false;

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

async function loadShortcuts(): Promise<void> {
  try {
    const shortcuts = await getShortcutMap();

    for (const element of shortcutLabels) {
      const action = element.dataset['shortcut'];
      const shortcut =
        action === 'page' || action === 'selection' || action === 'link'
          ? shortcuts[action]
          : undefined;

      element.textContent = shortcut ?? copy.notifications.shortcutUnavailable;
    }
  } catch (error) {
    console.error('Copy 2 Markdown could not load keyboard shortcuts.', error);

    shortcutLabels.forEach((element) => {
      element.textContent = copy.notifications.shortcutUnavailable;
    });
  }
}

async function syncActionIconTheme(isDark: boolean): Promise<void> {
  await chrome.runtime.sendMessage({
    type: 'SET_ACTION_ICON_THEME',
    theme: isDark ? 'dark' : 'light',
  });
}

const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');

syncActionIconTheme(colorScheme.matches).catch((error: unknown) => {
  console.error('Copy 2 Markdown could not initialise the toolbar icon theme.', error);
});
colorScheme.addEventListener('change', (event) => {
  syncActionIconTheme(event.matches).catch((error: unknown) => {
    console.error('Copy 2 Markdown could not update the toolbar icon theme.', error);
  });
});

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

  if (shortcutCard) {
    shortcutCard.hidden = true;
  }

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
  const knownMessages = [...Object.values(copy.errors), copy.states.fileAccessRequired];

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
      pageActionAvailable = false;
      buttons.forEach((button) => {
        button.disabled = true;
        button.title = copy.states.unavailable;
      });
      showUnavailable();

      return;
    }

    activeTab = { ...tab, id: tab.id, url: tab.url };
    let fileAccessAllowed = false;

    if (new URL(tab.url).protocol === 'file:') {
      try {
        fileAccessAllowed = await chrome.extension.isAllowedFileSchemeAccess();
      } catch (error) {
        console.error('Copy 2 Markdown could not check file URL access.', error);
      }
    }

    const pageSupport = getPageSupport(tab.url, fileAccessAllowed);

    pageActionAvailable = pageSupport === 'supported';
    const pageSupported = pageActionAvailable;

    if (shortcutCard) {
      shortcutCard.hidden = !pageSupported;
    }

    buttons.forEach((button) => {
      const isPageAction = button.dataset['action'] === 'page';

      button.disabled = isPageAction && !pageSupported;
      button.removeAttribute('title');
    });

    if (!pageSupported) {
      showUnavailable(
        pageSupport === 'file-access-required'
          ? copy.states.fileAccessRequired
          : copy.states.pageUnavailable,
      );
    }
  } catch (error) {
    activeTab = undefined;
    pageActionAvailable = false;
    buttons.forEach((button) => {
      button.disabled = true;
      button.title = copy.states.unavailable;
    });
    showUnavailable();
    showToast(copy.errors.copyFailed, 'error');
    console.error('Copy 2 Markdown could not resolve the active tab.', error);
  }
}

async function runAction(button: HTMLButtonElement, action: PopupAction): Promise<void> {
  if (operationInFlight || !activeTab) {
    return;
  }

  operationInFlight = true;
  const startedAt = performance.now();
  let feedback: { message: string; type: ToastType } | undefined;

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
    feedback = { message: copy.notifications.copied, type: 'success' };
  } catch (error) {
    feedback = { message: userFacingError(error), type: 'error' };

    const message = error instanceof Error ? error.message : '';

    if (![...Object.values(copy.errors), copy.states.fileAccessRequired].includes(message)) {
      console.error('Copy 2 Markdown popup action failed.', error);
    }
  } finally {
    const remainingLoadingTime = MINIMUM_LOADING_MS - (performance.now() - startedAt);

    if (remainingLoadingTime > 0) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, remainingLoadingTime);
      });
    }

    restoreButton(button);
    operationInFlight = false;
    buttons.forEach((candidate) => {
      candidate.disabled =
        !activeTab || (candidate.dataset['action'] === 'page' && !pageActionAvailable);
      candidate.setAttribute('aria-busy', 'false');
    });
  }

  if (feedback) {
    showToast(feedback.message, feedback.type);
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
