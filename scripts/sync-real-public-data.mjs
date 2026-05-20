import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSeedPath = path.join(repoRoot, 'data-sources', 'real-public-data.seed.json');

function parseArgs(argv) {
  const args = {
    seedPath: defaultSeedPath,
    write: false,
    recordRun: false,
    mode: 'weekly',
    skipLiveFetch: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--write') {
      args.write = true;
      continue;
    }

    if (arg === '--record-run') {
      args.recordRun = true;
      continue;
    }

    if (arg === '--skip-live-fetch') {
      args.skipLiveFetch = true;
      continue;
    }

    if (arg === '--daily' || arg === '--weekly') {
      args.mode = arg.slice(2);
      continue;
    }

    if (arg === '--seed') {
      args.seedPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  return args;
}

const knownPartyProfiles = {
  民主進步黨: { shortName: '民進黨', slug: 'dpp', themeKey: 'dpp', officialSiteUrl: 'https://www.dpp.org.tw/' },
  中國國民黨: { shortName: '國民黨', slug: 'kmt', themeKey: 'kmt', officialSiteUrl: 'https://www.kmt.org.tw/' },
  台灣民眾黨: { shortName: '民眾黨', slug: 'tpp', themeKey: 'tpp', officialSiteUrl: 'https://www.tpp.org.tw/' },
  臺灣民眾黨: { shortName: '民眾黨', slug: 'tpp', themeKey: 'tpp', officialSiteUrl: 'https://www.tpp.org.tw/' },
  時代力量: { shortName: '時力', slug: 'npp', themeKey: 'npp', officialSiteUrl: 'https://www.newpowerparty.tw/' },
  台灣基進: { shortName: '基進', slug: 'tsp', themeKey: 'tsp', officialSiteUrl: 'https://www.statebuilding.tw/' },
  臺灣基進: { shortName: '基進', slug: 'tsp', themeKey: 'tsp', officialSiteUrl: 'https://www.statebuilding.tw/' },
  親民黨: { shortName: '親民黨', slug: 'pfp', themeKey: 'pfp', officialSiteUrl: null },
};

const relevantPartyNames = new Set([
  '民主進步黨',
  '中國國民黨',
  '台灣民眾黨',
  '臺灣民眾黨',
  '時代力量',
  '台灣基進',
  '臺灣基進',
  '親民黨',
  '新黨',
  '台灣團結聯盟',
  '社會民主黨',
  '綠黨',
  '小民參政歐巴桑聯盟',
]);

function hashId(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 12);
}

function slugifyPartyName(name) {
  const known = knownPartyProfiles[name];

  if (known?.slug) {
    return known.slug;
  }

  return `moi-party-${hashId(name)}`;
}

function detectDelimiter(headerLine) {
  const candidates = [',', ';', '\t'];
  return candidates
    .map((delimiter) => ({ delimiter, count: headerLine.split(delimiter).length }))
    .sort((left, right) => right.count - left.count)[0].delimiter;
}

function parseDelimited(content) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;
  const headerLine = content.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = detectDelimiter(headerLine);

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(current.trim());
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }

      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, '').trim());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

function pickField(row, candidates) {
  for (const candidate of candidates) {
    const value = row[candidate]?.trim();
    if (value) {
      return value;
    }
  }

  return '';
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const bytes = await response.arrayBuffer();
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const replacementCount = (utf8.match(/\uFFFD/g) ?? []).length;

  if (replacementCount > 5) {
    try {
      return new TextDecoder('big5', { fatal: false }).decode(bytes);
    } catch {
      return utf8;
    }
  }

  return utf8;
}

async function enrichSeedWithLivePartyRegistry(seed, args) {
  const registrySource = seed.sources.find((source) => source.id === 'moi-party-registry');

  if (args.skipLiveFetch || !registrySource?.downloadUrl) {
    return {
      seed,
      livePartyRegistry: {
        status: 'skipped',
        count: seed.parties.length,
        url: registrySource?.downloadUrl ?? null,
      },
    };
  }

  try {
    const csv = await fetchText(registrySource.downloadUrl);
    const rows = parseDelimited(csv);
    const seenNames = new Set();
    const parties = rows
      .map((row) => ({
        row,
        name: pickField(row, ['政黨名稱', '名稱', '黨名', 'political_party_name']),
      }))
      .filter(({ name }) => {
        if (!name || seenNames.has(name) || !relevantPartyNames.has(name)) {
          return false;
        }

        seenNames.add(name);
        return true;
      })
      .map(({ row, name }) => {
        const known = knownPartyProfiles[name] ?? {};
        return {
          externalId: `moi-party-${hashId(name)}`,
          name,
          shortName: known.shortName ?? null,
          slug: slugifyPartyName(name),
          themeKey: known.themeKey ?? 'unknown',
          officialSiteUrl: known.officialSiteUrl ?? null,
          registryNo: pickField(row, ['政黨編號', '編號', 'registry_no', 'party_no']),
          foundedDateText: pickField(row, ['成立日期', 'founded_date']),
          filedDateText: pickField(row, ['備案日期', 'filed_date', 'registration_date']),
          headquartersAddress: pickField(row, ['主事務所地址', '地址', 'headquarters_address']),
          contactPhone: pickField(row, ['通訊電話', '電話', 'contact_phone']),
          chairpersonName: pickField(row, ['負責人', '主任委員', '黨主席', 'chairperson', 'leader']),
          status: 'active',
          sourceId: 'moi-party-registry',
        };
      });

    if (parties.length === 0) {
      throw new Error('CSV parsed successfully but no party names were found.');
    }

    return {
      seed: {
        ...seed,
        parties,
      },
      livePartyRegistry: {
        status: 'ok',
        count: parties.length,
        url: registrySource.downloadUrl,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      seed,
      livePartyRegistry: {
        status: 'fallback',
        count: seed.parties.length,
        url: registrySource.downloadUrl,
        error: message,
      },
    };
  }
}

function parseJsonPayload(content) {
  const startIndex = content.indexOf('{');
  const endIndex = content.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('No JSON object was found in response payload.');
  }

  return JSON.parse(content.slice(startIndex, endIndex + 1));
}

function getLegislatorCodeFromPhotoUrl(picUrl) {
  const match = picUrl.match(/\/(\d+)\.[a-z]+$/i);
  return match?.[1] ?? '';
}

async function enrichSeedWithLiveCurrentOfficeholders(seed, args) {
  const source = seed.sources.find((item) => item.id === 'ly-current-legislators');

  if (args.skipLiveFetch || !source?.downloadUrl) {
    return {
      seed,
      liveCurrentOfficeholders: {
        status: 'skipped',
        count: seed.people?.length ?? 0,
        url: source?.downloadUrl ?? null,
      },
    };
  }

  try {
    const payload = parseJsonPayload(await fetchText(source.downloadUrl));
    const rows = Array.isArray(payload.dataList) ? payload.dataList : [];
    const officeholders = rows
      .filter((row) => pickField(row, ['leaveFlag']) === '否')
      .map((row) => {
        const term = pickField(row, ['term']) || '11';
        const name = pickField(row, ['name']);
        const party = pickField(row, ['partyGroup', 'party']);
        const areaName = pickField(row, ['areaName']);
        const onboardDate = pickField(row, ['onboardDate']);
        const legislatorCode = getLegislatorCodeFromPhotoUrl(pickField(row, ['picUrl']));
        return {
          externalId: `ly-legislator-${term}-${legislatorCode || hashId([name, party, areaName, onboardDate].join('|'))}`,
          name,
          alias: pickField(row, ['ename']) || null,
          party,
          position: `第${term}屆立法委員`,
          electionYear: 2024,
          district: areaName,
          sourceUrl: source.url,
          isPublic: true,
          sourceId: 'ly-current-legislators',
        };
      })
      .filter((person) => person.name);

    if (officeholders.length === 0) {
      throw new Error('JSON parsed successfully but no current legislators were found.');
    }

    return {
      seed: {
        ...seed,
        people: officeholders,
      },
      liveCurrentOfficeholders: {
        status: 'ok',
        count: officeholders.length,
        url: source.downloadUrl,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      seed,
      liveCurrentOfficeholders: {
        status: 'fallback',
        count: seed.people?.length ?? 0,
        url: source?.downloadUrl ?? null,
        error: message,
      },
    };
  }
}

function readSeed(seedPath) {
  const content = fs.readFileSync(seedPath, 'utf8');
  return {
    seed: JSON.parse(content),
    hash: crypto.createHash('sha256').update(content).digest('hex'),
  };
}

function getSource(seed, sourceId) {
  const source = seed.sources.find((item) => item.id === sourceId);

  if (!source) {
    throw new Error(`Missing source metadata: ${sourceId}`);
  }

  return source;
}

function validateSeed(seed) {
  const sourceIds = new Set(seed.sources.map((source) => source.id));
  const regionIds = new Set(seed.regions.map((region) => region.externalId));
  const electionIds = new Set(seed.elections.map((election) => election.externalId));
  const raceIds = new Set(seed.races.map((race) => race.externalId));
  const personIds = new Set((seed.people ?? []).map((person) => person.externalId));
  const partyIds = new Set(seed.parties.map((party) => party.externalId));

  for (const collection of ['regions', 'elections', 'races', 'parties', 'people', 'candidates']) {
    if (!Array.isArray(seed[collection])) {
      throw new Error(`Seed collection must be an array: ${collection}`);
    }
  }

  for (const region of seed.regions) {
    if (!sourceIds.has(region.sourceId)) throw new Error(`Region ${region.externalId} has unknown sourceId.`);
    if (region.parentExternalId && !regionIds.has(region.parentExternalId)) {
      throw new Error(`Region ${region.externalId} has unknown parentExternalId.`);
    }
  }

  for (const election of seed.elections) {
    if (!sourceIds.has(election.sourceId)) throw new Error(`Election ${election.externalId} has unknown sourceId.`);
  }

  for (const race of seed.races) {
    if (!sourceIds.has(race.sourceId)) throw new Error(`Race ${race.externalId} has unknown sourceId.`);
    if (!electionIds.has(race.electionExternalId)) throw new Error(`Race ${race.externalId} has unknown electionExternalId.`);
    if (race.regionExternalId && !regionIds.has(race.regionExternalId)) {
      throw new Error(`Race ${race.externalId} has unknown regionExternalId.`);
    }
  }

  for (const party of seed.parties) {
    if (!sourceIds.has(party.sourceId)) throw new Error(`Party ${party.externalId} has unknown sourceId.`);
  }

  for (const person of seed.people ?? []) {
    if (!sourceIds.has(person.sourceId)) throw new Error(`Person ${person.externalId} has unknown sourceId.`);
  }

  for (const candidate of seed.candidates ?? []) {
    if (!sourceIds.has(candidate.sourceId)) throw new Error(`Candidate ${candidate.externalId} has unknown sourceId.`);
    if (!personIds.has(candidate.personExternalId)) {
      throw new Error(`Candidate ${candidate.externalId} has unknown personExternalId.`);
    }
    if (!raceIds.has(candidate.raceExternalId)) {
      throw new Error(`Candidate ${candidate.externalId} has unknown raceExternalId.`);
    }
  }

  for (const summary of seed.partyFinanceSummaries ?? []) {
    if (!partyIds.has(summary.partyExternalId)) {
      throw new Error(`Party finance summary has unknown partyExternalId: ${summary.partyExternalId}`);
    }
  }
}

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    throw new Error('Writing requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  return { url: url.replace(/\/$/, ''), serviceKey };
}

async function supabaseRequest(env, table, { method = 'GET', rows, onConflict, select } = {}) {
  const url = new URL(`${env.url}/rest/v1/${table}`);

  if (onConflict) {
    url.searchParams.set('on_conflict', onConflict);
  }

  if (select) {
    url.searchParams.set('select', select);
  }

  const headers = {
    apikey: env.serviceKey,
    authorization: `Bearer ${env.serviceKey}`,
  };

  if (method !== 'GET') {
    headers['content-type'] = 'application/json';
    headers.prefer = onConflict ? 'resolution=merge-duplicates,return=representation' : 'return=representation';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(rows),
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${table} ${method} failed: ${body?.message ?? response.statusText}`);
  }

  return Array.isArray(body) ? body : [];
}

async function upsertOrThrow(env, table, rows, options = {}) {
  if (rows.length === 0) {
    return [];
  }

  return supabaseRequest(env, table, {
    method: 'POST',
    rows,
    onConflict: options.onConflict,
  });
}

async function selectOrThrow(env, table, select) {
  return supabaseRequest(env, table, { method: 'GET', select });
}

async function writeSeed(seed, hash, args) {
  const env = getSupabaseEnv();
  const startedAt = new Date().toISOString();

  const regionRows = seed.regions.map((region) => {
    return {
      external_id: region.externalId,
      name: region.name,
      slug: region.slug,
      region_type: region.regionType,
      official_code: region.officialCode ?? null,
      map_code: region.mapCode ?? null,
      display_order: region.displayOrder ?? null,
      is_public: true,
      updated_at: startedAt,
      parent_region_id: null,
    };
  });

  const regions = await upsertOrThrow(env, 'regions', regionRows, { onConflict: 'external_id' });
  const regionByExternalId = new Map(regions.map((region) => [region.external_id, region]));

  const regionsWithParents = seed.regions
    .filter((region) => region.parentExternalId)
    .map((region) => ({
      external_id: region.externalId,
      parent_region_id: regionByExternalId.get(region.parentExternalId)?.id ?? null,
    }));

  await upsertOrThrow(env, 'regions', regionsWithParents, { onConflict: 'external_id' });

  const electionRows = seed.elections.map((election) => {
    const source = getSource(seed, election.sourceId);
    return {
      external_id: election.externalId,
      name: election.name,
      year: election.year,
      election_type: election.electionType,
      voting_date: election.votingDate,
      status: election.status,
      source_name: source.name,
      source_url: source.url,
      is_public: true,
      updated_at: startedAt,
    };
  });

  const elections = await upsertOrThrow(env, 'elections', electionRows, { onConflict: 'external_id' });
  const electionByExternalId = new Map(elections.map((election) => [election.external_id, election]));

  const regionRefresh = await selectOrThrow(env, 'regions', 'id,external_id');
  for (const region of regionRefresh) {
    regionByExternalId.set(region.external_id, region);
  }

  const raceRows = seed.races.map((race) => {
    const source = getSource(seed, race.sourceId);
    return {
      external_id: race.externalId,
      election_id: electionByExternalId.get(race.electionExternalId)?.id,
      region_id: race.regionExternalId ? regionByExternalId.get(race.regionExternalId)?.id ?? null : null,
      race_type: race.raceType,
      title: race.title,
      voting_date: race.votingDate,
      status: race.status,
      source_name: source.name,
      source_url: source.url,
      is_public: true,
      updated_at: startedAt,
    };
  });

  await upsertOrThrow(env, 'races', raceRows, { onConflict: 'external_id' });

  const raceRefresh = await selectOrThrow(env, 'races', 'id,external_id');
  const raceByExternalId = new Map(raceRefresh.map((race) => [race.external_id, race]));

  const personRows = (seed.people ?? []).map((person) => {
    const source = getSource(seed, person.sourceId);
    return {
      external_id: person.externalId,
      name: person.name,
      alias: person.alias ?? null,
      party: person.party ?? null,
      position: person.position ?? null,
      election_year: person.electionYear ?? null,
      district: person.district ?? null,
      source_url: person.sourceUrl ?? source.url,
      is_public: person.isPublic ?? true,
      updated_at: startedAt,
    };
  });

  const people = await upsertOrThrow(env, 'people', personRows, { onConflict: 'external_id' });
  const personByExternalId = new Map(people.map((person) => [person.external_id, person]));

  const candidateRows = (seed.candidates ?? []).map((candidate) => {
    const source = getSource(seed, candidate.sourceId);
    return {
      external_id: candidate.externalId,
      person_id: personByExternalId.get(candidate.personExternalId)?.id,
      race_id: raceByExternalId.get(candidate.raceExternalId)?.id,
      party: candidate.party ?? null,
      candidate_no: candidate.candidateNo ?? null,
      registration_status: candidate.registrationStatus ?? 'unknown',
      source_name: source.name,
      source_url: candidate.sourceUrl ?? source.url,
      is_public: candidate.isPublic ?? true,
      updated_at: startedAt,
    };
  });

  await upsertOrThrow(env, 'candidates', candidateRows, { onConflict: 'external_id' });

  const partyRows = seed.parties.map((party) => {
    const source = getSource(seed, party.sourceId);
    return {
      external_id: party.externalId,
      name: party.name,
      short_name: party.shortName ?? null,
      slug: party.slug,
      theme_key: party.themeKey,
      official_site_url: party.officialSiteUrl ?? null,
      chairperson_name: party.chairpersonName ?? null,
      registry_no: party.registryNo ?? null,
      founded_date_text: party.foundedDateText ?? null,
      filed_date_text: party.filedDateText ?? null,
      headquarters_address: party.headquartersAddress ?? null,
      contact_phone: party.contactPhone ?? null,
      status: party.status,
      source_name: source.name,
      source_url: source.url,
      is_public: true,
      updated_at: startedAt,
    };
  });

  const parties = await upsertOrThrow(env, 'parties', partyRows, { onConflict: 'external_id' });
  const partyByExternalId = new Map(parties.map((party) => [party.external_id, party]));

  const financeRows = (seed.partyFinanceSummaries ?? []).map((summary) => {
    const party = partyByExternalId.get(summary.partyExternalId);
    const source = getSource(seed, summary.sourceId);
    return {
      party_id: party?.id,
      report_year: summary.reportYear,
      income_total: summary.incomeTotal ?? 0,
      expense_total: summary.expenseTotal ?? 0,
      balance_amount: summary.balanceAmount ?? 0,
      individual_donation_total: summary.individualDonationTotal ?? 0,
      business_donation_total: summary.businessDonationTotal ?? 0,
      civil_group_donation_total: summary.civilGroupDonationTotal ?? 0,
      anonymous_donation_total: summary.anonymousDonationTotal ?? 0,
      other_income_total: summary.otherIncomeTotal ?? 0,
      source_name: source.name,
      source_url: source.url,
      is_public: true,
      updated_at: startedAt,
    };
  });

  await upsertOrThrow(env, 'party_finance_summaries', financeRows, { onConflict: 'party_id,report_year' });

  if (args.recordRun) {
    await upsertOrThrow(
      env,
      'data_sync_runs',
      [
        {
          sync_name: 'real-public-data-foundation',
          mode: args.write ? 'write' : 'dry-run',
          status: 'ok',
          source_hash: hash,
          source_count:
            seed.regions.length +
            seed.elections.length +
            seed.races.length +
            (seed.people?.length ?? 0) +
            (seed.candidates?.length ?? 0) +
            seed.parties.length +
            financeRows.length,
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          report_json: buildReport(seed, hash, args, args.livePartyRegistry, args.liveCurrentOfficeholders),
        },
      ],
    );
  }
}

function buildReport(seed, hash, args, livePartyRegistry, liveCurrentOfficeholders) {
  return {
    syncName: 'real-public-data-foundation',
    mode: args.write ? 'write' : 'dry-run',
    cadence: args.mode,
    sourceHash: hash,
    counts: {
      sources: seed.sources.length,
      regions: seed.regions.length,
      elections: seed.elections.length,
      races: seed.races.length,
      people: seed.people?.length ?? 0,
      candidates: seed.candidates?.length ?? 0,
      parties: seed.parties.length,
      partyFinanceSummaries: seed.partyFinanceSummaries?.length ?? 0,
      partyCompanyContributionSummaries: seed.partyCompanyContributionSummaries?.length ?? 0,
    },
    livePartyRegistry,
    liveCurrentOfficeholders,
    skipped: {
      personalDonationDetails: true,
      companyContributionSummaries: 'requires later review flow before publication',
    },
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const { seed: baseSeed } = readSeed(args.seedPath);
  const partyEnriched = await enrichSeedWithLivePartyRegistry(baseSeed, args);
  const officeholderEnriched = await enrichSeedWithLiveCurrentOfficeholders(partyEnriched.seed, args);
  const seed = officeholderEnriched.seed;
  const hash = crypto.createHash('sha256').update(JSON.stringify(seed)).digest('hex');
  validateSeed(seed);

  const report = buildReport(seed, hash, args, partyEnriched.livePartyRegistry, officeholderEnriched.liveCurrentOfficeholders);
  args.livePartyRegistry = partyEnriched.livePartyRegistry;
  args.liveCurrentOfficeholders = officeholderEnriched.liveCurrentOfficeholders;

  if (args.write) {
    await writeSeed(seed, hash, args);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`real public data sync failed: ${message}`);
  process.exit(1);
});
