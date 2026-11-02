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

const assetFiles = await readdir(resolve(distDirectory, 'assets'));

assert(
  assetFiles.filter((file) => file.endsWith('.otf')).length >= 2,
  'both font weights must be included in the build',
);

for (const [size, iconPath] of Object.entries(manifest.icons ?? {})) {
  assert(['16', '32', '48', '128'].includes(size), `unsupported icon size: ${size}`);
  await assertFile(iconPath, `icon ${size}`);
}

process.stdout.write('Manifest and extension build are valid.\n');
