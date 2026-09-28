import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createBestiaryStoragePlugin } from './server/vitePlugin.mjs';

export default defineConfig({
  plugins: [react(), createBestiaryStoragePlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
});
