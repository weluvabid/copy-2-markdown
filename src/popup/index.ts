import { Check, FileText, Code, Info, Link, LoaderCircle, createElement } from 'lucide';
import { htmlToMarkdown } from '../conversion/markdown';
import type { ExtractRequest, ExtractResponse, ExtractionMode } from '../shared/messages';

const status = document.querySelector<HTMLElement>('#status');
const statusSlot = document.querySelector<HTMLElement>('.status-slot');
const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action]'));
const successTimers = new WeakMap<HTMLButtonElement, number>();
let operationInFlight = false;
let activeTab: (chrome.tabs.Tab & { id: number; url: string }) | undefined;

function setIcon(target: Element | null, icon: typeof FileText, size = 18): void {
  if (!target) {return;}

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

function showUnavailable(message = 'Unavailable on this page.'): void {
  if (!status) {return;}

  const label = status.querySelector<HTMLElement>('.status-label');
  const iconHost = status.querySelector<HTMLElement>('.status-icon');

  if (label) {label.textContent = message;}

  if (iconHost) {setIcon(iconHost, Info, 13);}

  status.hidden = false;
  status.dataset['state'] = 'unavailable';
  statusSlot?.classList.add('is-visible');
}

function hideStatus(): void {
  if (status) {status.hidden = true;}

  statusSlot?.classList.remove('is-visible');
}

function restoreButton(button: HTMLButtonElement): void {
  const timer = successTimers.get(button);

  if (timer) {window.clearTimeout(timer);}

  successTimers.delete(button);
  const icon = button.querySelector('.action-icon');
  const label = button.querySelector<HTMLElement>('.action-label');

  if (!icon || !label) {return;}

  setIcon(icon, button.dataset['action'] === 'page' ? FileText : Link, 20);
  label.textContent =
    button.dataset['action'] === 'page' ? 'Copy Markdown page' : 'Copy Markdown link';
  delete button.dataset['state'];
}

function showInlineSuccess(button: HTMLButtonElement): void {
  const icon = button.querySelector('.action-icon');
  const label = button.querySelector<HTMLElement>('.action-label');

  if (!icon || !label) {return;}

  const previousTimer = successTimers.get(button);

  if (previousTimer) {window.clearTimeout(previousTimer);}

  setIcon(icon, Check, 20);
  label.textContent = 'Copied';
  button.dataset['state'] = 'success';
  successTimers.set(
    button,
    window.setTimeout(() => restoreButton(button), 1200),
  );
}

function isSupportedPage(url: string | undefined): url is string {
  if (!url || !/^https?:\/\//i.test(url)) {return false;}

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
        button.title = 'Unavailable on this page';
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
      button.title = 'Unavailable on this page';
    });
    showUnavailable();
  }
}

async function extract(mode: ExtractionMode): Promise<ExtractResponse & { ok: true }> {
  if (!activeTab) {throw new Error('Unavailable on this page.');}

  const request: ExtractRequest = { type: 'EXTRACT_CONTENT', mode };
  let response: ExtractResponse;

  try {
    response = (await chrome.tabs.sendMessage(activeTab.id, request)) as ExtractResponse;
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['content.js'],
    });
    response = (await chrome.tabs.sendMessage(activeTab.id, request)) as ExtractResponse;
  }

  if (!response.ok) {throw new Error(response.error);}

  return response;
}

async function runAction(button: HTMLButtonElement, action: 'page' | 'link'): Promise<void> {
  if (operationInFlight || !activeTab) {return;}

  operationInFlight = true;
  hideStatus();
  buttons.forEach((candidate) => {
    candidate.disabled = true;
    candidate.setAttribute('aria-busy', 'true');
  });
  button.dataset['state'] = 'loading';
  setIcon(button.querySelector('.action-icon'), LoaderCircle, 20);
  const label = button.querySelector<HTMLElement>('.action-label');

  if (label) {label.textContent = 'Preparing…';}

  try {
    let markdown: string;

    if (action === 'page') {
      const result = await extract('page');

      markdown = htmlToMarkdown(result.html, result.url);

      if (!markdown.trim()) {throw new Error('No Markdown content was produced.');}
    } else {
      const title = (activeTab.title ?? activeTab.url)
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\\/g, '\\\\')
        .replace(/[[\]]/g, '\\$&');

      markdown = `[${title}](<${new URL(activeTab.url).href}>)`;
    }

    await navigator.clipboard.writeText(markdown);
    showInlineSuccess(button);
  } catch (error) {
    restoreButton(button);
    button.title = error instanceof Error ? error.message : 'Copy failed. Try again.';
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
  button.addEventListener('click', () => {
    const action = button.dataset['action'];

    if (action === 'page' || action === 'link') {void runAction(button, action);}
  });
}

void resolveActiveTab();
