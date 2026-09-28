import { storageInfo } from '../server/fileStore.mjs';

console.log(JSON.stringify(await storageInfo(), null, 2));
