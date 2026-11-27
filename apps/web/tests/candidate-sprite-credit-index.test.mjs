import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
test('lightweight credit index matches every complete attribution identity and file', () => {
  const { assets } = read('../src/data/candidateSpriteSources.json');
  const index = read('../src/data/candidateSpriteCreditFiles.json');
  assert.equal(Object.keys(index).length, assets.length);
  assert.deepEqual(index, Object.fromEntries(assets.map(({ canonicalId, file }) => [canonicalId, file])));
});
test('homepage credit link has no eager complete attribution dependency', () => {
  const source = readFileSync(new URL('../src/components/CandidateSpriteCreditLink.tsx', import.meta.url), 'utf8');
  assert.match(source, /candidateSpriteCreditId/);
  assert.doesNotMatch(source, /candidateSpriteCredits|candidateSpriteSources/);
});

test('candidate comparison resolves complete credit data only in the opened share flow', () => {
  const panel = readFileSync(new URL('../src/components/CandidateComparisonPanel.tsx', import.meta.url), 'utf8');
  const button = readFileSync(new URL('../src/components/ShareButton.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(panel, /candidateSpriteCredits|candidateSpriteSources/);
  assert.doesNotMatch(button, /from ['"][^'"]*candidateSpriteCredits/);
  assert.match(button, /await import\(['"][^'"]*candidateSpriteCredits['"]\)/);
  assert.match(button, /if \(!isOpen\) return;[\s\S]+void loadComparisonSprites\(imageRows\)/);
});
