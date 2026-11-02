import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const ALLOWED_IMAGE_PROTOCOLS = new Set(['http:', 'https:']);

function resolveUrl(
  value: string | null,
  baseUrl: string,
  allowedProtocols: Set<string>,
): string | null {
  if (!value?.trim()) {
    return null;
  }

  try {
    const resolved = new URL(value.trim(), baseUrl);

    return allowedProtocols.has(resolved.protocol) ? resolved.href : null;
  } catch {
    return null;
  }
}

function languageFrom(element: HTMLElement): string {
  const dataLanguage = element.getAttribute('data-language')?.trim();

  if (dataLanguage && /^[\w+#.-]+$/.test(dataLanguage)) {
    return dataLanguage;
  }

  const classNames = [element.className, element.parentElement?.className ?? ''];
  const classTokens = classNames.flatMap((className) => className.split(/\s+/));

  for (const token of classTokens) {
    const match = token.match(/^(?:language|lang|highlight)-?([\w+#.-]+)$/i);

    if (match?.[1] && !['none', 'plain', 'text'].includes(match[1].toLowerCase())) {
      return match[1];
    }
  }

  return '';
}

function escapeMarkdownTitle(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s+/g, ' ');
}

function normalizeMarkdown(markdown: string): string {
  const normalized: string[] = [];
  let fenceCharacter: string | null = null;
  let fenceLength = 0;
  let previousLineWasBlank = false;

  for (const line of markdown.split('\n')) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);

    if (fenceCharacter) {
      normalized.push(line);

      if (
        fenceMatch?.[1] &&
        fenceMatch[1][0] === fenceCharacter &&
        fenceMatch[1].length >= fenceLength
      ) {
        fenceCharacter = null;
        fenceLength = 0;
      }

      continue;
    }

    if (fenceMatch?.[1]) {
      fenceCharacter = fenceMatch[1].charAt(0);
      fenceLength = fenceMatch[1].length;
      normalized.push(line);
      previousLineWasBlank = false;

      continue;
    }

    if (line.trim() === '') {
      if (!previousLineWasBlank) {
        normalized.push('');
      }

      previousLineWasBlank = true;

      continue;
    }

    normalized.push(line.replace(/[ \t]+$/, (trailing) => (trailing.length >= 2 ? '  ' : '')));
    previousLineWasBlank = false;
  }

  return normalized.join('\n').trim();
}

export function htmlToMarkdown(html: string, baseUrl: string): string {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    bulletListMarker: '-',
    strongDelimiter: '**',
    hr: '---',
  });

  turndown.use(gfm);
  turndown.addRule('strikethrough', {
    filter: (node) =>
      node.nodeName === 'DEL' || node.nodeName === 'S' || node.nodeName === 'STRIKE',
    replacement(content) {
      return content ? `~~${content}~~` : '';
    },
  });

  turndown.addRule('safeLinks', {
    filter: 'a',
    replacement(content, node) {
      const anchor = node as HTMLAnchorElement;
      const resolvedHref = resolveUrl(anchor.getAttribute('href'), baseUrl, ALLOWED_LINK_PROTOCOLS);

      if (!resolvedHref) {
        return content;
      }

      const href = resolvedHref.replace(/[()]/g, (character) =>
        character === '(' ? '%28' : '%29',
      );
      const title = anchor.title ? ` "${escapeMarkdownTitle(anchor.title)}"` : '';

      return content.trim() ? `[${content}](${href}${title})` : '';
    },
  });

  turndown.addRule('safeImages', {
    filter: 'img',
    replacement(_content, node) {
      const image = node as HTMLImageElement;
      const resolvedSrc = resolveUrl(image.getAttribute('src'), baseUrl, ALLOWED_IMAGE_PROTOCOLS);

      if (!resolvedSrc) {
        return '';
      }

      const src = resolvedSrc.replace(/[()]/g, (character) => (character === '(' ? '%28' : '%29'));
      const alt = (image.getAttribute('alt') ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/[[\]]/g, '\\$&');
      const title = image.title ? ` "${escapeMarkdownTitle(image.title)}"` : '';

      return `![${alt}](${src}${title})`;
    },
  });

  turndown.addRule('languageCodeBlocks', {
    filter(node, _options) {
      return node.nodeName === 'PRE' && Boolean((node as HTMLElement).querySelector('code'));
    },
    replacement(_content, node) {
      const pre = node as HTMLElement;
      const code = pre.querySelector('code');

      if (!code) {
        return '';
      }

      const language = languageFrom(code) || languageFrom(pre);
      const text = code.textContent?.replace(/\n+$/, '') ?? '';
      let longestFence = 0;

      for (const [run] of text.matchAll(/`+/g)) {
        longestFence = Math.max(longestFence, run.length);
      }

      const fence = '`'.repeat(Math.max(3, longestFence + 1));

      return `\n\n${fence}${language}\n${text}\n${fence}\n\n`;
    },
  });

  return normalizeMarkdown(turndown.turndown(html));
}
