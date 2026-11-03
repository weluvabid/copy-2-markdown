import { htmlToMarkdown } from '../conversion/markdown';
import copy from '../shared/copy.json';
import { writeClipboard } from '../shared/clipboard';
import { getPageSupport, isCopyablePageLink } from '../shared/page-support';
import type { ExtractRequest, ExtractResponse, ExtractionMode } from '../shared/messages';

export type PopupAction = 'page' | 'link';
export type ActivePageTab = chrome.tabs.Tab & { id: number; url: string };

async function extract(
  tabId: number,
  mode: ExtractionMode,
): Promise<ExtractResponse & { ok: true }> {
  const request: ExtractRequest = { type: 'EXTRACT_CONTENT', mode };
  let response: ExtractResponse;

  try {
    response = await chrome.tabs.sendMessage<ExtractRequest, ExtractResponse>(tabId, request);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    response = await chrome.tabs.sendMessage<ExtractRequest, ExtractResponse>(tabId, request);
  }

  if (!response.ok) {
    throw new Error(response.error);
  }

  return response;
}

function createMarkdownLink(tab: ActivePageTab): string {
  if (!isCopyablePageLink(tab.url)) {
    throw new Error(copy.errors.noLink);
  }

  const title = (tab.title?.trim() || tab.url)
    .replace(/\s+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/[[\]]/g, '\\$&');

  return `[${title}](<${new URL(tab.url).href}>)`;
}

export async function copyPopupAction(tab: ActivePageTab, action: PopupAction): Promise<void> {
  let markdown: string;

  if (action === 'page') {
    const fileAccessAllowed = tab.url.startsWith('file:')
      ? await chrome.extension.isAllowedFileSchemeAccess()
      : false;

    if (getPageSupport(tab.url, fileAccessAllowed) !== 'supported') {
      throw new Error(
        tab.url.startsWith('file:') ? copy.states.fileAccessRequired : copy.errors.unsupportedPage,
      );
    }

    const result = await extract(tab.id, 'page');

    markdown = htmlToMarkdown(result.html, result.url);
  } else {
    markdown = createMarkdownLink(tab);
  }

  if (!markdown.trim()) {
    throw new Error(copy.errors.noMarkdown);
  }

  await writeClipboard(markdown);
}
