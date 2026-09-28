import { MONSTER_IMAGE_PATHS, SPECIES_ORDER } from '../data/bestiaryData.js';

export const PALETTE = [
  '#c9a84c', '#b0b0b0', '#8a8a8a', '#6a6a6a', '#4a4a4a',
  '#c0a86a', '#a08050', '#e0c080', '#d4af37', '#c0c0c0',
  '#a8a8a8', '#909090', '#787878', '#606060', '#484848',
  '#c8b88a', '#b8a87a', '#a8986a', '#98885a', '#88784a',
];

export function normalizeMonsterName(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getBuiltInMonsterImage(name) {
  const imagePath = MONSTER_IMAGE_PATHS[normalizeMonsterName(name)];
  return imagePath ? encodeURI(`/${imagePath}`) : null;
}

export function getMonsterImage(entry) {
  if (!entry) return null;
  if (entry.imageData && String(entry.imageData).trim()) return entry.imageData;
  return getBuiltInMonsterImage(entry.name);
}

export function hasMonsterImage(entry) {
  return Boolean(getMonsterImage(entry));
}

export function orderedSpecies(entries) {
  const available = new Set(entries.map((entry) => entry.species).filter(Boolean));
  const ordered = [];

  for (const name of SPECIES_ORDER) {
    if (available.delete(name)) ordered.push(name);
  }

  return [...ordered, ...[...available].sort((a, b) => a.localeCompare(b))];
}

export function nextEntryId(entries) {
  const numericIds = entries
    .map((entry) => Number(entry.id))
    .filter((value) => Number.isFinite(value));
  return numericIds.length ? Math.max(...numericIds) + 1 : 1;
}

export function normalizeImportedEntry(item, id) {
  const species = String(item.species || item.category || 'Uncategorized').trim();
  const traits = Array.isArray(item.traits)
    ? item.traits.filter(Boolean).map(String)
    : String(item.traits || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

  return {
    id,
    name: String(item.name || '').trim(),
    species,
    kind: item.kind || species,
    description: String(item.description || '').trim(),
    traits,
    habitat: String(item.habitat || '').trim(),
    rarity: item.rarity || 'Common',
    danger: Number.parseInt(item.danger, 10) || 3,
    imageData: item.imageData || null,
    createdAt: item.createdAt || new Date().toISOString(),
    health: Number(item.health) || 0,
    minLevel: Number(item.minLevel) || 1,
    maxLevel: Number(item.maxLevel) || 1,
    healthPerLevel: Number(item.healthPerLevel) || 0,
    minDmg: Number(item.minDmg) || 0,
    maxDmg: Number(item.maxDmg) || 0,
    effects: String(item.effects || ''),
  };
}

export function reconcileCategories(entries, categories) {
  const byName = new Map((categories || []).map((category) => [category.name, category]));
  const allNames = new Set(entries.map((entry) => entry.species).filter(Boolean));

  for (const name of allNames) {
    if (!byName.has(name)) {
      byName.set(name, {
        name,
        color: PALETTE[byName.size % PALETTE.length],
      });
    }
  }

  return [...byName.values()];
}
