const shareImageWidth = 1200;
const shareImageHeight = 630;
const shareFontPath = '/assets/fonts/ZLabsPixel-12px-HC-Fallback.ttf';
const safeIdentifierPattern = /^[A-Za-z0-9._-]+$/;

let rendererPromise = null;
let fontBufferPromise = null;

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isSafeIdentifier(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 128
    && safeIdentifierPattern.test(value);
}

function getCatalogPage(pathname, catalog) {
  if (catalog?.pageByPath instanceof Map) return catalog.pageByPath.get(pathname) ?? null;
  return catalog?.pages?.find((page) => page.path === pathname) ?? null;
}

export function shareCardForUrl(url, catalog) {
  const pathname = cleanText(url.searchParams.get('path'));
  const page = getCatalogPage(pathname, catalog);
  if (!page) return null;

  const policy = url.searchParams.get('policy');
  if (/^\/people\/[^/]+$/.test(pathname) && policy) {
    const parts = policy.split(':');
    if (parts.length !== 2 || !parts.every(isSafeIdentifier)) return null;
    const item = Array.isArray(page.sharePolicies)
      ? page.sharePolicies.find((entry) => entry?.key === policy)
      : null;
    const body = cleanText(item?.text);
    if (!body) return null;
    return {
      kind: 'policy',
      eyebrow: '單一政見',
      title: page.title,
      body,
    };
  }

  const comparison = url.searchParams.get('compare');
  if (/^\/elections\/races\/[^/]+$/.test(pathname) && comparison) {
    const personIds = Array.from(new Set(comparison.split(',').filter(isSafeIdentifier)));
    if (personIds.length < 2 || personIds.length > 4) return null;
    const candidates = new Map(
      (Array.isArray(page.shareCandidates) ? page.shareCandidates : [])
        .map((candidate) => [candidate?.personId, cleanText(candidate?.name)]),
    );
    const names = personIds.map((personId) => candidates.get(personId)).filter(Boolean);
    if (names.length !== personIds.length) return null;
    return {
      kind: 'comparison',
      eyebrow: '候選人比較',
      title: page.title,
      body: names.join('、'),
    };
  }

  return null;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function characterWidth(character) {
  return /^[\u0000-\u00ff]$/.test(character) ? 0.55 : 1;
}

function wrapText(value, maxUnits, maxLines) {
  const characters = Array.from(cleanText(value).replaceAll(/\s+/gu, ' '));
  const lines = [];
  let line = '';
  let units = 0;
  let truncated = false;

  for (const character of characters) {
    const width = characterWidth(character);
    if (line && units + width > maxUnits) {
      lines.push(line.trim());
      line = '';
      units = 0;
      if (lines.length === maxLines) {
        truncated = true;
        break;
      }
    }
    line += character;
    units += width;
  }
  if (!truncated && line.trim() && lines.length < maxLines) lines.push(line.trim());
  if (truncated && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[，。；、,.!?！？\s]+$/u, '')}…`;
  }
  return lines;
}

function textLines(lines, x, startY, lineHeight, className) {
  return lines
    .map((line, index) => `<text x="${x}" y="${startY + (index * lineHeight)}" class="${className}">${escapeXml(line)}</text>`)
    .join('');
}

export function shareCardSvg(card) {
  const titleLines = wrapText(card.title, 14, 2);
  const bodyMaxLines = titleLines.length > 1 ? 2 : 3;
  const bodyLines = wrapText(card.body, card.kind === 'comparison' ? 24 : 22, bodyMaxLines);
  const bodyStart = titleLines.length > 1 ? 420 : 390;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${shareImageWidth}" height="${shareImageHeight}" viewBox="0 0 ${shareImageWidth} ${shareImageHeight}">
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#14324a" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="#061827"/>
  <rect width="1200" height="630" fill="url(#grid)" opacity="0.72"/>
  <rect x="0" y="0" width="18" height="630" fill="#31d7ef"/>
  <rect x="64" y="64" width="1072" height="502" rx="4" fill="#071b2c" stroke="#1f4a65" stroke-width="2"/>
  <rect x="96" y="92" width="150" height="7" fill="#31d7ef"/>
  <style>
    text { font-family: SharePixel, sans-serif; }
    .site { fill: #f8fbff; font-size: 28px; font-weight: 700; }
    .eyebrow { fill: #31d7ef; font-size: 28px; font-weight: 700; }
    .title { fill: #f8fbff; font-size: 64px; font-weight: 700; }
    .body { fill: #dce8f1; font-size: 36px; }
    .footer { fill: #86a7bb; font-size: 23px; }
  </style>
  <text x="96" y="140" class="site">公職資料觀測站</text>
  <text x="96" y="194" class="eyebrow">${escapeXml(card.eyebrow)}</text>
  ${textLines(titleLines, 96, 276, 64, 'title')}
  ${textLines(bodyLines, 96, bodyStart, 48, 'body')}
  <line x1="96" y1="516" x2="1104" y2="516" stroke="#1f4a65" stroke-width="2"/>
  <text x="96" y="552" class="footer">查看完整內容與資料來源</text>
  <text x="1104" y="552" class="eyebrow" text-anchor="end">pow4vote.org</text>
</svg>`;
}

async function loadRenderer() {
  rendererPromise ??= Promise.all([
    import('@resvg/resvg-wasm'),
    import('@resvg/resvg-wasm/index_bg.wasm'),
  ]).then(async ([resvg, wasm]) => {
    await resvg.initWasm(wasm.default ?? wasm);
    return resvg.Resvg;
  });
  return rendererPromise;
}

async function loadShareFont(env, origin) {
  fontBufferPromise ??= env.ASSETS
    .fetch(new Request(new URL(shareFontPath, origin)))
    .then(async (response) => {
      if (!response.ok) throw new Error('Share preview font asset is unavailable.');
      return response.arrayBuffer();
    });
  return fontBufferPromise;
}

export async function renderShareCardPng(card, env, origin) {
  const [Resvg, fontBuffer] = await Promise.all([
    loadRenderer(),
    loadShareFont(env, origin),
  ]);
  const renderer = new Resvg(shareCardSvg(card), {
    fitTo: { mode: 'width', value: shareImageWidth },
    font: {
      defaultFontFamily: 'SharePixel',
      fontBuffers: [new Uint8Array(fontBuffer)],
      loadSystemFonts: false,
    },
  });
  return renderer.render().asPng();
}
