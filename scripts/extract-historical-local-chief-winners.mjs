import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const ELECTION_PAGES = [
  {
    key: '1950-1951',
    term: 1,
    electionYear: 1950,
    votingDate: null,
    votingPeriod: '1950-10–1951-07',
    headingId: '各輪投票最高票候選人',
    pageTitle: '1950年—1951年中華民國縣市長選舉',
  },
  { key: '1954', term: 2, electionYear: 1954, votingDate: '1954-05-02', pageTitle: '1954年中華民國縣市長選舉' },
  { key: '1957', term: 3, electionYear: 1957, votingDate: '1957-04-21', pageTitle: '1957年中華民國縣市長選舉' },
  { key: '1960', term: 4, electionYear: 1960, votingDate: '1960-04-24', pageTitle: '1960年中華民國縣市長選舉' },
  { key: '1964', term: 5, electionYear: 1964, votingDate: '1964-04-26', pageTitle: '1964年中華民國縣市長選舉' },
  { key: '1968', term: 6, electionYear: 1968, votingDate: '1968-04-21', pageTitle: '1968年中華民國縣市長選舉' },
  { key: '1972', term: 7, electionYear: 1972, votingDate: '1972-12-23', pageTitle: '1972年中華民國縣市長選舉' },
  { key: '1977', term: 8, electionYear: 1977, votingDate: '1977-11-19', headingId: '概論[1]', pageTitle: '1977年中華民國縣市長選舉' },
  { key: '1981', term: 9, electionYear: 1981, votingDate: '1981-11-14', headingId: '概論[1]', pageTitle: '1981年中華民國縣市長選舉' },
  { key: '1985', term: 10, electionYear: 1985, votingDate: '1985-11-16', headingId: '選舉結果', pageTitle: '1985年中華民國縣市長選舉' },
  { key: '1989', term: 11, electionYear: 1989, votingDate: '1989-12-02', pageTitle: '1989年中華民國縣市長選舉' },
  { key: '1993', term: 12, electionYear: 1993, votingDate: '1993-11-27', headingId: '選舉結果', pageTitle: '1993年中華民國縣市長選舉' },
].map((page) => ({
  headingId: '當選人名單',
  votingPeriod: null,
  ...page,
  sourceUrl: `https://zh.wikipedia.org/wiki/${encodeURIComponent(page.pageTitle)}`,
}));

const KNOWN_PARTIES = [
  '中國國民黨',
  '民主進步黨',
  '中國民主社會黨',
  '中國青年黨',
  '無黨籍',
];

function decodeHtml(value) {
  const named = new Map([
    ['amp', '&'],
    ['quot', '"'],
    ['apos', "'"],
    ['lt', '<'],
    ['gt', '>'],
    ['nbsp', ' '],
  ]);
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity.startsWith('#x')) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named.get(entity.toLowerCase()) ?? match;
  });
}

function cellText(html) {
  return decodeHtml(html)
    .replace(/<(style|script|sup)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/[\u00a0\s]+/g, ' ')
    .trim();
}

function cellsFromRow(rowHtml) {
  return [...rowHtml.matchAll(/<t([dh])\b[^>]*>([\s\S]*?)<\/t\1>/gi)]
    .map((match) => ({ kind: `t${match[1].toLowerCase()}`, html: match[2], text: cellText(match[2]) }));
}

function firstTableAfterHeading(html, headingId) {
  const headingMarker = `id="${headingId}"`;
  const headingIndex = html.indexOf(headingMarker);
  if (headingIndex < 0) throw new Error(`Missing heading ${headingId}.`);
  const start = html.indexOf('<table', headingIndex + headingMarker.length);
  const end = html.indexOf('</table>', start);
  if (start < 0 || end < 0) throw new Error(`Missing table after ${headingId}.`);
  return html.slice(start, end + '</table>'.length);
}

function isRegion(value) {
  return /^(?:臺|台)?[^\s]{1,5}[縣市]$/.test(value) && value !== '縣市別';
}

function partyFromText(value) {
  return KNOWN_PARTIES.find((party) => value.includes(party)) ?? null;
}

function nameFromCandidateCell(value) {
  return value
    .split(/[（(]/, 1)[0]
    .replace(/[＊*✓－—-]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export function parseElectionPage(html, page) {
  const table = firstTableAfterHeading(html, page.headingId);
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => cellsFromRow(match[1]))
    .filter((cells) => cells.some((cell) => cell.kind === 'td'));
  const isMultiRound = page.headingId === '各輪投票最高票候選人';

  const records = [];
  let carriedPhase = null;
  for (const cells of rows) {
    const regionIndex = cells.findIndex((cell) => isRegion(cell.text));
    if (regionIndex < 0) continue;

    let candidateCell;
    let party;
    if (isMultiRound) {
      candidateCell = cells.slice(regionIndex + 1)
        .find((cell) => cell.html.includes('Elected_candidate_symbol'));
      if (!candidateCell) continue;
      party = partyFromText(candidateCell.text);
    } else {
      candidateCell = cells[regionIndex + 1];
      party = partyFromText(candidateCell?.text ?? '') ?? cells.slice(regionIndex + 2).map((cell) => partyFromText(cell.text)).find(Boolean) ?? null;
    }

    const name = nameFromCandidateCell(candidateCell?.text ?? '');
    if (!name || !party) throw new Error(`${page.key}: incomplete winner row for ${cells[regionIndex].text}.`);

    const explicitPhase = regionIndex > 0 && /期|補選/.test(cells[regionIndex - 1].text) ? cells[regionIndex - 1].text : null;
    if (explicitPhase) carriedPhase = explicitPhase;
    const phase = explicitPhase ?? (isMultiRound ? carriedPhase : null);
    records.push({
      electionYear: page.electionYear,
      term: page.term,
      votingDate: page.votingDate,
      votingPeriod: page.votingPeriod,
      eventType: phase === '補選' ? 'by_election' : 'regular_election',
      phase: phase && /期|補選/.test(phase) ? phase : null,
      electionType: 'local_chief',
      officeRole: 'local_chief',
      historicalRegionName: cells[regionIndex].text.replaceAll('台', '臺'),
      name,
      party,
      isElected: true,
      sourceId: 'wikipedia-historical-local-chief-index',
      sourceName: '中文維基百科歷史縣市長選舉條目',
      sourceUrl: page.sourceUrl,
      confidenceSuggestion: 'C',
      verificationStatus: 'research_lead',
      publicationStatus: 'archived',
    });
  }
  return records;
}

function parseArgs(argv) {
  const options = {
    inputDir: null,
    output: path.join(repoRoot, 'data-sources', 'historical-local-chief-winners-1950-1993.raw.json'),
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--input-dir') options.inputDir = argv[++index];
    else if (argv[index] === '--output') options.output = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!options.inputDir) throw new Error('Pass --input-dir with the cached Wikipedia HTML pages.');
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const records = ELECTION_PAGES.flatMap((page) => {
    const sourcePath = path.join(options.inputDir, `${page.key}.html`);
    if (!fs.existsSync(sourcePath)) throw new Error(`Missing cached page: ${sourcePath}`);
    return parseElectionPage(fs.readFileSync(sourcePath, 'utf8'), page);
  });
  const uniquePeople = new Set(records.map((record) => record.name));
  const output = {
    schemaVersion: 1,
    name: 'historical-local-chief-winners-1950-1993',
    generatedAt: new Date().toISOString(),
    archiveStatus: 'archived',
    scope: 'Regular and explicitly marked by-election winners in Taiwan county/city chief elections before the existing 1994+ official CEC dataset.',
    notes: [
      'This research lead dataset is archived from active review and retained for possible future restoration.',
      'It must not be published before official local-government cross-checking.',
      'The first election was held in phases from October 1950 through July 1951; no single voting date is asserted.',
      'Historical region names are retained and must not be rewritten as current jurisdictions.',
    ],
    sources: ELECTION_PAGES.map((page) => ({
      id: `${page.key}-local-chief-election-index`,
      type: 'secondary-index',
      name: page.pageTitle,
      url: page.sourceUrl,
      confidenceSuggestion: 'C',
    })),
    summary: {
      electionPageCount: ELECTION_PAGES.length,
      recordCount: records.length,
      personCount: uniquePeople.size,
      regularElectionRecordCount: records.filter((record) => record.eventType === 'regular_election').length,
      byElectionRecordCount: records.filter((record) => record.eventType === 'by_election').length,
    },
    records,
  };
  fs.writeFileSync(options.output, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ output: options.output, ...output.summary }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
