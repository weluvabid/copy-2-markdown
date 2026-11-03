import { chromium, expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const distDirectory = resolve('dist');
const fixtureHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Engineering Notes</title>
  <style>
    .css-hidden { display: none !important; }
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
  </style>
</head>
<body>
  <main>
    <article>
      <h1>Engineering Notes</h1>\n      <p class="cdk-visually-hidden">Duplicate accessible label that must not be copied.</p>
      <p>This article explains a reliable approach to browser automation, content extraction, and deterministic testing.</p>
      <h2>Implementation</h2>
      <p>Keep the browser-facing layer small, preserve semantic structure, and validate the resulting Markdown rather than relying on visual appearance alone.</p>
      <pre><code class="language-typescript">const answer = 42;</code></pre>
    </article>
  </main>
</body>
</html>`;
const fallbackHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Fallback Notes</title>
  <style>.css-hidden { display: none !important; }</style>
</head>
<body>
  <div>Visible fallback content is retained when an article parser cannot identify a conventional article structure. It remains readable and useful.</div>
  <div class="css-hidden">This stylesheet-hidden fallback content must never be copied into Markdown.</div>
</body>
</html>`;

let context: BrowserContext | undefined;
let extensionId = '';
let fixtureServer: Server | undefined;
let fixtureOrigin = '';
let userDataDirectory = '';

function getBrowserContext(): BrowserContext {
  if (!context) {
    throw new Error('Chromium browser context has not been initialized.');
  }

  return context;
}

async function startFixtureServer(): Promise<void> {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;

    if (pathname === '/article' || pathname === '/link/(draft)' || pathname === '/fallback') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      const html =
        pathname === '/article'
          ? fixtureHtml
          : pathname === '/fallback'
            ? fallbackHtml
            : fixtureHtml.replace(
                '<title>Engineering Notes</title>',
                '<title>Guide [draft] \\ release</title>',
              );

      response.end(html);

      return;
    }

    response.writeHead(404);
    response.end('Not found');
  });

  fixtureServer = server;

  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Could not start the browser-test fixture server.');
  }

  fixtureOrigin = `http://127.0.0.1:${address.port}`;
}

async function prepareTestExtension(): Promise<string> {
  const manifestPath = join(distDirectory, 'manifest.json');
  let manifestText: string;

  try {
    manifestText = await readFile(manifestPath, 'utf8');
  } catch {
    throw new Error('Built extension not found. Run `pnpm build` before `pnpm test:browser`.');
  }

  const manifest = JSON.parse(manifestText) as {
    host_permissions?: string[];
    background?: { service_worker?: string };
  };

  userDataDirectory = await mkdtemp(join(tmpdir(), 'copy-2-markdown-playwright-'));
  const extensionDirectory = join(userDataDirectory, 'extension');

  await cp(distDirectory, extensionDirectory, { recursive: true });

  // The test-only host permission is restricted to the loopback fixture host.
  // The production dist/manifest.json remains unchanged and retains activeTab-only access.
  manifest.host_permissions = ['http://127.0.0.1/*'];
  await writeFile(join(extensionDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2));

  return extensionDirectory;
}

async function openHarnessPage(path = '/article'): Promise<{ target: Page; popup: Page }> {
  const target = await getBrowserContext().newPage();

  await target.goto(`${fixtureOrigin}${path}`);

  const popup = await getBrowserContext().newPage();

  await popup.addInitScript(() => {
    // Keep tab selection deterministic while exercising the real tabs.sendMessage,
    // scripting.executeScript, content script, converter, and clipboard APIs.
    const originalQuery = chrome.tabs.query.bind(chrome.tabs);

    chrome.tabs.query = async (queryInfo: chrome.tabs.QueryInfo) => {
      if (queryInfo.active && queryInfo.lastFocusedWindow) {
        return originalQuery({ url: 'http://127.0.0.1/*' });
      }

      return originalQuery(queryInfo);
    };
  });

  await popup.goto(`chrome-extension://${extensionId}/popup/index.html`);
  await expect(popup.locator('[data-action="page"]')).toBeVisible();

  return { target, popup };
}

async function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

test.describe('Copy 2 Markdown MV3 browser acceptance', () => {
  test.beforeAll(async () => {
    await startFixtureServer();
    const extensionDirectory = await prepareTestExtension();

    context = await chromium.launchPersistentContext(userDataDirectory, {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${extensionDirectory}`,
        `--load-extension=${extensionDirectory}`,
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    const browserContext = getBrowserContext();
    const worker =
      browserContext.serviceWorkers()[0] ?? (await browserContext.waitForEvent('serviceworker'));

    extensionId = new URL(worker.url()).host;

    await browserContext.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: fixtureOrigin,
    });
  });

  test.afterAll(async () => {
    await context?.close();

    if (fixtureServer) {
      await new Promise<void>((resolveClose, reject) => {
        fixtureServer?.close((error) => (error ? reject(error) : resolveClose()));
      });
    }

    if (userDataDirectory) {
      await rm(userDataDirectory, { recursive: true, force: true });
    }
  });

  test('loads the packaged MV3 extension and exposes exactly two popup actions', async () => {
    const manifest = JSON.parse(await readFile(join(distDirectory, 'manifest.json'), 'utf8')) as {
      manifest_version: number;
      permissions: string[];
      host_permissions?: string[];
      commands?: Record<string, { suggested_key?: { default?: string; mac?: string } }>;
    };

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions.sort()).toEqual(
      ['activeTab', 'clipboardWrite', 'contextMenus', 'scripting'].sort(),
    );
    expect(manifest.host_permissions ?? []).toEqual([]);
    expect(manifest.commands?.['copy-page-markdown']?.suggested_key?.default).toBe('Alt+Shift+M');
    expect(manifest.commands?.['copy-selection-markdown']?.suggested_key?.default).toBe(
      'Alt+Shift+L',
    );

    const { popup, target } = await openHarnessPage();

    await expect(popup.locator('[data-action]')).toHaveCount(2);
    await expect(popup.locator('.footer a')).toHaveAttribute(
      'href',
      'https://github.com/weluvabid/copy-2-markdown',
    );
    await expect(popup.getByRole('button', { name: /copy page as markdown/i })).toBeVisible();
    await expect(popup.getByRole('button', { name: /copy markdown link/i })).toBeVisible();
    await expect(popup.locator('#status')).toBeHidden();
    await expect(popup.locator('[data-action]')).toHaveCount(2);
    await expect(popup.getByRole('button', { name: /copy selection/i })).toHaveCount(0);

    const menuTitles = await popup.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          chrome.contextMenus.getAll((items) => resolve(items.map((item) => item.title ?? '')));
        }),
    );

    expect(menuTitles).toEqual(
      expect.arrayContaining([
        'Copy page as Markdown',
        'Copy selection as Markdown',
        'Copy Markdown link',
      ]),
    );

    await popup.close();
    await target.close();
  });

  test('keeps popup geometry stable across ready, loading, and success states', async () => {
    const { target, popup } = await openHarnessPage();
    const initial = await popup.locator('.popup').evaluate((element) => {
      const actions = element.querySelector('.actions')!.getBoundingClientRect();
      const footer = element.querySelector('.footer')!.getBoundingClientRect();

      return {
        actions: { x: actions.x, y: actions.y, width: actions.width, height: actions.height },
        footerY: footer.y,
      };
    });

    await popup.locator('[data-action="page"]').click();
    await expect(popup.locator('[data-action="page"] .action-label')).toHaveText('Copied');
    const after = await popup.locator('.popup').evaluate((element) => {
      const actions = element.querySelector('.actions')!.getBoundingClientRect();
      const footer = element.querySelector('.footer')!.getBoundingClientRect();

      return {
        actions: { x: actions.x, y: actions.y, width: actions.width, height: actions.height },
        footerY: footer.y,
      };
    });

    expect(after).toEqual(initial);

    await popup.close();
    await target.close();
  });

  test('copies the extracted page as Markdown', async () => {
    const { target, popup } = await openHarnessPage();

    await popup.locator('[data-action="page"]').click();
    await expect(popup.locator('[data-action="page"] .action-label')).toHaveText('Copied');
    await expect(popup.locator('body')).toHaveCSS('font-family', /Atkinson Hyperlegible/);
    const fontLoaded = await popup.evaluate(async () => {
      await document.fonts.ready;

      return document.fonts.check('13px "Atkinson Hyperlegible"');
    });

    expect(fontLoaded).toBe(true);

    const markdown = await readClipboard(target);

    expect(markdown).toContain('# Engineering Notes');
    expect(markdown).toContain('## Implementation');
    expect(markdown).toContain('reliable approach to browser automation');
    expect(markdown).not.toContain('Duplicate accessible label that must not be copied');
    expect(markdown).toContain('```typescript');

    // Explicitly inject a second time to exercise the content-script idempotency guard.
    await popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });

      if (typeof tab?.id !== 'number') {
        throw new Error('Could not resolve the fixture tab for duplicate-injection testing.');
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
    });

    await popup.locator('[data-action="page"]').click();
    await expect(popup.locator('[data-action="page"] .action-label')).toHaveText('Copied');
    await expect(popup.locator('body')).toHaveCSS('font-family', /Atkinson Hyperlegible/);

    await popup.close();
    await target.close();
  });

  test('removes stylesheet-hidden nodes from the cleaned-DOM fallback', async () => {
    const { target, popup } = await openHarnessPage('/fallback');

    await popup.locator('[data-action="page"]').click();
    await expect(popup.locator('[data-action="page"] .action-label')).toHaveText('Copied');
    await expect(popup.locator('body')).toHaveCSS('font-family', /Atkinson Hyperlegible/);

    const markdown = await readClipboard(target);

    expect(markdown).toContain('Visible fallback content is retained');
    expect(markdown).not.toContain('stylesheet-hidden fallback content');

    await popup.close();
    await target.close();
  });

  test('does not inject a floating action when text is selected', async () => {
    const { target, popup } = await openHarnessPage();

    await popup.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });

      if (typeof tab?.id !== 'number') {throw new Error('Could not resolve fixture tab.');}

      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    });

    await target.evaluate(() => {
      const paragraph = document.querySelector('main article p:not(.cdk-visually-hidden)');

      if (!paragraph?.firstChild) {throw new Error('Selection fixture paragraph is missing.');}

      const range = document.createRange();

      range.selectNodeContents(paragraph);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });

    await expect(target.locator('#copy-2-markdown-selection-action')).toHaveCount(0);
    await popup.close();
    await target.close();
  });

  test('copies the active page as an escaped Markdown link', async () => {
    const { target, popup } = await openHarnessPage('/link/(draft)?version=1');

    await popup.locator('[data-action="link"]').click();
    await expect(popup.locator('[data-action="link"] .action-label')).toHaveText('Copied');

    const markdown = await readClipboard(target);

    const rawTitle = 'Guide [draft] \\ release';
    const escapedTitle = rawTitle.replace(/\\/g, '\\\\').replace(/[[\]]/g, '\\$&');

    expect(markdown).toBe(`[${escapedTitle}](<${fixtureOrigin}/link/(draft)?version=1>)`);

    await popup.close();
    await target.close();
  });
});
