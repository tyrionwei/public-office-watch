// Source-specific tokenizer: comments and raw text are not HTML elements.
function tokens(html) {
  const out = [];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4);
      if (end < 0) throw new Error('Unclosed HTML comment');
      i = end + 3; continue;
    }
    if (html[i] !== '<' || !/^<\/?[a-zA-Z][\w:-]*(?:\s|\/?>)/u.test(html.slice(i))) {
      const end = html.indexOf('<', i + 1);
      const next = end < 0 ? html.length : end;
      out.push({ kind: 'text', value: html.slice(i, next) });
      i = next; continue;
    }
    let j = i + 1, quote = null;
    for (; j < html.length; j++) {
      const c = html[j];
      if (quote) { if (c === quote) quote = null; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
    }
    if (j === html.length) throw new Error('Unclosed HTML tag');
    const value = html.slice(i, j + 1), match = value.match(/^<(\/?)([\w:-]+)/u);
    const name = match[2].toLowerCase(), closing = match[1] === '/';
    i = j + 1;
    if (!closing && ['script','style','textarea','title','xmp'].includes(name)) {
      const end = new RegExp('</' + name + '\\s*>', 'giu');
      end.lastIndex = i;
      if (!end.exec(html)) throw new Error('Unclosed raw-text element');
      i = end.lastIndex; continue;
    }
    out.push({ kind: 'tag', name, closing, value, selfClosing: /\/\s*>$/u.test(value) });
  }
  return out;
}
export function pingtungProfileListHtml(html, label) {
  if (!['縣長學歷','縣長經歷'].includes(label)) throw new Error('Unsupported section');
  const stream = tokens(html), headings = [];
  for (let i = 0; i < stream.length; i++) {
    if (stream[i].kind !== 'tag' || stream[i].name !== 'h4' || stream[i].closing) continue;
    let text = '', end = i + 1;
    for (; end < stream.length; end++) {
      const t = stream[end];
      if (t.kind === 'tag' && t.name === 'h4' && t.closing) break;
      if (t.kind === 'tag' && /^h[1-6]$/u.test(t.name)) throw new Error('Unclosed heading');
      if (t.kind === 'text') text += t.value;
    }
    if (end === stream.length) throw new Error('Unclosed heading');
    if (text.trim() === label) headings.push(end + 1);
    i = end;
  }
  if (headings.length !== 1) throw new Error('Missing or ambiguous profile heading');
  let start = headings[0];
  while (stream[start]?.kind === 'text' && !stream[start].value.trim()) start++;
  if (stream[start]?.kind !== 'tag' || stream[start].name !== 'ul' || stream[start].closing) throw new Error('Heading not followed by list');
  const stack = [], content = [];
  const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  for (let i = start; i < stream.length; i++) {
    const t = stream[i];
    if (t.kind === 'tag') {
      if (/^h[1-6]$/u.test(t.name) || t.name === 'footer') throw new Error('List crosses section boundary');
      if (t.closing) {
        const match = stack.lastIndexOf(t.name);
        if (match < 0) throw new Error('List crosses enclosing container boundary');
        if (stack.slice(match + 1).includes('ul')) throw new Error('List closed by another container');
        stack.length = match;
      } else if (!voids.has(t.name) && !t.selfClosing) {
        if (t.name === 'li' && stack.at(-1) === 'li') stack.pop();
        stack.push(t.name);
      }
    }
    // Do not return original attributes to downstream legacy HTML-to-text code.
    // A quoted '>' or '<h4>' is data, never markup in the extracted section.
    content.push(t.kind === 'tag' ? '<' + (t.closing ? '/' : '') + t.name + '>' : t.value);
    if (t.kind === 'tag' && t.closing && t.name === 'ul' && stack.length === 0) return content.join('');
  }
  throw new Error('Unclosed profile list');
}
