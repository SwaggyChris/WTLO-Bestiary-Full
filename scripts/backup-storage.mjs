import { createManualBackup, storageInfo } from '../server/fileStore.mjs';

const file = await createManualBackup();
const info = await storageInfo();
console.log(`Backup created: ${file}`);
console.log(`Entries: ${info.entries} | Categories: ${info.categories} | Images: ${info.uploadedImages}`);
