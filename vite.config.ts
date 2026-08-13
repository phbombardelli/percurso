import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // base relativa: o build em dist/ abre por file:// sem servidor (requisito offline)
  base: './',
  resolve: {
    alias: {
      '@core': r('./src/core'),
      '@render': r('./src/render'),
      '@ui': r('./src/ui'),
      '@store': r('./src/store'),
      '@platform': r('./src/platform'),
    },
  },
  build: { target: 'es2022', assetsInlineLimit: 0 },
});
