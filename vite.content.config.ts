import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const projectRoot = import.meta.dirname;

export default defineConfig(({ mode }) => ({
  root: resolve(projectRoot, 'src'),
  publicDir: false,
  build: {
    outDir: resolve(projectRoot, 'dist'),
    emptyOutDir: false,
    sourcemap: mode === 'development',
    minify: mode !== 'development',
    target: 'es2022',
    lib: {
      entry: resolve(projectRoot, 'src/content/index.ts'),
      name: 'Copy2MarkdownContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
}));
