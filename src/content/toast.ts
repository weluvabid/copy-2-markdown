import { Check, X, createElement } from 'lucide';
import copy from '../shared/copy.json';

type ToastType = 'success' | 'error' | 'info';

let host: HTMLElement | undefined;
let container: HTMLDivElement | undefined;

function ensureToastRoot(): HTMLDivElement {
  if (container) {
    return container;
  }

  host = document.createElement('div');
  host.id = 'copy-2-markdown-toasts';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  const regularFont = chrome.runtime.getURL('assets/fonts/atkinson-hyperlegible-regular.otf');

  style.textContent = `
    @font-face { font-family: 'Atkinson Hyperlegible'; src: url('${regularFont}') format('opentype'); font-weight: 400; font-display: swap; }
    :host { all: initial; position: fixed; z-index: 2147483647; right: 20px; bottom: 20px; color-scheme: light dark; }
    .stack { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; font: 400 14px/1.4 'Atkinson Hyperlegible', Arial, sans-serif; pointer-events: none; }
    .toast { display: flex; align-items: center; gap: 12px; width: min(360px, calc(100vw - 36px)); min-height: 56px; padding: 13px 16px; border: 1px solid #e8e7e1; border-radius: 16px; background: #fff; color: #20201e; box-shadow: 0 8px 28px #0002; opacity: 0; transform: translateY(9px); transition: opacity 180ms ease, transform 180ms cubic-bezier(.16,1,.3,1); overflow-wrap: anywhere; pointer-events: auto; font-weight: 400; }
    .toast[data-state='visible'] { opacity: 1; transform: translateY(0); }
    .toast[data-type='error'] { border-color: #d9aaa5; }
    .icon { display: inline-flex; flex: 0 0 auto; color: #27845e; }
    .toast[data-type='error'] .icon { color: #b42318; }
    .message { flex: 1; min-width: 0; }
    .dismiss { display: inline-grid; width: 30px; height: 30px; flex: 0 0 30px; place-items: center; padding: 0; border: 0; border-radius: 8px; background: transparent; color: #888; cursor: pointer; font: inherit; }
    .dismiss:hover { background: #f1f0ec; color: #20201e; }
    .dismiss:focus-visible { outline: 2px solid #737373; outline-offset: 2px; }
    svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 1.8; fill: none; }
    @media (prefers-color-scheme: dark) { .toast { border-color: #27271f; background: #11110d; color: #e8e7e3; box-shadow: 0 5px 20px #0006; } .toast[data-type='error'] { border-color: #6b302b; } .dismiss { color: #99978f; } .dismiss:hover { background: #191914; color: #e8e7e3; } }
    @media (prefers-reduced-motion: reduce) { .toast { transition: none; } }
  `;
  container = document.createElement('div');
  container.className = 'stack';
  shadow.append(style, container);
  document.documentElement.append(host);

  return container;
}

export function showToast(message: string, type: ToastType = 'info', duration = 2200): void {
  const root = ensureToastRoot();
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

  const messageNode = document.createElement('span');

  messageNode.className = 'message';
  messageNode.textContent = message;

  const dismiss = document.createElement('button');

  dismiss.className = 'dismiss';
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', copy.notifications.dismiss);
  dismiss.append(createElement(X, { width: '16', height: '16', 'aria-hidden': 'true' }));
  toast.append(iconHost, messageNode, dismiss);
  root.append(toast);

  let dismissTimer = 0;
  let removed = false;

  const remove = (): void => {
    if (removed) {
      return;
    }

    removed = true;
    window.clearTimeout(dismissTimer);
    toast.dataset['state'] = 'hidden';
    window.setTimeout(() => {
      toast.remove();

      if (container?.childElementCount === 0) {
        host?.remove();
        host = undefined;
        container = undefined;
      }
    }, 190);
  };

  dismiss.addEventListener('click', remove, { once: true });
  requestAnimationFrame(() => {
    toast.dataset['state'] = 'visible';
  });
  dismissTimer = window.setTimeout(remove, duration);
}
