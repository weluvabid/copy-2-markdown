import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from '../../src/conversion/markdown';
import { nodesOfType, parseMarkdownAst } from '../helpers/markdown-ast';

const baseUrl = 'https://docs.example.com/guide/start';

describe('htmlToMarkdown', () => {
  it('converts headings, paragraphs and inline formatting', () => {
    const markdown = htmlToMarkdown(
      '<h1>Guide</h1><p>A <strong>strong</strong>, <em>useful</em> and <del>old</del> sentence.</p>',
      baseUrl,
    );

    expect(markdown).toContain('# Guide');
    expect(markdown).toContain('**strong**');
    expect(markdown).toContain('*useful*');
    expect(markdown).toContain('~~old~~');
  });

  it('resolves relative links and images against the page URL', () => {
    const markdown = htmlToMarkdown(
      '<p><a href="../api">API</a></p><img src="./diagram.png" alt="System diagram">',
      baseUrl,
    );

    expect(markdown).toContain('[API](https://docs.example.com/api)');
    expect(markdown).toContain('![System diagram](https://docs.example.com/guide/diagram.png)');
  });

  it('preserves nested lists and task lists', () => {
    const markdown = htmlToMarkdown(
      '<ol><li>One<ul><li>Nested</li></ul></li><li><input type="checkbox" checked> Done</li></ol>',
      baseUrl,
    );

    expect(markdown).toMatch(/1\.\s+One/);
    expect(markdown).toContain('Nested');
    expect(markdown).toMatch(/\[x]\s+Done/);
  });

  it('preserves nested blockquotes and horizontal rules', () => {
    const markdown = htmlToMarkdown(
      '<blockquote><p>Quoted</p><blockquote><p>Nested quote</p></blockquote></blockquote><hr>',
      baseUrl,
    );

    expect(markdown).toContain('> Quoted');
    expect(markdown).toContain('Nested quote');
    expect(markdown).toContain('---');
  });

  it.only('converts GFM tables and strikethrough', () => {
    const markdown = htmlToMarkdown(
      '<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>Cache</td><td>~~old~~ new</td></tr></tbody></table>',
      baseUrl,
    );

    expect(markdown).toContain('| Name | Value |');
    expect(markdown).toContain('~~old~~');
  });

  it('preserves fenced code blocks and language hints', () => {
    const markdown = htmlToMarkdown(
      '<pre><code class="language-rust">fn main() {\n  println!("hi");\n}</code></pre>',
      baseUrl,
    );

    expect(markdown).toContain('```rust');
    expect(markdown).toContain('fn main()');
  });

  it('does not normalize meaningful whitespace inside code blocks', () => {
    const markdown = htmlToMarkdown(
      '<pre><code>first line\n\nsecond line  \n</code></pre>',
      baseUrl,
    );

    expect(markdown).toContain('first line\n\nsecond line  \n```');
  });

  it('converts pre elements without code children and keeps syntax-highlighted text', () => {
    const markdown = htmlToMarkdown(
      '<pre class="highlight-source-ts"><span>const answer = 42;</span></pre>',
      baseUrl,
    );

    expect(markdown).toContain('```ts');
    expect(markdown).toContain('const answer = 42;');
  });

  it('preserves literal script examples as fenced code instead of executable HTML', () => {
    const markdown = htmlToMarkdown(
      '<pre><code class="language-svelte">&lt;script lang="ts"&gt;\n  const value = 1;\n&lt;/script&gt;</code></pre>',
      baseUrl,
    );

    expect(markdown).toContain('```svelte');
    expect(markdown).toContain('<script lang="ts">');
    expect(markdown).toContain('</script>');
    expect(markdown).not.toContain('\\=');
  });

  it('does not create unsafe links from protocol-relative or malformed URLs', () => {
    const markdown = htmlToMarkdown(
      '<a href="//cdn.example.com/docs">CDN</a><a href="http://[invalid">Broken</a>',
      baseUrl,
    );

    expect(markdown).toContain('[CDN](https://cdn.example.com/docs)');
    expect(markdown).toContain('Broken');
    expect(markdown).not.toContain('http://[invalid');
  });

  it('uses a longer fence when code contains backticks', () => {
    const markdown = htmlToMarkdown(
      '<pre><code class="language-js">const sample = ```;</code></pre>',
      baseUrl,
    );

    expect(markdown).toContain('````js');
    expect(markdown).toContain('const sample = ```;');
  });

  it('drops unsafe link and image protocols', () => {
    const markdown = htmlToMarkdown(
      '<a href="javascript:alert(1)">bad link</a><img src="data:image/png;base64,AAAA" alt="pixel">',
      baseUrl,
    );

    expect(markdown).toBe('bad link');
    expect(markdown).not.toContain('javascript:');
    expect(markdown).not.toContain('data:');
  });

  it('normalizes excessive whitespace and decodes entities', () => {
    const markdown = htmlToMarkdown('<p>Tom &amp; Jerry</p><p>Second</p><p>Third</p>', baseUrl);

    expect(markdown).toBe('Tom & Jerry\n\nSecond\n\nThird');
  });

  it('handles empty and malformed fragments without throwing', () => {
    expect(htmlToMarkdown('', baseUrl)).toBe('');
    expect(htmlToMarkdown('<p>unfinished <strong>markup', baseUrl)).toContain(
      'unfinished **markup**',
    );
  });

  describe('independent Markdown AST validation', () => {
    it('produces semantic GFM nodes for tables, task lists, links, images and strikethrough', () => {
      const markdown = htmlToMarkdown(
        `<h2>Release</h2>
         <ul><li><input type="checkbox" checked> shipped</li><li><input type="checkbox"> pending</li></ul>
         <table><thead><tr><th>Feature</th><th>Status</th></tr></thead><tbody><tr><td><a href="/docs">Docs</a></td><td><del>old</del></td></tr></tbody></table>
         <p><img src="/diagram.svg" alt="Architecture"></p>`,
        baseUrl,
      );
      const nodes = parseMarkdownAst(markdown);

      expect(nodesOfType(nodes, 'heading')).toHaveLength(1);
      expect(nodesOfType(nodes, 'list')).not.toHaveLength(0);
      expect(nodesOfType(nodes, 'table')).toHaveLength(1);
      expect(nodesOfType(nodes, 'link')).toHaveLength(1);
      expect(nodesOfType(nodes, 'image')).toHaveLength(1);
      expect(nodesOfType(nodes, 'delete')).toHaveLength(1);
      expect(nodesOfType(nodes, 'listItem').some((node) => node.checked === true)).toBe(true);
      expect(nodesOfType(nodes, 'listItem').some((node) => node.checked === false)).toBe(true);
    });

    it('preserves deeply nested mixed lists as nested AST lists', () => {
      const markdown = htmlToMarkdown(
        '<ul><li>Level one<ol><li>Level two<ul><li>Level three</li></ul></li></ol></li></ul>',
        baseUrl,
      );
      const nodes = parseMarkdownAst(markdown);

      expect(nodesOfType(nodes, 'list')).toHaveLength(3);
      expect(nodesOfType(nodes, 'listItem')).toHaveLength(3);
    });

    it('preserves fenced code language and literal script content in code AST nodes', () => {
      const markdown = htmlToMarkdown(
        '<pre><code class="highlight-source-svelte">&lt;script lang="ts"&gt;\nconst x = 1;\n&lt;/script&gt;</code></pre>',
        baseUrl,
      );
      const code = nodesOfType(parseMarkdownAst(markdown), 'code');

      expect(code).toHaveLength(1);
      expect(code[0]?.lang).toBe('svelte');
      expect(code[0]?.['value']).toContain('<script lang="ts">');
      expect(code[0]?.['value']).toContain('</script>');
    });

    it('keeps code containing fence delimiters parseable and intact', () => {
      const source = 'const sample = ```;\nconst tilde = ~~~~;';
      const markdown = htmlToMarkdown(
        `<pre><code class="language-js">${source}</code></pre>`,
        baseUrl,
      );
      const code = nodesOfType(parseMarkdownAst(markdown), 'code');

      expect(code).toHaveLength(1);
      expect(code[0]?.lang).toBe('js');
      expect(code[0]?.['value']).toBe(source);
    });

    it('does not emit raw HTML for supported semantic elements or unsafe URL targets', () => {
      const markdown = htmlToMarkdown(
        '<p><strong>safe</strong> <a href="javascript:alert(1)">label</a></p><img src="data:image/svg+xml,evil" alt="bad">',
        baseUrl,
      );
      const nodes = parseMarkdownAst(markdown);

      expect(nodesOfType(nodes, 'html')).toHaveLength(0);
      expect(nodesOfType(nodes, 'link')).toHaveLength(0);
      expect(nodesOfType(nodes, 'image')).toHaveLength(0);
      expect(nodesOfType(nodes, 'strong')).toHaveLength(1);
      expect(markdown).toContain('label');
    });

    it('preserves nested blockquotes and code blocks in the parsed structure', () => {
      const markdown = htmlToMarkdown(
        '<blockquote><p>Outer</p><blockquote><p>Inner</p><pre><code class="language-ts">const x = 1;</code></pre></blockquote></blockquote>',
        baseUrl,
      );
      const nodes = parseMarkdownAst(markdown);

      expect(nodesOfType(nodes, 'blockquote')).toHaveLength(2);
      expect(nodesOfType(nodes, 'code')).toHaveLength(1);
      expect(nodesOfType(nodes, 'code')[0]?.lang).toBe('ts');
    });
  });
});
