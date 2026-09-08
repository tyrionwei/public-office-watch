const numberedMarkerSource = String.raw`(?:\d{1,3}[.、．）)]|\(\d{1,3}\)|（\d{1,3}）|[一二三四五六七八九十百]+[.、．）)]|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])`;

function stripListPrefix(value) {
  return value
    .replace(/^[\s\-–—*•●○▪◆◇★※◎‧“”‘’"'＋+.]+/u, '')
    .replace(new RegExp(`^(?:${numberedMarkerSource})\\s*`, 'u'), '')
    .replace(/\s+/gu, ' ')
    .trim();
}

const bulletPrefixPattern = /^[*•●○▪◆◇★※◎]\s*/u;

export function explicitSectionHeading(lines, index) {
  const line = lines[index]?.trim() ?? '';
  if (!line) return null;
  const nextLine = lines.slice(index + 1).find((candidate) => candidate.trim())?.trim() ?? '';
  const markdownHeading = line.match(/^#{1,6}\s+(.+)$/u)?.[1]?.trim() ?? null;
  if (markdownHeading && bulletPrefixPattern.test(nextLine)) return stripListPrefix(markdownHeading);
  const numberedHeading = /^[一二三四五六七八九十百]+[.、．）)]\s*/u.test(line) && bulletPrefixPattern.test(nextLine)
    ? stripListPrefix(line)
    : null;
  if (numberedHeading) return numberedHeading;
  const bulletHeading = line.match(/^[•●○▪◆◇★※◎]\s*(.+)$/u)?.[1]?.trim() ?? null;
  if (bulletHeading && /^(?:\d{1,3}[.、．）)]|\(\d{1,3}\)|（\d{1,3}）|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*/u.test(nextLine)) return stripListPrefix(bulletHeading);
  if (/[>＞]\s*$/u.test(line)) return stripListPrefix(line.replace(/[>＞]\s*$/u, ''));
  if (
    /^[\p{Script=Han}]{2,8}$/u.test(line)
    && bulletPrefixPattern.test(nextLine)
  ) {
    return line;
  }
  return null;
}

