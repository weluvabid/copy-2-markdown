import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const release = join(root, 'release');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const archiveName = `copy-2-markdown-v${pkg.version}.zip`;
const archive = join(release, archiveName);
const checksumFile = join(release, 'SHA256SUMS.txt');

await access(archive);
await access(checksumFile);

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'inherit'] });
    let stdout = '';

    child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk));
    child.once('error', rejectRun);
    child.once('exit', (code) => {
      if (code === 0) {
        resolveRun(stdout);
      } else {
        rejectRun(new Error(`${command} exited with code ${code ?? 'unknown'}.`));
      }
    });
  });
}

const entries = (await run('unzip', ['-Z1', archive])).trim().split('\n').filter(Boolean);

if (!entries.includes('manifest.json')) {
  throw new Error('manifest.json must be at the ZIP root.');
}

if (entries.some((entry) => entry.startsWith('/') || entry.split('/').includes('..'))) {
  throw new Error('Archive contains an unsafe path.');
}

if (entries.some((entry) => entry.endsWith('.map'))) {
  throw new Error('Source maps must not ship in the release ZIP.');
}

for (const required of ['background.js', 'content.js', 'offscreen.html', 'popup/index.html']) {
  if (!entries.includes(required)) {
    throw new Error(`Release archive is missing ${required}.`);
  }
}

await run('unzip', ['-tqq', archive]);

const hash = createHash('sha256');

await new Promise((resolveHash, rejectHash) => {
  createReadStream(archive)
    .on('data', (chunk) => hash.update(chunk))
    .on('error', rejectHash)
    .on('end', resolveHash);
});
const expected = (await readFile(checksumFile, 'utf8')).trim().split(/\s+/)[0];

if (hash.digest('hex') !== expected) {
  throw new Error('SHA-256 checksum does not match the release archive.');
}

process.stdout.write(`Release package valid: ${archiveName} (${entries.length} files).\n`);
