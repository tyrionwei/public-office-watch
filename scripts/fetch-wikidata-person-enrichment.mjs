import fs from 'node:fs';
import path from 'node:path';

const wikidataApiUrl = 'https://www.wikidata.org/w/api.php';
const defaultOutputPath = path.resolve('data-sources/person-enrichment-claims.seed.json');
const defaultProgressPath = path.resolve('data-sources/person-enrichment-progress.json');

const relationProperties = {
  P22: 'father',
  P25: 'mother',
  P26: 'spouse',
  P40: 'child',
  P3373: 'sibling',
};

const relationLabels = {
  father: '父親',
  mother: '母親',
  spouse: '配偶',
  child: '子女',
  sibling: '手足',
};

function parseArgs(argv) {
  const args = {
    outputPath: defaultOutputPath,
    progressPath: defaultProgressPath,
    targetNamesPath: null,
    targetNamesFromSupabase: false,
    offset: 0,
    resume: false,
    maxPeople: 25,
    searchLimit: 3,
    requestDelayMs: 1500,
    retryCount: 3,
    dryRun: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--output') {
      args.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--progress-file') {
      args.progressPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--target-names') {
      args.targetNamesPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--target-names-from-supabase') {
      args.targetNamesFromSupabase = true;
      continue;
    }

    if (arg === '--max-people') {
      args.maxPeople = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--offset') {
      args.offset = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--resume') {
      args.resume = true;
      continue;
    }

    if (arg === '--search-limit') {
      args.searchLimit = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--request-delay-ms') {
      args.requestDelayMs = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--retry-count') {
      args.retryCount = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  if (!Number.isFinite(args.maxPeople) || args.maxPeople <= 0) {
    throw new Error('--max-people must be a positive number.');
  }

  if (!Number.isFinite(args.offset) || args.offset < 0) {
    throw new Error('--offset must be zero or a positive number.');
  }

  return args;
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .replace(/[臺]/g, '台')
    .replace(/[‧·．・･•]/g, '')
    .replace(/[\s\u00A0\u3000]+/g, '');
}

function getBestMonolingual(values, languages = ['zh-tw', 'zh-hant', 'zh', 'en']) {
  for (const language of languages) {
    if (values?.[language]?.value) return values[language].value;
  }

  return Object.values(values ?? {})[0]?.value ?? null;
}

function loadTargetNames(filePath) {
  if (!filePath) {
    throw new Error('Provide --target-names or --target-names-from-supabase.');
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const names = Array.isArray(parsed) ? parsed : parsed.names;

  if (!Array.isArray(names) || names.length === 0) {
    throw new Error('Target names file must be a JSON array or an object with a non-empty names array.');
  }

  return names.map((name) => ({ name: String(name).trim() })).filter((item) => item.name);
}

async function loadTargetNamesFromSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !anonKey) {
    throw new Error('Set SUPABASE_URL/VITE_SUPABASE_URL and SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY to load target names from public_people.');
  }

  const people = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/public_people`);
    url.searchParams.set('select', 'person_id,name,party,position,district');
    url.searchParams.set('order', 'updated_at.desc');

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
        range: `${offset}-${offset + pageSize - 1}`,
      },
      signal: AbortSignal.timeout(60000),
    });
    const rows = await response.json();

    if (!response.ok || !Array.isArray(rows)) {
      throw new Error(`Failed to fetch public_people targets: ${rows?.message ?? response.statusText}`);
    }

    people.push(...rows.map((row) => ({
      personId: row.person_id,
      name: row.name,
      party: row.party,
      position: row.position,
      district: row.district,
    })).filter((row) => row.name));

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  const byName = new Map();
  for (const person of people) {
    if (!byName.has(`${person.personId}:${person.name}`)) {
      byName.set(`${person.personId}:${person.name}`, person);
    }
  }

  return Array.from(byName.values());
}

async function wikidataGet(params) {
  const url = new URL(wikidataApiUrl);
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      'user-agent': 'public-office-watch/0.1 (person enrichment; review-only)',
      accept: 'application/json',
    },
    signal: AbortSignal.timeout(60000),
  });
  const text = await response.text();
  let payload;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Wikidata API returned non-JSON response: ${text.slice(0, 120)}`);
  }

  if (!response.ok || payload.error) {
    throw new Error(`Wikidata API failed: ${payload.error?.info ?? response.statusText}`);
  }

  return payload;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function wikidataGetWithRetry(params, args) {
  let lastError = null;

  for (let attempt = 0; attempt <= args.retryCount; attempt += 1) {
    try {
      return await wikidataGet(params);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);

      if (!message.includes('too many requests') && !message.includes('maxlag') && !message.includes('non-JSON')) {
        throw error;
      }

      await sleep(args.requestDelayMs * (attempt + 1));
    }
  }

  throw lastError;
}

async function searchEntity(name, limit, args) {
  const payload = await wikidataGetWithRetry({
    action: 'wbsearchentities',
    search: name,
    language: 'zh',
    uselang: 'zh',
    type: 'item',
    limit,
  }, args);

  return payload.search ?? [];
}

async function getEntities(ids, args) {
  if (ids.length === 0) return {};
  const payload = await wikidataGetWithRetry({
    action: 'wbgetentities',
    ids: Array.from(new Set(ids)).join('|'),
    props: 'labels|descriptions|aliases|claims|sitelinks',
    languages: 'zh-tw|zh-hant|zh|en',
  }, args);

  return payload.entities ?? {};
}

function entityIdFromClaim(claim) {
  return claim?.mainsnak?.datavalue?.value?.id ?? null;
}

function timeFromClaim(claim) {
  const time = claim?.mainsnak?.datavalue?.value?.time;
  if (!time) return null;
  return time.replace(/^\+/, '').slice(0, 10);
}

function claimEntityIds(entity, property) {
  return (entity.claims?.[property] ?? []).map(entityIdFromClaim).filter(Boolean);
}

function claimTimes(entity, property) {
  return (entity.claims?.[property] ?? []).map(timeFromClaim).filter(Boolean);
}

function isLikelySamePerson(target, entity, searchResult) {
  const targetName = normalizeName(target.name);
  const labels = [
    getBestMonolingual(entity.labels),
    searchResult.label,
    ...(Object.values(entity.aliases ?? {}).flatMap((items) => items.map((item) => item.value))),
  ].filter(Boolean).map(normalizeName);

  if (!labels.includes(targetName)) {
    return false;
  }

  const description = [
    getBestMonolingual(entity.descriptions),
    searchResult.description,
    target.party,
    target.position,
    target.district,
  ].filter(Boolean).join(' ');

  return /政治|政黨|立法|議員|市長|縣長|總統|候選|minister|politician|legislator|mayor|president/i.test(description);
}

function sourceUrlFor(qid) {
  return `https://www.wikidata.org/wiki/${qid}`;
}

function claimRecord({ target, qid, claimType, claimValue, claimJson = {}, sourceUrl = sourceUrlFor(qid) }) {
  return {
    personId: target.personId ?? null,
    personName: target.name,
    claimType,
    claimValue,
    claimJson: {
      ...claimJson,
      wikidataQid: qid,
    },
    confidenceLevel: 'C',
    reviewStatus: 'pending',
    visibility: 'review_only',
    sourceId: 'wikidata-person-enrichment',
    sourceName: 'Wikidata 人物補充資料',
    sourceUrl,
  };
}

function genderFromEntityId(entityId) {
  if (entityId === 'Q6581097') return 'male';
  if (entityId === 'Q6581072') return 'female';
  return null;
}

function labelsForIds(entities, ids) {
  return ids.map((id) => ({ id, label: getBestMonolingual(entities[id]?.labels), description: getBestMonolingual(entities[id]?.descriptions) }))
    .filter((item) => item.label);
}

function buildClaimsForTarget({ target, entity, qid, relatedEntities }) {
  const claims = [];
  const gender = genderFromEntityId(claimEntityIds(entity, 'P21')[0]);
  const birthDate = claimTimes(entity, 'P569')[0] ?? null;
  const education = labelsForIds(relatedEntities, claimEntityIds(entity, 'P69')).map((item) => item.label);
  const positions = labelsForIds(relatedEntities, claimEntityIds(entity, 'P39')).map((item) => item.label);
  const occupations = labelsForIds(relatedEntities, claimEntityIds(entity, 'P106')).map((item) => item.label);

  claims.push(claimRecord({ target, qid, claimType: 'external_id', claimValue: `wikidata:${qid}` }));

  if (gender) {
    claims.push(claimRecord({ target, qid, claimType: 'gender', claimValue: gender }));
  }

  if (birthDate) {
    claims.push(claimRecord({ target, qid, claimType: 'birth_date', claimValue: birthDate }));
  }

  if (education.length > 0) {
    claims.push(claimRecord({ target, qid, claimType: 'education', claimValue: Array.from(new Set(education)).join('；') }));
  }

  if (positions.length > 0 || occupations.length > 0) {
    claims.push(claimRecord({
      target,
      qid,
      claimType: 'experience',
      claimValue: Array.from(new Set([...positions, ...occupations])).slice(0, 12).join('；'),
      claimJson: { positions, occupations },
    }));
  }

  for (const [property, relationType] of Object.entries(relationProperties)) {
    for (const relative of labelsForIds(relatedEntities, claimEntityIds(entity, property))) {
      claims.push(claimRecord({
        target,
        qid,
        claimType: 'family_relation',
        claimValue: `${relationLabels[relationType]}：${relative.label}`,
        sourceUrl: sourceUrlFor(relative.id),
        claimJson: {
          relationType,
          relationLabel: relationLabels[relationType],
          relativeQid: relative.id,
          relativeName: relative.label,
          relativeDescription: relative.description ?? null,
        },
      }));
    }
  }

  return claims;
}

function mergeClaims(existingPayload, newClaims) {
  const existingClaims = existingPayload.personClaims ?? [];
  const keyFor = (claim) =>
    claim.claimKey ??
    [
      claim.personId ?? claim.personName,
      claim.claimType,
      claim.claimValue,
      claim.claimJson?.wikidataQid,
      claim.claimJson?.relativeQid,
    ].filter(Boolean).join('|');
  const byKey = new Map(existingClaims.map((claim) => [keyFor(claim), claim]));

  for (const claim of newClaims) {
    byKey.set(keyFor(claim), claim);
  }

  return {
    schemaVersion: existingPayload.schemaVersion ?? 1,
    name: existingPayload.name ?? 'person-enrichment-claims',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: existingPayload.notes ?? 'Reviewed-source supplemental person claims. Wikidata/Wikipedia-derived records are review-only by default.',
    personClaims: Array.from(byKey.values()),
  };
}

function readProgress(progressPath) {
  if (!fs.existsSync(progressPath)) {
    return { nextOffset: 0 };
  }

  return JSON.parse(fs.readFileSync(progressPath, 'utf8'));
}

function writeProgress(progressPath, progress) {
  fs.writeFileSync(progressPath, `${JSON.stringify(progress, null, 2)}\n`);
}

async function main() {
  const args = parseArgs(process.argv);
  const progress = args.resume ? readProgress(args.progressPath) : { nextOffset: args.offset };
  const offset = args.resume ? Number(progress.nextOffset ?? 0) : args.offset;
  const targets = (args.targetNamesFromSupabase ? await loadTargetNamesFromSupabase() : loadTargetNames(args.targetNamesPath)).slice(
    offset,
    offset + args.maxPeople,
  );
  const allClaims = [];
  const skipped = [];

  for (const target of targets) {
    await sleep(args.requestDelayMs);
    const searchResults = await searchEntity(target.name, args.searchLimit, args);
    const entities = await getEntities(searchResults.map((result) => result.id), args);
    const matched = searchResults.find((result) => {
      const entity = entities[result.id];
      return entity && isLikelySamePerson(target, entity, result);
    });

    if (!matched) {
      skipped.push({ name: target.name, reason: 'no confident Wikidata entity match' });
      continue;
    }

    const entity = entities[matched.id];
    await sleep(args.requestDelayMs);
    const relatedIds = [
      ...claimEntityIds(entity, 'P21'),
      ...claimEntityIds(entity, 'P69'),
      ...claimEntityIds(entity, 'P39'),
      ...claimEntityIds(entity, 'P106'),
      ...Object.keys(relationProperties).flatMap((property) => claimEntityIds(entity, property)),
    ];
    const relatedEntities = await getEntities(relatedIds, args);
    allClaims.push(...buildClaimsForTarget({ target, entity, qid: matched.id, relatedEntities }));
  }

  const existingPayload = fs.existsSync(args.outputPath)
    ? JSON.parse(fs.readFileSync(args.outputPath, 'utf8'))
    : { personClaims: [] };
  const nextPayload = mergeClaims(existingPayload, allClaims);

  if (!args.dryRun) {
    fs.writeFileSync(args.outputPath, `${JSON.stringify(nextPayload, null, 2)}\n`);
    writeProgress(args.progressPath, {
      nextOffset: offset + targets.length,
      lastOffset: offset,
      lastTargetCount: targets.length,
      lastNewClaimCount: allClaims.length,
      lastSkippedCount: skipped.length,
      updatedAt: new Date().toISOString(),
    });
  }

  console.log(JSON.stringify({
        status: 'ok',
        targetCount: targets.length,
        offset,
        nextOffset: offset + targets.length,
        newClaimCount: allClaims.length,
    skippedCount: skipped.length,
    outputPath: args.outputPath,
    dryRun: args.dryRun,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`wikidata person enrichment fetch failed: ${message}`);
  process.exit(1);
});
