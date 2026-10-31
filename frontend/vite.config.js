import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/PWA-Daily-Life/',
  plugins: [tailwindcss()],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
});
