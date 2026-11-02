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
