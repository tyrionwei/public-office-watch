import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultManifestPath = path.join(repoRoot, 'data-sources', 'daily-person-news-monitor.json');

function readLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [
          separator >= 0 ? line.slice(0, separator).trim() : line,
          separator >= 0 ? line.slice(separator + 1).trim().replace(/^["']|["']$/g, '') : '',
        ];
      }),
  );
}

function parseArgs(argv) {
  const options = {
    manifestPath: defaultManifestPath,
    watchlistPath: null,
    previousPath: null,
    outputPath: null,
    lookbackHours: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--manifest') options.manifestPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--watchlist') options.watchlistPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--previous') options.previousPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--lookback-hours') options.lookbackHours = Number(argv[++index]);
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (options.lookbackHours != null && (!Number.isFinite(options.lookbackHours) || options.lookbackHours <= 0)) {
    throw new Error('--lookback-hours must be a positive number');
  }
  return options;
}

function requireText(value, field, errors) {
  const normalized = String(value ?? '').trim();
  if (!normalized) errors.push(`${field} is required`);
  return normalized;
}

function validateManifest(raw) {
  const errors = [];
  if (raw?.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  const lookbackHours = Number(raw?.lookbackHours);
  if (!Number.isFinite(lookbackHours) || lookbackHours <= 0) errors.push('lookbackHours must be positive');
  const feed = {
    provider: requireText(raw?.feed?.provider, 'feed.provider', errors),
    baseUrl: requireText(raw?.feed?.baseUrl, 'feed.baseUrl', errors),
    language: requireText(raw?.feed?.language, 'feed.language', errors),
    country: requireText(raw?.feed?.country, 'feed.country', errors),
    edition: requireText(raw?.feed?.edition, 'feed.edition', errors),
  };
  try {
    const url = new URL(feed.baseUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'news.google.com') {
      errors.push('feed.baseUrl must be the HTTPS Google News RSS endpoint');
    }
  } catch {
    errors.push('feed.baseUrl must be a valid URL');
  }
  const rawCategories = Array.isArray(raw?.categories) ? raw.categories : [];
  if (rawCategories.length === 0) errors.push('categories must contain at least one category');
  const seenKeys = new Set();
  const categories = rawCategories.map((category, index) => {
    const key = requireText(category?.key, `categories[${index}].key`, errors);
    const label = requireText(category?.label, `categories[${index}].label`, errors);
    if (seenKeys.has(key)) errors.push(`categories[${index}].key is duplicated`);
    seenKeys.add(key);
    const queryTerms = Array.isArray(category?.queryTerms) ? category.queryTerms.map(String).filter(Boolean) : [];
    const eventTerms = Array.isArray(category?.eventTerms) ? category.eventTerms.map(String).filter(Boolean) : [];
    if (queryTerms.length === 0) errors.push(`categories[${index}].queryTerms must not be empty`);
    if (eventTerms.length === 0) errors.push(`categories[${index}].eventTerms must not be empty`);
    return { key, label, queryTerms, eventTerms };
  });
  const trustedPublishers = Array.isArray(raw?.trustedPublishers)
    ? raw.trustedPublishers.map(String).map((value) => value.trim()).filter(Boolean)
    : [];
  if (errors.length > 0) throw new Error(`Invalid daily news manifest:\n- ${errors.join('\n- ')}`);
  return { schemaVersion: 1, lookbackHours, feed, categories, trustedPublishers };
}

function decodeXml(value) {
  return String(value ?? '')
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function plainText(value) {
  return decodeXml(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tagValue(xml, tag) {
  return decodeXml(xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1] ?? '');
}

function parseRssItems(xml) {
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).map((match) => {
    const item = match[1];
    const sourceMatch = item.match(/<source(?:\s+url=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/source>/i);
    return {
      title: plainText(tagValue(item, 'title')),
      url: plainText(tagValue(item, 'link')),
      publishedAt: plainText(tagValue(item, 'pubDate')),
      summary: plainText(tagValue(item, 'description')).slice(0, 500),
      publisherName: plainText(sourceMatch?.[2] ?? ''),
      publisherUrl: plainText(sourceMatch?.[1] ?? ''),
    };
  }).filter((item) => item.title && item.url);
}

function buildFeedUrl(feed, category, lookbackHours) {
  const lookbackDays = Math.max(1, Math.ceil(lookbackHours / 24));
  const query = `台灣 (${category.queryTerms.join(' OR ')}) when:${lookbackDays}d`;
  const url = new URL(feed.baseUrl);
  url.searchParams.set('q', query);
  url.searchParams.set('hl', feed.language);
  url.searchParams.set('gl', feed.country);
  url.searchParams.set('ceid', feed.edition);
  return url.toString();
}

function normalizeName(value) {
  return String(value ?? '').normalize('NFKC').replaceAll('臺', '台').replace(/\s+/g, '');
}

function priorityPerson(person) {
  return Boolean(String(person.current_office_label ?? '').trim())
    || Boolean(String(person.upcoming_candidate_label ?? '').trim())
    || Number(person.election_year) >= 2022
    || ['current', 'candidate'].includes(String(person.list_status ?? person.status ?? ''));
}

function normalizeWatchlist(rawPeople) {
  const byId = new Map();
  for (const person of rawPeople) {
    const id = String(person.person_id ?? person.id ?? '').trim();
    const name = String(person.name ?? '').trim();
    if (!id || !name || !priorityPerson(person)) continue;
    byId.set(id, {
      personId: id,
      name,
      normalizedName: normalizeName(name),
      party: String(person.party ?? '').trim() || null,
      currentOfficeLabel: String(person.current_office_label ?? '').trim() || null,
      upcomingCandidateLabel: String(person.upcoming_candidate_label ?? '').trim() || null,
      electionYear: Number.isFinite(Number(person.election_year)) ? Number(person.election_year) : null,
    });
  }
  return Array.from(byId.values()).sort((left, right) => right.normalizedName.length - left.normalizedName.length);
}

function personNameFrequency(watchlist) {
  const counts = new Map();
  for (const person of watchlist) counts.set(person.normalizedName, (counts.get(person.normalizedName) ?? 0) + 1);
  return counts;
}

function hashKey(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

const shortNameEventCues = new Set([
  '宣', '表', '今', '突', '請', '退', '遭', '被', '涉', '因', '將', '已', '不', '無', '確', '正',
  '開', '加', '恢', '辭', '停', '解', '罷', '遞', '補', '搜', '約', '聲', '羈', '交', '起', '判',
  '有', '定',
]);

const relatedPersonDescriptors = [
  '愛將', '發言人', '市府', '團隊', '子弟兵', '幕僚', '辦公室', '助理', '顧問', '旗下',
];

function directEventMatch(title, personName, eventTerms, categoryKey) {
  const normalizedTitle = normalizeName(title);
  const normalizedPersonName = normalizeName(personName);
  if (!normalizedPersonName) return false;
  const nameIndexes = [];
  for (let index = normalizedTitle.indexOf(normalizedPersonName); index >= 0; index = normalizedTitle.indexOf(normalizedPersonName, index + 1)) {
    nameIndexes.push(index);
  }
  for (const nameIndex of nameIndexes) {
    const nameEnd = nameIndex + normalizedPersonName.length;
    const textBeforeName = normalizedTitle.slice(0, nameIndex);
    if (categoryKey === 'candidacy_status' && textBeforeName.endsWith('要')) {
      continue;
    }
    const nextCharacter = normalizedTitle[nameEnd] ?? '';
    if (normalizedPersonName.length === 2 && /[\u3400-\u9fff]/u.test(nextCharacter) && !shortNameEventCues.has(nextCharacter)) {
      continue;
    }
    const textAfterName = normalizedTitle.slice(nameEnd);
    if (relatedPersonDescriptors.some((descriptor) => textAfterName.startsWith(descriptor))) {
      continue;
    }
    for (const rawTerm of eventTerms) {
      const term = normalizeName(rawTerm);
      for (let termIndex = normalizedTitle.indexOf(term); termIndex >= 0; termIndex = normalizedTitle.indexOf(term, termIndex + 1)) {
        const termEnd = termIndex + term.length;
        const betweenPersonAndTerm = termIndex >= nameEnd
          ? normalizedTitle.slice(nameEnd, termIndex)
          : normalizedTitle.slice(termEnd, nameIndex);
        const sameClause = !/[？！?!]/u.test(betweenPersonAndTerm);
        const legalNounOnly = categoryKey === 'legal_procedure' && term === '起訴' && normalizedTitle[termEnd] === '書';
        const commentatorCue = /^(嗆|籲|促|喊)/u.test(betweenPersonAndTerm);
        const broadRecallPhrase = categoryKey === 'office_status' && term === '罷免' && normalizedTitle[termIndex - 1] === '大';
        const followsPerson = sameClause && !legalNounOnly && !commentatorCue && !broadRecallPhrase
          && termIndex >= nameEnd && termIndex - nameEnd <= 4;
        if (followsPerson) return true;
      }
    }
  }
  return false;
}

function buildEventLeads(itemsByCategory, watchlist, manifest, now = new Date()) {
  const cutoff = now.getTime() - (manifest.lookbackHours * 60 * 60 * 1000);
  const nameCounts = personNameFrequency(watchlist);
  const trusted = new Set(manifest.trustedPublishers.map(normalizeName));
  const leads = [];
  for (const { category, items } of itemsByCategory) {
    for (const item of items) {
      const publishedTime = Date.parse(item.publishedAt);
      if (Number.isFinite(publishedTime) && publishedTime < cutoff) continue;
      const normalizedTitle = normalizeName(item.title);
      const normalizedSummary = normalizeName(item.summary);
      const matchedTerms = category.eventTerms.filter((term) => (
        normalizedTitle.includes(normalizeName(term)) || normalizedSummary.includes(normalizeName(term))
      ));
      if (matchedTerms.length === 0) continue;
      let matchedKnownPerson = false;
      for (const person of watchlist) {
        const inTitle = normalizedTitle.includes(person.normalizedName);
        if (!inTitle || !directEventMatch(item.title, person.name, matchedTerms, category.key)) continue;
        const sameNameCount = nameCounts.get(person.normalizedName) ?? 1;
        const trustedPublisher = trusted.has(normalizeName(item.publisherName));
        const score = sameNameCount > 1
          ? 50
          : Math.min(95, 80 + (trustedPublisher ? 10 : 0) + (matchedTerms.length > 1 ? 5 : 0));
        matchedKnownPerson = true;
        const leadKey = `daily-news:${hashKey(`${person.personId}|${category.key}|${item.url}`)}`;
        leads.push({
          leadKey,
          personId: person.personId,
          personName: person.name,
          category: category.key,
          categoryLabel: category.label,
          headline: item.title,
          sourceUrl: item.url,
          publisherName: item.publisherName || null,
          publisherUrl: item.publisherUrl || null,
          publishedAt: Number.isFinite(publishedTime) ? new Date(publishedTime).toISOString() : null,
          matchedTerms,
          matchedIn: 'title',
          matchScore: score,
          identityStatus: sameNameCount > 1 ? 'ambiguous_same_name' : 'candidate_match',
          reviewStatus: 'pending',
          autoPublish: false,
        });
      }
      if (!matchedKnownPerson) {
        leads.push({
          leadKey: `daily-news-unmatched:${hashKey(`${category.key}|${item.url}`)}`,
          personId: null,
          personName: null,
          category: category.key,
          categoryLabel: category.label,
          headline: item.title,
          sourceUrl: item.url,
          publisherName: item.publisherName || null,
          publisherUrl: item.publisherUrl || null,
          publishedAt: Number.isFinite(publishedTime) ? new Date(publishedTime).toISOString() : null,
          matchedTerms,
          matchedIn: 'event_terms',
          matchScore: 0,
          identityStatus: 'unmatched_person',
          reviewStatus: 'pending',
          autoPublish: false,
        });
      }
    }
  }
  return Array.from(new Map(leads.map((lead) => [lead.leadKey, lead])).values())
    .sort((left, right) => String(right.publishedAt).localeCompare(String(left.publishedAt)));
}

function groupEventLeads(leads) {
  const groups = new Map();
  for (const lead of leads) {
    const date = String(lead.publishedAt ?? '').slice(0, 10) || 'unknown-date';
    const terms = [...lead.matchedTerms].map(normalizeName).sort().join('|');
    const identityKey = lead.personId ?? lead.leadKey;
    const eventKey = `news-event:${hashKey(`${identityKey}|${lead.category}|${date}|${terms}`)}`;
    const group = groups.get(eventKey) ?? {
      eventKey,
      personId: lead.personId,
      personName: lead.personName,
      category: lead.category,
      categoryLabel: lead.categoryLabel,
      eventDate: date === 'unknown-date' ? null : date,
      representativeHeadline: lead.headline,
      latestPublishedAt: lead.publishedAt,
      matchedTerms: new Set(),
      publisherNames: new Set(),
      leadKeys: [],
      autoPublish: false,
    };
    group.leadKeys.push(lead.leadKey);
    for (const term of lead.matchedTerms) group.matchedTerms.add(term);
    if (lead.publisherName) group.publisherNames.add(lead.publisherName);
    if (String(lead.publishedAt).localeCompare(String(group.latestPublishedAt)) > 0) {
      group.latestPublishedAt = lead.publishedAt;
      group.representativeHeadline = lead.headline;
    }
    groups.set(eventKey, group);
  }
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      matchedTerms: [...group.matchedTerms],
      publisherNames: [...group.publisherNames],
      sourceCount: group.leadKeys.length,
    }))
    .sort((left, right) => String(right.latestPublishedAt).localeCompare(String(left.latestPublishedAt)));
}

async function fetchAllPublicPeople(config) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/people_directory`);
    url.searchParams.set('select', 'person_id,name,party,current_office_label,upcoming_candidate_label,election_year,list_status');
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(pageSize));
    const response = await fetch(url, {
      headers: {
        apikey: config.apiKey,
        authorization: `Bearer ${config.apiKey}`,
        'accept-profile': 'published',
      },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`Failed to fetch published people directory: ${body?.message ?? response.statusText}`);
    rows.push(...body);
    if (body.length < pageSize) return rows;
  }
}

async function fetchFeed(feedUrl) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(feedUrl, {
        headers: { 'user-agent': 'PublicOfficeWatch/1.0 (+daily public-event lead monitor)' },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`News feed returned HTTP ${response.status}`);
      return parseRssItems(await response.text());
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = validateManifest(JSON.parse(fs.readFileSync(options.manifestPath, 'utf8')));
  if (options.lookbackHours != null) manifest.lookbackHours = options.lookbackHours;
  const localEnv = readLocalEnv();
  let rawPeople;
  if (options.watchlistPath) {
    const watchlistFile = JSON.parse(fs.readFileSync(options.watchlistPath, 'utf8'));
    rawPeople = Array.isArray(watchlistFile) ? watchlistFile : watchlistFile.people;
    if (!Array.isArray(rawPeople)) throw new Error('Watchlist file must be an array or contain a people array');
  } else {
    const config = {
      supabaseUrl: process.env.SUPABASE_URL?.trim()
        || process.env.VITE_SUPABASE_URL?.trim()
        || localEnv.SUPABASE_URL
        || localEnv.VITE_SUPABASE_URL
        || 'http://127.0.0.1:54321',
      apiKey: process.env.SUPABASE_ANON_KEY?.trim()
        || process.env.VITE_SUPABASE_ANON_KEY?.trim()
        || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
        || localEnv.SUPABASE_ANON_KEY
        || localEnv.VITE_SUPABASE_ANON_KEY
        || localEnv.SUPABASE_SERVICE_ROLE_KEY,
    };
    if (!config.apiKey) throw new Error('A Supabase anon or service-role key is required to build the watchlist');
    rawPeople = await fetchAllPublicPeople(config);
  }
  const watchlist = normalizeWatchlist(rawPeople);
  const fetchedAt = new Date();
  const itemsByCategory = [];
  const errors = [];
  for (const category of manifest.categories) {
    const feedUrl = buildFeedUrl(manifest.feed, category, manifest.lookbackHours);
    try {
      itemsByCategory.push({ category, feedUrl, items: await fetchFeed(feedUrl) });
    } catch (error) {
      errors.push({ category: category.key, feedUrl, message: error instanceof Error ? error.message : String(error) });
    }
  }
  const leads = buildEventLeads(itemsByCategory, watchlist, manifest, fetchedAt);
  const eventGroups = groupEventLeads(leads);
  const previous = options.previousPath && fs.existsSync(options.previousPath)
    ? JSON.parse(fs.readFileSync(options.previousPath, 'utf8'))
    : null;
  const previousKeys = new Set((previous?.leads ?? []).map((lead) => lead.leadKey));
  const report = {
    schemaVersion: 1,
    fetchedAt: fetchedAt.toISOString(),
    lookbackHours: manifest.lookbackHours,
    status: errors.length === 0 ? 'ok' : itemsByCategory.length > 0 ? 'partial' : 'failed',
    watchlistCount: watchlist.length,
    categoryCount: manifest.categories.length,
    fetchedArticleCount: itemsByCategory.reduce((sum, item) => sum + item.items.length, 0),
    leadCount: leads.length,
    eventGroupCount: eventGroups.length,
    newLeadCount: leads.filter((lead) => !previousKeys.has(lead.leadKey)).length,
    eventGroups,
    leads,
    errors,
  };
  if (options.outputPath) {
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.status === 'failed') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  buildEventLeads,
  buildFeedUrl,
  directEventMatch,
  groupEventLeads,
  normalizeWatchlist,
  parseArgs,
  parseRssItems,
  priorityPerson,
  validateManifest,
};
