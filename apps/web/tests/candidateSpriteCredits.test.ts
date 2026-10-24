import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pickPersonCandidateSprite } from '../src/data/defaultCharacterAssets.ts';

const manifest = JSON.parse(readFileSync(new URL('../src/data/candidateSpriteSources.json', import.meta.url), 'utf8'));
test('credit records identify unique deployed sprite bytes and keep individual sources', () => {
  assert.equal(manifest.assets.length, 331);
  assert.equal(new Set(manifest.assets.map((item: { canonicalId: string }) => item.canonicalId)).size, 331);
  for (const item of manifest.assets) {
    assert.equal(pickPersonCandidateSprite(item.canonicalId), `/assets/characters/candidates/${item.file}`);
    assert.equal(createHash('sha256').update(readFileSync(new URL('../public/assets/characters/candidates/' + item.file, import.meta.url))).digest('hex'), item.sha256);
    assert.equal(new URL(item.sourceUrl).protocol, 'https:');
    assert.equal(new URL(item.licenseUrl).protocol, 'https:');
    assert.ok(item.attribution && item.modifications && item.modificationsEn);
  }
});
test('Huang replacement uses the official Tainan source and exact new bytes', () => {
 const item=manifest.assets.find((x: {canonicalId:string})=>x.canonicalId==='a0959bb6-fc41-4012-b5dc-52d136c4bb73');
 assert.equal(item.sha256,'12a7afc8768e0c1293f1d141d92a164dff88e7572b6b25d3ddf40a6aafed0029');
 assert.equal(item.sourceUrl,'https://www.tainan.gov.tw/cp.aspx?n=5034');
 assert.equal(item.licenseUrl,'https://www.tainan.gov.tw/cp.aspx?n=13612');
 assert.equal(item.adaptationLicense,undefined);
 assert.doesNotMatch(item.attribution,/Ring Chang|CC BY/);
});

test('Yu Bei-chen retains Commons acquisition and per-file attribution relationship', () => {
  const item = manifest.assets.find((entry: { canonicalId: string }) => entry.canonicalId === '2cc22d56-8808-4d2a-9894-4ae01bbf902e');
  assert.equal(new URL(item.sourceImageUrl).hostname, 'upload.wikimedia.org');
  assert.equal(new URL(item.sourceUrl).hostname, 'commons.wikimedia.org');
  assert.equal(item.licenseFilePageUrl, item.sourceUrl);
  assert.match(item.attribution, /內政部.*AI/);
  assert.equal(item.licenseUrl, 'https://www.moi.gov.tw/cp.aspx?n=10954');
});
