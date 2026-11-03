import copy from './shared/copy.json';
import type { CopyActionRequest } from './shared/messages';
import { installClipboardMessageHandler } from './background/clipboard';

const MENU_IDS = {
  page: 'copy-2-markdown-page',
  selection: 'copy-2-markdown-selection',
  link: 'copy-2-markdown-link',
} as const;

function registerContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_IDS.page,
      title: copy.contextMenu.page,
      contexts: ['page'],
    });
    chrome.contextMenus.create({
      id: MENU_IDS.selection,
      title: copy.contextMenu.selection,
      contexts: ['selection'],
    });
    chrome.contextMenus.create({
      id: MENU_IDS.link,
      title: copy.contextMenu.link,
      contexts: ['link'],
    });
  });
}

async function dispatchCopy(tabId: number, request: CopyActionRequest): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, request);
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tabId, request);
    } catch (error) {
      console.error('Copy 2 Markdown could not run on this page.', error);
    }
  }
}

installClipboardMessageHandler();

chrome.runtime.onInstalled.addListener(registerContextMenus);
chrome.runtime.onStartup.addListener(registerContextMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (typeof tab.id !== 'number') {
    return;
  }

  let request: CopyActionRequest | undefined;

  if (info.menuItemId === MENU_IDS.page) {
    request = { type: 'COPY_ACTION', action: 'page' };
  } else if (info.menuItemId === MENU_IDS.selection) {
    request = { type: 'COPY_ACTION', action: 'selection', selectionText: info.selectionText };
  } else if (info.menuItemId === MENU_IDS.link && info.linkUrl) {
    request = { type: 'COPY_ACTION', action: 'link', linkUrl: info.linkUrl };
  }

  if (request) {
    dispatchCopy(tab.id, request).catch((error: unknown) => {
      console.error('Copy 2 Markdown context-menu action failed.', error);
    });
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== 'copy-page-markdown' && command !== 'copy-selection-markdown') {
    return;
  }

  async function dispatchShortcut(): Promise<void> {
    let tabId = tab?.id;

    if (typeof tabId !== 'number') {
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

      tabId = activeTab?.id;
    }

    if (typeof tabId !== 'number') {
      return;
    }

    await dispatchCopy(tabId, {
      type: 'COPY_ACTION',
      action: command === 'copy-page-markdown' ? 'page' : 'selection',
    });
  }

  dispatchShortcut().catch((error: unknown) => {
    console.error('Copy 2 Markdown shortcut failed.', error);
  });
});
