import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutputPath = path.join(repoRoot, 'tmp', 'candidate-finance', 'cy-2022-mayor-finance.json');
const downloadEndpoint = 'https://ardata.cy.gov.tw/api/v1/Search/download';
const sourceName = '監察院政治獻金公開查閱平臺';

const municipalityAreas = ['臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市'];
const countyCityAreas = [
  '基隆市',
  '新竹市',
  '嘉義市',
  '新竹縣',
  '苗栗縣',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義縣',
  '屏東縣',
  '宜蘭縣',
  '花蓮縣',
  '臺東縣',
  '澎湖縣',
  '金門縣',
  '連江縣',
];
const sourceScopes = [
  ...municipalityAreas.map((area) => ({ area, electionSearchName: '111年直轄市市長選舉' })),
  ...countyCityAreas.map((area) => ({ area, electionSearchName: '111年縣(市)長選舉' })),
];

const safeMoneyFields = {
  individualDonations: '個人捐贈收入',
  businessDonations: '營利事業捐贈收入',
  partyDonations: '政黨捐贈收入',
  groupDonations: '人民團體捐贈收入',
  anonymousDonations: '匿名捐贈收入',
  otherIncome: '其他收入',
  incomeTotal: '收入小計',
  incomeOverThirtyThousand: '累計超過三萬元之收入總額',
  cashIncomeTotal: '金錢收入總額',
  nonCashIncomeTotal: '非金錢收入總額',
  personnelExpenses: '人事費用支出',
  publicityExpenses: '宣傳支出',
  campaignVehicleRentalExpenses: '租用宣傳車輛支出',
  campaignOfficeRentalExpenses: '租用競選辦事處支出',
  rallyExpenses: '集會支出',
  travelExpenses: '交通旅運支出',
  miscellaneousExpenses: '雜支支出',
  returnedDonationExpenses: '返還捐贈支出',
  treasuryPaymentExpenses: '繳庫支出',
  publicRelationsExpenses: '公共關係費用支出',
  expenditureTotal: '支出小計',
  expenditureOverThirtyThousand: '累計超過三萬元之支出總額',
  cashExpenditureTotal: '金錢支出總額',
  nonCashExpenditureTotal: '非金錢支出總額',
  accountBalance: '結算日金融機構帳戶存款餘額',
  balance: '餘額',
  cashBalance: '收支結存內金錢餘額',
  nonCashProperty: '金錢以外之財產',
};

function parseArgs(argv) {
  const options = { outputPath: defaultOutputPath, area: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--area') options.area = String(argv[++index] ?? '').trim();
    else throw new Error('Unsupported argument: ' + arg);
  }
  if (options.area && !sourceScopes.some((scope) => scope.area === options.area)) {
    throw new Error('Unsupported 2022 mayor finance area: ' + options.area);
  }
  return options;
}

function buildDownloadUrl(scope) {
  if (!sourceScopes.some((candidate) => candidate.area === scope.area && candidate.electionSearchName === scope.electionSearchName)) {
    throw new Error('Unsupported Control Yuan finance scope: ' + scope.area);
  }
  const url = new URL(downloadEndpoint);
  url.searchParams.set('AccountNumber', '');
  url.searchParams.set('DownloadType', '3');
  url.searchParams.set('ElectionArea', scope.area);
  url.searchParams.set('ElectionName', scope.electionSearchName);
  url.searchParams.set('SearchType', '2');
  url.searchParams.set('Version', '');
  url.searchParams.set('YearOrSerial', '1');
  return url.toString();
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error('Unclosed quoted field in candidate finance CSV');
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseMoney(value, label) {
  const normalized = String(value ?? '').trim().replaceAll(',', '');
  if (!/^-?\d+(?:\.\d+)?$/u.test(normalized)) {
    throw new Error('Invalid money value for ' + label + ': ' + value);
  }
  const amount = Number(normalized);
  if (!Number.isSafeInteger(amount)) {
    throw new Error('Unsafe money value for ' + label + ': ' + value);
  }
  return amount;
}

function rocDateToIso(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  if (!/^\d{7}$/u.test(normalized)) throw new Error('Invalid ROC date: ' + value);
  const year = Number(normalized.slice(0, 3)) + 1911;
  const month = normalized.slice(3, 5);
  const day = normalized.slice(5, 7);
  const iso = year + '-' + month + '-' + day;
  const parsed = new Date(iso + 'T00:00:00Z');
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== iso) throw new Error('Invalid ROC date: ' + value);
  return iso;
}

function parseCandidateFinanceCsv(text, scope) {
  const rows = parseCsvRows(String(text).replace(/^\uFEFF/u, ''));
  if (rows.length < 2) throw new Error('Empty candidate finance summary for ' + scope.area);
  const headers = rows[0].map((value) => value.trim());
  const requiredHeaders = ['擬參選人', '選舉名稱', '申報序號', ...Object.values(safeMoneyFields)];
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) throw new Error('Missing candidate finance header ' + header + ' for ' + scope.area);
  }

  return rows.slice(1).map((values, index) => {
    const row = Object.fromEntries(headers.map((header, columnIndex) => [header, values[columnIndex]?.trim() ?? '']));
    const amounts = Object.fromEntries(
      Object.entries(safeMoneyFields).map(([key, header]) => [key, parseMoney(row[header], header)]),
    );
    const candidateName = row['擬參選人'];
    const electionName = row['選舉名稱'];
    const filingSequence = row['申報序號'];
    if (!candidateName || !electionName || !filingSequence) {
      throw new Error('Missing identity field in candidate finance row ' + (index + 2) + ' for ' + scope.area);
    }
    if (!electionName.includes(scope.area) || !electionName.includes('長選舉')) {
      throw new Error('Candidate finance election mismatch for ' + candidateName + ': ' + electionName);
    }

    return {
      area: scope.area,
      candidateName,
      electionName,
      filingSequence,
      amounts,
      settlementDate: rocDateToIso(row['結算日期']),
      filingDate: rocDateToIso(row['申報日期']),
      correctionDate: rocDateToIso(row['更正日期']),
    };
  });
}

function findZipEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  throw new Error('ZIP end of central directory was not found');
}

function listZipEntries(buffer) {
  const endOffset = findZipEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const entries = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP central directory entry');
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    entries.push({
      name: new TextDecoder('big5', { fatal: false }).decode(buffer.subarray(offset + 46, offset + 46 + fileNameLength)),
      compressionMethod: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      uncompressedSize: buffer.readUInt32LE(offset + 24),
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
    });
    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }
  return entries;
}

function extractZipEntry(buffer, entry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error('Invalid ZIP local header for ' + entry.name);
  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraFieldLength = buffer.readUInt16LE(offset + 28);
  const dataOffset = offset + 30 + fileNameLength + extraFieldLength;
  const compressed = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);
  let extracted;
  if (entry.compressionMethod === 0) extracted = compressed;
  else if (entry.compressionMethod === 8) extracted = zlib.inflateRawSync(compressed);
  else throw new Error('Unsupported ZIP compression method ' + entry.compressionMethod);
  if (entry.uncompressedSize && extracted.length !== entry.uncompressedSize) {
    throw new Error('ZIP entry size mismatch for ' + entry.name);
  }
  return extracted;
}

function readSafeSummaryCsv(buffer) {
  const entries = listZipEntries(buffer).filter(
    (entry) => entry.name.split('/').at(-1) === 'election_incomes and expenditures_first.csv',
  );
  if (entries.length !== 1) throw new Error('Expected one safe candidate summary CSV, found ' + entries.length);
  return extractZipEntry(buffer, entries[0]);
}

async function fetchArchive(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'ardata.cy.gov.tw') {
    throw new Error('Refused non-official candidate finance URL: ' + url);
  }
  const response = await fetch(parsed, {
    headers: {
      accept: 'application/zip,application/octet-stream',
      'user-agent': 'PublicOfficeWatch/1.1 (+candidate finance aggregate monitor)',
    },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
  const archive = Buffer.from(await response.arrayBuffer());
  if (archive.length < 4 || archive.readUInt32LE(0) !== 0x04034b50) {
    throw new Error('Official candidate finance response is not a ZIP archive: ' + url);
  }
  return { archive, lastModified: response.headers.get('last-modified') };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function collectScope(scope) {
  const sourceUrl = buildDownloadUrl(scope);
  const { archive, lastModified } = await fetchArchive(sourceUrl);
  const summaryBytes = readSafeSummaryCsv(archive);
  const summaryText = new TextDecoder('utf-8', { fatal: true }).decode(summaryBytes);
  const records = parseCandidateFinanceCsv(summaryText, scope);
  return {
    source: {
      area: scope.area,
      electionSearchName: scope.electionSearchName,
      sourceName,
      sourceUrl,
      archiveSha256: sha256(archive),
      summarySha256: sha256(summaryBytes),
      lastModified,
      recordCount: records.length,
    },
    records: records.map((record) => ({ ...record, sourceUrl })),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const scopes = options.area ? sourceScopes.filter((scope) => scope.area === options.area) : sourceScopes;
  const sources = [];
  const records = [];
  for (const scope of scopes) {
    const result = await collectScope(scope);
    sources.push(result.source);
    records.push(...result.records);
  }

  const payload = {
    schemaVersion: 1,
    name: '監察院 2022 縣市長候選人政治獻金安全摘要',
    generatedAt: new Date().toISOString(),
    sourceName,
    sourceUrl: 'https://ardata.cy.gov.tw/home',
    privacyBoundary: 'Only candidate-level aggregate totals are retained. Donor, payee, identifier, address, phone and transaction-detail files are never parsed or stored.',
    scopeCount: sources.length,
    recordCount: records.length,
    sources,
    records,
  };
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, JSON.stringify(payload, null, 2) + '\n');
  console.log(JSON.stringify({
    scopeCount: payload.scopeCount,
    recordCount: payload.recordCount,
    outputPath: options.outputPath,
  }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  buildDownloadUrl,
  parseArgs,
  parseCandidateFinanceCsv,
  parseCsvRows,
  readSafeSummaryCsv,
  rocDateToIso,
  sourceScopes,
};
