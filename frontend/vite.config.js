import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/PWA-4/',
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
