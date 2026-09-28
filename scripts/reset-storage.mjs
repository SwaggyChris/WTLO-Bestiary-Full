import { resetState } from '../server/fileStore.mjs';

const state = await resetState();
console.log(`Bestiary reset to seed data. Entries: ${state.entries.length}, categories: ${state.categories.length}.`);
