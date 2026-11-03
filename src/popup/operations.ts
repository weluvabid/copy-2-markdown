import { htmlToMarkdown } from '../conversion/markdown';
import copy from '../shared/copy.json';
import { writeClipboard } from '../shared/clipboard';
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
  const title = (tab.title?.trim() || tab.url)
    .replace(/\s+/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/[[\]]/g, '\\$&');

  return `[${title}](<${new URL(tab.url).href}>)`;
}

export async function copyPopupAction(tab: ActivePageTab, action: PopupAction): Promise<void> {
  let markdown: string;

  if (action === 'page') {
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
