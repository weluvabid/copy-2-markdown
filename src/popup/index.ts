import { htmlToMarkdown } from '../conversion/markdown';
import type { ExtractRequest, ExtractResponse, ExtractionMode } from '../shared/messages';

const status = document.querySelector<HTMLElement>('#status');
const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action]'));

function setStatus(message: string, state: 'idle' | 'busy' | 'success' | 'error' = 'idle'): void {
  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset['state'] = state;
}

function setBusy(busy: boolean): void {
  buttons.forEach((button) => {
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
  });
}

async function getActiveTab(): Promise<chrome.tabs.Tab & { id: number; url: string }> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

  if (typeof tab?.id !== 'number' || typeof tab.url !== 'string') {
    throw new Error('No active page is available.');
  }

  if (!/^https?:\/\//i.test(tab.url)) {
    throw new Error('This browser page does not allow content extraction.');
  }

  return { ...tab, id: tab.id, url: tab.url };
}

async function extract(mode: ExtractionMode): Promise<ExtractResponse & { ok: true }> {
  const tab = await getActiveTab();
  const request: ExtractRequest = { type: 'EXTRACT_CONTENT', mode };
  let response: ExtractResponse;

  try {
    response = (await chrome.tabs.sendMessage(tab.id, request)) as ExtractResponse;
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    response = (await chrome.tabs.sendMessage(tab.id, request)) as ExtractResponse;
  }

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response;
}

async function copyMarkdown(mode: ExtractionMode): Promise<void> {
  setBusy(true);
  setStatus(mode === 'page' ? 'Reading page…' : 'Converting selection…', 'busy');

  try {
    const result = await extract(mode);
    const markdown = htmlToMarkdown(result.html, result.url);

    if (!markdown) {
      throw new Error('No Markdown content was produced.');
    }

    await navigator.clipboard.writeText(markdown);
    setStatus('Markdown copied.', 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Copy failed. Try again.', 'error');
  } finally {
    setBusy(false);
  }
}

async function copyLink(): Promise<void> {
  setBusy(true);
  setStatus('Copying link…', 'busy');

  try {
    const tab = await getActiveTab();
    const title = (tab.title ?? tab.url ?? 'Link')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\\/g, '\\\\')
      .replace(/[[\]]/g, '\\$&');
    const parsedUrl = new URL(tab.url);
    const url = parsedUrl.href;

    // Angle-bracket destinations are valid CommonMark and preserve URL
    // characters without ad-hoc percent-encoding of parentheses.
    await navigator.clipboard.writeText(`[${title}](<${url}>)`);
    setStatus('Markdown link copied.', 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Copy failed. Try again.', 'error');
  } finally {
    setBusy(false);
  }
}

for (const button of buttons) {
  button.addEventListener('click', async () => {
    const action = button.dataset['action'];

    if (action === 'page') {
      await copyMarkdown('page');
    } else if (action === 'selection') {
      await copyMarkdown('selection');
    } else if (action === 'link') {
      await copyLink();
    }
  });
}
