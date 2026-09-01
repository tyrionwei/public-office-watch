type ShareCardInput = {
  eyebrow: string;
  title: string;
  body: string;
  footer: string;
  url: string;
};

const cardWidth = 1200;
const cardHeight = 630;
const cardFont = '"Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif';

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
