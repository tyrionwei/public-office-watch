import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const options = {
    inputPath: path.resolve('tmp/daily-person-enrichment-targets.json'),
    outputPath: path.resolve('tmp/daily-person-research-queue.json'),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.inputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  return options;
}

function quotedName(name) {
  return `"${String(name).replaceAll('"', '')}"`;
}

function buildSearchPlans(target) {
  const name = quotedName(target.name);
  const identity = [name, target.position, target.district].filter(Boolean).join(' ');
  const missing = new Set(target.missingSignals ?? []);
  const research = new Set([...(target.researchSignals ?? []), 'experience', 'party_affiliation', 'legal_case']);
  const plans = [];
  const basicFields = [
    ['birth_date', '生日'],
    ['gender', '性別'],
    ['education', '學歷'],
    ['external_id', '官方人物資料'],
  ].filter(([key]) => missing.has(key)).map(([, label]) => label);

  if (basicFields.length > 0) {
    plans.push({
      key: 'basic_profile',
      query: `${identity} ${basicFields.join(' ')}`,
      historical: true,
      sourcePriority: ['official_profile', 'election_authority', 'official_biography', 'wikidata_fallback'],
    });
  }
  if (missing.has('family_relation')) {
    plans.push({
      key: 'family_relation',
      query: `${identity} 配偶 父親 母親 子女 家族關係`,
      historical: true,
      sensitive: true,
      sourcePriority: ['official_profile', 'direct_statement', 'trusted_media', 'wikidata_fallback'],
    });
  }
  if (research.has('experience')) {
    plans.push({
      key: 'experience_history',
      query: `${identity} 經歷 曾任 履歷`,
      historical: true,
      sourcePriority: ['official_profile', 'election_authority', 'government_record', 'trusted_media'],
    });
  }
  if (research.has('party_affiliation')) {
    plans.push({
      key: 'party_affiliation_history',
      query: `${identity} 入黨 退黨 開除黨籍 恢復黨籍 更換黨籍`,
      historical: true,
      sensitive: true,
      sourcePriority: ['party_official', 'direct_statement', 'election_authority', 'trusted_media'],
      note: 'Election recommendation is an election-time snapshot and must not be treated as proof of formal membership by itself.',
    });
  }
  if (research.has('legal_case')) {
    plans.push({
      key: 'legal_record_clues',
      query: `${identity} 搜索 約談 交保 起訴 判決 定讞`,
      historical: true,
      sensitive: true,
      sourcePriority: ['trusted_media', 'prosecutor_or_court_release'],
      nextStep: 'Only after a concrete clue and identity match, search official Judicial Yuan criminal judgments from the event year onward.',
    });
  }
  return plans;
}

function buildResearchQueue(targets, generatedAt = new Date().toISOString()) {
  return {
    schemaVersion: 1,
    name: 'daily-person-research-queue',
    generatedAt,
    targetCount: targets.length,
    notes: 'Private review queue for historical person research. Election-platform ingestion is intentionally handled as a separate CEC bulletin project.',
    targets: targets.map((target, index) => ({
      order: index + 1,
      personId: target.personId,
      name: target.name,
      position: target.position ?? null,
      district: target.district ?? null,
      priorElectionYears: target.priorElectionYears ?? [],
      missingSignals: target.missingSignals ?? [],
      researchSignals: target.researchSignals ?? [],
      searchPlans: buildSearchPlans(target),
      reviewStatus: 'pending',
      autoPublish: false,
    })),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const payload = JSON.parse(fs.readFileSync(options.inputPath, 'utf8'));
  const targets = Array.isArray(payload) ? payload : payload.targets;
  if (!Array.isArray(targets)) throw new Error('Input must contain a targets array');
  const queue = buildResearchQueue(targets);
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(queue, null, 2)}\n`);
  console.log(JSON.stringify({
    status: 'written',
    targetCount: queue.targetCount,
    firstPersonName: queue.targets[0]?.name ?? null,
    lastPersonName: queue.targets.at(-1)?.name ?? null,
    searchPlanCount: queue.targets.reduce((sum, target) => sum + target.searchPlans.length, 0),
    outputPath: options.outputPath,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { buildResearchQueue, buildSearchPlans, parseArgs };
