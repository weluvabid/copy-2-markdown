import copy from '../shared/copy.json';
import type {
  ClipboardResponse,
  OffscreenClipboardRequest,
  WriteClipboardRequest,
} from '../shared/messages';

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
let creatingOffscreenDocument: Promise<void> | undefined;
let clipboardWriteQueue: Promise<void> = Promise.resolve();

function isClipboardWriteRequest(message: unknown): message is WriteClipboardRequest {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message.type === 'WRITE_CLIPBOARD' &&
    'text' in message &&
    typeof message.text === 'string'
  );
}

async function ensureOffscreenDocument(): Promise<void> {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  // Keep the Promise return explicit because the installed Chrome declarations
  // combine callback and Promise overloads in a way that can confuse inference.
  const contextFilter = {
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [offscreenUrl],
  };
  const contexts = await (chrome.runtime.getContexts(contextFilter) as Promise<
    chrome.runtime.ExtensionContext[]
  >);

  if (contexts.length > 0) {
    return;
  }

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: ['CLIPBOARD'],
        justification: 'Write generated Markdown to the system clipboard.',
      })
      .finally(() => {
        creatingOffscreenDocument = undefined;
      });
  }

  await creatingOffscreenDocument;
}

async function writeClipboard(text: string): Promise<void> {
  await ensureOffscreenDocument();
  const request: OffscreenClipboardRequest = { type: 'OFFSCREEN_WRITE_CLIPBOARD', text };
  const response = (await chrome.runtime.sendMessage(request)) as ClipboardResponse | undefined;

  if (!response?.ok) {
    throw new Error(response?.error || copy.errors.clipboard);
  }
}

function enqueueClipboardWrite(text: string): Promise<void> {
  const operation = clipboardWriteQueue.then(() => writeClipboard(text));

  clipboardWriteQueue = operation.catch(() => undefined);

  return operation;
}

/** Write directly from the service worker without sending a message to itself. */
export function writeClipboardFromBackground(text: string): Promise<void> {
  return enqueueClipboardWrite(text);
}

export function installClipboardMessageHandler(): void {
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (!isClipboardWriteRequest(message)) {
      return false;
    }

    // Keep Chrome's callback-based message channel open until the offscreen
    // document confirms that the clipboard write has completed.
    enqueueClipboardWrite(message.text)
      .then(() => {
        sendResponse({ ok: true } satisfies ClipboardResponse);
      })
      .catch((error: unknown) => {
        console.error('Copy 2 Markdown clipboard write failed.', error, { sender: sender.url });
        sendResponse({
          ok: false,
          error: copy.errors.clipboard,
        } satisfies ClipboardResponse);
      });

    return true;
  });
}
