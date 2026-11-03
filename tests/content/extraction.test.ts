import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { extractContent, extractFallbackContent } from '../../src/content/extraction';
import { htmlToMarkdown } from '../../src/conversion/markdown';

const articleText =
  'A substantial article paragraph with enough words to pass the readability threshold. It explains the important details of the subject and gives readers useful context.';

describe('extractContent', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.title = 'Test page';
    window.getSelection()?.removeAllRanges();
  });

  it('extracts primary article content without surrounding navigation', () => {
    document.body.innerHTML = `
      <nav><a href="/home">Home navigation</a></nav>
      <article><h1>Readable article</h1><p>${articleText}</p></article>
      <footer>Unrelated footer</footer>
    `;

    const html = extractContent('page');

    expect(html).toContain('Readable article');
    expect(html).toContain(articleText);
    expect(html).not.toContain('Home navigation');
  });

  it('adds the page title when extracted content has no H1', () => {
    document.title = 'Documentation page';
    document.body.innerHTML = `<main><p>${articleText}</p></main>`;

    const html = extractContent('page');

    expect(html).toContain('<h1>Documentation page</h1>');
  });

  it('uses the cleaned semantic fallback for documentation-shaped content', () => {
    document.body.innerHTML = `
      <main>
        <nav>Useful documentation navigation</nav>
        <p>${articleText}</p>
        <script>window.unwanted = true;</script>
        <button>Interactive control</button>
      </main>
    `;

    const html = extractFallbackContent();

    expect(html).toContain('Useful documentation navigation');
    expect(html).toContain(articleText);
    expect(html).not.toContain('window.unwanted');
    expect(html).not.toContain('Interactive control');
  });

  it('removes elements hidden by parsed inline styles without dropping visible styled content', () => {
    document.body.innerHTML = `
      <main>
        <p style="display : none !important">Hidden display content.</p>
        <p style="visibility: hidden">Hidden visibility content.</p>
        <p style="color: red">Visible styled documentation content.</p>
        <p aria-hidden="true">Visible accessibility-hidden content.</p>
        <p inert>Inert content.</p>
        <p>${articleText}</p>
      </main>
    `;

    const html = extractFallbackContent();

    expect(html).not.toContain('Hidden display content');
    expect(html).not.toContain('Hidden visibility content');
    expect(html).toContain('Visible accessibility-hidden content');
    expect(html).not.toContain('Inert content');
    expect(html).toContain('Visible styled documentation content');
    expect(html).toContain(articleText);
  });

  it('removes framework visually-hidden utilities only when their computed styles conceal them', () => {
    const stylesheet = document.createElement('style');

    stylesheet.textContent = `
      .cdk-visually-hidden {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0, 0, 0, 0) !important;
        white-space: nowrap !important;
        border: 0 !important;
      }
      .not-sr-only {
        position: static !important;
        width: auto !important;
        height: auto !important;
        overflow: visible !important;
        clip: auto !important;
        white-space: normal !important;
      }
    `;
    document.head.append(stylesheet);
    document.body.innerHTML = `
      <main>
        <p class="cdk-visually-hidden">Screen reader duplicate content.</p>
        <p class="sr-only not-sr-only">Visible overridden utility content.</p>
        <p>${articleText}</p>
      </main>
    `;

    try {
      const html = extractFallbackContent();

      expect(html).not.toContain('Screen reader duplicate content');
      expect(html).toContain('Visible overridden utility content');
      expect(html).toContain(articleText);
    } finally {
      stylesheet.remove();
    }
  });

  it('preserves visible article images that use clip-path for presentation', () => {
    document.body.innerHTML = `
      <main>
        <figure>
          <img
            src="/charts/network(overview).png"
            alt=""
            style="clip-path: inset(50%)"
          >
          <figcaption>Network traffic by ASN.</figcaption>
        </figure>
        <p>${articleText}</p>
      </main>
    `;

    const html = extractFallbackContent();

    expect(html).toContain('network(overview).png');
    expect(html).toContain('Network traffic by ASN.');
  });

  it('removes the complete visually-hidden utility pattern without removing visible clipped content', () => {
    const stylesheet = document.createElement('style');

    stylesheet.textContent = `
      .sr-only {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip-path: inset(50%) !important;
        white-space: nowrap !important;
      }
    `;
    document.head.append(stylesheet);
    document.body.innerHTML = `
      <main>
        <a class="sr-only">Copy link</a>
        <img src="/charts/visible.png" style="clip-path: inset(50%)" alt="">
        <p>${articleText}</p>
      </main>
    `;

    try {
      const html = extractFallbackContent();

      expect(html).not.toContain('Copy link');
      expect(html).toContain('/charts/visible.png');
      expect(html).toContain(articleText);
    } finally {
      stylesheet.remove();
    }
  });

  it('removes elements hidden by stylesheet rules and hidden ancestors', () => {
    const stylesheet = document.createElement('style');

    stylesheet.textContent = `
      .stylesheet-hidden { display: none !important; }
      .visibility-hidden { visibility: hidden; }
      .content-hidden { content-visibility: hidden; }
    `;
    document.head.append(stylesheet);

    document.body.innerHTML = `
      <main>
        <p class="stylesheet-hidden">Hidden by stylesheet.</p>
        <section class="visibility-hidden">
          <p>Hidden through an ancestor.</p>
        </section>
        <p class="content-hidden">Hidden by content visibility.</p>
        <p class="visible-with-class">Visible content remains.</p>
        <p>${articleText}</p>
      </main>
    `;

    try {
      const html = extractFallbackContent();

      expect(html).not.toContain('Hidden by stylesheet');
      expect(html).not.toContain('Hidden through an ancestor');
      expect(html).not.toContain('Hidden by content visibility');
      expect(html).toContain('Visible content remains');
      expect(html).toContain(articleText);
    } finally {
      stylesheet.remove();
    }
  });

  it('removes explicit interface controls without discarding meaningful alert content', () => {
    document.body.innerHTML = `
      <main>
        <p>${articleText}</p>
        <div role="toolbar"><button>Toolbar action</button></div>
        <div class="copy-button">Copy code control</div>
        <div role="alert">Important document warning remains.</div>
      </main>
    `;

    const html = extractFallbackContent();

    expect(html).not.toContain('Toolbar action');
    expect(html).not.toContain('Copy code control');
    expect(html).toContain('Important document warning remains.');
    expect(html).toContain(articleText);
  });

  it('counts fallback content from parsed text rather than stripping tags with a regex', () => {
    document.body.innerHTML = `
      <main>
        <p>${articleText}</p>
        <p>Comparison: 5 &lt; 8 and 9 &gt; 4.</p>
      </main>
    `;

    const html = extractContent('page');

    expect(html).toContain('Comparison: 5 &lt; 8 and 9 &gt; 4.');
  });

  it('removes executable page scripts but preserves script examples inside documentation code blocks', () => {
    document.body.innerHTML = readFileSync(
      resolve(import.meta.dirname, '../fixtures/iris-docs.html'),
      'utf8',
    );

    const extracted = extractFallbackContent();
    const markdown = htmlToMarkdown(extracted, 'https://docs.example.com/iris');

    expect(extracted).not.toContain('window.pageTracking');
    expect(markdown).toContain('```svelte');
    expect(markdown).toContain('<script lang="ts">');
    expect(markdown).toContain(
      "import { SiteHeader, SiteFooter } from '@weluvabid/iris/components';",
    );
    expect(markdown).toContain('```ts');
    expect(markdown).toContain('const answer = 42;');
  });

  it('extracts only the explicit DOM selection', () => {
    document.body.innerHTML =
      '<p id="chosen">Selected <strong>content</strong></p><p>Not selected</p>';
    const paragraph = document.querySelector('#chosen');
    const text = paragraph?.firstChild;

    if (!paragraph || !text) {
      throw new Error('Test fixture is invalid.');
    }

    const range = document.createRange();

    range.selectNodeContents(paragraph);
    const selection = window.getSelection();

    selection?.removeAllRanges();
    selection?.addRange(range);

    const html = extractContent('selection');

    expect(html).toContain('Selected');
    expect(html).toContain('<strong>content</strong>');
    expect(html).not.toContain('Not selected');
  });

  it('uses the selected fragment only when selection mode is requested', () => {
    document.body.innerHTML = `
      <nav id="selected">Explicit selection text</nav>
      <article><h1>Page article</h1><p>${articleText}</p></article>
    `;
    const selected = document.querySelector('#selected');

    if (!selected) {
      throw new Error('Test fixture is invalid.');
    }

    const range = document.createRange();

    range.selectNodeContents(selected);
    const selection = window.getSelection();

    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(extractContent('page')).not.toContain('Explicit selection text');
    expect(extractContent('selection')).toContain('Explicit selection text');
  });

  it('rejects an empty selection and pages without meaningful content', () => {
    expect(() => extractContent('selection')).toThrow('Select some page content first.');
    document.body.innerHTML = '<main><p>Too short.</p></main>';
    expect(() => extractContent('page')).toThrow('Could not find enough readable page content.');
  });
});
