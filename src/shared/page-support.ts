export type PageSupport = 'supported' | 'file-access-required' | 'unsupported';

/** Classify URLs that the page/selection extraction pipeline can safely handle. */
export function getPageSupport(value: string | undefined, fileAccessAllowed = false): PageSupport {
  if (!value) {
    return 'unsupported';
  }

  try {
    const url = new URL(value);

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      if (
        (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore')) ||
        url.hostname === 'chromewebstore.google.com'
      ) {
        return 'unsupported';
      }

      return 'supported';
    }

    if (url.protocol === 'file:') {
      return fileAccessAllowed ? 'supported' : 'file-access-required';
    }
  } catch {
    return 'unsupported';
  }

  return 'unsupported';
}

/** Only portable web links and explicitly supported local-file links are copied. */
export function isCopyablePageLink(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const protocol = new URL(value).protocol;

    return protocol === 'http:' || protocol === 'https:' || protocol === 'file:';
  } catch {
    return false;
  }
}

export function isCopyableTargetLink(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const protocol = new URL(value).protocol;

    return (
      protocol === 'http:' ||
      protocol === 'https:' ||
      protocol === 'file:' ||
      protocol === 'mailto:' ||
      protocol === 'tel:'
    );
  } catch {
    return false;
  }
}
