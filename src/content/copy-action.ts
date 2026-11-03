import copy from '../shared/copy.json';
import type { CopyActionRequest } from '../shared/messages';
import { writeClipboard } from '../shared/clipboard';
import { extractContent } from './extraction';
import { htmlToMarkdown } from '../conversion/markdown';

function markdownLink(request: CopyActionRequest): string {
  const href = request.linkUrl;

  if (!href) {
    throw new Error(copy.errors.noLink);
  }

  const absoluteHref = new URL(href, location.href).href;
  const anchor = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find(
    (candidate) => candidate.href === absoluteHref,
  );
  const label = (anchor?.innerText || href)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\\/g, '\\\\')
    .replace(/[[\]]/g, '\\$&');

  return `[${label}](<${absoluteHref}>)`;
}

export async function executeCopyAction(request: CopyActionRequest): Promise<void> {
  const markdown =
    request.action === 'link'
      ? markdownLink(request)
      : htmlToMarkdown(extractContent(request.action, request.selectionText), location.href);

  if (!markdown.trim()) {
    throw new Error(copy.errors.noMarkdown);
  }

  await writeClipboard(markdown);
}
