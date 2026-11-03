import { Check, X, createElement } from 'lucide';
import { extractContent } from './extraction';
import { htmlToMarkdown } from '../conversion/markdown';
import type {
  CopyActionRequest,
  CopyResponse,
  ExtractRequest,
  ExtractResponse,
} from '../shared/messages';

(function copy2MarkdownContentScript() {
  const contentWindow = window as Window & {
    __copy2MarkdownContentScriptInstalled?: boolean;
  };

  if (contentWindow.__copy2MarkdownContentScriptInstalled) {return;}

  contentWindow.__copy2MarkdownContentScriptInstalled = true;

  function isExtractRequest(message: unknown): message is ExtractRequest {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === 'EXTRACT_CONTENT' &&
      'mode' in message &&
      (message.mode === 'page' || message.mode === 'selection')
    );
  }

  function isCopyActionRequest(message: unknown): message is CopyActionRequest {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === 'COPY_ACTION' &&
      'action' in message &&
      (message.action === 'page' || message.action === 'selection' || message.action === 'link')
    );
  }

  let toastHost: HTMLElement | undefined;
  let toastContainer: HTMLDivElement | undefined;

  function showToast(
    message: string,
    type: 'success' | 'error' | 'info' = 'info',
    duration = 2200,
  ): void {
    if (!toastHost || !toastContainer) {
      toastHost = document.createElement('div');
      toastHost.id = 'copy-2-markdown-toasts';
      const shadow = toastHost.attachShadow({ mode: 'closed' });
      const style = document.createElement('style');
      const regularFont = chrome.runtime.getURL('assets/fonts/atkinson-hyperlegible-regular.otf');

      style.textContent = `
        @font-face { font-family: 'Atkinson Hyperlegible'; src: url('${regularFont}') format('opentype'); font-weight: 400; font-display: swap; }
        :host { all: initial; position: fixed; z-index: 2147483647; right: 20px; bottom: 20px; color-scheme: light dark; }
        .stack { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; font: 400 14px/1.4 'Atkinson Hyperlegible', Arial, sans-serif; pointer-events: none; }
        .toast { display: flex; align-items: center; gap: 12px; width: min(360px, calc(100vw - 36px)); min-height: 56px; padding: 13px 16px; border: 1px solid #e8e7e1; border-radius: 16px; background: #fff; color: #20201e; box-shadow: 0 8px 28px #0002; opacity: 0; transform: translateY(9px); transition: opacity 180ms ease, transform 180ms cubic-bezier(.16,1,.3,1); overflow-wrap: anywhere; pointer-events: auto; }
        .toast[data-state='visible'] { opacity: 1; transform: translateY(0); }
        .toast, .message, .dismiss { font-weight: 400; }
        .toast[data-type='error'] { border-color: #d9aaa5; }
        .icon { display: inline-flex; flex: 0 0 auto; color: #27845e; }
        .toast[data-type='error'] .icon { color: #b42318; }
        .message { flex: 1; min-width: 0; }
        .dismiss { display: inline-grid; width: 30px; height: 30px; flex: 0 0 30px; place-items: center; padding: 0; border: 0; border-radius: 8px; background: transparent; color: #888; cursor: pointer; }
        .dismiss:hover { background: #f1f0ec; color: #20201e; }
        .dismiss:focus-visible { outline: 2px solid #737373; outline-offset: 2px; }
        svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.8; fill: none; }
        @media (prefers-color-scheme: dark) {
          .toast { border-color: #27271f; background: #11110d; color: #e8e7e3; box-shadow: 0 5px 20px #0006; }
          .toast[data-type='error'] { border-color: #6b302b; }
          .dismiss { color: #99978f; }
          .dismiss:hover { background: #191914; color: #e8e7e3; }
        }
        @media (prefers-reduced-motion: reduce) { .toast { transition: none; } }
      `;
      toastContainer = document.createElement('div');
      toastContainer.className = 'stack';
      shadow.append(style, toastContainer);
      document.documentElement.append(toastHost);
    }

    const toast = document.createElement('div');

    toast.className = 'toast';
    toast.dataset['type'] = type;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const iconHost = document.createElement('span');

    iconHost.className = 'icon';
    iconHost.append(
      createElement(type === 'error' ? X : Check, {
        width: '18',
        height: '18',
        'aria-hidden': 'true',
      }),
    );
    const text = document.createElement('span');

    text.className = 'message';
    text.textContent = message;
    const dismiss = document.createElement('button');

    dismiss.className = 'dismiss';
    dismiss.type = 'button';
    dismiss.setAttribute('aria-label', 'Dismiss notification');
    dismiss.append(createElement(X, { width: '16', height: '16', 'aria-hidden': 'true' }));
    toast.append(iconHost, text, dismiss);
    toastContainer.append(toast);

    let removeTimer = 0;
    let dismissTimer = 0;
    let isRemoving = false;
    const removeToast = (): void => {
      if (isRemoving) {return;}

      isRemoving = true;
      window.clearTimeout(dismissTimer);
      toast.dataset['state'] = 'hidden';
      removeTimer = window.setTimeout(() => {
        toast.remove();

        if (toastContainer?.childElementCount === 0) {
          toastHost?.remove();
          toastHost = undefined;
          toastContainer = undefined;
        }
      }, 190);
    };

    dismiss.addEventListener('click', removeToast, { once: true });
    requestAnimationFrame(() => {
      toast.dataset['state'] = 'visible';
    });
    dismissTimer = window.setTimeout(removeToast, duration);
  }

  async function copyAction(request: CopyActionRequest, notify = true): Promise<void> {
    let markdown: string;

    if (request.action === 'link') {
      const href = request.linkUrl;

      if (!href) {throw new Error('No link was provided.');}

      const absoluteHref = new URL(href, location.href).href;
      const anchor = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find(
        (candidate) => candidate.href === absoluteHref,
      );
      const label = (anchor?.innerText || href)
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\\/g, '\\\\')
        .replace(/[[\]]/g, '\\$&');

      markdown = `[${label}](<${absoluteHref}>)`;
    } else {
      const html = extractContent(request.action);

      markdown = htmlToMarkdown(html, location.href);
    }

    if (!markdown.trim()) {throw new Error('No Markdown content was produced.');}

    await navigator.clipboard.writeText(markdown);

    if (notify) {showToast('Markdown copied', 'success');}
  }

  function sendExtractResponse(
    message: ExtractRequest,
    sendResponse: (response: ExtractResponse) => void,
  ): void {
    try {
      sendResponse({ ok: true, html: extractContent(message.mode), url: location.href });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Unable to extract page content.',
      });
    }
  }

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (isExtractRequest(message)) {
      sendExtractResponse(message, sendResponse);

      return false;
    }

    if (isCopyActionRequest(message)) {
      void copyAction(message)
        .then(() => sendResponse({ ok: true } satisfies CopyResponse))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Copy failed.';

          showToast(message, 'error');
          console.error('Copy 2 Markdown failed.', error);
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : 'Copy failed.',
          } satisfies CopyResponse);
        });

      return true;
    }

    return false;
  });
})();
