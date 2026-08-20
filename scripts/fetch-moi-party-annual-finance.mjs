import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const listingUrl = 'https://party.moi.gov.tw/PartyFinancialChecklist.aspx?n=16101&sms=13073';
const defaultOutputPath = path.join(repoRoot, 'tmp', 'party-annual-finance', 'moi-party-annual-finance.json');

function priorRocYear(date = new Date()) {
  return date.getUTCFullYear() - 1912;
}

function parseArgs(argv) {
  const options = { rocYear: priorRocYear(), outputPath: defaultOutputPath };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--year') options.rocYear = Number.parseInt(argv[++index] ?? '', 10);
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!Number.isInteger(options.rocYear) || options.rocYear < 100) throw new Error('A valid ROC report year is required.');
  return options;
}

function decodeHtml(value) {
  return String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function textFromHtml(value) {
  return decodeHtml(String(value ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function absoluteUrl(href, baseUrl = listingUrl) {
  return href ? new URL(decodeHtml(href), baseUrl).toString() : null;
}

function parseListingRows(html, rocYear) {
  const records = [];
  let current = {};
  for (const cellMatch of String(html).matchAll(/<td\b[^>]*data-title=["']([^"']+)["'][^>]*>([\s\S]*?)<\/td>/gi)) {
    const label = textFromHtml(cellMatch[1]);
    const content = cellMatch[2];
    const value = textFromHtml(content);
    if (label === '年度') current = { rocYear: Number.parseInt(value, 10) };
    else if (label === '政黨編號') current.partyNumber = Number.parseInt(value, 10);
    else if (label === '政黨名稱') {
      current.partyName = value;
      current.detailHref = content.match(/href=["']([^"']*PartyFinancialChecklistContent[^"']*)["']/i)?.[1];
    } else if (label === '申報狀態') current.filingStatus = value;
    else if (label === '追認狀態') {
      current.ratificationStatus = value;
      if (
        current.rocYear === rocYear
        && Number.isInteger(current.partyNumber)
        && current.partyName
        && current.detailHref
      ) {
        records.push({
          rocYear,
          reportYear: rocYear + 1911,
          partyNumber: current.partyNumber,
          partyName: current.partyName,
          filingStatus: current.filingStatus ?? '',
          ratificationStatus: current.ratificationStatus,
          detailUrl: absoluteUrl(current.detailHref),
        });
      }
      current = {};
    }
  }
  return records;
}

function valueByLabel(html, label) {
  for (const rowMatch of String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((match) => textFromHtml(match[1]));
    const labelIndex = cells.findIndex((cell) => cell === label);
    if (labelIndex >= 0 && cells[labelIndex + 1]) return cells[labelIndex + 1];
  }
  return null;
}

function parseDetailPage(html, detailUrl) {
  const pdfHref = [...String(html).matchAll(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi)][0]?.[1];
  return {
    partyStatus: valueByLabel(html, '政黨狀態'),
    assemblyApprovalStatus: valueByLabel(html, '有無經黨員(代表)大會通過'),
    reportPdfUrl: absoluteUrl(pdfHref, detailUrl),
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'PublicOfficeWatch/1.0 (+MOI party annual finance monitor)',
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

async function fetchListing(rocYear) {
  const records = [];
  const seen = new Set();
  for (let page = 1; page <= 10; page += 1) {
    const url = page === 1 ? listingUrl : `${listingUrl}&PageSize=20&page=${page}`;
    const pageRecords = parseListingRows(await fetchText(url), rocYear);
    for (const record of pageRecords) {
      const key = `${record.rocYear}:${record.partyNumber}`;
      if (!seen.has(key)) {
        seen.add(key);
        records.push(record);
      }
    }
    if (page > 1 && pageRecords.length === 0) break;
  }
  return records.sort((left, right) => left.partyNumber - right.partyNumber);
}

async function enrichDetails(records) {
  const enriched = [];
  for (const record of records) {
    try {
      const detail = parseDetailPage(await fetchText(record.detailUrl), record.detailUrl);
      enriched.push({
        ...record,
        ...detail,
        detailStatus: detail.reportPdfUrl ? 'ok' : 'missing_report_pdf',
        amountExtractionStatus: 'pending_scanned_pdf_review',
      });
    } catch (error) {
      enriched.push({
        ...record,
        partyStatus: null,
        assemblyApprovalStatus: null,
        reportPdfUrl: null,
        detailStatus: 'failed',
        amountExtractionStatus: 'not_attempted',
        sourceError: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return enriched;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const records = await enrichDetails(await fetchListing(options.rocYear));
  if (records.length === 0) throw new Error(`No MOI party annual finance records found for ROC year ${options.rocYear}.`);
  const failedDetailCount = records.filter((record) => record.detailStatus !== 'ok').length;
  const payload = {
    schemaVersion: 1,
    name: '內政部政黨年度財務申報索引',
    generatedAt: new Date().toISOString(),
    status: failedDetailCount === 0 ? 'ok' : 'needs_attention',
    sourceName: '內政部政黨資訊網－查財報',
    sourceUrl: listingUrl,
    rocYear: options.rocYear,
    reportYear: options.rocYear + 1911,
    recordCount: records.length,
    failedDetailCount,
    amountExtractionPolicy: 'Official PDFs are scanned images. Amounts remain pending until OCR output is reviewed; listing and filing metadata may be used directly.',
    records,
  };
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({
    status: payload.status,
    rocYear: payload.rocYear,
    reportYear: payload.reportYear,
    recordCount: payload.recordCount,
    failedDetailCount: payload.failedDetailCount,
    outputPath: options.outputPath,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { parseArgs, parseDetailPage, parseListingRows, priorRocYear, textFromHtml };
