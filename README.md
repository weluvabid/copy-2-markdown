# Copy 2 Markdown

A small, local-first Chrome extension for copying webpage content as clean Markdown.

## Actions

- **Copy page** — extracts the primary article with Mozilla Readability, then falls back to a cleaned semantic content root or body when the page is not article-shaped. The page title is added as an H1 only when the extracted content has no H1 already.
- **Copy selection** — converts only the content explicitly selected on the current page.
- **Copy link** — copies the current page as a Markdown link.

Conversion supports headings, paragraphs, inline formatting, links, images, nested ordered and unordered lists, task lists, fenced code blocks, blockquotes, horizontal rules, and GitHub-Flavored Markdown tables. Relative links and image URLs are resolved against the source page. Unsafe link and image protocols are omitted.

All extraction and conversion happens locally in the browser. The extension has no account, backend, telemetry, or remote processing.

## Requirements

- Node.js 26.13.0
- pnpm 12
- Chrome or Chromium with Manifest V3 support

## Development

```sh
pnpm install
pnpm dev
```

`pnpm dev` rebuilds `dist/` on changes. Load `dist/` as an unpacked extension from `chrome://extensions` and reload it after rebuilds.

## Quality checks and production build

```sh
pnpm check
```

The check runs ESLint, Prettier, TypeScript, Vitest, the production build, and manifest/build validation.

## Permissions

- `activeTab` — access the active page only after the user invokes the extension.
- `scripting` — inject the bundled extractor into that active page on demand.
- `clipboardWrite` — write the requested Markdown to the clipboard.

No persistent host permissions are requested. Browser-internal pages and other restricted URLs are rejected with a visible error.

## Project structure

```text
src/
  content/       On-demand page and selection extraction
  conversion/    HTML-to-Markdown conversion
  popup/         Three-action popup and status feedback
  shared/        Typed extension message contracts
  assets/fonts/  Bundled Atkinson Hyperlegible fonts and licence
```

The conversion module is independent of Chrome APIs and can be tested directly with HTML fragments. The bundled Atkinson Hyperlegible font files retain their own licence in `src/assets/fonts/LICENSE.txt`; that font licence is separate from the project licence and is copied into `dist/assets/fonts/` during builds.
