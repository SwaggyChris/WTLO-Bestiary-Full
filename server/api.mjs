import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createManualBackup, ensureStorage, readState, resetState, storageInfo, writeState } from './fileStore.mjs';
import { IMAGE_DIR } from './paths.mjs';

const MAX_JSON_BYTES = 30 * 1024 * 1024;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

function sendJson(res, statusCode, value) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function sanitizeBaseName(value) {
  return String(value || 'image')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'image';
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function imageNameFromUrl(url) {
  const prefix = '/api/bestiary/images/';
  if (!url.pathname.startsWith(prefix)) return null;
  const raw = decodeURIComponent(url.pathname.slice(prefix.length));
  const name = path.basename(raw);
  return name && name === raw ? name : null;
}

function contentTypeFromFileName(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

export async function handleBestiaryApi(req, res) {
  const url = new URL(req.url, 'http://localhost');
  await ensureStorage();

  if (url.pathname === '/api/bestiary/state' && req.method === 'GET') {
    sendJson(res, 200, await readState());
    return true;
  }

  if (url.pathname === '/api/bestiary/state' && req.method === 'PUT') {
    const body = await readBody(req, MAX_JSON_BYTES);
    let parsed;
    try {
      parsed = JSON.parse(body.toString('utf8') || '{}');
    } catch {
      sendError(res, 400, 'Invalid JSON state payload.');
      return true;
    }
    if (!Array.isArray(parsed.entries) || !Array.isArray(parsed.categories)) {
      sendError(res, 400, 'State must contain entries and categories arrays.');
      return true;
    }
    sendJson(res, 200, await writeState(parsed));
    return true;
  }

  if (url.pathname === '/api/bestiary/info' && req.method === 'GET') {
    sendJson(res, 200, await storageInfo());
    return true;
  }

  if (url.pathname === '/api/bestiary/backup' && req.method === 'POST') {
    const backupPath = await createManualBackup();
    sendJson(res, 201, { ok: true, backupPath });
    return true;
  }

  if (url.pathname === '/api/bestiary/reset' && req.method === 'POST') {
    sendJson(res, 200, await resetState());
    return true;
  }

  if (url.pathname === '/api/bestiary/images' && req.method === 'POST') {
    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const extension = IMAGE_TYPES.get(contentType);
    if (!extension) {
      sendError(res, 415, 'Supported image types: PNG, JPG/JPEG, WEBP and GIF.');
      return true;
    }

    const originalName = decodeURIComponent(String(req.headers['x-file-name'] || 'image'));
    const baseName = sanitizeBaseName(path.basename(originalName, path.extname(originalName)));
    const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${baseName}${extension}`;
    const bytes = await readBody(req, MAX_IMAGE_BYTES);
    if (!bytes.length) {
      sendError(res, 400, 'The uploaded image is empty.');
      return true;
    }

    await fs.writeFile(path.join(IMAGE_DIR, fileName), bytes, { flag: 'wx' });
    sendJson(res, 201, {
      fileName,
      path: `/api/bestiary/images/${encodeURIComponent(fileName)}`,
    });
    return true;
  }

  if (url.pathname === '/api/bestiary/images' && req.method === 'DELETE') {
    const publicPath = decodeURIComponent(url.searchParams.get('path') || '');
    const prefix = '/api/bestiary/images/';
    if (!publicPath.startsWith(prefix)) {
      sendError(res, 400, 'Only locally uploaded bestiary images can be deleted.');
      return true;
    }
    const raw = decodeURIComponent(publicPath.slice(prefix.length));
    const fileName = path.basename(raw);
    if (!fileName || fileName !== raw) {
      sendError(res, 400, 'Invalid image path.');
      return true;
    }
    await fs.unlink(path.join(IMAGE_DIR, fileName)).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
    sendJson(res, 200, { ok: true });
    return true;
  }

  const imageName = imageNameFromUrl(url);
  if (imageName && req.method === 'GET') {
    try {
      const bytes = await fs.readFile(path.join(IMAGE_DIR, imageName));
      res.statusCode = 200;
      res.setHeader('Content-Type', contentTypeFromFileName(imageName));
      res.setHeader('Content-Length', String(bytes.length));
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.end(bytes);
    } catch (error) {
      if (error?.code === 'ENOENT') sendError(res, 404, 'Image not found.');
      else throw error;
    }
    return true;
  }

  return false;
}

export function bestiaryApiMiddleware() {
  return async (req, res, next) => {
    try {
      const handled = await handleBestiaryApi(req, res);
      if (!handled) next();
    } catch (error) {
      console.error('[WTLO Bestiary storage]', error);
      if (!res.headersSent) sendError(res, error.statusCode || 500, error.message || 'Storage error.');
      else res.end();
    }
  };
}
