import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sourceId = 'votetw-election-history';
const apiUrl = 'https://votetw.com/w/api.php';
const defaultOutputPath = path.resolve('data-sources/votetw-election-history.seed.json');
const defaultRawOutputDir = path.resolve('data-sources/raw/votetw-election-history');
const userAgent = 'public-office-watch/0.1 (VoteTW historical election importer; source-versioned)';

const knownVotingDates = new Map([
  [2016, '2016-01-16'],
  [2018, '2018-11-24'],
  [2020, '2020-01-11'],
  [2022, '2022-11-26'],
  [2024, '2024-01-13'],
]);

let lastRequestAt = 0;

function parseArgs(argv) {
  const args = {
    outputPath: defaultOutputPath,
    rawOutputDir: defaultRawOutputDir,
    pageTitles: [],
    manifestPath: null,
    offset: 0,
    maxPages: 10,
    requestDelayMs: 1000,
    dryRun: false,
    skipFetchErrors: false,
    useRawCache: true,
    cacheOnly: false,
    verbose: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output') {
      args.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (arg === '--raw-output-dir') {
      args.rawOutputDir = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (arg === '--page-title') {
      args.pageTitles.push(argv[index + 1] ?? '');
      index += 1;
    } else if (arg === '--manifest') {
      args.manifestPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (arg === '--offset') {
      args.offset = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    } else if (arg === '--max-pages') {
      args.maxPages = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    } else if (arg === '--request-delay-ms') {
      args.requestDelayMs = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--skip-fetch-errors') {
      args.skipFetchErrors = true;
    } else if (arg === '--no-raw-cache') {
      args.useRawCache = false;
    } else if (arg === '--cache-only') {
      args.cacheOnly = true;
    } else if (arg === '--verbose') {
      args.verbose = true;
    } else {
      throw new Error(`Unsupported argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.offset) || args.offset < 0) throw new Error('--offset must be zero or a positive number.');
  if (!Number.isFinite(args.maxPages) || args.maxPages <= 0) throw new Error('--max-pages must be a positive number.');
  return args;
}

function loadPageTitles(args) {
  const titles = [...args.pageTitles.map((title) => title.trim()).filter(Boolean)];
  if (args.manifestPath) {
    const parsed = JSON.parse(fs.readFileSync(args.manifestPath, 'utf8'));
    const records = Array.isArray(parsed) ? parsed : parsed.pages ?? parsed.pageTitles ?? parsed.titles;
    if (!Array.isArray(records)) throw new Error('Manifest must be an array or contain pages/pageTitles/titles.');
    for (const record of records) {
      const title = typeof record === 'string' ? record : record.title ?? record.pageTitle;
      if (title) titles.push(String(title).trim());
    }
  }

  const unique = Array.from(new Set(titles));
  if (unique.length === 0) {
    throw new Error('Provide --page-title or --manifest.');
  }

  return unique.slice(args.offset, args.offset + args.maxPages);
}

function hashId(value, length = 12) {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, length);
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .replace(/[臺]/g, '台')
    .replace(/[‧·．・･•]/g, '')
    .replace(/[\s\u00A0\u3000]+/g, '');
}

function slugFor(value) {
  return hashId(normalizeName(value), 10);
}

function stripWiki(value) {
  return String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<small>|<\/small>/gi, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/\{\{[^{}]+\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function cleanValue(value) {
  const text = stripWiki(value).replace(/\s+/g, ' ').trim();
  if (!text || text === '-' || text === 'unknown') return null;
  return text;
}

function cleanNumber(value) {
  const text = String(value ?? '').replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  if (!text) return null;
  const number = Number.parseInt(text, 10);
  return Number.isFinite(number) ? number : null;
}

function cleanRate(value) {
  const text = String(value ?? '').replace('%', '').trim();
  const number = Number.parseFloat(text);
  return Number.isFinite(number) ? number : null;
}

function normalizePartyName(value) {
  const party = cleanValue(value);
  if (!party || party === '無') return '無黨籍';
  return party;
}

function genderFromName() {
  return 'unknown';
}

function parseElectionMetadata(pageTitle) {
  const match = pageTitle.match(/^(\d{4})年(.+?選舉).*投票結果$/);
  if (!match) {
    throw new Error(`Unsupported VoteTW election page title: ${pageTitle}`);
  }

  const year = Number.parseInt(match[1], 10);
  const name = `${year}年${match[2]}`;
  return {
    year,
    name,
    electionType: inferElectionType(match[2]),
    votingDate: knownVotingDates.get(year) ?? null,
    electionExternalId: `votetw-election-${year}-${slugFor(match[2])}`,
  };
}

function inferElectionType(name) {
  if (name.includes('總統')) return 'president';
  if (name.includes('立法委員')) return 'legislator';
  if (name.includes('村里長') || name.includes('村長') || name.includes('里長')) return 'village_chief';
  if (name.includes('代表')) return 'township_representative';
  if (name.includes('議員')) return 'councilor';
  if (name.includes('鄉鎮市長') || name.includes('縣長') || name.includes('鄉長') || name.includes('鎮長') || name.includes('市長') || name.includes('區長')) return 'local_chief';
  return 'other';
}

function isSubcountyChiefTitle(raceTitle) {
  return /(鄉長|鎮長|區長)選舉$/.test(raceTitle) || /縣.+市市長選舉$/.test(raceTitle);
}

function inferRaceType(electionType, raceTitle) {
  if (electionType === 'president') return 'president';
  if (electionType === 'legislator') {
    if (raceTitle.includes('不分區')) return 'party_list';
    if (raceTitle.includes('原住民')) return 'indigenous';
    return 'legislative_district';
  }
  if (electionType === 'village_chief') return 'village_chief';
  if (electionType === 'township_representative') return 'township_representative_district';
  if (electionType === 'councilor') return 'councilor_district';
  if (electionType === 'local_chief') return isSubcountyChiefTitle(raceTitle) ? 'township_mayor' : 'local_chief';
  return 'other';
}

function inferPosition(electionType, record = null) {
  if (electionType === 'president') return record?.ticketRole === 'vice_president' ? '副總統候選人' : '總統候選人';
  if (electionType === 'legislator') return '立法委員候選人';
  if (electionType === 'village_chief') return '村里長候選人';
  if (electionType === 'township_representative') return '鄉鎮市民代表候選人';
  if (electionType === 'councilor') return '議員候選人';
  if (record?.race?.raceType === 'township_mayor') return '鄉鎮市區長候選人';
  if (electionType === 'local_chief') return '地方首長候選人';
  return '候選人';
}

async function throttle(delayMs) {
  const waitMs = Math.max(0, delayMs - (Date.now() - lastRequestAt));
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();
}

async function requestJson(url, args) {
  const text = await requestWithRetry(url, args, { accept: 'application/json', label: 'VoteTW API request' });
  return JSON.parse(text);
}

async function requestText(url, args) {
  return requestWithRetry(url, args, { accept: 'text/plain', label: 'VoteTW raw request' });
}

async function requestWithRetry(url, args, { accept, label }) {
  const maxAttempts = 5;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await throttle(args.requestDelayMs);
      const response = await fetch(url, {
        headers: { 'user-agent': userAgent, accept },
        signal: AbortSignal.timeout(60000),
      });
      const text = await response.text();
      if (response.ok) return text;
      lastError = new Error(`${label} failed: ${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, args.requestDelayMs * attempt));
    }
  }

  throw lastError;
}

function revisionContent(revision) {
  return revision?.slots?.main?.['*'] ?? revision?.slots?.main?.content ?? revision?.['*'] ?? revision?.content ?? null;
}

async function fetchVoteTwPage(title, args) {
  const infoUrl = new URL(apiUrl);
  infoUrl.searchParams.set('action', 'query');
  infoUrl.searchParams.set('format', 'json');
  infoUrl.searchParams.set('prop', 'info|revisions');
  infoUrl.searchParams.set('rvprop', 'ids|timestamp|content');
  infoUrl.searchParams.set('rvslots', 'main');
  infoUrl.searchParams.set('titles', title);
  const infoJson = await requestJson(infoUrl, args);
  const page = Object.values(infoJson.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined) return null;

  const revision = page.revisions?.[0];
  let raw = revisionContent(revision);
  const rawUrl = new URL('https://votetw.com/w/index.php');
  rawUrl.searchParams.set('title', title);
  rawUrl.searchParams.set('action', 'raw');
  if (!raw) raw = await requestText(rawUrl, args);
  return {
    title: page.title,
    pageid: page.pageid,
    lastrevid: page.lastrevid,
    revisionTimestamp: revision?.timestamp ?? null,
    url: `https://votetw.com/wiki/${encodeURIComponent(page.title)}`,
    rawUrl: rawUrl.toString(),
    raw,
  };
}

function safeRawTitle(title) {
  return title.replace(/[^\p{L}\p{N}_-]+/gu, '_');
}

function readCachedRawPage(title, args) {
  if (!args.useRawCache || !fs.existsSync(args.rawOutputDir)) return null;

  const safeTitle = safeRawTitle(title);
  const files = fs.readdirSync(args.rawOutputDir)
    .filter((fileName) => fileName.startsWith(`${safeTitle}-`) && fileName.endsWith('.wiki'))
    .sort((a, b) => b.localeCompare(a));
  const fileName = files[0];
  if (!fileName) return null;

  const suffix = fileName.slice(safeTitle.length + 1, -'.wiki'.length);
  const parts = suffix.split('-');
  const lastrevid = Number.parseInt(parts.at(-1) ?? '', 10);
  const pageid = Number.parseInt(parts.at(-2) ?? '', 10);
  const rawPath = path.join(args.rawOutputDir, fileName);

  return {
    title,
    pageid: Number.isFinite(pageid) ? pageid : null,
    lastrevid: Number.isFinite(lastrevid) ? lastrevid : null,
    revisionTimestamp: null,
    url: `https://votetw.com/wiki/${encodeURIComponent(title)}`,
    rawUrl: `https://votetw.com/w/index.php?title=${encodeURIComponent(title)}&action=raw`,
    raw: fs.readFileSync(rawPath, 'utf8'),
    rawPath,
  };
}

function parseLinkTitle(line) {
  const match = line.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  if (!match) return null;
  return {
    target: match[1],
    label: match[2] ?? match[1],
  };
}

function parseTableHeaders(line) {
  if (!line.startsWith('!') || !line.includes('號次') || !line.includes('候選人')) return null;
  return line.slice(1).split('!!').map((cell) => cleanValue(cell));
}

function valueAfterAttributes(value) {
  const text = String(value ?? '').replace(/^\|/, '').trim();
  const parts = text.split('|');
  return parts.at(-1) ?? text;
}

function parseCandidateNumberCell(value) {
  const text = valueAfterAttributes(stripWiki(value)).trim();
  return /^\d+$/.test(text) ? Number.parseInt(text, 10) : null;
}

function parseCandidateStart(line, headers = []) {
  const cells = line.slice(1).split('||');
  if (cells.length < 3) return null;
  const candidateNoIndex = headers.indexOf('號次');
  const nameIndex = headers.indexOf('候選人');
  const partyIndex = headers.indexOf('政黨');
  const incumbentIndex = headers.indexOf('現任');
  const candidateNo = parseCandidateNumberCell(cells[candidateNoIndex >= 0 ? candidateNoIndex : 0]);
  const nameCell = cells[nameIndex >= 0 ? nameIndex : 1];
  const nameLink = parseLinkTitle(nameCell);
  const name = cleanValue(nameLink?.label ?? nameCell);
  if (!candidateNo || !name) return null;
  return {
    candidateNo,
    name,
    personPageTitle: nameLink?.target ?? name,
    incumbent: /'''/.test(nameCell) || cleanValue(cells[incumbentIndex]) === '是',
    party: normalizePartyName(cells[partyIndex >= 0 ? partyIndex : 2]),
  };
}

function parseVoteLine(line) {
  return cleanNumber(valueAfterAttributes(line));
}

function parseRateElectedLine(line) {
  const text = String(line ?? '').replace(/^\|/, '');
  const [rateCell = '', ...statusCells] = text.split('||');
  return {
    voteRate: cleanRate(valueAfterAttributes(rateCell)),
    incumbent: statusCells.some((cell) => cleanValue(cell) === '是'),
    elected: statusCells.some((cell) => /9989|✅|當選/.test(cell)),
  };
}

function compactRaceTitle(label, currentSection, metadata, qualifier) {
  const shouldKeepQualifier = qualifier && qualifier !== '區域';
  if (currentSection) return shouldKeepQualifier && !currentSection.includes(qualifier) ? `${currentSection}（${qualifier}）` : currentSection;
  const title = cleanValue(String(label ?? '')
    .replace(new RegExp('^' + metadata.name), '')
    .replace(/^\d{4}年/, '')
    .replace(/投票結果$/, ''));
  return shouldKeepQualifier && title && !title.includes(qualifier) ? `${title}（${qualifier}）` : title;
}

function fullRaceTitle(pageTitle, compactTitle, metadata) {
  if (!compactTitle) return compactTitle;

  if (metadata.electionType === 'village_chief' && pageTitle.startsWith(metadata.name)) {
    const area = pageTitle.slice(metadata.name.length).replace(/投票結果$/, '');
    if (!area) return compactTitle;
    const office = compactTitle.endsWith('村')
      ? '村長選舉'
      : compactTitle.endsWith('里') ? '里長選舉' : '村里長選舉';
    return `${area}${compactTitle}${office}`;
  }

  const electionTitle = metadata.name.replace(/^\d{4}年/, '');
  if (metadata.electionType === 'township_representative') {
    const office = electionTitle.match(/(鄉民代表|鎮民代表|市民代表|區民代表)選舉$/)?.[1];
    if (!office) return compactTitle;
    const area = electionTitle.replace(/(鄉民代表|鎮民代表|市民代表|區民代表)選舉$/, '');
    const localArea = area.match(/([^縣市]+[鄉鎮市區])$/)?.[1] ?? '';
    const district = localArea && compactTitle.startsWith(localArea)
      ? compactTitle.slice(localArea.length)
      : compactTitle;
    return `${area}${district}${office}選舉`;
  }

  if (metadata.electionType === 'local_chief') return electionTitle;
  return compactTitle;
}

function shouldParseVoteDetailTable(pageTitle, metadata, currentSection, qualifier) {
  if (metadata.electionType === 'legislator' && qualifier && qualifier !== '區域' && currentSection !== '全國') return false;
  if (/^\d{4}年立法委員選舉投票結果$/.test(pageTitle)) return true;
  if (/^\d{4}年縣市長選舉投票結果$/.test(pageTitle)) return true;
  if (/^\d{4}年.+議員選舉投票結果$/.test(pageTitle)) return true;
  if (/^\d{4}年村里長選舉.+[鄉鎮市區]投票結果$/.test(pageTitle)) return true;
  if (/^\d{4}年.+[鄉鎮市區](鄉民代表|鎮民代表|市民代表|區民代表)選舉投票結果$/.test(pageTitle)) return true;
  return false;
}

function parsePresidentialTicketMate(line, headers, ticket) {
  if (!line.startsWith('|') || !line.includes('||')) return null;
  const cells = line.slice(1).split('||');
  const nameCell = cells[0];
  const nameLink = parseLinkTitle(nameCell);
  const name = cleanValue(nameLink?.label ?? nameCell);
  const partyIndex = Math.max(0, headers.indexOf('政黨') - 1);
  if (!name) return null;
  return {
    candidateNo: ticket.candidateNo,
    name,
    personPageTitle: nameLink?.target ?? name,
    incumbent: /'''/.test(nameCell),
    party: normalizePartyName(cells[partyIndex]),
    ticketRole: 'vice_president',
  };
}

function parsePresidentialTicket(lines, index, headers) {
  const president = parseCandidateStart(lines[index].trim(), headers);
  if (!president) return null;

  const votes = parseVoteLine(lines[index + 1] ?? '');
  const rate = parseRateElectedLine(lines[index + 2] ?? '');
  const elected = rate.elected || /9989|✅|當選/.test(lines[index + 3] ?? '');
  const ticket = {
    votes,
    voteRate: rate.voteRate,
    elected,
    incumbent: rate.incumbent,
  };
  const records = [{
    ...president,
    ...ticket,
    incumbent: president.incumbent || ticket.incumbent,
    ticketRole: 'president',
  }];

  let nextIndex = index;
  for (let offset = 4; offset <= 7; offset += 1) {
    const mateLine = lines[index + offset]?.trim();
    const mate = mateLine ? parsePresidentialTicketMate(mateLine, headers, president) : null;
    if (mate) {
      records.push({
        ...mate,
        ...ticket,
        incumbent: mate.incumbent || ticket.incumbent,
      });
      nextIndex = index + offset;
      break;
    }
  }

  return { records, nextIndex };
}

function parseElectionPage(page) {
  const metadata = parseElectionMetadata(page.title);
  const candidates = [];
  const lines = page.raw.split('\n');
  let currentSection = null;
  let currentRace = null;
  let currentTableHeaders = [];
  let inVoteDetailSection = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const headingMatch = line.match(/^(=+)\s*(.+?)\s*=+$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const heading = cleanValue(headingMatch[2]);
      if (level === 2) {
        inVoteDetailSection = heading.includes('投票明細');
        currentRace = null;
        currentTableHeaders = [];
      }
      if (level >= 3) currentSection = heading;
      continue;
    }

    if (inVoteDetailSection && !shouldParseVoteDetailTable(page.title, metadata, currentSection, line.match(/（([^）]+)）/)?.[1] ?? null)) continue;

    if (line.includes('!colspan') && line.includes('投票結果')) {
      const link = parseLinkTitle(line);
      const qualifier = line.match(/（([^）]+)）/)?.[1] ?? null;
      const compactTitle = compactRaceTitle(link?.label ?? page.title, currentSection, metadata, qualifier);
      const raceTitle = fullRaceTitle(page.title, compactTitle, metadata);
      const regionExternalId = `votetw-region-${slugFor(raceTitle)}`;
      const raceExternalId = `votetw-race-${metadata.year}-${slugFor(`${link?.target ?? compactTitle}|${compactTitle}|${qualifier ?? ''}`)}`;
      currentRace = {
        externalId: raceExternalId,
        title: raceTitle,
        sourcePageTitle: link?.target ?? null,
        qualifier,
        regionExternalId,
        raceType: inferRaceType(metadata.electionType, raceTitle),
      };
      currentTableHeaders = [];
      continue;
    }

    const tableHeaders = parseTableHeaders(line);
    if (tableHeaders) {
      currentTableHeaders = tableHeaders;
      continue;
    }

    if (!currentRace || !line.startsWith('|') || !line.includes('||')) continue;
    if (metadata.electionType === 'president' && currentSection !== '全國') continue;
    if (metadata.electionType === 'president') {
      const ticket = parsePresidentialTicket(lines, index, currentTableHeaders);
      if (!ticket) continue;
      for (const record of ticket.records) {
        candidates.push({
          ...record,
          race: currentRace,
          election: metadata,
        });
      }
      index = ticket.nextIndex;
      continue;
    }
    const start = parseCandidateStart(line, currentTableHeaders);
    if (!start) continue;

    const votes = parseVoteLine(lines[index + 1] ?? '');
    const rate = parseRateElectedLine(lines[index + 2] ?? '');
    candidates.push({
      ...start,
      votes,
      voteRate: rate.voteRate,
      elected: rate.elected,
      incumbent: start.incumbent || rate.incumbent,
      race: currentRace,
      election: metadata,
    });
  }

  return { metadata, candidates };
}

function partyRecord(name) {
  const normalized = normalizePartyName(name);
  const slug = normalized === '無黨籍' ? 'independent' : slugFor(normalized);
  return {
    externalId: `votetw-party-${slug}`,
    sourceId,
    name: normalized,
    shortName: normalized,
    slug,
    themeKey: normalized === '無黨籍' ? 'independent' : 'other',
    officialSiteUrl: null,
    status: 'active',
  };
}

function buildSeed(pages, parsedPages) {
  const sources = [{ id: sourceId, name: 'VoteTW historical election results', url: 'https://votetw.com/', licenseNote: 'Public VoteTW wiki pages fetched with pageid/revision metadata and raw source archival.' }];
  const regions = new Map();
  const elections = new Map();
  const races = new Map();
  const people = new Map();
  const sourcePeople = new Map();
  const candidates = new Map();
  const parties = new Map();

  for (const { page, parsed } of parsedPages) {
    const election = parsed.metadata;
    elections.set(election.electionExternalId, {
      externalId: election.electionExternalId,
      sourceId,
      name: election.name,
      year: election.year,
      electionType: election.electionType,
      votingDate: election.votingDate,
      status: 'completed',
    });

    for (const record of parsed.candidates) {
      const race = record.race;
      const regionExternalId = race.regionExternalId;
      regions.set(regionExternalId, {
        externalId: regionExternalId,
        sourceId,
        name: race.title,
        slug: `votetw-${slugFor(race.title)}`,
        regionType: race.raceType,
        sourcePayload: {
          voteTwPageTitle: race.sourcePageTitle,
          qualifier: race.qualifier,
        },
      });

      races.set(race.externalId, {
        externalId: race.externalId,
        sourceId,
        electionExternalId: election.electionExternalId,
        regionExternalId,
        raceType: race.raceType,
        title: race.title,
        votingDate: election.votingDate,
        status: 'completed',
      });

      parties.set(partyRecord(record.party).externalId, partyRecord(record.party));

      const personExternalId = `votetw-person-${hashId(`${record.personPageTitle}|${record.name}|${race.externalId}|${record.candidateNo}`, 16)}`;
      const sourcePersonKey = `${sourceId}:${personExternalId}`;
      const sourceUrl = `https://votetw.com/wiki/${encodeURIComponent(record.personPageTitle)}`;
      const position = inferPosition(election.electionType, record);
      people.set(personExternalId, {
        externalId: personExternalId,
        sourceId,
        name: record.name,
        gender: genderFromName(record.name),
        party: record.party,
        position,
        district: race.title,
        electionYear: election.year,
        sourceUrl,
        sourcePayload: {
          voteTwPersonPageTitle: record.personPageTitle,
          voteTwElectionPageTitle: page.title,
          sourcePersonKey,
          identityPolicy: 'candidate-scoped external id; do not merge same-name candidates without later identity matching',
        },
      });

      sourcePeople.set(sourcePersonKey, {
        sourcePersonKey,
        sourceId,
        sourceName: 'VoteTW historical election results',
        sourceUrl,
        rawName: record.name,
        gender: genderFromName(record.name),
        party: record.party,
        position,
        district: race.title,
        electionYear: election.year,
        externalPersonId: personExternalId,
        externalRecordId: `${race.externalId}:${record.candidateNo}`,
        sourcePayload: {
          voteTwPersonPageTitle: record.personPageTitle,
          voteTwElectionPageTitle: page.title,
          raceExternalId: race.externalId,
          candidateNo: record.candidateNo,
          votes: record.votes,
          voteRate: record.voteRate,
          elected: record.elected,
          incumbent: record.incumbent,
          ticketRole: record.ticketRole ?? null,
        },
        confidenceSuggestion: 'B',
        isPublic: true,
      });

      const candidateExternalId = `votetw-candidate-${hashId(`${race.externalId}|${record.candidateNo}|${record.name}`, 16)}`;
      candidates.set(candidateExternalId, {
        externalId: candidateExternalId,
        sourceId,
        personExternalId,
        raceExternalId: race.externalId,
        party: record.party,
        candidateNo: record.candidateNo,
        registrationStatus: record.elected ? 'elected' : 'not_elected',
        voteCount: record.votes,
        voteRate: record.voteRate,
        isElected: record.elected,
        isIncumbent: record.incumbent,
        sourceUrl: page.url,
        sourcePayload: {
          votes: record.votes,
          voteRate: record.voteRate,
          elected: record.elected,
          incumbent: record.incumbent,
          voteTwPersonPageTitle: record.personPageTitle,
          voteTwElectionPageTitle: page.title,
          voteTwPageid: page.pageid,
          voteTwLastrevid: page.lastrevid,
          ticketRole: record.ticketRole ?? null,
        },
      });
    }
  }

  return {
    schemaVersion: 1,
    name: 'votetw-election-history',
    sourceId,
    generatedAt: new Date().toISOString(),
    summary: {
      pageCount: pages.length,
      electionCount: elections.size,
      raceCount: races.size,
      candidateCount: candidates.size,
      sourcePersonCount: sourcePeople.size,
      newPersonCount: people.size,
      partyCount: parties.size,
    },
    sources,
    regions: Array.from(regions.values()),
    elections: Array.from(elections.values()),
    races: Array.from(races.values()),
    parties: Array.from(parties.values()),
    people: Array.from(people.values()),
    sourcePeople: Array.from(sourcePeople.values()),
    candidates: Array.from(candidates.values()),
    rawSources: pages.map((page) => ({
      title: page.title,
      pageid: page.pageid,
      lastrevid: page.lastrevid,
      revisionTimestamp: page.revisionTimestamp,
      sourceUrl: page.url,
      rawUrl: page.rawUrl,
      rawPath: page.rawPath,
      sha256: crypto.createHash('sha256').update(page.raw).digest('hex'),
      bytes: Buffer.byteLength(page.raw),
    })),
  };
}

async function writeRawPage(page, args) {
  fs.mkdirSync(args.rawOutputDir, { recursive: true });
  const safeTitle = safeRawTitle(page.title);
  const rawPath = path.join(args.rawOutputDir, `${safeTitle}-${page.pageid}-${page.lastrevid}.wiki`);
  fs.writeFileSync(rawPath, page.raw);
  return rawPath;
}

async function main() {
  const args = parseArgs(process.argv);
  const titles = loadPageTitles(args);
  const pages = [];
  const parsedPages = [];
  const skippedPages = [];

  for (const [titleIndex, title] of titles.entries()) {
    let page = readCachedRawPage(title, args);
    if (args.verbose) {
      console.error(`[${titleIndex + 1}/${titles.length}] ${page ? 'cached' : 'fetch'} ${title}`);
    }
    if (!page && args.cacheOnly) {
      const message = `Missing cached VoteTW raw page: ${title}`;
      console.warn(message);
      skippedPages.push({ title, error: 'missing raw cache' });
      continue;
    }
    try {
      if (!page) page = await fetchVoteTwPage(title, args);
    } catch (error) {
      if (args.skipFetchErrors) {
        const message = `Failed to fetch VoteTW page ${title}: ${error.message}`;
        console.warn(message);
        skippedPages.push({ title, error: error.message });
        continue;
      }
      throw new Error(`Failed to fetch VoteTW page ${title}: ${error.message}`, { cause: error });
    }
    if (!page) {
      console.warn(`VoteTW page not found: ${title}`);
      continue;
    }
    page.rawPath = args.dryRun ? null : page.rawPath ?? await writeRawPage(page, args);
    const parsed = parseElectionPage(page);
    pages.push(page);
    parsedPages.push({ page, parsed });
  }

  const seed = buildSeed(pages, parsedPages);
  seed.summary.fetchErrorCount = skippedPages.length;
  seed.skippedPages = skippedPages;
  if (!args.dryRun) {
    fs.mkdirSync(path.dirname(args.outputPath), { recursive: true });
    fs.writeFileSync(args.outputPath, `${JSON.stringify(seed, null, 2)}\n`);
  }

  console.log(JSON.stringify(seed.summary, null, 2));
  if (!args.dryRun) {
    console.log(`Wrote ${args.outputPath}`);
    console.log(`Wrote raw pages under ${args.rawOutputDir}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
