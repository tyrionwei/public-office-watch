import { readFileSync, writeFileSync } from 'node:fs';
const source = new URL('../src/data/candidateSpriteSources.json', import.meta.url);
const target = new URL('../src/data/candidateSpriteCreditFiles.json', import.meta.url);
const { assets } = JSON.parse(readFileSync(source, 'utf8'));
const index = Object.fromEntries(assets.map(({ canonicalId, file }) => [canonicalId, file]));
if (Object.keys(index).length !== assets.length) throw new Error('Duplicate sprite credit identity');
writeFileSync(target, JSON.stringify(index, null, 2) + '\n');
