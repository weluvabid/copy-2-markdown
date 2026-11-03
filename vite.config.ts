import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const projectRoot = import.meta.dirname;

export default defineConfig(({ mode }) => ({
  base: './',
  root: resolve(projectRoot, 'src'),
  publicDir: resolve(projectRoot, 'public'),
  build: {
    outDir: resolve(projectRoot, 'dist'),
    emptyOutDir: false,
    sourcemap: mode === 'development',
    minify: mode !== 'development',
    target: 'es2022',
    rollupOptions: {
      input: {
        popup: resolve(projectRoot, 'src/popup/index.html'),
        background: resolve(projectRoot, 'src/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
}));
