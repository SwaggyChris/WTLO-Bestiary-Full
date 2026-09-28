import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(here, '..');
export const STORAGE_DIR = path.join(PROJECT_ROOT, 'storage');
export const STATE_FILE = path.join(STORAGE_DIR, 'bestiary-state.json');
export const IMAGE_DIR = path.join(STORAGE_DIR, 'images');
export const BACKUP_DIR = path.join(STORAGE_DIR, 'backups');
export const SEED_FILE = path.join(PROJECT_ROOT, 'src', 'data', 'bestiaryData.json');
