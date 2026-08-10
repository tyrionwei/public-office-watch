import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const sourceId = 'votetw-person-enrichment';
const apiUrl = 'https://votetw.com/w/api.php';
const defaultOutputPath = path.resolve('data-sources/votetw-person-enrichment-claims.seed.json');
const defaultRawOutputDir = path.resolve('data-sources/raw/votetw');
const userAgent = 'public-office-watch/0.1 (VoteTW public person enrichment; source-versioned)';

let lastRequestAt = 0;

function parseArgs(argv) {
  const args = {
    outputPath: defaultOutputPath,
    rawOutputDir: defaultRawOutputDir,
    targetNames: [],
    targetNamesPath: null,
    targetNamesFromSupabase: false,
    offset: 0,
    maxPeople: 25,
    requestDelayMs: 1000,
    includeLegalPublic: true,
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
    } else if (arg === '--target-name') {
      args.targetNames.push(argv[index + 1] ?? '');
      index += 1;
    } else if (arg === '--target-names') {
      args.targetNamesPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (arg === '--target-names-from-supabase') {
      args.targetNamesFromSupabase = true;
    } else if (arg === '--offset') {
      args.offset = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    } else if (arg === '--max-people') {
      args.maxPeople = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    } else if (arg === '--request-delay-ms') {
      args.requestDelayMs = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
    } else if (arg === '--no-legal-public') {
      args.includeLegalPublic = false;
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
  if (!Number.isFinite(args.maxPeople) || args.maxPeople <= 0) throw new Error('--max-people must be a positive number.');
  return args;
}

function readLocalEnv() {
  const parsed = {};
  for (const filePath of ['.env.local', '.env']) {
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [key, ...valueParts] = trimmed.split('=');
      parsed[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
  return parsed;
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .replace(/[臺]/g, '台')
    .replace(/[‧·．・･•]/g, '')
    .replace(/[\s\u00A0\u3000]+/g, '');
}

function hashId(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function normalizeDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  const chineseMatch = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (chineseMatch) return `${chineseMatch[1]}-${chineseMatch[2].padStart(2, '0')}-${chineseMatch[3].padStart(2, '0')}`;
  const bdMatch = text.match(/\{\{bd\|(\d{4})年\|(\d{1,2})月\|(\d{1,2})日\}\}/);
  if (bdMatch) return `${bdMatch[1]}-${bdMatch[2].padStart(2, '0')}-${bdMatch[3].padStart(2, '0')}`;
  return null;
}

function normalizeGender(value) {
  const text = String(value ?? '').trim();
  if (text === '男' || text.includes('男性')) return 'male';
  if (text === '女' || text.includes('女性')) return 'female';
  return null;
}

function targetFromRecord(record) {
  if (typeof record === 'string') {
    const name = record.trim();
    return name ? { name } : null;
  }
  if (!record || typeof record !== 'object') return null;
  const name = String(record.name ?? record.raw ?? record.personName ?? record.person_name ?? '').trim();
  if (!name) return null;
  return {
    personId: record.personId ?? record.person_id ?? null,
    name,
    pageTitle: record.pageTitle ?? record.page_title ?? record.voteTwPersonPageTitle ?? record.vote_tw_person_page_title ?? name,
    birthDate: normalizeDate(record.birthDate ?? record.birth_date ?? record.birth_date_claim),
    gender: record.gender ?? 'unknown',
    party: record.party ?? '',
    position: record.position ?? '',
    district: record.district ?? '',
    electionYear: record.electionYear ?? record.election_year ?? null,
    sourceElectionSeedPersonExternalId: record.sourceElectionSeedPersonExternalId ?? record.source_election_seed_person_external_id ?? null,
    education: record.education ?? '',
    experience: record.experience ?? '',
  };
}

function loadTargetsFromFile(filePath) {
  if (!filePath) return [];
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const records = Array.isArray(parsed) ? parsed : parsed.targets ?? parsed.people ?? parsed.names ?? parsed.records ?? parsed.skippedTargets;
  if (!Array.isArray(records)) throw new Error('Target names file must be a JSON array or an object with targets/people/names/records.');
  return records.map(targetFromRecord).filter(Boolean);
}

async function loadTargetsFromSupabase() {
  const localEnv = readLocalEnv();
  const supabaseUrl = (process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim() || localEnv.SUPABASE_URL || localEnv.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || localEnv.SUPABASE_ANON_KEY || localEnv.VITE_SUPABASE_ANON_KEY || localEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !key) throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY to load public_people targets.');

  const people = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const url = new URL(`${supabaseUrl}/rest/v1/public_people_directory`);
    url.searchParams.set('select', 'person_id,name,gender,party,position,district,education,experience');
    url.searchParams.set('order', 'name.asc,person_id.asc');
    const response = await fetch(url, {
      headers: { apikey: key, authorization: `Bearer ${key}`, range: `${offset}-${offset + pageSize - 1}` },
      signal: AbortSignal.timeout(60000),
    });
    const rows = await response.json();
    if (!response.ok || !Array.isArray(rows)) throw new Error(`Failed to fetch public_people targets: ${rows?.message ?? response.statusText}`);
    people.push(...rows.map(targetFromRecord).filter(Boolean));
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  const birthDates = await loadPublicBirthDateClaims(supabaseUrl, key);
  return people.map((person) => ({ ...person, birthDate: person.birthDate || birthDates.get(person.personId) || null }));
}

async function loadPublicBirthDateClaims(supabaseUrl, key) {
  const birthDates = new Map();
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const url = new URL(`${supabaseUrl}/rest/v1/public_person_claims`);
    url.searchParams.set('select', 'person_id,claim_value,claim_json');
    url.searchParams.set('claim_type', 'eq.birth_date');
    url.searchParams.set('is_public', 'eq.true');
    url.searchParams.set('order', 'person_id.asc');
    const response = await fetch(url, {
      headers: { apikey: key, authorization: `Bearer ${key}`, range: `${offset}-${offset + pageSize - 1}` },
      signal: AbortSignal.timeout(60000),
    });
    const rows = await response.json();
    if (!response.ok || !Array.isArray(rows)) return birthDates;
    for (const row of rows) {
      const birthDate = normalizeDate(row.claim_value ?? row.claim_json?.birthDate);
      if (row.person_id && birthDate && !birthDates.has(row.person_id)) birthDates.set(row.person_id, birthDate);
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return birthDates;
}

async function loadTargets(args) {
  const targets = [
    ...args.targetNames.map((name) => targetFromRecord(name)).filter(Boolean),
    ...loadTargetsFromFile(args.targetNamesPath),
  ];
  if (args.targetNamesFromSupabase) targets.push(...await loadTargetsFromSupabase());

  const byKey = new Map();
  for (const target of targets) {
    const key = `${target.personId ?? target.pageTitle ?? 'name'}:${normalizeName(target.name)}`;
    if (!byKey.has(key)) byKey.set(key, target);
  }
  return Array.from(byKey.values()).slice(args.offset, args.offset + args.maxPeople);
}

function stripWiki(value) {
  return String(value ?? '')
    .replace(/\{\{bd\|(\d{4})年\|(\d{1,2})月\|(\d{1,2})日\}\}/g, '$1年$2月$3日')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<small>|<\/small>/gi, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/\{\{[^{}]+\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function cleanValue(value) {
  const text = stripWiki(value).replace(/\s+/g, ' ').trim();
  if (!text || text === 'unknown' || text === '-') return null;
  return text;
}

function uniqueCompact(values) {
  return Array.from(new Set(values.map(cleanValue).filter(Boolean)));
}

function uniqueByJson(values) {
  const seen = new Set();
  const unique = [];
  for (const value of values) {
    const key = JSON.stringify(value);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(value);
  }
  return unique;
}

function cleanMultilineValue(value) {
  return stripWiki(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function summarizeText(value, maxLength = 280) {
  const text = cleanMultilineValue(value).replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function splitList(value) {
  return Array.from(new Set(stripWiki(value).split(/\n|[；;]/).map((item) => item.replace(/^[-*#]\s*/, '').trim()).filter(Boolean)));
}

async function throttle(delayMs) {
  const waitMs = Math.max(0, delayMs - (Date.now() - lastRequestAt));
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();
}

async function requestJson(url, args) {
  await throttle(args.requestDelayMs);
  const response = await fetch(url, { headers: { 'user-agent': userAgent, accept: 'application/json' }, signal: AbortSignal.timeout(60000) });
  const json = await response.json();
  if (!response.ok) throw new Error(`VoteTW API request failed: ${json?.error?.info ?? response.statusText}`);
  return json;
}

async function requestText(url, args) {
  await throttle(args.requestDelayMs);
  const response = await fetch(url, { headers: { 'user-agent': userAgent, accept: 'text/plain' }, signal: AbortSignal.timeout(60000) });
  const text = await response.text();
  if (!response.ok) throw new Error(`VoteTW raw request failed: ${response.statusText}`);
  return text;
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

function normalizeTemplateTitle(title) {
  const cleaned = cleanValue(title);
  if (!cleaned) return null;
  if (/^(選舉公報|[0-9]{4}年.*公報)$/.test(cleaned)) return null;
  if (!cleaned.includes('政見')) return null;
  if (/^(Template|模板):/.test(cleaned)) return cleaned;
  return `Template:${cleaned}`;
}

function extractPlatformTemplateTitles(raw) {
  const titles = [];
  const pattern = /\{\{([^{}\n]*政見[^{}\n]*)\}\}/g;
  let match = pattern.exec(raw);
  while (match) {
    const title = normalizeTemplateTitle(match[1]);
    if (title) titles.push(title);
    match = pattern.exec(raw);
  }
  return Array.from(new Set(titles));
}

function extractInlinePlatformRecords(raw) {
  const lines = raw.split('\n');
  const records = [];
  for (let index = 0; index < lines.length; index += 1) {
    const stripped = stripWiki(lines[index]).trim();
    if (!/^政見(?:\s|[:：①(（]|$)/.test(stripped)) continue;

    const parts = [lines[index]];
    for (let next = index + 1; next < lines.length; next += 1) {
      const line = lines[next];
      if (/^==+\s*.+?\s*==+$/.test(line.trim())) break;
      parts.push(line);
    }

    const platformText = cleanMultilineValue(parts.join('\n'));
    if (platformText.length < 20) continue;
    records.push({
      sourceKind: 'inline',
      platformText,
      summary: summarizeText(platformText),
    });
  }
  return uniqueByJson(records);
}

async function collectPlatformRecords(page, args, templatePagesByTitle, rawSources) {
  const records = [...extractInlinePlatformRecords(page.raw)];
  for (const templateTitle of extractPlatformTemplateTitles(page.raw)) {
    let templatePage = templatePagesByTitle.get(templateTitle);
    if (templatePage === undefined) {
      try {
        templatePage = readCachedRawPage(templateTitle, args) ?? await fetchVoteTwPage(templateTitle, args);
      } catch (error) {
        if (!args.skipFetchErrors) throw error;
        templatePage = null;
      }
      templatePagesByTitle.set(templateTitle, templatePage);
      if (templatePage) {
        const rawPath = args.dryRun ? null : templatePage.rawPath ?? await writeRawPage(templatePage, args);
        rawSources.push(rawSourceRecord(templatePage, rawPath));
      }
    }
    if (!templatePage) continue;
    const platformText = cleanMultilineValue(templatePage.raw);
    if (platformText.length < 20) continue;
    records.push({
      sourceKind: 'template',
      templateTitle: templatePage.title,
      templatePageid: templatePage.pageid,
      templateLastrevid: templatePage.lastrevid,
      templateRevisionTimestamp: templatePage.revisionTimestamp,
      templateSourceUrl: templatePage.url,
      platformText,
      summary: summarizeText(platformText),
    });
  }
  return uniqueByJson(records);
}

function parseVoteTwProfiles(page) {
  const profiles = new Map();
  const addProfile = (partial) => {
    const name = String(partial.name ?? '').trim();
    if (!name) return null;
    const birthDate = normalizeDate(partial.birthDate);
    const key = `${normalizeName(name)}:${birthDate ?? `no-birth-${profiles.size}`}`;
    const current = profiles.get(key) ?? {
      key,
      name,
      normalizedName: normalizeName(name),
      birthDate,
      gender: null,
      party: null,
      education: null,
      experiences: [],
      electionRecords: [],
      legalRecords: [],
    };
    current.birthDate = current.birthDate ?? birthDate;
    current.gender = current.gender ?? normalizeGender(partial.gender);
    current.party = current.party ?? cleanValue(partial.party);
    current.education = current.education ?? cleanValue(partial.education);
    current.experiences = uniqueCompact([...current.experiences, ...(partial.experiences ?? [])]);
    current.electionRecords = uniqueByJson([...current.electionRecords, ...(partial.electionRecords ?? [])]);
    current.legalRecords = uniqueByJson([...current.legalRecords, ...(partial.legalRecords ?? [])]);
    profiles.set(key, current);
    return current;
  };

  for (const line of page.raw.split('\n')) {
    const introMatch = line.match(/'''([^']+)'''（([^）]+)），?([^。\n]*)/);
    if (!introMatch) continue;
    const introTail = stripWiki(introMatch[3]);
    addProfile({
      name: stripWiki(introMatch[1]),
      birthDate: introMatch[2],
      gender: introTail.match(/(?:^|，)(男|女)(?:，|$)/)?.[1],
      party: introTail.match(/([^，。]{2,12}(?:黨籍|無黨籍))/)?.[1]?.replace(/籍$/, ''),
      education: introTail.match(/([^，。]{2,12}學歷)/)?.[1],
    });
  }

  const infoboxExperience = extractTemplateField(page.raw, 'experience');
  if (infoboxExperience && profiles.size === 1) {
    const [profile] = profiles.values();
    addProfile({ name: profile.name, birthDate: profile.birthDate, experiences: splitList(infoboxExperience) });
  }

  for (const line of page.raw.split('\n')) {
    if (!line.startsWith('|') || !line.includes('||')) continue;
    const cells = line.slice(1).split('||').map((cell) => stripWiki(cell));
    if (cells.length < 6 || !cells[0].includes('選舉')) continue;
    const name = cleanValue(cells[1]);
    if (!name) continue;
    const birthDate = normalizeDate(cells[3]);
    const record = {
      election: cleanValue(cells[0]),
      name,
      gender: normalizeGender(cells[2]),
      birthDate,
      education: cleanValue(cells[4]),
      party: cleanValue(cells[5]),
      district: cleanValue(cells[6]),
      votes: cleanValue(cells[7]),
      voteRate: cleanValue(cells[8]),
      incumbent: cleanValue(cells[9]),
      elected: cleanValue(cells[10]),
    };
    addProfile({ name, birthDate, gender: cells[2], education: record.education, party: record.party, electionRecords: [record] });
  }

  const legalRecords = extractLegalRecords(page.raw);
  if (legalRecords.length > 0 && profiles.size === 1) {
    const [profile] = profiles.values();
    addProfile({ name: profile.name, birthDate: profile.birthDate, legalRecords });
  }
  return Array.from(profiles.values());
}

function extractTemplateField(raw, fieldName) {
  const lines = raw.split('\n');
  const fieldPrefix = new RegExp(`^\\|\\s*${fieldName}\\s*=\\s*(.*)$`, 'i');
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(fieldPrefix);
    if (!match) continue;
    const parts = [match[1]];
    for (let next = index + 1; next < lines.length; next += 1) {
      if (/^\|\s*[a-z_]+\s*=/i.test(lines[next]) || lines[next].trim() === '}}') break;
      parts.push(lines[next]);
    }
    return parts.join('\n');
  }
  return null;
}

function extractLegalRecords(raw) {
  const legalSectionTitles = /司法|犯罪|刑事|案件|判決|起訴|貪污|賄選|爭議|訴訟/;
  const legalSentence = /判刑|判決|起訴|不起訴|無罪|有罪|貪污|賄選|偽造|羈押|緩刑|罰金|法院|檢察署|檢方|涉案/;
  const records = [];
  const sections = raw.split(/\n==+\s*/);
  for (const section of sections) {
    const [rawTitle = '', ...bodyParts] = section.split(/\s*==+\n/);
    const title = stripWiki(rawTitle);
    const body = stripWiki(bodyParts.join('\n'));
    if (!legalSectionTitles.test(title)) continue;
    const excerpts = body.split(/(?<=[。；;])|\n/).map((line) => line.trim()).filter((line) => legalSentence.test(line)).slice(0, 4);
    if (excerpts.length === 0) continue;
    records.push({ sectionTitle: title || null, summary: excerpts.join(' '), excerpts });
  }
  return records.slice(0, 3);
}

function targetIdentityNames(target) {
  return new Set([target.name, target.pageTitle].map(normalizeName).filter(Boolean));
}

function normalizeLooseIdentityName(value) {
  return normalizeName(value)
    .replace(/[A-Za-z0-9._'’`-]+/g, '')
    .replace(/[-]/g, '')
    .replace(/[^\p{Script=Han}]/gu, '');
}

function targetLooseIdentityNames(target) {
  return new Set([target.name, target.pageTitle].map(normalizeLooseIdentityName).filter((value) => value.length >= 2));
}

function looseProfileNameMatchesTarget(target, profile) {
  const looseProfileName = normalizeLooseIdentityName(profile.name);
  if (looseProfileName.length < 2) return false;
  for (const identityName of targetLooseIdentityNames(target)) {
    if (looseProfileName === identityName) return true;
    if (identityName.length >= 2 && looseProfileName.startsWith(identityName)) return true;
    if (looseProfileName.length >= 2 && identityName.startsWith(looseProfileName)) return true;
  }
  return false;
}

function normalizeElectionContextValue(value) {
  return normalizeName(value)
    .replace(/[()（）]/g, '')
    .replace(/選舉區/g, '')
    .replace(/全國/g, '')
    .replace(/區域/g, '')
    .replace(/縣市/g, '')
    .replace(/直轄市/g, '')
    .replace(/原住民/g, '原住民族');
}

function normalizePartyContext(value) {
  const normalized = normalizeName(value).replace(/籍$/g, '');
  if (!normalized || normalized === '無' || normalized === '無黨') return '無黨籍';
  return normalized;
}

function targetPositionMatchesElection(target, record) {
  const position = String(target.position ?? '');
  const electionText = normalizeElectionContextValue([record.election, record.district].filter(Boolean).join(' '));
  if (!position || !electionText) return false;
  if (position.includes('立法委員')) return electionText.includes('立法委員');
  if (position.includes('議員')) return electionText.includes('議員');
  if (position.includes('鄉鎮市民代表')) return electionText.includes('代表');
  if (position.includes('村里長')) return electionText.includes('村長') || electionText.includes('里長');
  if (position.includes('地方首長')) return /縣長|市長|鄉長|鎮長|區長/.test(electionText);
  return false;
}

function targetDistrictMatchesElection(target, record) {
  const targetDistrict = normalizeElectionContextValue(target.district);
  if (!targetDistrict || targetDistrict.length < 2) return false;
  const electionText = normalizeElectionContextValue([record.election, record.district].filter(Boolean).join(' '));
  if (!electionText) return false;
  if (electionText.includes(targetDistrict) || targetDistrict.includes(electionText)) return true;

  const districtTokens = targetDistrict
    .split(/第|選|（|）|\(|\)/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !['全國', '區域', '原住民族'].includes(token));
  return districtTokens.some((token) => electionText.includes(token));
}

function targetPartyMatchesElection(target, record) {
  const targetParty = normalizePartyContext(target.party);
  const recordParty = normalizePartyContext(record.party);
  return Boolean(targetParty && recordParty && targetParty === recordParty);
}

function electionYearMatchesTarget(target, record) {
  if (!target.electionYear) return false;
  const electionText = String(record.election ?? '');
  return electionText.includes(String(target.electionYear));
}

function electionRecordContextSignals(target, record) {
  return {
    position: targetPositionMatchesElection(target, record),
    district: targetDistrictMatchesElection(target, record),
    party: targetPartyMatchesElection(target, record),
  };
}

function electionRecordMatchesTarget(target, record) {
  if (!electionYearMatchesTarget(target, record)) return null;
  const signals = electionRecordContextSignals(target, record);
  const score = Object.values(signals).filter(Boolean).length;
  if (score < 2) return null;
  return { record, signals, score, yearMatched: true };
}

function electionRecordMatchesTargetWithoutYear(target, record) {
  const signals = electionRecordContextSignals(target, record);
  const score = Object.values(signals).filter(Boolean).length;
  if (score < 3) return null;
  return { record, signals, score, yearMatched: false };
}

function matchProfileByElectionContext(target, profiles) {
  return matchProfileByElectionRecord(target, profiles, electionRecordMatchesTarget);
}

function matchProfileByElectionContextWithoutYear(target, profiles) {
  return matchProfileByElectionRecord(target, profiles, electionRecordMatchesTargetWithoutYear);
}

function matchProfileByElectionRecord(target, profiles, matchRecord) {
  const matches = [];
  for (const profile of profiles) {
    const recordMatches = profile.electionRecords
      .map((record) => matchRecord(target, record))
      .filter(Boolean);
    if (recordMatches.length === 0) continue;
    recordMatches.sort((left, right) => right.score - left.score);
    matches.push({ profile, electionContextMatch: recordMatches[0] });
  }
  if (matches.length !== 1) return null;
  return matches[0];
}

function matchProfileToTarget(target, profiles) {
  const identityNames = targetIdentityNames(target);
  const sameNameProfiles = profiles.filter((profile) => identityNames.has(profile.normalizedName));
  if (sameNameProfiles.length === 0) {
    const looseNameProfiles = profiles.filter((profile) => looseProfileNameMatchesTarget(target, profile));
    const electionContextMatch = matchProfileByElectionContext(target, looseNameProfiles);
    if (electionContextMatch) {
      return {
        status: 'matched',
        matchedBy: 'unique_loose_name_election_context',
        confidenceLevel: 'B',
        profile: electionContextMatch.profile,
        electionContextMatch: electionContextMatch.electionContextMatch,
      };
    }
    const electionContextWithoutYearMatch = matchProfileByElectionContextWithoutYear(target, looseNameProfiles);
    if (electionContextWithoutYearMatch) {
      return {
        status: 'matched',
        matchedBy: 'unique_loose_name_election_context_without_year',
        confidenceLevel: 'B',
        profile: electionContextWithoutYearMatch.profile,
        electionContextMatch: electionContextWithoutYearMatch.electionContextMatch,
      };
    }
    return { status: 'skipped', reason: 'no same-name profile on VoteTW page' };
  }
  const electionContextMatch = matchProfileByElectionContext(target, sameNameProfiles);
  if (electionContextMatch) {
    return {
      status: 'matched',
      matchedBy: 'unique_election_context',
      confidenceLevel: 'B',
      profile: electionContextMatch.profile,
      electionContextMatch: electionContextMatch.electionContextMatch,
    };
  }

  const electionContextWithoutYearMatch = matchProfileByElectionContextWithoutYear(target, sameNameProfiles);
  if (electionContextWithoutYearMatch) {
    return {
      status: 'matched',
      matchedBy: 'unique_election_context_without_year',
      confidenceLevel: 'B',
      profile: electionContextWithoutYearMatch.profile,
      electionContextMatch: electionContextWithoutYearMatch.electionContextMatch,
    };
  }

  if (target.birthDate) {
    const birthDateMatches = sameNameProfiles.filter((profile) => profile.birthDate === target.birthDate);
    if (birthDateMatches.length === 1) return { status: 'matched', matchedBy: 'birth_date', confidenceLevel: 'A', profile: birthDateMatches[0] };
    return { status: 'skipped', reason: birthDateMatches.length > 1 ? 'multiple same-name profiles with same birthday' : 'target birthday does not match VoteTW profiles' };
  }

  return {
    status: 'skipped',
    reason: sameNameProfiles.length === 1
      ? 'unique same-name profile lacks matching election context or target birthday'
      : 'multiple same-name profiles on one VoteTW page and target has no birthday',
  };
}

function claimRecord({ target, page, profile, claimType, claimValue, claimJson, confidenceLevel, publicGate, reviewStatus = 'pending', visibility = 'review_only' }) {
  const normalizedName = normalizeName(target.name);
  const claimHash = hashId(JSON.stringify({ claimType, claimValue, pageid: page.pageid, profileKey: profile.key }));
  return {
    claimKey: `${sourceId}:${target.personId ?? normalizedName}:${claimType}:${claimHash}`,
    personId: target.personId ?? null,
    personName: target.name,
    claimType,
    claimValue,
    claimJson: {
      ...claimJson,
      identityMatch: {
        status: 'matched',
        matchedBy: publicGate.matchedBy,
        targetBirthDate: target.birthDate ?? null,
        sourceBirthDate: profile.birthDate ?? null,
        sourceProfileKey: profile.key,
        sameNameProfileCount: publicGate.sameNameProfileCount,
      },
      publicationGate: publicGate,
      voteTw: { pageTitle: page.title, pageid: page.pageid, lastrevid: page.lastrevid, revisionTimestamp: page.revisionTimestamp },
    },
    confidenceLevel,
    reviewStatus,
    visibility,
    sourceId,
    sourceName: 'VoteTW',
    sourceUrl: page.url,
    observedAt: new Date().toISOString(),
  };
}

function buildClaims(target, page, profiles, match, args, platformRecords = []) {
  const profile = match.profile;
  const identityNames = targetIdentityNames(target);
  const sameNameProfileCount = profiles.filter((item) => identityNames.has(item.normalizedName)).length;
  const publicGate = {
    status: 'review_required',
    reason: 'VoteTW person enrichment is imported as review-only before publication',
    matchedBy: match.matchedBy,
    sameNameProfileCount,
    electionContextMatch: match.electionContextMatch ? {
      score: match.electionContextMatch.score,
      signals: match.electionContextMatch.signals,
      electionRecord: match.electionContextMatch.record,
    } : null,
  };
  const base = { target, page, profile, confidenceLevel: match.confidenceLevel, publicGate };
  const claims = [claimRecord({ ...base, claimType: 'external_id', claimValue: `votetw:${page.pageid}:${profile.key}`, claimJson: { externalIdType: 'votetw_profile', electionRecords: profile.electionRecords } })];
  if (profile.birthDate) claims.push(claimRecord({ ...base, claimType: 'birth_date', claimValue: profile.birthDate, claimJson: {} }));
  if (profile.gender) claims.push(claimRecord({ ...base, claimType: 'gender', claimValue: profile.gender, claimJson: {} }));
  if (profile.education) claims.push(claimRecord({ ...base, claimType: 'education', claimValue: profile.education, claimJson: {} }));
  if (profile.party) claims.push(claimRecord({ ...base, claimType: 'party_affiliation', claimValue: profile.party, claimJson: { electionRecords: profile.electionRecords } }));
  if (profile.experiences.length > 0) claims.push(claimRecord({ ...base, claimType: 'experience', claimValue: profile.experiences.join('；'), claimJson: { experiences: profile.experiences } }));
  if (profile.electionRecords.length > 0) {
    claims.push(claimRecord({
      ...base,
      claimType: 'experience',
      claimValue: profile.electionRecords.map((record) => record.election).filter(Boolean).join('；'),
      claimJson: { electionRecords: profile.electionRecords, experienceType: 'election_history' },
    }));
  }
  for (const platformRecord of platformRecords) {
    claims.push(claimRecord({
      ...base,
      claimType: 'platform',
      claimValue: platformRecord.summary,
      claimJson: {
        platformText: platformRecord.platformText,
        platformSource: platformRecord,
        platformPublicEligible: true,
        publicationNote: 'Public campaign platform text fetched from a source-versioned VoteTW page or template.',
      },
      confidenceLevel: 'B',
      publicGate: {
        ...publicGate,
        status: 'passed',
        reason: 'VoteTW platform text is source-versioned and identity was constrained before publication',
      },
      reviewStatus: 'verified',
      visibility: 'public',
    }));
  }

  if (args.includeLegalPublic && profile.legalRecords.length > 0) {
    claims.push(claimRecord({
      ...base,
      claimType: 'legal_case',
      claimValue: profile.legalRecords.map((record) => record.summary).join(' '),
      claimJson: {
        legalRecords: profile.legalRecords,
        legalCasePublicEligible: false,
        publicationNote: 'Review-only by default; sensitive legal claims require manual approval before publication.',
      },
    }));
  }
  return claims;
}

function rawSourceRecord(page, rawPath) {
  return {
    title: page.title,
    pageid: page.pageid,
    lastrevid: page.lastrevid,
    revisionTimestamp: page.revisionTimestamp,
    sourceUrl: page.url,
    rawUrl: page.rawUrl,
    rawPath,
    sha256: crypto.createHash('sha256').update(page.raw).digest('hex'),
    bytes: Buffer.byteLength(page.raw),
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
  const targets = await loadTargets(args);
  if (targets.length === 0) throw new Error('Provide --target-name, --target-names, or --target-names-from-supabase.');

  const personClaims = [];
  const rawSources = [];
  const skippedTargets = [];
  const pagesByName = new Map();
  const templatePagesByTitle = new Map();
  for (const [targetIndex, target] of targets.entries()) {
    const title = target.pageTitle ?? target.name;
    let page = pagesByName.get(title);
    if (page === undefined) {
      page = readCachedRawPage(title, args);
      if (args.verbose) console.error(`[${targetIndex + 1}/${targets.length}] ${page ? 'cached' : 'fetch'} ${title}`);
      if (!page && args.cacheOnly) {
        skippedTargets.push({ target, reason: 'missing raw cache' });
        pagesByName.set(title, null);
        continue;
      }
      try {
        if (!page) page = await fetchVoteTwPage(title, args);
      } catch (error) {
        if (!args.skipFetchErrors) throw error;
        skippedTargets.push({ target, reason: error.message });
        pagesByName.set(title, null);
        continue;
      }
      pagesByName.set(title, page);
      if (page) {
        const rawPath = args.dryRun ? null : page.rawPath ?? await writeRawPage(page, args);
        rawSources.push(rawSourceRecord(page, rawPath));
      }
    }
    if (!page) {
      skippedTargets.push({ target, reason: 'VoteTW page not found' });
      continue;
    }
    const profiles = parseVoteTwProfiles(page);
    const match = matchProfileToTarget(target, profiles);
    if (match.status !== 'matched') {
      skippedTargets.push({
        target,
        reason: match.reason,
        sourceProfiles: profiles.map((profile) => ({ name: profile.name, birthDate: profile.birthDate, party: profile.party, electionRecordCount: profile.electionRecords.length })),
      });
      continue;
    }
    const platformRecords = await collectPlatformRecords(page, args, templatePagesByTitle, rawSources);
    personClaims.push(...buildClaims(target, page, profiles, match, args, platformRecords));
  }

  const seed = {
    schemaVersion: 1,
    name: 'votetw-person-enrichment-claims',
    sourceId,
    generatedAt: new Date().toISOString(),
    summary: {
      targetCount: targets.length,
      rawSourceCount: rawSources.length,
      claimCount: personClaims.length,
      skippedCount: skippedTargets.length,
      legalClaimCount: personClaims.filter((claim) => claim.claimType === 'legal_case').length,
      platformClaimCount: personClaims.filter((claim) => claim.claimType === 'platform').length,
    },
    sources: [{ id: sourceId, name: 'VoteTW', url: 'https://votetw.com/', licenseNote: 'Public VoteTW wiki pages fetched with pageid/revision metadata and raw source archival.' }],
    rawSources,
    skippedTargets,
    personClaims,
  };

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
