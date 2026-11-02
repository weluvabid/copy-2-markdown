import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from '../../src/conversion/markdown';
import { nodesOfType, parseMarkdownAst } from '../helpers/markdown-ast';

const baseUrl = 'https://docs.example.com/guides/conversion/index.html';

describe('htmlToMarkdown adversarial cases', () => {
  it('preserves mixed strong and emphasis as nested semantic formatting', () => {
    const markdown = htmlToMarkdown(
      '<p><strong><em>triplet</em></strong> and <em><strong>reversed</strong></em></p>',
      baseUrl,
    );
    const nodes = parseMarkdownAst(markdown);

    expect(markdown).toContain('***triplet***');
    expect(nodesOfType(nodes, 'strong')).toHaveLength(2);
    expect(nodesOfType(nodes, 'emphasis')).toHaveLength(2);
  });

  it('preserves inline code containing backticks', () => {
    const markdown = htmlToMarkdown('<p>Use <code>value `with` ticks</code> here.</p>', baseUrl);
    const inlineCode = nodesOfType(parseMarkdownAst(markdown), 'inlineCode');

    expect(inlineCode).toHaveLength(1);
    expect(inlineCode[0]?.['value']).toBe('value `with` ticks');
  });

  it('preserves table alignment and escapes pipes inside cell content', () => {
    const markdown = htmlToMarkdown(
      '<table><thead><tr><th align="left">Name</th><th align="right">Count</th><th align="center">Expression</th></tr></thead><tbody><tr><td>Cache</td><td>42</td><td>A | B | C</td></tr></tbody></table>',
      baseUrl,
    );
    const tables = nodesOfType(parseMarkdownAst(markdown), 'table');

    expect(tables).toHaveLength(1);
    expect(tables[0]?.['align']).toEqual(['left', 'right', 'center']);
    expect(markdown).toContain('A \\| B \\| C');
  });

  it('keeps table boundaries with whitespace text nodes and multiple body rows', () => {
    const markdown = htmlToMarkdown(
      `<table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Expression</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cache</td>
            <td>A | B | C</td>
          </tr>
          <tr>
            <td>Queue</td>
            <td>D | E</td>
          </tr>
        </tbody>
      </table>`,
      baseUrl,
    );
    const tables = nodesOfType(parseMarkdownAst(markdown), 'table');

    expect(tables).toHaveLength(1);
    expect(markdown).toContain('| Name | Expression |');
    expect(markdown).toContain('| Cache | A \\| B \\| C |');
    expect(markdown).toContain('| Queue | D \\| E |');
  });

  it('preserves link destinations, relative resolution and title attributes', () => {
    const markdown = htmlToMarkdown(
      '<p><a href="../api" title="API reference">Relative</a> <a href="https://example.org/path?q=one&amp;x=two" title="External docs">Absolute</a></p>',
      baseUrl,
    );
    const links = nodesOfType(parseMarkdownAst(markdown), 'link');

    expect(links).toHaveLength(2);
    expect(links[0]?.['url']).toBe('https://docs.example.com/guides/api');
    expect(links[0]?.['title']).toBe('API reference');
    expect(links[1]?.['url']).toBe('https://example.org/path?q=one&x=two');
    expect(links[1]?.['title']).toBe('External docs');
  });

  it('escapes image alt text and preserves image titles', () => {
    const markdown = htmlToMarkdown(
      '<img src="/images/diagram.svg" alt="[diagram] \\\\ path" title="System diagram">',
      baseUrl,
    );
    const images = nodesOfType(parseMarkdownAst(markdown), 'image');

    expect(images).toHaveLength(1);
    expect(images[0]?.['url']).toBe('https://docs.example.com/images/diagram.svg');
    expect(images[0]?.['alt']).toBe('[diagram] \\\\ path');
    expect(images[0]?.['title']).toBe('System diagram');
  });

  it('rejects dangerous URL schemes while retaining safe link labels', () => {
    const markdown = htmlToMarkdown(
      '<a href="javascript:alert(1)">javascript</a><a href="vbscript:msgbox(1)">vbscript</a><a href="data:text/html,evil">data</a><a href="file:///etc/passwd">file</a><img src="javascript:alert(1)" alt="unsafe">',
      baseUrl,
    );
    const nodes = parseMarkdownAst(markdown);

    expect(nodesOfType(nodes, 'link')).toHaveLength(0);
    expect(nodesOfType(nodes, 'image')).toHaveLength(0);
    expect(markdown).toContain('javascript');
    expect(markdown).toContain('vbscript');
    expect(markdown).toContain('data');
    expect(markdown).toContain('file');
    expect(markdown).not.toContain('alert(1)');
  });

  it('preserves code language, indentation and internal blank lines', () => {
    const source =
      'function example() {\n    if (true) {\n        return 1;\n    }\n\n    return 0;\n}';
    const markdown = htmlToMarkdown(
      `<pre><code class="language-typescript">${source}</code></pre>`,
      baseUrl,
    );
    const code = nodesOfType(parseMarkdownAst(markdown), 'code');

    expect(code).toHaveLength(1);
    expect(code[0]?.lang).toBe('typescript');
    expect(code[0]?.['value']).toBe(source);
  });

  it('preserves language hints from common highlighter class conventions', () => {
    const cases = [
      ['language-typescript', 'typescript'],
      ['lang-rust', 'rust'],
      ['highlight-source-svelte', 'svelte'],
      ['highlight-python', 'python'],
    ] as const;

    for (const [className, language] of cases) {
      const markdown = htmlToMarkdown(
        `<pre><code class="${className}">const answer = 42;</code></pre>`,
        baseUrl,
      );
      const code = nodesOfType(parseMarkdownAst(markdown), 'code');

      expect(code[0]?.lang, className).toBe(language);
    }
  });

  it('preserves line breaks as hard breaks', () => {
    const markdown = htmlToMarkdown('<p>First line<br>Second line<br />Third line</p>', baseUrl);
    const breaks = nodesOfType(parseMarkdownAst(markdown), 'break');

    expect(breaks).toHaveLength(2);
  });

  it('escapes destination parentheses and quoted title punctuation', () => {
    const markdown = htmlToMarkdown(
      '<a href="/guide/(advanced)" title="A &quot;quoted&quot; title">Advanced guide</a>',
      baseUrl,
    );
    const links = nodesOfType(parseMarkdownAst(markdown), 'link');

    expect(links).toHaveLength(1);
    expect(links[0]?.['url']).toBe('https://docs.example.com/guide/%28advanced%29');
    expect(links[0]?.['title']).toBe('A "quoted" title');
  });

  it('round-trips link titles containing quote and backslash combinations', () => {
    const cases = [
      ['Double quotes', 'A "quoted" title'],
      ['Single quotes', "A 'quoted' title"],
      ['Both quote types', 'A "double" and \'single\' title'],
      ['Backslash', String.raw`A \\ path`],
    ] as const;

    for (const [label, title] of cases) {
      const escapedTitle = title.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      const markdown = htmlToMarkdown(
        `<a href="/guide" title="${escapedTitle}">${label}</a>`,
        baseUrl,
      );
      const link = nodesOfType(parseMarkdownAst(markdown), 'link')[0];

      expect(link?.['title'], label).toBe(title);
    }
  });

  it('round-trips image titles containing quotes and backslashes', () => {
    const title = 'A "diagram" and \'source\' \\ reference';
    const htmlTitle = title.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const markdown = htmlToMarkdown(
      `<img src="/diagram.svg" alt="Architecture" title="${htmlTitle}">`,
      baseUrl,
    );
    const image = nodesOfType(parseMarkdownAst(markdown), 'image')[0];

    expect(image?.['title']).toBe(title);
  });

  it('preserves Unicode, non-breaking spaces and normalized source line endings', () => {
    const markdown = htmlToMarkdown('<p>Résumé — 東京\r\nsecond&nbsp;line</p>', baseUrl);
    const text = nodesOfType(parseMarkdownAst(markdown), 'text')
      .map((node) => node['value'])
      .join(' ');

    expect(text).toContain('Résumé — 東京');
    expect(text).toContain('second line');
  });

  it('preserves deeply nested mixed lists under adversarial inline content', () => {
    const markdown = htmlToMarkdown(
      '<ul><li><strong>Outer</strong><ol><li><a href="/inner">Inner</a><ul><li><code>leaf()</code></li></ul></li></ol></li></ul>',
      baseUrl,
    );
    const nodes = parseMarkdownAst(markdown);

    expect(nodesOfType(nodes, 'list')).toHaveLength(3);
    expect(nodesOfType(nodes, 'strong')).toHaveLength(1);
    expect(nodesOfType(nodes, 'link')).toHaveLength(1);
    expect(nodesOfType(nodes, 'inlineCode')).toHaveLength(1);
  });

  it('preserves deeply nested blockquotes', () => {
    const markdown = htmlToMarkdown(
      '<blockquote><p>One</p><blockquote><p>Two</p><blockquote><p>Three</p><blockquote><p>Four</p></blockquote></blockquote></blockquote></blockquote>',
      baseUrl,
    );
    const quotes = nodesOfType(parseMarkdownAst(markdown), 'blockquote');

    expect(quotes).toHaveLength(4);
    expect(markdown).toContain('Four');
  });

  it('handles malformed fragments and empty elements without losing surrounding text', () => {
    const markdown = htmlToMarkdown(
      '<p>Before <strong>bold<p>After <em>italic</em></em><span></span><div></div><p></p>',
      baseUrl,
    );
    const nodes = parseMarkdownAst(markdown);

    expect(markdown).toContain('Before');
    expect(markdown).toContain('bold');
    expect(markdown).toContain('After');
    expect(markdown).toContain('italic');
    expect(nodesOfType(nodes, 'paragraph').length).toBeGreaterThan(0);
  });

  it('does not invent content for empty tags', () => {
    expect(htmlToMarkdown('<p></p><span></span><strong></strong><em></em>', baseUrl)).toBe('');
  });

  it('keeps a long sequence of mixed nested formatting parseable', () => {
    const markdown = htmlToMarkdown(
      '<p><strong>bold <em>and italic <del>and deleted <code>inline</code></del></em></strong></p>',
      baseUrl,
    );
    const nodes = parseMarkdownAst(markdown);

    expect(nodesOfType(nodes, 'strong')).toHaveLength(1);
    expect(nodesOfType(nodes, 'emphasis')).toHaveLength(1);
    expect(nodesOfType(nodes, 'delete')).toHaveLength(1);
    expect(nodesOfType(nodes, 'inlineCode')).toHaveLength(1);
  });
});
