// Thin wrapper around the separated JSON seed-data file.
import bestiaryData from './bestiaryData.json';

export const SPECIES_ORDER = bestiaryData.speciesOrder;
export const MONSTER_IMAGE_PATHS = Object.freeze(bestiaryData.monsterImagePaths);
export const DEFAULT_CATEGORIES = bestiaryData.defaultCategories;
export const DEFAULT_ENTRIES = bestiaryData.entries;
