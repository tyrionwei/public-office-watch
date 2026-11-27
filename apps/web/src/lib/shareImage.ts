export type ShareComparisonRow = {
  name: string;
  number?: string;
  status: string;
  excerpt: string;
  available: boolean;
  sprite?: { src: string; credit: string };
};

type ShareCardInput = {
  eyebrow: string;
  title: string;
  body: string;
  comparisonRows?: ShareComparisonRow[];
  comparisonTitle?: string;
  comparisonContext?: string;
  comparisonCreditLabel?: string;
  footer: string;
  url: string;
};

const cardWidth = 1200;
const cardHeight = 630;
const cardFont = '"Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif';

const font = (style: string) => style + ' ' + cardFont;

function fitLines(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  maxLines: number,
) {
  const characters = Array.from(value.replace(/[^\S\n]+/g, ' ').trim());
  const lines: string[] = [];
  let line = '';
  let truncated = false;

  for (const character of characters) {
    if (character === '\n') {
      if (line) {
        lines.push(line);
        line = '';
      }
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
      continue;
    }
    const candidate = line + character;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = character;
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
      continue;
    }
    line = candidate;
  }

  if (!truncated && line && lines.length < maxLines) lines.push(line);
  if (truncated && lines.length > 0) {
    let lastLine = lines[lines.length - 1];
    while (lastLine && context.measureText(`${lastLine}…`).width > maxWidth) {
      lastLine = lastLine.slice(0, -1);
    }
    lines[lines.length - 1] = `${lastLine}…`;
  }
  return lines;
}

function drawLines(
  context: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
) {
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Share card could not be rendered'));
    }, 'image/png');
  });
}

async function loadComparisonSprite(src?: string): Promise<HTMLImageElement | null> {
  // Only same-origin, repo-owned pixel assets. A missing image never blocks sharing.
  if (!src || !/^\/assets\/characters\/candidates\/[0-9a-f-]{36}\.png$/i.test(src)) return null;
  return new Promise((resolve) => {
    const image = new Image();
    const finish = (result: HTMLImageElement | null) => {
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(result);
    };
    const timer = window.setTimeout(() => finish(null), 1800);
    image.onload = () => finish(image.naturalWidth && image.naturalHeight ? image : null);
    image.onerror = () => finish(null);
    image.src = src;
  });
}

async function drawComparisonCard(
  context: CanvasRenderingContext2D,
  input: ShareCardInput,
  rows: ShareComparisonRow[],
) {
  context.font = font('400 17px');
  const images = await Promise.all(rows.map((row) => (
    row.sprite?.credit && context.measureText(row.sprite.credit).width <= 506
      ? loadComparisonSprite(row.sprite.src)
      : Promise.resolve(null)
  )));
  const creditLines: string[] = [];
  const seenCredits = new Set<string>();
  const creditPrefix = input.comparisonCreditLabel ?? '小人圖：';
  const separator = '  ·  ';
  context.font = font('400 17px');
  rows.forEach((row, i) => {
    if (!images[i] || !row.sprite) return;
    const credit = row.sprite.credit;
    if (seenCredits.has(credit)) return;
    const last = creditLines[creditLines.length - 1];
    const text = last ? last + separator + credit : creditPrefix + credit;
    if (context.measureText(text).width <= 1112) {
      if (last) creditLines[creditLines.length - 1] = text;
      else creditLines.push(text);
    } else if (creditLines.length < 2 && context.measureText(credit).width <= 1112) {
      creditLines.push(credit);
    } else {
      // Never export an illustration when its full credit would be omitted.
      images[i] = null;
      return;
    }
    seenCredits.add(credit);
  });
  const backdrop = context.createLinearGradient(0, 0, cardWidth, cardHeight);
  backdrop.addColorStop(0, '#10283d');
  backdrop.addColorStop(0.7, '#091525');
  backdrop.addColorStop(1, '#123145');
  context.fillStyle = backdrop;
  context.fillRect(0, 0, cardWidth, cardHeight);
  context.fillStyle = '#67e8f9';
  context.fillRect(44, 36, 36, 5);
  context.font = font('700 23px');
  context.fillText('公職資料觀測站', 96, 45);
  context.textAlign = 'right';
  context.fillText(input.eyebrow, 1156, 45);
  context.textAlign = 'left';
  context.fillStyle = '#fff';
  context.font = font('700 46px');
  drawLines(context, fitLines(context, input.comparisonTitle || input.title, 1112, 1), 44, 108, 49);
  context.fillStyle = '#cbd5e1';
  context.font = font('600 25px');
  drawLines(context, fitLines(context, input.comparisonContext ?? '', 1112, 2), 44, 150, 29);

  const tileTop = 199;
  const gap = 16;
  const short = rows.length > 2;
  const height = short ? 160 : 336;
  const half = (1112 - gap) / 2;
  rows.forEach((row, i) => {
    const x = 44 + (i % 2) * (half + gap);
    const y = tileTop + Math.floor(i / 2) * (height + gap);
    const width = rows.length === 3 && i === 2 ? 1112 : half;
    context.fillStyle = '#13283b';
    context.fillRect(x, y, width, height);
    context.fillStyle = row.available ? '#67e8f9' : '#7891a7';
    context.fillRect(x, y, 4, height);
    const textX = x + 21;
    const image = images[i];
    const imageSize = short ? 76 : 114;
    const headWidth = width - 42 - (image ? imageSize + 12 : 0);
    context.font = font('600 20px');
    drawLines(context, fitLines(context, [row.number, row.status].filter(Boolean).join('  ·  '), headWidth, 1), textX, y + 29, 22);
    context.fillStyle = '#fff';
    context.font = font(short ? '700 31px' : '700 39px');
    drawLines(context, fitLines(context, row.name, headWidth, 1), textX, y + (short ? 67 : 79), 40);
    if (image) {
      const scale = Math.min(imageSize / image.naturalWidth, imageSize / image.naturalHeight);
      const w = image.naturalWidth * scale;
      const h = image.naturalHeight * scale;
      context.imageSmoothingEnabled = false;
      context.drawImage(image, x + width - 18 - (imageSize + w) / 2, y + 14 + imageSize - h, w, h);
      context.imageSmoothingEnabled = true;
    }
    context.fillStyle = '#dbe5ef';
    context.font = font(short ? '400 21px' : '400 27px');
    drawLines(context, fitLines(context, row.excerpt, short && image ? headWidth : width - 42, short ? 2 : 6),
      textX, y + (short ? 104 : 158), short ? 25 : 32);
  });
  context.fillStyle = '#34516a';
  context.fillRect(44, 549, 1112, 1);
  context.fillStyle = '#d0dce9';
  context.font = font('500 20px');
  const footerY = creditLines.length > 0 ? 574 : 592;
  drawLines(context, fitLines(context, input.footer, 900, 1), 44, footerY, 24);
  context.textAlign = 'right';
  context.fillStyle = '#67e8f9';
  context.fillText(new URL(input.url).hostname, 1156, footerY);
  context.textAlign = 'left';
  context.fillStyle = '#cbd5e1';
  context.font = font('400 17px');
  drawLines(context, creditLines, 44, 600, 20);
}

export async function createShareCardFile(
  input: ShareCardInput,
  fileName: string,
) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = cardWidth;
  canvas.height = cardHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');

  if (input.comparisonRows && input.comparisonRows.length >= 2 && input.comparisonRows.length <= 4) {
    await drawComparisonCard(context, input, input.comparisonRows);
    return new File([await canvasBlob(canvas)], fileName, { type: 'image/png' });
  }
  context.fillStyle = '#07101f';
  context.fillRect(0, 0, cardWidth, cardHeight);

  context.strokeStyle = 'rgba(34, 211, 238, 0.10)';
  context.lineWidth = 1;
  for (let x = 0; x <= cardWidth; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, cardHeight);
    context.stroke();
  }
  for (let y = 0; y <= cardHeight; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(cardWidth, y);
    context.stroke();
  }

  context.fillStyle = '#22d3ee';
  context.fillRect(0, 0, 18, cardHeight);
  context.fillRect(64, 112, 110, 6);

  context.fillStyle = '#f8fafc';
  context.font = `700 30px ${cardFont}`;
  context.fillText('公職資料觀測站', 64, 72);

  context.fillStyle = '#67e8f9';
  context.font = `700 24px ${cardFont}`;
  context.fillText(input.eyebrow, 64, 156);

  context.fillStyle = '#ffffff';
  context.font = `700 54px ${cardFont}`;
  drawLines(context, fitLines(context, input.title, 1072, 2), 64, 224, 68);

  context.fillStyle = '#cbd5e1';
  context.font = `400 27px ${cardFont}`;
  drawLines(context, fitLines(context, input.body, 1072, 5), 64, 350, 36);

  context.fillStyle = '#0f2038';
  context.fillRect(64, 532, 1072, 1);

  context.fillStyle = '#94a3b8';
  context.font = `400 23px ${cardFont}`;
  context.fillText(input.footer, 64, 576);

  context.textAlign = 'right';
  context.fillStyle = '#67e8f9';
  context.font = `700 23px ${cardFont}`;
  context.fillText(new URL(input.url).hostname, 1136, 576);
  context.textAlign = 'left';

  const blob = await canvasBlob(canvas);
  return new File([blob], fileName, { type: 'image/png' });
}
