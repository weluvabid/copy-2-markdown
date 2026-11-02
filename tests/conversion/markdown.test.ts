import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from '../../src/conversion/markdown';

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

  it('converts GFM tables and strikethrough', () => {
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
});
