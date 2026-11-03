import copy from './shared/copy.json';
import type { CopyActionRequest, CopyAction } from './shared/messages';
import { formatShortcut } from './shared/shortcuts';
import { getPageSupport, isCopyablePageLink, isCopyableTargetLink } from './shared/page-support';
import {
  installClipboardMessageHandler,
  writeClipboardFromBackground,
} from './background/clipboard';
import { reportOperationFailure, showActionBadge, showTabToast } from './background/feedback';

const MENU_IDS = {
  page: 'copy-2-markdown-page',
  selection: 'copy-2-markdown-selection',
  pageLink: 'copy-2-markdown-page-link',
  targetLink: 'copy-2-markdown-target-link',
} as const;

const COMMAND_IDS: Record<CopyAction, string> = {
  page: 'copy-page-markdown',
  selection: 'copy-selection-markdown',
  link: 'copy-link-markdown',
};

async function getContextMenuTitles(): Promise<Record<CopyAction, string>> {
  try {
    const commands = await chrome.commands.getAll();
    const shortcuts = new Map(commands.map((command) => [command.name, command.shortcut ?? '']));

    const title = (action: CopyAction, label: string): string => {
      const shortcut = shortcuts.get(COMMAND_IDS[action]);

      return shortcut ? `${label} (${formatShortcut(shortcut)})` : label;
    };

    return {
      page: title('page', copy.contextMenu.page),
      selection: title('selection', copy.contextMenu.selection),
      link: title('link', copy.contextMenu.link),
    };
  } catch (error) {
    console.error('Copy 2 Markdown could not load context-menu shortcuts.', error);

    return copy.contextMenu;
  }
}

function registerContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    const removeError = chrome.runtime.lastError;

    if (removeError) {
      console.error('Copy 2 Markdown could not reset context menus.', removeError.message);

      return;
    }

    getContextMenuTitles()
      .then((titles) => {
        const entries = [
          {
            id: MENU_IDS.page,
            title: titles.page,
            contexts: ['page', 'link', 'selection'],
            documentUrlPatterns: ['http://*/*', 'https://*/*', 'file:///*'],
          },
          {
            id: MENU_IDS.selection,
            title: titles.selection,
            contexts: ['selection'],
            documentUrlPatterns: ['http://*/*', 'https://*/*', 'file:///*'],
          },
          {
            id: MENU_IDS.pageLink,
            title: titles.link,
            contexts: ['page'],
            documentUrlPatterns: ['http://*/*', 'https://*/*', 'file:///*'],
          },
          {
            id: MENU_IDS.targetLink,
            title: titles.link,
            contexts: ['link'],
          },
        ] satisfies chrome.contextMenus.CreateProperties[];

        for (const entry of entries) {
          chrome.contextMenus.create(entry, () => {
            const error = chrome.runtime.lastError;

            if (error) {
              console.error(`Copy 2 Markdown could not register ${entry.id}.`, error.message);
            }
          });
        }
      })
      .catch((error: unknown) => {
        console.error('Copy 2 Markdown could not register context menus.', error);
      });
  });
}

function escapeMarkdownLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/[[\]]/g, '\\$&').replace(/\s+/g, ' ').trim();
}

function createMarkdownLink(tab: chrome.tabs.Tab, linkUrl?: string): string {
  const rawUrl = linkUrl ?? tab.url;

  if (!rawUrl) {
    throw new Error(copy.errors.noLink);
  }

  const parsedUrl = new URL(rawUrl, tab.url);
  const validLink = linkUrl
    ? isCopyableTargetLink(parsedUrl.href)
    : isCopyablePageLink(parsedUrl.href);

  if (!validLink) {
    throw new Error(copy.errors.noLink);
  }

  const label = escapeMarkdownLabel(linkUrl ? rawUrl : tab.title?.trim() || rawUrl);

  return `[${label || parsedUrl.href}](<${parsedUrl.href}>)`;
}

async function copyLinkInBackground(tab: chrome.tabs.Tab, linkUrl?: string): Promise<void> {
  if (typeof tab.id !== 'number') {
    return;
  }

  try {
    const markdown = createMarkdownLink(tab, linkUrl);

    await writeClipboardFromBackground(markdown);

    const shown = await showTabToast(tab.id, {
      type: 'SHOW_TOAST',
      message: copy.notifications.copied,
      toastType: 'success',
    });

    if (!shown) {
      await showActionBadge(tab.id, true);
    }
  } catch (error) {
    await reportOperationFailure(tab.id, error, 'link action');
  }
}

async function dispatchCopy(
  tabId: number,
  request: CopyActionRequest,
  tabUrl?: string,
): Promise<void> {
  try {
    const fileAccessAllowed =
      tabUrl?.startsWith('file:') === true
        ? await chrome.extension.isAllowedFileSchemeAccess()
        : false;

    if (getPageSupport(tabUrl, fileAccessAllowed) !== 'supported') {
      throw new Error(
        tabUrl?.startsWith('file:') ? copy.states.fileAccessRequired : copy.errors.unsupportedPage,
      );
    }

    let response: { ok: boolean; error?: string } | undefined;

    try {
      response = await chrome.tabs.sendMessage<CopyActionRequest, { ok: boolean; error?: string }>(
        tabId,
        request,
      );
    } catch {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      response = await chrome.tabs.sendMessage<CopyActionRequest, { ok: boolean; error?: string }>(
        tabId,
        request,
      );
    }

    if (!response) {
      await reportOperationFailure(tabId, new Error(copy.errors.copyFailed), 'copy action');

      return;
    }

    // A rejected action is already reported by the content script's toast.
  } catch (error) {
    await reportOperationFailure(tabId, error, 'copy action');
  }
}

installClipboardMessageHandler();

chrome.runtime.onInstalled.addListener(registerContextMenus);
chrome.runtime.onStartup.addListener(registerContextMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (typeof tab?.id !== 'number') {
    reportOperationFailure(
      undefined,
      new Error(copy.errors.tabUnavailable),
      'context-menu action',
    ).catch((error: unknown) => {
      console.error('Copy 2 Markdown could not report the context-menu failure.', error);
    });

    return;
  }

  if (info.menuItemId === MENU_IDS.pageLink) {
    copyLinkInBackground(tab).catch((error: unknown) => {
      console.error('Copy 2 Markdown page-link action failed unexpectedly.', error);
    });

    return;
  }

  if (info.menuItemId === MENU_IDS.targetLink) {
    if (!info.linkUrl) {
      reportOperationFailure(tab.id, new Error(copy.errors.noLink), 'target-link action').catch(
        (error: unknown) => {
          console.error('Copy 2 Markdown could not report the target-link failure.', error);
        },
      );

      return;
    }

    copyLinkInBackground(tab, info.linkUrl).catch((error: unknown) => {
      console.error('Copy 2 Markdown target-link action failed unexpectedly.', error);
    });

    return;
  }

  let request: CopyActionRequest | undefined;

  if (info.menuItemId === MENU_IDS.page) {
    request = { type: 'COPY_ACTION', action: 'page' };
  } else if (info.menuItemId === MENU_IDS.selection) {
    request = {
      type: 'COPY_ACTION',
      action: 'selection',
      selectionText: info.selectionText,
    };
  }

  if (request) {
    dispatchCopy(tab.id, request, tab.url).catch((error: unknown) => {
      console.error('Copy 2 Markdown context-menu action failed unexpectedly.', error);
    });
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (!Object.values(COMMAND_IDS).includes(command)) {
    return;
  }

  async function dispatchShortcut(): Promise<void> {
    let activeTab = tab;

    try {
      if (typeof activeTab?.id !== 'number') {
        [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      }

      if (typeof activeTab?.id !== 'number') {
        throw new Error(copy.errors.tabUnavailable);
      }

      if (command === COMMAND_IDS.link) {
        await copyLinkInBackground(activeTab);

        return;
      }

      await dispatchCopy(
        activeTab.id,
        {
          type: 'COPY_ACTION',
          action: command === COMMAND_IDS.selection ? 'selection' : 'page',
        },
        activeTab.url,
      );
    } catch (error) {
      await reportOperationFailure(activeTab?.id, error, 'keyboard shortcut');
    }
  }

  dispatchShortcut().catch((error: unknown) => {
    console.error('Copy 2 Markdown shortcut failed unexpectedly.', error);
  });
});
