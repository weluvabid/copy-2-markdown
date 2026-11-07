# Copy 2 Markdown

A small, local-first Chrome extension for copying webpage content as clean Markdown.

Copy 2 Markdown turns a page, a selection, or a link into Markdown and puts the result on the
clipboard. It runs in the browser, asks for page access only when an action is invoked, and does
not send copied content anywhere.

The Chrome Web Store release is coming soon. Until then, the project includes a validated build
and a manual installation path for people who want to try it from a GitHub Release.

## Have a look

**Source:** <https://github.com/weluvabid/copy-2-markdown>

## What it does

- **Copy page** — available from the extension popup or page context menu. It uses Mozilla
  Readability for article-shaped pages, then falls back to a cleaned semantic content root or the
  page body when a page is not an article. The page title is added as an H1 only when the extracted
  content does not already contain one.
- **Copy selection** — available from the selection context menu or keyboard shortcut. It converts
  the selected content without injecting a floating selection control into the page.
- **Copy link as Markdown** — available from the context menu, keyboard shortcut, or popup. On a
  link, it copies that destination; elsewhere, it copies the current page URL as a Markdown link.
- **Local conversion** — extraction and HTML-to-Markdown conversion happen in the browser. There is
  no account, application backend, telemetry, or remote content processing.

Conversion supports headings, paragraphs, inline formatting, links, images, nested ordered and
unordered lists, task lists, fenced code blocks, blockquotes, horizontal rules, and GitHub-Flavored
Markdown tables. Relative links and image URLs are resolved against the source page. Unsupported or
unsafe link and image protocols are omitted.

## Keyboard shortcuts

- `Alt+Shift+M` — copy the current page as Markdown.
- `Alt+Shift+L` — copy the current selection as Markdown.
- `Alt+Shift+K` — copy the current page URL as a Markdown link.

These are suggested shortcuts, not fixed bindings. Chrome may assign different shortcuts or leave
one unassigned. The popup reads the current assignments and displays `Not assigned` when needed.
Change them from `chrome://extensions/shortcuts` if they conflict with another browser or system
shortcut.

## A few decisions worth a look

- **Page access is on demand.** The extension uses `activeTab` and injects its bundled content script
  after the user invokes an action. It does not request persistent host permissions.
- **Extraction has a fallback.** Readability is useful for article pages, but not every useful page
  is an article. When it cannot produce enough content, a cleaned semantic root or the body is used
  instead.
- **Filtering is deliberately layered.** Structural elements, semantic controls, and a narrow set
  of framework UI patterns are handled separately. Framework class names alone are not treated as
  proof that an arbitrary element is disposable.
- **Clipboard work stays out of the page.** An extension-owned offscreen document handles clipboard
  writes, rather than asking page content scripts to own that responsibility.
- **The converter is independently testable.** HTML-to-Markdown conversion does not depend on
  Chrome APIs, which keeps its edge cases testable with focused HTML fixtures.

The [architecture notes](docs/architecture.md) show how these pieces fit together, with focused notes
on extraction, conversion, and clipboard handling.

## Requirements

- Node.js `26.13.0` (see `.node-version`).
- pnpm `12.0.0` (pinned in `package.json`).
- Chrome or Chromium with Manifest V3 support (minimum Chrome version: 116).

## Run it locally

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` rebuilds `dist/` when source files change. Open `chrome://extensions`, enable Developer
mode, choose **Load unpacked**, and select `dist/`. Reload the extension after a rebuild.

## Checks and packaging

```sh
pnpm check
pnpm exec playwright install chromium
pnpm test:browser
```

`pnpm check` runs linting, formatting, type checks, unit tests, the production build, and manifest
validation. The Playwright suite exercises the built extension in Chromium.

To create and validate a distribution package:

```sh
pnpm package:release
pnpm package:check
```

The resulting ZIP is suitable for Chrome Web Store submission or manual distribution. GitHub
Releases are created from version tags; Chrome Web Store publication is a separate step.

For manual installation, see [INSTALL.md](INSTALL.md).

## Permissions

- `activeTab` — access the active page after the user invokes an extension action.
- `scripting` — inject the bundled extractor into that active page on demand.
- `clipboardWrite` — write the requested Markdown to the clipboard.
- `contextMenus` — register page, selection, and link actions in the browser context menu.
- `offscreen` — use an extension-owned offscreen document for clipboard operations.

No persistent host permissions are requested. Browser-internal pages and other restricted URLs are
rejected with a visible error. The regular Atkinson Hyperlegible font is bundled locally and exposed
as a web-accessible extension resource so the isolated toast can share the popup typography.

See [Privacy](PRIVACY.md) for the extension's data practices and permission details.

## Project structure

```text
src/
  background/       Clipboard coordination and user feedback
  content/          On-demand page and selection extraction
  content/filtering/Structural, semantic, and framework-aware UI filtering
  conversion/       HTML-to-Markdown conversion
  popup/            Popup interface and status feedback
  shared/           Message contracts, shortcuts, and shared utilities
  offscreen.html    Extension-owned clipboard document
  offscreen.ts      Clipboard write handler
  background.ts     Service worker and action dispatch
  assets/fonts/     Bundled Atkinson Hyperlegible font and licence

tests/
  browser/          Chromium MV3 acceptance tests
  content/          Extraction tests
  conversion/       Markdown and adversarial conversion tests
  shared/           Page support and shortcut tests
```

The conversion module is independent of Chrome APIs and can be tested directly with HTML fragments.
The bundled Atkinson Hyperlegible font retains its own licence in
`src/assets/fonts/LICENSE.txt`; that licence is separate from the project licence and is copied into
`dist/assets/fonts/` during builds.

## Documentation

- [Architecture](docs/architecture.md)
- [Page extraction and filtering](docs/extraction.md)
- [HTML-to-Markdown conversion](docs/conversion.md)
- [Clipboard and permissions](docs/clipboard-and-permissions.md)
- [Privacy policy](PRIVACY.md)
- [Manual installation](INSTALL.md)

## Licence

The project is licensed under the [MIT Licence](LICENSE). The bundled Atkinson Hyperlegible font
retains the separate licence included alongside the font.
