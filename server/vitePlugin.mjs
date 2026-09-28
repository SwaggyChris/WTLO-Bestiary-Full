import { bestiaryApiMiddleware } from './api.mjs';
import { ensureStorage } from './fileStore.mjs';

export function createBestiaryStoragePlugin() {
  const install = (server) => {
    ensureStorage().catch((error) => console.error('[WTLO Bestiary storage init]', error));
    server.middlewares.use(bestiaryApiMiddleware());
  };

  return {
    name: 'wtlo-bestiary-machine-storage',
    configureServer: install,
    configurePreviewServer: install,
  };
}
