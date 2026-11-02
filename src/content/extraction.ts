import { Readability } from '@mozilla/readability';
import type { ExtractionMode } from '../shared/messages';

const MIN_ARTICLE_TEXT_LENGTH = 80;
const MAX_EXTRACTED_HTML_LENGTH = 5_000_000;
const REMOVED_ELEMENTS = [
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'object',
  'embed',
  'canvas',
  'form',
  'button',
  'input:not([type=checkbox])',
  'select',
  'textarea',
  '[hidden]',
  '[aria-hidden="true" i]',
  '[inert]',
  '[style*="display:none" i]',
  '[style*="display: none" i]',
  '[style*="visibility:hidden" i]',
  '[style*="visibility: hidden" i]',
].join(',');

function cloneSelection(): string {
  const selection = window.getSelection();

  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    throw new Error('Select some page content first.');
  }

  const container = document.createElement('div');

  for (let index = 0; index < selection.rangeCount; index += 1) {
    container.append(selection.getRangeAt(index).cloneContents());
  }

  return container.innerHTML;
}

export function extractFallbackContent(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;

  clone.querySelectorAll(REMOVED_ELEMENTS).forEach((element) => element.remove());

  // Prefer semantic content roots without aggressively stripping documentation navigation.
  const root = clone.querySelector('main, article, [role="main"]');

  return (root ?? clone).innerHTML;
}

function withPageTitle(html: string, title: string): string {
  const container = document.createElement('div');

  container.innerHTML = html;

  if (!container.querySelector('h1') && title.trim()) {
    const heading = document.createElement('h1');

    heading.textContent = title.trim();
    container.prepend(heading);
  }

  return container.innerHTML;
}

function extractPage(): string {
  let article: ReturnType<Readability['parse']> = null;

  try {
    const readerDocument = document.cloneNode(true) as Document;

    article = new Readability(readerDocument, {
      charThreshold: MIN_ARTICLE_TEXT_LENGTH,
    }).parse();
  } catch {
    // Some malformed or unusual documents can defeat Readability; the cleaned fallback remains usable.
  }

  const articleText = article?.textContent?.trim() ?? '';

  if (article?.content && articleText.length >= MIN_ARTICLE_TEXT_LENGTH) {
    return withPageTitle(article.content, article.title || document.title);
  }

  const fallback = extractFallbackContent();
  const textLength = fallback
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;

  if (textLength < MIN_ARTICLE_TEXT_LENGTH) {
    throw new Error('Could not find enough readable page content.');
  }

  return withPageTitle(fallback, document.title);
}

export function extractContent(mode: ExtractionMode): string {
  const html = mode === 'selection' ? cloneSelection() : extractPage();

  if (html.length > MAX_EXTRACTED_HTML_LENGTH) {
    throw new Error('This page is too large to convert safely. Try selecting a smaller section.');
  }

  return html;
}
