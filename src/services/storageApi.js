// All persistence goes through the local project server.
// Nothing here writes bestiary data to localStorage, sessionStorage, IndexedDB, or browser caches.

const STATE_ENDPOINT = '/api/bestiary/state';
const IMAGE_ENDPOINT = '/api/bestiary/images';
const INFO_ENDPOINT = '/api/bestiary/info';
const BACKUP_ENDPOINT = '/api/bestiary/backup';
const LOCAL_IMAGE_PREFIX = '/api/bestiary/images/';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Storage request failed (${response.status}).`);
  }

  return payload;
}

export async function loadBestiaryState(defaultEntries, defaultCategories) {
  const saved = await requestJson(STATE_ENDPOINT);
  return {
    entries: Array.isArray(saved?.entries) ? saved.entries : clone(defaultEntries),
    categories: Array.isArray(saved?.categories) ? saved.categories : clone(defaultCategories),
    revision: Number(saved?.revision || 0),
    updatedAt: saved?.updatedAt || null,
  };
}

let saveQueue = Promise.resolve();

export function saveBestiaryState(entries, categories) {
  const snapshot = {
    entries: clone(entries),
    categories: clone(categories),
  };

  saveQueue = saveQueue
    .catch(() => undefined)
    .then(() => requestJson(STATE_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    }));

  return saveQueue;
}

export async function uploadBestiaryImage(file) {
  if (!(file instanceof File)) throw new Error('A valid image file is required.');
  if (!file.type.startsWith('image/')) throw new Error('Only image files are supported.');

  return requestJson(IMAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name || 'image'),
    },
    body: file,
  });
}

export async function deleteBestiaryImage(publicPath) {
  if (!isProjectUploadedImage(publicPath)) return;
  await requestJson(`${IMAGE_ENDPOINT}?path=${encodeURIComponent(publicPath)}`, {
    method: 'DELETE',
  });
}

export function isProjectUploadedImage(publicPath) {
  return Boolean(publicPath && String(publicPath).startsWith(LOCAL_IMAGE_PREFIX));
}

export async function getStorageInfo() {
  return requestJson(INFO_ENDPOINT);
}

export async function createStorageBackup() {
  return requestJson(BACKUP_ENDPOINT, { method: 'POST' });
}
