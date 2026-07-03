import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultInputPath = path.join(repoRoot, 'data-sources', 'election-race-duplicate-report.json');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'election-race-merge-plan-report.json');

function parseArgs(argv) {
  const options = {
    inputPath: defaultInputPath,
    outputPath: defaultOutputPath,
    sampleLimit: 25,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--input') {
      options.inputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--output') {
      options.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--sample-limit') {
      options.sampleLimit = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  if (!Number.isInteger(options.sampleLimit) || options.sampleLimit < 0) {
    throw new Error('--sample-limit must be a non-negative integer');
  }

  return options;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing duplicate report: ${filePath}. Run npm run report:election-race-duplicates first.`);
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sourceRank(sourceKind) {
  return { cec: 0, votetw: 1, other: 2 }[sourceKind] ?? 9;
}

function compareCanonicalCandidate(left, right) {
  return sourceRank(left.sourceKind) - sourceRank(right.sourceKind) ||
    String(left.externalId ?? '').localeCompare(String(right.externalId ?? ''));
}

function chooseCanonical(left, right) {
  return compareCanonicalCandidate(left, right) <= 0
    ? { canonical: left, duplicate: right }
    : { canonical: right, duplicate: left };
}

function electionAction(pair) {
  if (pair.confidence === 'auto') return 'auto_merge';
  if (pair.year === 2022 && pair.semanticType === 'local' && pair.confidence === 'review') {
    return 'review_aggregate_source_link';
  }
  if (pair.confidence === 'review') return 'review_merge';
  return 'manual_review';
}

function raceAction(pair) {
  if (pair.confidence === 'auto') return 'auto_merge';
  if (pair.confidence === 'review') return 'review_merge';
  return 'manual_review';
}

function evidenceForPair(pair) {
  return {
    confidence: pair.confidence,
    candidateOverlap: pair.candidateOverlap,
    nameSimilarity: pair.nameSimilarity ?? null,
    raceTypeOverlap: pair.raceTypeOverlap ?? [],
  };
}

function electionPlanRow(pair) {
  const { canonical, duplicate } = chooseCanonical(pair.left, pair.right);
  const action = electionAction(pair);

  return {
    action,
    year: pair.year,
    semanticType: pair.semanticType,
    canonicalElection: compactTarget(canonical),
    duplicateElection: compactTarget(duplicate),
    evidence: evidenceForPair(pair),
    notes: action === 'review_aggregate_source_link'
      ? 'CEC 2022 local election is an aggregate source while VoteTW local pages are split by office/region; do not direct-merge until a parent/child election model exists.'
      : null,
  };
}

function racePlanRow(pair) {
  const { canonical, duplicate } = chooseCanonical(pair.left, pair.right);

  return {
    action: raceAction(pair),
    year: pair.year,
    semanticRaceType: pair.semanticRaceType,
    canonicalRace: compactTarget(canonical, pair.leftElection, pair.rightElection),
    duplicateRace: compactTarget(duplicate, pair.leftElection, pair.rightElection),
    evidence: evidenceForPair(pair),
  };
}

function compactTarget(target, leftElection = null, rightElection = null) {
  const compact = {
    id: target.id ?? null,
    externalId: target.externalId ?? null,
    name: target.name ?? target.title ?? null,
    sourceKind: target.sourceKind,
    sourceName: target.sourceName,
  };

  if (target.raceType) compact.raceType = target.raceType;
  if (target.electionType) compact.electionType = target.electionType;
  if (leftElection || rightElection) compact.electionContext = { leftElection, rightElection };

  return compact;
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) {
    counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  }
  return counts;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const report = readJson(options.inputPath);
  const electionMergePlan = (report.electionPairs ?? []).map(electionPlanRow);
  const raceMergePlan = (report.racePairs ?? []).map(racePlanRow);

  const plan = {
    generatedAt: new Date().toISOString(),
    mode: 'dry-run',
    inputPath: options.inputPath,
    summary: {
      electionPlanRows: electionMergePlan.length,
      racePlanRows: raceMergePlan.length,
      electionActionCounts: countBy(electionMergePlan, 'action'),
      raceActionCounts: countBy(raceMergePlan, 'action'),
      warnings: [
        'This file is a merge plan only. It does not write database rows.',
        'review_aggregate_source_link rows should not be direct-merged without a parent/child election model.',
        'auto_merge rows still need an apply script that preserves source references before any database write.',
      ],
    },
    electionMergePlan,
    raceMergePlan,
  };

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(plan, null, 2)}\n`);

  console.log(JSON.stringify({
    generatedAt: plan.generatedAt,
    mode: plan.mode,
    inputPath: plan.inputPath,
    outputPath: options.outputPath,
    summary: plan.summary,
    sampleElectionMergePlan: electionMergePlan.slice(0, options.sampleLimit),
    sampleRaceMergePlan: raceMergePlan.slice(0, options.sampleLimit),
  }, null, 2));
}

main();
