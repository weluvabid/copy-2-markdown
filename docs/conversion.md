# HTML-to-Markdown conversion

The converter lives in `src/conversion/markdown.ts`. It accepts an HTML fragment and its source URL,
then returns normalized Markdown. It does not read the active tab, call Chrome APIs, or write to
the clipboard.

## Turndown and GitHub-Flavored Markdown

The conversion is built on Turndown with the GitHub-Flavored Markdown plugin. The base configuration
uses ATX headings, fenced code blocks, asterisks for emphasis, hyphen bullets, and `---` horizontal
rules.

The output supports headings, paragraphs, inline formatting, links, images, nested lists, task
lists, blockquotes, fenced code blocks, horizontal rules, and GFM tables.

A small set of explicit rules handles cases where the default conversion needs tighter behaviour:

- Strikethrough elements become `~~text~~`.
- Links and images are resolved against the source page URL and checked against protocol allowlists.
- Image sources account for common lazy-loading attributes and `srcset` candidates.
- Code blocks retain a language hint when one can be identified, and their fence is longer than any
  backtick run in the code itself.
- Table cell pipes are escaped without losing already escaped pipes.
- Markdown whitespace is normalized without collapsing meaningful code-block contents.

## URL handling

Relative destinations are resolved with the browser URL parser using the source page as the base.
Links allow `http:`, `https:`, `mailto:`, and `tel:`. Images allow only `http:` and `https:`.
Destinations containing embedded username/password credentials or unsupported protocols are
omitted rather than emitted as Markdown links or images.

The converter does not attempt to fetch remote images or inline remote assets. It preserves a safe
resolved URL in the Markdown output.

## Why conversion is independent

Keeping conversion separate from extraction makes the formatter deterministic for a given HTML
fragment and base URL. It also means the tests can exercise malformed fragments, nested structures,
Unicode, escaping, code fences, and table edge cases without loading a browser extension.

The unit suite includes ordinary conversion tests and adversarial cases. The browser suite then
checks that the full extension path—from a real Chromium page to the clipboard—connects those pieces
correctly.
