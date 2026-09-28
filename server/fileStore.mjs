import fs from 'node:fs/promises';
import path from 'node:path';
import { BACKUP_DIR, IMAGE_DIR, SEED_FILE, STATE_FILE, STORAGE_DIR } from './paths.mjs';

const MAX_BACKUPS = 20;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeState(input = {}, previous = {}) {
  return {
    schemaVersion: 2,
    revision: Number(previous.revision || 0) + 1,
    updatedAt: new Date().toISOString(),
    entries: Array.isArray(input.entries) ? input.entries : [],
    categories: Array.isArray(input.categories) ? input.categories : [],
  };
}

async function readSeed() {
  const seed = JSON.parse(await fs.readFile(SEED_FILE, 'utf8'));
  return {
    schemaVersion: 2,
    revision: 0,
    updatedAt: new Date().toISOString(),
    entries: Array.isArray(seed.entries) ? seed.entries : [],
    categories: Array.isArray(seed.defaultCategories) ? seed.defaultCategories : [],
  };
}

export async function ensureStorage() {
  await Promise.all([
    fs.mkdir(STORAGE_DIR, { recursive: true }),
    fs.mkdir(IMAGE_DIR, { recursive: true }),
    fs.mkdir(BACKUP_DIR, { recursive: true }),
  ]);

  try {
    await fs.access(STATE_FILE);
  } catch {
    const seed = await readSeed();
    await atomicWriteJson(STATE_FILE, seed);
  }
}

export async function readState() {
  await ensureStorage();
  try {
    const parsed = JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
    return {
      schemaVersion: Number(parsed.schemaVersion || 1),
      revision: Number(parsed.revision || 0),
      updatedAt: parsed.updatedAt || null,
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    };
  } catch (error) {
    const seed = await readSeed();
    const recovery = path.join(BACKUP_DIR, `recovered-${Date.now()}.json`);
    await atomicWriteJson(recovery, seed);
    await atomicWriteJson(STATE_FILE, seed);
    return seed;
  }
}

export async function writeState(input) {
  await ensureStorage();
  const previous = await readState();
  const next = sanitizeState(input, previous);

  await writeBackup(previous);
  await atomicWriteJson(STATE_FILE, next);
  await pruneBackups();
  return clone(next);
}

export async function resetState() {
  await ensureStorage();
  const current = await readState();
  await writeBackup(current);
  const seed = await readSeed();
  seed.revision = Number(current.revision || 0) + 1;
  seed.updatedAt = new Date().toISOString();
  await atomicWriteJson(STATE_FILE, seed);
  await pruneBackups();
  return seed;
}

export async function createManualBackup() {
  const state = await readState();
  return writeBackup(state, 'manual');
}

export async function storageInfo() {
  const state = await readState();
  const images = await fs.readdir(IMAGE_DIR).catch(() => []);
  const backups = await fs.readdir(BACKUP_DIR).catch(() => []);
  return {
    stateFile: STATE_FILE,
    imageDirectory: IMAGE_DIR,
    backupDirectory: BACKUP_DIR,
    revision: state.revision,
    updatedAt: state.updatedAt,
    entries: state.entries.length,
    categories: state.categories.length,
    uploadedImages: images.filter((name) => !name.startsWith('.')).length,
    backups: backups.filter((name) => name.endsWith('.json')).length,
  };
}

async function atomicWriteJson(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
}

async function writeBackup(state, label = 'auto') {
  if (!state) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${stamp}-${label}-r${Number(state.revision || 0)}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);
  await atomicWriteJson(filePath, state);
  return filePath;
}

async function pruneBackups() {
  const files = (await fs.readdir(BACKUP_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  await Promise.all(files.slice(MAX_BACKUPS).map((name) => (
    fs.unlink(path.join(BACKUP_DIR, name)).catch(() => undefined)
  )));
}
