import { Check, FileText, Code, Info, Link, LoaderCircle, createElement } from 'lucide';
import copy from '../shared/copy.json';
import { copyPopupAction, type ActivePageTab, type PopupAction } from './operations';

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
const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action]'));
const successTimers = new WeakMap<HTMLButtonElement, number>();
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

for (const button of buttons) {
  setIcon(
    button.querySelector('.action-icon'),
    button.dataset['action'] === 'page' ? FileText : Link,
    20,
  );
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
  const timer = successTimers.get(button);

  if (timer) {
    window.clearTimeout(timer);
  }

  successTimers.delete(button);
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

function showInlineSuccess(button: HTMLButtonElement): void {
  const icon = button.querySelector('.action-icon');
  const label = button.querySelector<HTMLElement>('.action-label');

  if (!icon || !label) {
    return;
  }

  const previousTimer = successTimers.get(button);

  if (previousTimer) {
    window.clearTimeout(previousTimer);
  }

  setIcon(icon, Check, 20);
  label.textContent = copy.states.copied;
  button.dataset['state'] = 'success';
  successTimers.set(
    button,
    window.setTimeout(() => restoreButton(button), 1200),
  );
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

async function resolveActiveTab(): Promise<void> {
  buttons.forEach((button) => {
    button.disabled = true;
  });
  hideStatus();

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

    if (typeof tab?.id !== 'number' || !isSupportedPage(tab.url)) {
      activeTab = undefined;
      buttons.forEach((button) => {
        button.disabled = true;
        button.title = copy.states.unavailable;
      });
      showUnavailable();

      return;
    }

    activeTab = { ...tab, id: tab.id, url: tab.url };
    buttons.forEach((button) => {
      button.disabled = false;
      button.removeAttribute('title');
    });
  } catch {
    activeTab = undefined;
    buttons.forEach((button) => {
      button.disabled = true;
      button.title = copy.states.unavailable;
    });
    showUnavailable();
  }
}

async function runAction(button: HTMLButtonElement, action: PopupAction): Promise<void> {
  if (operationInFlight || !activeTab) {
    return;
  }

  operationInFlight = true;
  hideStatus();
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
    showInlineSuccess(button);
  } catch (error) {
    restoreButton(button);
    button.title = error instanceof Error ? error.message : copy.errors.copyFailed;
    console.error('Copy 2 Markdown popup action failed.', error);
  } finally {
    operationInFlight = false;
    buttons.forEach((candidate) => {
      candidate.disabled = !activeTab;
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

resolveActiveTab().catch((error: unknown) => {
  console.error('Copy 2 Markdown could not resolve the active tab.', error);
  showUnavailable();
});
