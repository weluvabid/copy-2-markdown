import { spawn } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const vite = resolve('node_modules/vite/bin/vite.js');

function run(executable, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [executable, ...args], { stdio: 'inherit' });

    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`Command failed with exit code ${code ?? 'unknown'}.`));
      }
    });
  });
}

await rm('dist', { recursive: true, force: true });
await run(vite, ['build']);
await run(vite, ['build', '--config', 'vite.content.config.ts']);
await mkdir('dist/assets/fonts', { recursive: true });
await Promise.all([
  cp(
    'src/assets/fonts/atkinson-hyperlegible-regular.otf',
    'dist/assets/fonts/atkinson-hyperlegible-regular.otf',
  ),
  cp('src/assets/fonts/LICENSE.txt', 'dist/assets/fonts/LICENSE.txt'),
]);
await run(resolve('scripts/validate-manifest.mjs'), []);
