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

    if (resolved.username || resolved.password || !allowedProtocols.has(resolved.protocol)) {
      return null;
    }

    return resolved.href;
  } catch {
    return null;
  }
}

function resolveImageSource(image: HTMLImageElement, baseUrl: string): string | null {
  const candidates = [
    image.getAttribute('src'),
    image.getAttribute('data-src'),
    image.getAttribute('data-lazy-src'),
    image.getAttribute('data-original'),
    image.getAttribute('data-original-src'),
    image.getAttribute('data-lazy'),
    image.getAttribute('data-lightbox-src'),
  ];

  for (const candidate of candidates) {
    const resolved = resolveUrl(candidate, baseUrl, ALLOWED_IMAGE_PROTOCOLS);

    if (resolved) {
      return resolved;
    }
  }

  // srcset is a fallback only. Prefer the largest declared candidate so copied
  // Markdown does not unnecessarily point at a low-resolution thumbnail.
  const srcset = image.getAttribute('srcset');

  if (srcset) {
    const candidatesFromSet = srcset
      .split(',')
      .map((candidate) => {
        const [url, descriptor] = candidate.trim().split(/\s+/);

        return {
          url,
          density: descriptor ? Number.parseFloat(descriptor) || 0 : 1,
        };
      })
      .filter((candidate): candidate is { url: string; density: number } => Boolean(candidate.url))
      .sort((left, right) => right.density - left.density);

    for (const candidate of candidatesFromSet) {
      const resolved = resolveUrl(candidate.url, baseUrl, ALLOWED_IMAGE_PROTOCOLS);

      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
}

function markdownDestination(url: string): string {
  // CommonMark's angle-bracket destination form safely contains parentheses
  // and other characters that would otherwise need ad-hoc escaping.
  return `<${url}>`;
}

function languageFrom(element: HTMLElement): string {
  const dataLanguage =
    element.getAttribute('data-language')?.trim() ?? element.getAttribute('data-lang')?.trim();

  if (dataLanguage && /^[\w+#.-]+$/.test(dataLanguage)) {
    return dataLanguage;
  }

  const classNames = [element.className, element.parentElement?.className ?? ''];

  const prefixes = ['highlight-source-', 'language-', 'lang-', 'highlight-'];

  for (const className of classNames) {
    for (const token of className.split(/\s+/)) {
      const prefix = prefixes.find((candidate) => token.toLowerCase().startsWith(candidate));

      if (!prefix) {
        continue;
      }

      const candidate = token.slice(prefix.length).replace(/^-+/, '');

      if (
        /^[\w+#.-]+$/.test(candidate) &&
        !['none', 'plain', 'text'].includes(candidate.toLowerCase())
      ) {
        return candidate;
      }
    }
  }

  return '';
}

function escapeTablePipes(value: string): string {
  let escaped = '';

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character === '|') {
      let precedingBackslashes = 0;

      for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
        precedingBackslashes += 1;
      }

      if (precedingBackslashes % 2 === 0) {
        escaped += '\\';
      }
    }

    escaped += character;
  }

  return escaped;
}

function formatMarkdownTitle(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return '';
  }

  const escaped = normalized.replace(/\\/g, '\\\\');

  if (!normalized.includes('"')) {
    return `"${escaped}"`;
  }

  if (!normalized.includes("'")) {
    return `'${escaped}'`;
  }

  return `"${escaped.replace(/"/g, '\\"')}"`;
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

      const href = markdownDestination(resolvedHref);
      const title = anchor.title ? ` ${formatMarkdownTitle(anchor.title)}` : '';

      // Block wrappers (commonly nested <div>s around linked avatars) can
      // contribute leading/trailing blank lines to Turndown's child content.
      // Links are inline Markdown constructs, so discard only that outer
      // whitespace while preserving all meaningful content inside the label.
      const label = content.trim();

      return label ? `[${label}](${href}${title})` : '';
    },
  });

  turndown.addRule('safeImages', {
    filter: 'img',
    replacement(_content, node) {
      const image = node as HTMLImageElement;
      const resolvedSrc = resolveImageSource(image, baseUrl);

      if (!resolvedSrc) {
        return '';
      }

      const src = markdownDestination(resolvedSrc);
      const alt = (image.getAttribute('alt') ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/[[\]]/g, '\\$&');
      const title = image.title ? ` ${formatMarkdownTitle(image.title)}` : '';

      return `![${alt}](${src}${title})`;
    },
  });

  turndown.addRule('fencedCodeBlocks', {
    filter: 'pre',

    replacement(_content, node) {
      const pre = node as HTMLElement;
      const code = pre.querySelector('code');

      const language = (code ? languageFrom(code) : '') || languageFrom(pre);
      const text = (code ?? pre).textContent?.replace(/\n+$/, '') ?? '';

      if (!text) {
        return '';
      }

      let longestFence = 0;

      for (const [run] of text.matchAll(/`+/g)) {
        longestFence = Math.max(longestFence, run.length);
      }

      const fence = '`'.repeat(Math.max(3, longestFence + 1));

      return `\n\n${fence}${language}\n${text}\n${fence}\n\n`;
    },
  });

  // Mirror the GFM plugin's cell delimiters, but use firstElementChild so
  // indentation text nodes inside <tr> do not hide the first cell.
  // The plugin itself determines the first cell using childNodes indexes,
  // which can be thrown off by whitespace-only text nodes.
  turndown.addRule('safeTableCells', {
    filter: ['th', 'td'],
    replacement(content, node) {
      const escaped = escapeTablePipes(content);
      const isFirstCell = node.parentNode?.firstElementChild === node;

      return `${isFirstCell ? '| ' : ' '}${escaped} |`;
    },
  });

  return normalizeMarkdown(turndown.turndown(html));
}
