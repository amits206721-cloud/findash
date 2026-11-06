
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',

  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: [
      'findash-wpz1.onrender.com'
    ]
  },

  build: {
    outDir: 'desktop-dist'
  }
});
