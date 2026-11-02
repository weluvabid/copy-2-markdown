import { extractContent } from './extraction';
import type { ExtractRequest, ExtractResponse } from '../shared/messages';

(function copy2MarkdownContentScript() {
  const contentWindow = window as Window & {
    __copy2MarkdownContentScriptInstalled?: boolean;
  };

  if (contentWindow.__copy2MarkdownContentScriptInstalled) {
    return;
  }

  contentWindow.__copy2MarkdownContentScriptInstalled = true;

  function isExtractRequest(message: unknown): message is ExtractRequest {
    if (typeof message !== 'object' || message === null) {
      return false;
    }

    return (
      'type' in message &&
      message.type === 'EXTRACT_CONTENT' &&
      'mode' in message &&
      (message.mode === 'page' || message.mode === 'selection')
    );
  }

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isExtractRequest(message)) {
      return false;
    }

    try {
      const response: ExtractResponse = {
        ok: true,
        html: extractContent(message.mode),
        url: window.location.href,
      };

      sendResponse(response);
    } catch (error) {
      const response: ExtractResponse = {
        ok: false,
        error: error instanceof Error ? error.message : 'Unable to extract page content.',
      };

      sendResponse(response);
    }

    return false;
  });
})();
