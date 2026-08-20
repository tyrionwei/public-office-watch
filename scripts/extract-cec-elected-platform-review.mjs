import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultInputPath = path.join(repoRoot, 'tmp', 'cec-elected-platforms', 'review.json');
const defaultOutputPath = path.join(repoRoot, 'tmp', 'cec-elected-platforms', 'platform-review.json');
const defaultCropDir = path.join(repoRoot, 'tmp', 'cec-elected-platforms', 'crops');
const defaultLayoutDir = path.join(repoRoot, 'tmp', 'cec-elected-platforms', 'layouts');
const manualCropOverrides = JSON.parse(fs.readFileSync(
  path.join(repoRoot, 'scripts', 'data', 'cec-platform-crop-overrides-2022.json'), 'utf8',
));
const bestTessdataDir = path.join(repoRoot, 'tmp', 'tessdata-best');

function parseArgs(argv) {
  const options = {
    inputPath: defaultInputPath,
    outputPath: defaultOutputPath,
    cropDir: defaultCropDir,
    layoutDir: defaultLayoutDir,
    offset: 0,
    limit: Number.POSITIVE_INFINITY,
    personName: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') options.inputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--output') options.outputPath = path.resolve(argv[++index] ?? '');
    else if (arg === '--crop-dir') options.cropDir = path.resolve(argv[++index] ?? '');
    else if (arg === '--layout-dir') options.layoutDir = path.resolve(argv[++index] ?? '');
    else if (arg === '--offset') options.offset = Number.parseInt(argv[++index] ?? '', 10);
    else if (arg === '--limit') options.limit = Number.parseInt(argv[++index] ?? '', 10);
    else if (arg === '--person-name') options.personName = argv[++index] ?? '';
    else throw new Error(`Unsupported argument: ${arg}`);
  }
  if (!fs.existsSync(options.inputPath)) throw new Error(`Input report not found: ${options.inputPath}`);
  if (!Number.isInteger(options.offset) || options.offset < 0) throw new Error('--offset must be a non-negative integer');
  if (!(options.limit > 0)) throw new Error('--limit must be a positive integer');
  return options;
}

function decodeXml(value) {
  return String(value ?? '')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replaceAll('臺', '台')
    .replace(/[\s\u00a0\u3000]+/g, '')
    .toLowerCase();
}

function isEligibleEntry(entry) {
  return Boolean(entry?.sourceDocument?.file);
}

function parseBboxPages(html) {
  const pages = [];
  const pagePattern = /<page\s+width="([\d.]+)"\s+height="([\d.]+)">([\s\S]*?)<\/page>/g;
  const wordPattern = /<word\s+xMin="([\d.]+)"\s+yMin="([\d.]+)"\s+xMax="([\d.]+)"\s+yMax="([\d.]+)">([\s\S]*?)<\/word>/g;
  for (const [pageIndex, pageMatch] of Array.from(html.matchAll(pagePattern)).entries()) {
    const words = [];
    for (const wordMatch of pageMatch[3].matchAll(wordPattern)) {
      words.push({
        text: decodeXml(wordMatch[5]),
        xMin: Number(wordMatch[1]),
        yMin: Number(wordMatch[2]),
        xMax: Number(wordMatch[3]),
        yMax: Number(wordMatch[4]),
      });
    }
    pages.push({ page: pageIndex + 1, width: Number(pageMatch[1]), height: Number(pageMatch[2]), words });
  }
  return pages;
}

function groupWordsIntoLines(words, tolerance = 3) {
  const lines = [];
  for (const word of [...words].sort((left, right) => left.yMin - right.yMin || left.xMin - right.xMin)) {
    const center = (word.yMin + word.yMax) / 2;
    let line = lines.find((candidate) => Math.abs(candidate.center - center) <= tolerance);
    if (!line) {
      line = { center, words: [] };
      lines.push(line);
    }
    line.words.push(word);
    line.center = line.words.reduce((sum, item) => sum + ((item.yMin + item.yMax) / 2), 0) / line.words.length;
  }
  return lines.map((line) => ({ ...line, words: line.words.sort((left, right) => left.xMin - right.xMin) }));
}

function findPhraseMatches(page, phrase) {
  const wanted = normalizeText(phrase);
  if (!wanted) return [];
  const matches = [];
  for (const line of groupWordsIntoLines(page.words)) {
    for (let start = 0; start < line.words.length; start += 1) {
      let text = '';
      for (let end = start; end < line.words.length && text.length <= wanted.length; end += 1) {
        text += normalizeText(line.words[end].text);
        if (text === wanted) {
          const subset = line.words.slice(start, end + 1);
          matches.push({
            page: page.page,
            xMin: Math.min(...subset.map((word) => word.xMin)),
            yMin: Math.min(...subset.map((word) => word.yMin)),
            xMax: Math.max(...subset.map((word) => word.xMax)),
            yMax: Math.max(...subset.map((word) => word.yMax)),
          });
          break;
        }
      }
    }
  }
  return matches;
}

function choosePlatformCrop(entry, pages) {
  const nameMatches = pages.flatMap((page) => findPhraseMatches(page, entry.person_name));
  const headerMatches = pages.flatMap((page) => findPhraseMatches(page, '政見'));
  const candidates = [];
  for (const name of nameMatches) {
    const page = pages.find((item) => item.page === name.page);
    const headers = headerMatches.filter((header) => header.page === name.page
      && header.yMin <= name.yMin
      && name.yMin - header.yMin < page.height * 0.25
      && header.xMin > name.xMax + 10);
    for (const header of headers) {
      candidates.push({
        name,
        header,
        page,
        score: (name.yMin - header.yMin) + ((header.xMin - name.xMax) * 0.1),
      });
    }
  }
  candidates.sort((left, right) => left.score - right.score);
  if (candidates.length === 0) {
    return { status: 'needs_manual_localization', nameMatchCount: nameMatches.length, headerMatchCount: headerMatches.length };
  }

  const selected = candidates[0];
  const sectionMatches = findPhraseMatches(selected.page, '候選人');
  const peerMatches = (entry.raceCandidates ?? []).flatMap((candidate) =>
    findPhraseMatches(selected.page, candidate.personName)
      .map((match) => ({ ...match, candidateNo: candidate.candidateNo, personName: candidate.personName })))
    .filter((match) => match.xMax < selected.header.xMin
      && Math.abs(match.xMin - selected.name.xMin) < selected.page.width * 0.15
      && match.yMin > selected.header.yMin);
  const nextPeer = peerMatches
    .filter((match) => match.yMin > selected.name.yMin + 5)
    .sort((left, right) => left.yMin - right.yMin)[0];
  const nextSection = sectionMatches
    .filter((match) => match.yMin > selected.name.yMin + 30)
    .sort((left, right) => left.yMin - right.yMin)[0];
  const nextHeader = headerMatches
    .filter((header) => header.page === selected.page.page
      && Math.abs(header.yMin - selected.header.yMin) < 40
      && header.xMin > selected.header.xMin + 20)
    .sort((left, right) => left.xMin - right.xMin)[0];
  const xMin = Math.max(0, selected.header.xMin - (selected.page.width * 0.055));
  const xMax = Math.min(
    selected.page.width,
    nextHeader
      ? selected.header.xMin + ((nextHeader.xMin - selected.header.xMin) * 0.42)
      : selected.page.width - 10,
  );
  const yMin = Math.max(selected.header.yMax, selected.name.yMin - 30);
  const yMax = Math.min(
    selected.page.height,
    nextPeer
      ? nextPeer.yMin - 15
      : nextSection
        ? nextSection.yMin - 50
        : selected.name.yMin + (selected.page.height * 0.12),
  );
  if (xMax - xMin < 100 || yMax - yMin < 30) {
    return { status: 'needs_manual_localization', nameMatchCount: nameMatches.length, headerMatchCount: headerMatches.length };
  }
  return {
    status: nameMatches.length === 1 ? 'ocr_ready' : 'ocr_ready_multiple_name_occurrences',
    nameMatchCount: nameMatches.length,
    nameMatchPages: [...new Set(nameMatches.map((match) => match.page))],
    headerMatchCount: headerMatches.length,
    selectedName: selected.name,
    selectedHeader: selected.header,
    peerMatches,
    crop: { page: selected.page.page, xMin, yMin, xMax, yMax },
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout;
}

function evidenceCacheStem(entry) {
  return `${entry.candidate_id}-${entry.sourceDocument.sha256.slice(0, 16)}`;
}

function cropCacheStem(entry, crop) {
  const cropHash = crypto.createHash('sha256').update(JSON.stringify(crop)).digest('hex').slice(0, 12);
  return `${evidenceCacheStem(entry)}-${cropHash}`;
}

function tableGeometryPage(pages, textEvidence) {
  if (pages.length === 1) return pages[0].page;
  return textEvidence.nameMatchPages?.length === 1 ? textEvidence.nameMatchPages[0] : null;
}

function chooseTableGeometryCrop(entry, pages, layoutDir, pageNumber) {
  const candidateNumber = Number.parseInt(entry.candidate_no, 10);
  const page = pages.find((item) => item.page === pageNumber);
  if (!Number.isInteger(candidateNumber) || candidateNumber < 1 || !page) {
    return { status: 'needs_manual_localization', geometryStatus: 'invalid_candidate_number' };
  }
  const pdfPath = path.join(repoRoot, entry.sourceDocument.file);
  const layoutBase = path.join(layoutDir, `${evidenceCacheStem(entry)}-page-${pageNumber}`);
  const layoutImage = `${layoutBase}.png`;
  fs.mkdirSync(layoutDir, { recursive: true });
  if (!fs.existsSync(layoutImage)) {
    run('pdftoppm', ['-f', String(pageNumber), '-l', String(pageNumber), '-singlefile', '-png', '-r', '100', pdfPath, layoutBase]);
  }
  const output = run('python3', [
    path.join(repoRoot, 'scripts', 'cec-platform-table-crop.py'),
    layoutImage,
    '--candidate-number', String(candidateNumber),
    '--candidate-count', String(entry.raceCandidates?.length ?? 0),
  ]);
  const geometry = JSON.parse(output);
  if (geometry.status !== 'located') {
    return { status: 'needs_manual_localization', geometryStatus: geometry.status, geometry };
  }
  const scaleX = page.width / geometry.imageSize.width;
  const scaleY = page.height / geometry.imageSize.height;
  return {
    status: 'ocr_ready_table_geometry',
    nameMatchCount: 0,
    headerMatchCount: 0,
    geometry,
    layoutFile: path.relative(repoRoot, layoutImage),
    crop: {
      page: pageNumber,
      xMin: geometry.crop.xMin * scaleX,
      yMin: geometry.crop.yMin * scaleY,
      xMax: geometry.crop.xMax * scaleX,
      yMax: geometry.crop.yMax * scaleY,
    },
  };
}

function chooseManualOverrideCrop(entry, pages, overrides = manualCropOverrides) {
  const override = overrides[entry.candidate_id];
  if (!override) return { status: 'needs_manual_localization', geometryStatus: 'manual_override_not_found' };
  if (override.sourceSha256 !== entry.sourceDocument.sha256) {
    return { status: 'needs_manual_localization', geometryStatus: 'manual_override_source_mismatch' };
  }
  const page = pages[override.page - 1];
  if (!page || !override.imageSize?.width || !override.imageSize?.height) {
    return { status: 'needs_manual_localization', geometryStatus: 'manual_override_invalid' };
  }
  const scaleX = page.width / override.imageSize.width;
  const scaleY = page.height / override.imageSize.height;
  return {
    status: 'ocr_ready_manual_geometry',
    geometry: { status: 'manual_override', ...override },
    crop: {
      page: override.page,
      xMin: override.crop.xMin * scaleX,
      yMin: override.crop.yMin * scaleY,
      xMax: override.crop.xMax * scaleX,
      yMax: override.crop.yMax * scaleY,
    },
  };
}

function renderAndOcr(entry, evidence, cropDir) {
  const pdfPath = path.join(repoRoot, entry.sourceDocument.file);
  const crop = evidence.crop;
  const dpi = 300;
  const scale = dpi / 72;
  const outputBase = path.join(cropDir, cropCacheStem(entry, crop));
  const imagePath = `${outputBase}.png`;
  fs.mkdirSync(cropDir, { recursive: true });
  if (!fs.existsSync(imagePath)) {
    run('pdftoppm', [
      '-f', String(crop.page), '-l', String(crop.page), '-singlefile', '-png', '-r', String(dpi),
      '-x', String(Math.round(crop.xMin * scale)), '-y', String(Math.round(crop.yMin * scale)),
      '-W', String(Math.round((crop.xMax - crop.xMin) * scale)),
      '-H', String(Math.round((crop.yMax - crop.yMin) * scale)),
      pdfPath, outputBase,
    ]);
  }
  const ocrText = run('tesseract', [imagePath, 'stdout', '-l', 'chi_tra+eng', '--psm', '6']).trim();
  let bestOcrText = null;
  if (fs.existsSync(path.join(bestTessdataDir, 'chi_tra.traineddata'))
    && fs.existsSync(path.join(bestTessdataDir, 'eng.traineddata'))) {
    bestOcrText = run('tesseract', [
      imagePath,
      'stdout',
      '--tessdata-dir', bestTessdataDir,
      '-l', 'chi_tra+eng',
      '--oem', '1',
      '--psm', '6',
    ]).trim();
  }
  const textLayer = run('pdftotext', [
    '-f', String(crop.page), '-l', String(crop.page), '-x', String(Math.floor(crop.xMin)),
    '-y', String(Math.floor(crop.yMin)), '-W', String(Math.ceil(crop.xMax - crop.xMin)),
    '-H', String(Math.ceil(crop.yMax - crop.yMin)), '-layout', pdfPath, '-',
  ]).trim();
  return { cropFile: path.relative(repoRoot, imagePath), ocrText, bestOcrText, textLayer };
}

function extractEntry(entry, cropDir, layoutDir) {
  const pdfPath = path.join(repoRoot, entry.sourceDocument.file);
  const bboxHtml = run('pdftotext', ['-bbox-layout', pdfPath, '-']);
  const pages = parseBboxPages(bboxHtml);
  const textEvidence = choosePlatformCrop(entry, pages);
  const manualEvidence = chooseManualOverrideCrop(entry, pages);
  const geometryPage = tableGeometryPage(pages, textEvidence);
  const tableEvidence = textEvidence.crop || manualEvidence.crop
    ? null
    : geometryPage
      ? chooseTableGeometryCrop(entry, pages, layoutDir, geometryPage)
      : {
        status: 'needs_manual_localization',
        geometryStatus: 'multi_page_source_without_unique_candidate_page',
      };
  const evidence = textEvidence.crop
    ? textEvidence
    : manualEvidence.crop ? manualEvidence : tableEvidence;
  if (!evidence.crop) return { ...entry, extraction: evidence };
  try {
    return { ...entry, extraction: { ...evidence, ...renderAndOcr(entry, evidence, cropDir), reviewStatus: 'private_manual_transcription_required' } };
  } catch (error) {
    return { ...entry, extraction: { ...evidence, status: 'extraction_failed', error: error instanceof Error ? error.message : String(error) } };
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const input = JSON.parse(fs.readFileSync(options.inputPath, 'utf8'));
  const eligibleEntries = input.entries.filter(isEligibleEntry);
  const selected = eligibleEntries
    .filter((entry) => !options.personName || entry.person_name === options.personName)
    .slice(options.offset, options.offset + options.limit);
  const progressPath = `${options.outputPath}.progress`;
  let entries = [];
  if (fs.existsSync(progressPath)) {
    const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
    if (progress.targetCount === selected.length && Array.isArray(progress.entries)) {
      entries = progress.entries;
    }
  }
  for (let index = entries.length; index < selected.length; index += 1) {
    const entry = selected[index];
    console.error(`[${index + 1}/${selected.length}] ${entry.person_name} ${entry.race_title}`);
    entries.push(extractEntry(entry, options.cropDir, options.layoutDir));
    fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
    fs.writeFileSync(progressPath, `${JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      processedCount: entries.length,
      targetCount: selected.length,
      entries,
    }, null, 2)}\n`);
  }
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceReport: path.relative(repoRoot, options.inputPath),
    summary: {
      targetCount: entries.length,
      skippedInputCount: input.entries.length - eligibleEntries.length,
      ocrReadyCount: entries.filter((entry) => entry.extraction.status.startsWith('ocr_ready')).length,
      tableGeometryCount: entries.filter((entry) => entry.extraction.status === 'ocr_ready_table_geometry').length,
      manualGeometryCount: entries.filter((entry) => entry.extraction.status === 'ocr_ready_manual_geometry').length,
      manualLocalizationCount: entries.filter((entry) => entry.extraction.status === 'needs_manual_localization').length,
      failedCount: entries.filter((entry) => entry.extraction.status === 'extraction_failed').length,
    },
    entries,
  };
  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(report, null, 2)}\n`);
  if (fs.existsSync(progressPath)) fs.rmSync(progressPath);
  console.log(JSON.stringify(report.summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { chooseManualOverrideCrop, choosePlatformCrop, cropCacheStem, evidenceCacheStem, findPhraseMatches, groupWordsIntoLines, isEligibleEntry, normalizeText, parseArgs, parseBboxPages, tableGeometryPage };
