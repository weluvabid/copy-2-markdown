import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDirectory = resolve(import.meta.dirname, '../dist');
const manifestPath = resolve(distDirectory, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Invalid extension build: ${message}`);
  }
}

async function assertFile(relativePath, label) {
  assert(typeof relativePath === 'string' && relativePath.length > 0, `${label} path is missing`);

  try {
    await access(resolve(distDirectory, relativePath));
  } catch {
    throw new Error(`Invalid extension build: ${label} file not found: ${relativePath}`);
  }
}

assert(manifest.manifest_version === 3, 'manifest_version must be 3');
assert(
  manifest.permissions?.includes('offscreen'),
  'offscreen permission is required for clipboard writes',
);
assert(typeof manifest.name === 'string' && manifest.name.length > 0, 'name is required');
assert(/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(manifest.version), 'version is invalid');

if (manifest.background?.service_worker) {
  await assertFile(manifest.background.service_worker, 'service worker');
}

if (manifest.action?.default_popup) {
  await assertFile(manifest.action.default_popup, 'popup');
}

for (const script of manifest.content_scripts ?? []) {
  for (const file of script.js ?? []) {
    await assertFile(file, 'content script');
  }
}

await assertFile('content.js', 'injected content script');
await assertFile('assets/fonts/LICENSE.txt', 'Atkinson Hyperlegible font licence');
await assertFile('offscreen.html', 'clipboard offscreen document');

for (const command of ['copy-page-markdown', 'copy-selection-markdown', 'copy-link-markdown']) {
  assert(
    Boolean(manifest.commands?.[command]?.suggested_key?.default),
    `shortcut is missing: ${command}`,
  );
}

assert(
  manifest.web_accessible_resources?.some((entry) =>
    entry.resources?.includes('assets/fonts/atkinson-hyperlegible-regular.otf'),
  ),
  'bundled fonts must be web-accessible to isolated content UI',
);

const fontFiles = await readdir(resolve(distDirectory, 'assets/fonts'));

assert(
  fontFiles.includes('atkinson-hyperlegible-regular.otf'),
  'the regular Atkinson Hyperlegible font must be included in the build',
);

for (const [size, iconPath] of Object.entries(manifest.icons ?? {})) {
  assert(['16', '32', '48', '128'].includes(size), `unsupported icon size: ${size}`);
  await assertFile(iconPath, `icon ${size}`);
}

for (const theme of ['light', 'dark']) {
  for (const size of [16, 32, 48, 128, 256, 512]) {
    await assertFile(`icons/${theme}/icon${size}.png`, `${theme} ${size}px icon`);
  }

  await assertFile(`icons/${theme}/icon-master.svg`, `${theme} SVG master icon`);
  await assertFile(`icons/${theme}/icon-master-1024.png`, `${theme} 1024px master icon`);
}

for (const [size, iconPath] of Object.entries(manifest.action?.default_icon ?? {})) {
  assert(['16', '32'].includes(size), `unsupported action icon size: ${size}`);
  await assertFile(iconPath, `action icon ${size}`);
}

process.stdout.write('Manifest and extension build are valid.\n');
