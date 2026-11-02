import { Readability } from '@mozilla/readability';
import type { ExtractionMode } from '../shared/messages';
import { removalPolicies, visuallyHiddenUtilitySelectors } from './filtering';

const MIN_ARTICLE_TEXT_LENGTH = 80;
const MAX_EXTRACTED_HTML_LENGTH = 5_000_000;

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

function isVisuallyHidden(element: Element): boolean {
  const style = window.getComputedStyle(element);

  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.visibility === 'collapse' ||
    style.contentVisibility === 'hidden' ||
    Number.parseFloat(style.opacity) === 0
  ) {
    return true;
  }

  const width = Number.parseFloat(style.width);
  const height = Number.parseFloat(style.height);
  const hasTinyBox = Number.isFinite(width) && Number.isFinite(height) && width <= 1 && height <= 1;
  const clipsOverflow =
    ['hidden', 'clip'].includes(style.overflow) ||
    ['hidden', 'clip'].includes(style.overflowX) ||
    ['hidden', 'clip'].includes(style.overflowY);
  const hasClipPath = style.clipPath !== 'none' && /inset\(\s*(?:50%|100%)/i.test(style.clipPath);
  const clip = style.clip.replace(/\s+/g, '').toLowerCase();
  const hasZeroClip = /^rect\(0(?:px)?,0(?:px)?,0(?:px)?,0(?:px)?\)$/.test(clip);
  const hasVisuallyHiddenUtility = visuallyHiddenUtilitySelectors.some((selector) =>
    element.matches(selector),
  );

  // Covers common visually-hidden utility recipes without treating tiny elements,
  // absolute positioning, clipping, or class names as sufficient on their own.
  const hasClassicVisuallyHiddenPattern =
    hasTinyBox &&
    (style.position === 'absolute' || style.position === 'fixed') &&
    clipsOverflow &&
    (hasClipPath || hasZeroClip || (hasVisuallyHiddenUtility && style.whiteSpace === 'nowrap'));

  return hasClipPath || hasZeroClip || hasClassicVisuallyHiddenPattern;
}

function removeDocumentNoise(source: HTMLElement, clone: HTMLElement): void {
  const sourceElements = source.querySelectorAll('*');
  const clonedElements = clone.querySelectorAll('*');
  const count = Math.min(sourceElements.length, clonedElements.length);

  // Deep cloning preserves element order, allowing computed styles to be read
  // from the live document without attaching the clone or executing page code.
  for (let index = 0; index < count; index += 1) {
    const sourceElement = sourceElements[index];
    const clonedElement = clonedElements[index];

    if (!sourceElement || !clonedElement || !clone.contains(clonedElement)) {
      continue;
    }

    if (isVisuallyHidden(sourceElement)) {
      clonedElement.remove();
    }
  }

  for (const policy of removalPolicies) {
    for (const selector of policy.selectors) {
      clone.querySelectorAll(selector).forEach((element) => element.remove());
    }
  }
}

export function extractFallbackContent(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;

  removeDocumentNoise(document.body, clone);

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

    // Readability operates on a detached document and cannot evaluate computed
    // styles itself. Remove visually hidden nodes using the live document's
    // computed styles before parsing, so hidden content is excluded from both
    // the primary and fallback extraction paths.
    if (document.body && readerDocument.body) {
      removeDocumentNoise(document.body, readerDocument.body);
    }

    article = new Readability(readerDocument, {
      charThreshold: MIN_ARTICLE_TEXT_LENGTH,
      keepClasses: true,
    }).parse();
  } catch {
    // Some malformed or unusual documents can defeat Readability; the cleaned fallback remains usable.
  }

  const articleText = article?.textContent?.trim() ?? '';

  if (article?.content && articleText.length >= MIN_ARTICLE_TEXT_LENGTH) {
    return withPageTitle(article.content, article.title || document.title);
  }

  const fallback = extractFallbackContent();
  const fallbackText = document.createElement('div');

  fallbackText.innerHTML = fallback;
  const textLength = fallbackText.textContent?.replace(/\s+/g, ' ').trim().length ?? 0;

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
