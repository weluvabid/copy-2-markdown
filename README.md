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

## Quality checks and browser tests

```sh
pnpm check
pnpm exec playwright install chromium
pnpm build
pnpm test:browser
```

`pnpm check` runs ESLint, Prettier, TypeScript, Vitest, the production build, and manifest/build validation. The Playwright suite loads the built MV3 extension in Chromium and exercises the popup, content-script injection, extraction, selection, and clipboard against a local fixture server.

The browser harness creates a temporary copy of `dist/` and adds a host permission restricted to its ephemeral `127.0.0.1` fixture origin. The production manifest and build output are never modified. Browser tests require the Chromium binary installed by Playwright.

Git hooks run the fast quality checks before commits and the production build plus Chromium acceptance suite before pushes. CI is intentionally disabled; the local hooks are the project's enforcement gate.

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
