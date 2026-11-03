import type { ClipboardResponse, WriteClipboardRequest } from './messages';

/** Route clipboard writes through the extension-owned offscreen document. */
export async function writeClipboard(text: string): Promise<void> {
  const request: WriteClipboardRequest = { type: 'WRITE_CLIPBOARD', text };
  const response = (await chrome.runtime.sendMessage(request)) as ClipboardResponse | undefined;

  if (!response?.ok) {
    throw new Error(response?.error || 'Clipboard write failed.');
  }
}
