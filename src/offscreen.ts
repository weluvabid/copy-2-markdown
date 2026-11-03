import copy from './shared/copy.json';
import type { OffscreenClipboardRequest } from './shared/messages';

function isClipboardRequest(message: unknown): message is OffscreenClipboardRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'OFFSCREEN_WRITE_CLIPBOARD' &&
    'text' in message &&
    typeof message.text === 'string'
  );
}

function copyText(text: string): void {
  const buffer = document.querySelector<HTMLTextAreaElement>('#clipboard-buffer');

  if (!buffer) {
    throw new Error(copy.errors.clipboard);
  }

  buffer.value = text;
  buffer.select();
  buffer.setSelectionRange(0, buffer.value.length);

  // Offscreen documents cannot be focused, so navigator.clipboard.writeText()
  // rejects with NotAllowedError. Chrome's supported MV3 offscreen clipboard
  // pattern uses the extension's clipboardWrite permission and execCommand.
  const copied = document.execCommand('copy');

  buffer.value = '';
  buffer.blur();

  if (!copied) {
    throw new Error(copy.errors.clipboard);
  }
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isClipboardRequest(message)) {
    return false;
  }

  try {
    copyText(message.text);
    sendResponse({ ok: true });
  } catch {
    sendResponse({ ok: false, error: copy.errors.clipboard });
  }

  return false;
});
