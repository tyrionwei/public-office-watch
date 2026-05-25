import fs from 'node:fs';
import path from 'node:path';

const authUrl = 'https://data.judicial.gov.tw/jdg/api/Auth';
const listUrl = 'https://data.judicial.gov.tw/jdg/api/JList';
const docUrl = 'https://data.judicial.gov.tw/jdg/api/JDoc';
const defaultOutputPath = path.resolve('data-sources/legal-record-leads.seed.json');

function parseArgs(argv) {
  const args = {
    outputPath: defaultOutputPath,
    targetNamesPath: null,
    maxDocs: 50,
    requireServiceWindow: true,
    dryRun: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--output') {
      args.outputPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--target-names') {
      args.targetNamesPath = path.resolve(argv[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (arg === '--max-docs') {
      args.maxDocs = Number.parseInt(argv[index + 1] ?? '', 10);
      index += 1;
      continue;
    }

    if (arg === '--skip-service-window-check') {
      args.requireServiceWindow = false;
      continue;
    }

    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  if (!Number.isFinite(args.maxDocs) || args.maxDocs <= 0) {
    throw new Error('--max-docs must be a positive number.');
  }

  return args;
}

function assertServiceWindow() {
  const taipeiHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      hour: '2-digit',
      hour12: false,
    }).format(new Date()),
  );

  if (taipeiHour < 0 || taipeiHour >= 6) {
    throw new Error('Judicial API service window is 00:00-06:00 Asia/Taipei. Re-run during that window or pass --skip-service-window-check for explicit testing.');
  }
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${response.statusText}`);
  }

  if (payload?.error) {
    throw new Error(`${url} returned error: ${payload.error}`);
  }

  return payload;
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .replace(/[臺]/g, '台')
    .replace(/[‧·．・･•]/g, '')
    .replace(/[\s\u00A0\u3000]+/g, '');
}

function loadTargetNames(filePath) {
  if (!filePath) {
    throw new Error('Provide --target-names. The fetcher only creates leads for explicit target names.');
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(content);
  const names = Array.isArray(parsed) ? parsed : parsed.names;

  if (!Array.isArray(names) || names.length === 0) {
    throw new Error('Target names file must be a JSON array or an object with a non-empty names array.');
  }

  return Array.from(new Set(names.map((name) => String(name).trim()).filter(Boolean))).map((name) => ({
    raw: name,
    normalized: normalizeName(name),
  }));
}

function parseJid(jid) {
  const [courtCode = '', year = '', caseCode = '', caseNumber = '', judgmentDate = ''] = String(jid ?? '').split(',');
  return { courtCode, year, caseCode, caseNumber, judgmentDate };
}

function toIsoDateFromRocCompact(value) {
  const match = String(value ?? '').match(/^(\d{3})(\d{2})(\d{2})$/);

  if (!match) {
    return null;
  }

  return `${Number(match[1]) + 1911}-${match[2]}-${match[3]}`;
}

function titleForDoc(doc) {
  return [doc.JTITLE, doc.JYEAR ? `${doc.JYEAR}年度` : null, doc.JCASE, doc.JNO ? `第${doc.JNO}號` : null]
    .filter(Boolean)
    .join(' ');
}

function leadFor({ doc, targetName }) {
  const jid = doc.JID ?? '';
  const parsedJid = parseJid(jid);
  const fullText = doc.JFULLX?.JFULLCONTENT ?? '';
  const title = titleForDoc(doc);
  const sourceUrl = `https://data.judicial.gov.tw/jdg/api/JDoc/${encodeURIComponent(jid)}`;

  return {
    leadKey: `judicial-jdoc:${jid}:${targetName.normalized}`,
    sourceId: 'judicial-yuan-court-open-data-api',
    sourceType: 'court_document',
    sourceName: '司法院裁判書開放API',
    sourceUrl,
    courtName: parsedJid.courtCode || null,
    caseYear: doc.JYEAR ?? parsedJid.year ?? null,
    caseCode: doc.JCASE ?? parsedJid.caseCode ?? null,
    caseNumber: doc.JNO ?? parsedJid.caseNumber ?? null,
    judgmentDate: toIsoDateFromRocCompact(doc.JDATE ?? parsedJid.judgmentDate),
    caseType: jid.split(',')[0]?.slice(-1) ?? null,
    reason: doc.JTITLE ?? null,
    title,
    summary: fullText.slice(0, 500),
    rawName: targetName.raw,
    confidenceLevel: 'B',
    sourcePayload: {
      jid,
      jfullType: doc.JFULLX?.JFULLTYPE ?? null,
      attachmentCount: Array.isArray(doc.ATTACHMENTS) ? doc.ATTACHMENTS.length : 0,
    },
  };
}

function mergeLeads(existingPayload, newLeads) {
  const existingLeads = existingPayload.legalRecordLeads ?? [];
  const byKey = new Map(existingLeads.map((lead) => [lead.leadKey ?? lead.lead_key, lead]));

  for (const lead of newLeads) {
    byKey.set(lead.leadKey, lead);
  }

  return {
    schemaVersion: existingPayload.schemaVersion ?? 1,
    name: existingPayload.name ?? 'legal-record-leads',
    updatedAt: new Date().toISOString().slice(0, 10),
    notes: existingPayload.notes ?? 'Private review-only legal/court record leads. Do not add name-only matches as public claims.',
    legalRecordLeads: Array.from(byKey.values()).sort((left, right) => String(left.leadKey).localeCompare(String(right.leadKey))),
  };
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.requireServiceWindow) {
    assertServiceWindow();
  }

  const user = process.env.JUDICIAL_OPEN_DATA_USER?.trim();
  const password = process.env.JUDICIAL_OPEN_DATA_PASSWORD?.trim();

  if (!user || !password) {
    throw new Error('Set JUDICIAL_OPEN_DATA_USER and JUDICIAL_OPEN_DATA_PASSWORD before fetching.');
  }

  const targetNames = loadTargetNames(args.targetNamesPath);
  const authPayload = await postJson(authUrl, { user, password });
  const token = authPayload.Token;

  if (!token) {
    throw new Error('Judicial API auth did not return Token.');
  }

  const changedLists = await postJson(listUrl, { token });
  const jids = [...new Set((Array.isArray(changedLists) ? changedLists : []).flatMap((item) => item.list ?? []))].slice(0, args.maxDocs);
  const leads = [];

  for (const jid of jids) {
    const doc = await postJson(docUrl, { token, j: jid });
    const searchableText = normalizeName([doc.JTITLE, doc.JFULLX?.JFULLCONTENT].filter(Boolean).join('\n'));
    const matchedNames = targetNames.filter((name) => searchableText.includes(name.normalized));

    for (const targetName of matchedNames) {
      leads.push(leadFor({ doc, targetName }));
    }
  }

  const existingPayload = fs.existsSync(args.outputPath)
    ? JSON.parse(fs.readFileSync(args.outputPath, 'utf8'))
    : { legalRecordLeads: [] };
  const nextPayload = mergeLeads(existingPayload, leads);

  if (!args.dryRun) {
    fs.writeFileSync(args.outputPath, `${JSON.stringify(nextPayload, null, 2)}\n`);
  }

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        checkedDocCount: jids.length,
        newLeadCount: leads.length,
        outputPath: args.outputPath,
        dryRun: args.dryRun,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`judicial legal lead fetch failed: ${message}`);
  process.exit(1);
});
