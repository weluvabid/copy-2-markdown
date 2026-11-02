# Extension Template

Minimal Chrome Manifest V3 starter using TypeScript, Vite, vanilla HTML/CSS, and Vitest.

## Requirements

- Node.js 26.13.0
- pnpm 12
- Chrome or Chromium

## Develop

```sh
pnpm install
pnpm dev
```

`pnpm dev` rebuilds `dist/` on changes. Reload the unpacked extension manually in `chrome://extensions`.

## Build

```sh
pnpm build
```

In Chrome, enable **Developer mode**, choose **Load unpacked**, and select `dist/`.

Run the quality checks with `pnpm check`.

## Start building

- Edit `public/manifest.json` for the extension name, description, permissions, and icons.
- Put popup markup, behavior, and styles in `src/popup/`.
- Add a background service worker, content scripts, or an options page only when the extension needs them, and register each entry in the manifest and Vite configuration.

Keep permissions narrow. MV3 service workers can be suspended, so persist required state rather than relying on module-level memory.
