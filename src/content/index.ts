import copy from '../shared/copy.json';
import type {
  CopyActionRequest,
  CopyResponse,
  ExtractRequest,
  ExtractResponse,
} from '../shared/messages';
import { executeCopyAction } from './copy-action';
import { extractContent } from './extraction';
import { showToast } from './toast';

(function installContentScript(): void {
  const contentWindow = window as Window & { __copy2MarkdownContentScriptInstalled?: boolean };

  if (contentWindow.__copy2MarkdownContentScriptInstalled) {
    return;
  }

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
      (message.action === 'page' || message.action === 'selection' || message.action === 'link') &&
      (!('linkUrl' in message) || typeof message.linkUrl === 'string') &&
      (!('selectionText' in message) || typeof message.selectionText === 'string')
    );
  }

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (isExtractRequest(message)) {
      try {
        const response: ExtractResponse = {
          ok: true,
          html: extractContent(message.mode),
          url: location.href,
        };

        sendResponse(response);
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : copy.errors.noContent,
        } satisfies ExtractResponse);
      }

      return false;
    }

    if (isCopyActionRequest(message)) {
      executeCopyAction(message)
        .then(() => {
          showToast(copy.notifications.copied, 'success');
          sendResponse({ ok: true } satisfies CopyResponse);
        })
        .catch((error: unknown) => {
          const errorMessage = error instanceof Error ? error.message : copy.errors.copyFailed;

          showToast(errorMessage, 'error');
          sendResponse({ ok: false, error: errorMessage } satisfies CopyResponse);
        });

      return true;
    }

    return false;
  });
})();
