import copy from '../shared/copy.json';
import type { ToastRequest } from '../shared/messages';

const BADGE_RESET_DELAY_MS = 2600;
const badgeTimers = new Map<string, ReturnType<typeof setTimeout>>();

function userFacingError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const knownMessages = Object.values(copy.errors);

  return knownMessages.includes(message) ? message : copy.errors.copyFailed;
}

export async function showTabToast(tabId: number, request: ToastRequest): Promise<boolean> {
  try {
    try {
      await chrome.tabs.sendMessage(tabId, request);
    } catch {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tabId, request);
    }

    return true;
  } catch {
    return false;
  }
}

export async function showActionBadge(
  tabId: number | undefined,
  success: boolean,
  title?: string,
): Promise<void> {
  const badgeText = success ? '✓' : '!';
  const badgeColor = success ? '#27845e' : '#b42318';
  const target = typeof tabId === 'number' ? { tabId } : {};
  const timerKey = typeof tabId === 'number' ? String(tabId) : 'global';

  try {
    await chrome.action.setBadgeText({ ...target, text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ ...target, color: badgeColor });
    await chrome.action.setTitle({
      ...target,
      title: title ?? (success ? copy.notifications.copied : copy.errors.copyFailed),
    });

    const previousTimer = badgeTimers.get(timerKey);

    if (previousTimer) {
      clearTimeout(previousTimer);
    }

    const timer = setTimeout(() => {
      badgeTimers.delete(timerKey);
      void chrome.action.setBadgeText({ ...target, text: '' }).catch(() => undefined);
      void chrome.action.setTitle({ ...target, title: copy.brand.name }).catch(() => undefined);
    }, BADGE_RESET_DELAY_MS);

    badgeTimers.set(timerKey, timer);
  } catch (error) {
    console.error('Copy 2 Markdown could not display toolbar feedback.', error);
  }
}

/** Report a user-triggered failure through the page toast, then the toolbar badge. */
export async function reportOperationFailure(
  tabId: number | undefined,
  error: unknown,
  operation: string,
): Promise<void> {
  const message = userFacingError(error);

  console.error(`Copy 2 Markdown ${operation} failed.`, error);

  const shown =
    typeof tabId === 'number'
      ? await showTabToast(tabId, {
          type: 'SHOW_TOAST',
          message,
          toastType: 'error',
        })
      : false;

  if (!shown) {
    await showActionBadge(tabId, false, message);
  }
}
