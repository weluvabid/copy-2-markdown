import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const release = join(root, 'release');
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf8'));
const version = packageJson.version;

if (manifest.version !== version) {
  throw new Error(
    `Package version (${version}) does not match manifest version (${manifest.version}).`,
  );
}

await access(dist);
await rm(release, { recursive: true, force: true });
await mkdir(release, { recursive: true });

const archiveName = `copy-2-markdown-v${version}.zip`;
const archivePath = join(release, archiveName);

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });

    child.once('error', rejectRun);
    child.once('exit', (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`${command} exited with code ${code ?? 'unknown'}.`));
      }
    });
  });
}

// ZIP is deliberately created from the contents of dist, so manifest.json is at archive root.
// -X omits host-specific extended attributes; sorted paths keep archive entry ordering stable.
const files = await collectFiles(dist);

if (files.length === 0) {
  throw new Error('dist/ is empty; build the extension before packaging.');
}

await run('zip', ['-X', '-q', archivePath, ...files], { cwd: dist });
await run('unzip', ['-tqq', archivePath]);

const checksum = createHash('sha256');

await new Promise((resolveHash, rejectHash) => {
  createReadStream(archivePath)
    .on('data', (chunk) => checksum.update(chunk))
    .on('error', rejectHash)
    .on('end', resolveHash);
});
const digest = checksum.digest('hex');

await writeFile(join(release, 'SHA256SUMS.txt'), `${digest}  ${archiveName}\n`, 'utf8');

process.stdout.write(`Packaged ${archiveName}\nSHA-256 ${digest}\n`);

async function collectFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      result.push(...(await collectFiles(join(directory, entry.name), relative)));
    } else if (entry.isFile() && !entry.name.endsWith('.map')) {
      result.push(relative);
    }
  }

  return result;
}
