import { spawn } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const vite = resolve('node_modules/vite/bin/vite.js');

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets/fonts', { recursive: true });
await cp('src/assets/fonts/LICENSE.txt', 'dist/assets/fonts/LICENSE.txt');

const commands = [
  [vite, ['build', '--watch']],
  [vite, ['build', '--config', 'vite.content.config.ts', '--watch']],
];
const children = commands.map(([executable, args]) =>
  spawn(process.execPath, [executable, ...args], { stdio: 'inherit' }),
);
let stopping = false;

function stop(exitCode = 0) {
  if (stopping) {
    return;
  }

  stopping = true;
  process.exitCode = exitCode;

  for (const child of children) {
    child.kill('SIGTERM');
  }
}

for (const child of children) {
  child.on('error', () => stop(1));
  child.on('exit', (code) => {
    if (!stopping) {
      stop(code ?? 1);
    }
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
