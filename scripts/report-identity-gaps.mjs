import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultDuplicateReportPath = path.join(repoRoot, 'data-sources', 'duplicate-people-report.json');
const defaultOutputPath = path.join(repoRoot, 'data-sources', 'identity-gap-report.json');

function parseArgs(argv) {
  const options = {
    duplicateReportPath: defaultDuplicateReportPath,
    outputPath: defaultOutputPath,
    write: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--duplicate-report') {
      options.duplicateReportPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--output') {
      options.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--write') {
      options.write = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return options;
}

function hasSharedExternalId(records) {
  const counts = new Map();

  for (const record of records) {
    for (const externalId of record.externalIds ?? []) {
      counts.set(externalId, (counts.get(externalId) ?? 0) + 1);
    }
  }

  return Array.from(counts.values()).some((count) => count > 1);
}

function hasSharedBirthDate(records) {
  const counts = new Map();

  for (const record of records) {
    for (const birthDate of record.birthDates ?? []) {
      counts.set(birthDate, (counts.get(birthDate) ?? 0) + 1);
    }
  }

  return Array.from(counts.values()).some((count) => count > 1);
}

function missingStableIdentitySignals(record) {
  const missing = [];

  if (!record.externalIds || record.externalIds.length === 0) {
    missing.push('external_id');
  }

  if (!record.birthDates || record.birthDates.length === 0) {
    missing.push('birth_date');
  }

  return missing;
}

function buildReport(duplicateReport) {
  const groups = (duplicateReport.groups ?? [])
    .filter((group) => ['same_name_only', 'manual_review'].includes(group.topRecommendation))
    .map((group) => {
      const records = group.records ?? [];
      const recordsWithMissingSignals = records
        .map((record) => ({
          personId: record.personId,
          name: record.name,
          gender: record.gender,
          party: record.party,
          position: record.position,
          district: record.district,
          externalIds: record.externalIds ?? [],
          birthDates: record.birthDates ?? [],
          missingSignals: missingStableIdentitySignals(record),
        }))
        .filter((record) => record.missingSignals.length > 0);
      const groupMissingSignals = Array.from(new Set(recordsWithMissingSignals.flatMap((record) => record.missingSignals))).sort();

      return {
        normalizedName: group.normalizedName,
        recordCount: group.recordCount,
        topRecommendation: group.topRecommendation,
        hasSharedExternalId: hasSharedExternalId(records),
        hasSharedBirthDate: hasSharedBirthDate(records),
        groupMissingSignals,
        priority:
          group.topRecommendation === 'manual_review'
            ? 'high'
            : groupMissingSignals.includes('birth_date')
              ? 'medium'
              : 'low',
        records: recordsWithMissingSignals,
      };
    })
    .filter((group) => group.groupMissingSignals.length > 0)
    .sort((left, right) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[left.priority] - priorityOrder[right.priority] || right.recordCount - left.recordCount || left.normalizedName.localeCompare(right.normalizedName, 'zh-Hant-TW');
    });

  const byPriority = groups.reduce((counts, group) => {
    counts[group.priority] = (counts[group.priority] ?? 0) + 1;
    return counts;
  }, {});
  const byMissingSignal = groups.reduce((counts, group) => {
    for (const signal of group.groupMissingSignals) {
      counts[signal] = (counts[signal] ?? 0) + 1;
    }
    return counts;
  }, {});

  return {
    generatedAt: new Date().toISOString(),
    sourceDuplicateReportGeneratedAt: duplicateReport.generatedAt,
    policy: {
      purpose: 'Prioritize official birth date or shared official/person external IDs for same-name groups.',
      contextOnlySignals: duplicateReport.policy?.contextOnlySignals ?? ['party', 'district', 'position', 'candidate region'],
    },
    groupCount: groups.length,
    byPriority,
    byMissingSignal,
    groups,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const duplicateReport = JSON.parse(fs.readFileSync(options.duplicateReportPath, 'utf8'));
  const report = buildReport(duplicateReport);
  const content = `${JSON.stringify(report, null, 2)}\n`;

  if (options.write) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, content);
    console.log(`Wrote identity gap report: ${path.relative(repoRoot, options.outputPath)}`);
    return;
  }

  console.log(content);
}

main();
