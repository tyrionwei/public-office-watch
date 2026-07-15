import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPaths = [
  path.join(repoRoot, 'data-sources', 'votetw-election-history.non-village.seed.json'),
  path.join(repoRoot, 'data-sources', 'votetw-election-history.village-chief.seed.json'),
];
const outputPath = path.join(repoRoot, 'data-sources', 'votetw-election-history.seed.json');

function mergeByKey(seeds, property, key) {
  const records = new Map();

  for (const seed of seeds) {
    for (const record of seed[property] ?? []) {
      records.set(record[key], record);
    }
  }

  return Array.from(records.values());
}

function main() {
  const seeds = inputPaths.map((inputPath) => JSON.parse(fs.readFileSync(inputPath, 'utf8')));
  if (seeds.some((seed) => seed.schemaVersion !== 1 || seed.sourceId !== 'votetw-election-history')) {
    throw new Error('All VoteTW election history seeds must use schemaVersion 1 and the same sourceId.');
  }

  const sources = mergeByKey(seeds, 'sources', 'id');
  const regions = mergeByKey(seeds, 'regions', 'externalId');
  const elections = mergeByKey(seeds, 'elections', 'externalId');
  const races = mergeByKey(seeds, 'races', 'externalId');
  const parties = mergeByKey(seeds, 'parties', 'externalId');
  const people = mergeByKey(seeds, 'people', 'externalId');
  const sourcePeople = mergeByKey(seeds, 'sourcePeople', 'sourcePersonKey');
  const candidates = mergeByKey(seeds, 'candidates', 'externalId');
  const rawSources = mergeByKey(seeds, 'rawSources', 'title');
  const summary = {
    pageCount: rawSources.length,
    electionCount: elections.length,
    raceCount: races.length,
    candidateCount: candidates.length,
    sourcePersonCount: sourcePeople.length,
    newPersonCount: people.length,
    partyCount: parties.length,
    fetchErrorCount: seeds.reduce((total, seed) => total + (seed.summary?.fetchErrorCount ?? 0), 0),
  };
  const merged = {
    schemaVersion: 1,
    name: 'votetw-election-history',
    sourceId: 'votetw-election-history',
    generatedAt: new Date().toISOString(),
    summary,
    sources,
    regions,
    elections,
    races,
    parties,
    people,
    sourcePeople,
    candidates,
    rawSources,
  };

  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2) + '\n');
  console.log(JSON.stringify({
    status: 'ok',
    inputs: inputPaths.map((inputPath) => path.relative(repoRoot, inputPath)),
    output: path.relative(repoRoot, outputPath),
    summary,
  }, null, 2));
}

main();
