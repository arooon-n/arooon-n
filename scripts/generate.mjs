// Builds every image in assets/ and README.md from network.config.json. No dependencies.
//   npm run build                     public data only; repoTotal comes from the config
//   PROFILE_TOKEN=xxx npm run build   counts private repos and contributions automatically
//
// The concept is a designer's desk: every section is a different object rather than a repeated
// panel. A design canvas, a printed poster, paint chips, browser windows, a bento of living
// illustrations, a mechanical keyboard, and one LED departure board. Text is drawn as outlines
// from scripts/fonts.json, because README images cannot load web fonts.
//
// Privacy rule: private repositories are only ever COUNTED. Their names are never requested,
// stored or drawn. A private project appears by name only if you add it to the config yourself.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => JSON.parse(fs.readFileSync(path.join(ROOT, ...p), 'utf8'));
const cfg = read('network.config.json');
const FONTS = read('scripts', 'fonts.json');
const LOGOS = read('scripts', 'logos.json');
const ASSETS = path.join(ROOT, 'assets');
const SOURCES = path.join(ROOT, 'sources');

// ---------------------------------------------------------------- tokens
const INK = { canvas: '#14161B', raised: '#1C1F26', line: '#2A2E37', text: '#F2F4F7', text2: '#BDC3CD', muted: '#8B94A1' };
const AMBER = '#FFB000';
const LED = { bg: '#0B0A08', on: '#FFB000', dim: '#A87400', off: '#1C1710', edge: '#332A1B' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const STILL = '@media (prefers-reduced-motion:reduce)';

// ---------------------------------------------------------------- type as outlines
let glyphDefs = new Map();
function textWidth(str, size, f = 'body', track = 0) {
  const font = FONTS[f];
  const chars = [...str];
  let pen = 0;
  chars.forEach((ch, i) => {
    const g = font.glyphs[ch] ?? font.glyphs[' '];
    pen += g[1] + (font.kern[ch + chars[i + 1]] ?? 0) + track * font.upm;
  });
  return (pen * size) / font.upm;
}
function text(str, x, y, size, { f = 'body', fill = INK.text, anchor = 'start', track = 0, cls = '' } = {}) {
  const font = FONTS[f];
  const chars = [...str];
  let pen = 0;
  let uses = '';
  chars.forEach((ch, i) => {
    const g = font.glyphs[ch] ?? font.glyphs[' '];
    if (g[0]) {
      const id = `g${f[0]}${ch.codePointAt(0)}`;
      if (!glyphDefs.has(id)) glyphDefs.set(id, `<path id="${id}" d="${g[0]}"/>`);
      uses += `<use href="#${id}" x="${Math.round(pen)}"/>`;
    }
    pen += g[1] + (font.kern[ch + chars[i + 1]] ?? 0) + track * font.upm;
  });
  const s = size / font.upm;
  const width = pen * s;
  const sx = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x;
  return `<g transform="translate(${sx.toFixed(1)} ${y}) scale(${s.toFixed(4)})" fill="${fill}"${cls ? ` class="${cls}"` : ''}>${uses}</g>`;
}
function wrap(str, maxW, size, f = 'body') {
  const lines = [];
  let line = '';
  for (const word of str.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size, f) > maxW && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
const svg = (w, h, title, desc, style, body) => {
  const defs = glyphDefs.size ? `<defs>${[...glyphDefs.values()].join('')}</defs>` : '';
  glyphDefs = new Map();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="t${desc ? ' d' : ''}">` +
    `<title id="t">${esc(title)}</title>${desc ? `<desc id="d">${esc(desc)}</desc>` : ''}${style ? `<style>${style}</style>` : ''}${defs}${body}</svg>`;
};

// ---------------------------------------------------------------- small helpers
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function rounded(pts, r = 14) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    const la = Math.hypot(b[0] - a[0], b[1] - a[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const k = Math.min(r, la / 2, lc / 2);
    d += `L${(b[0] - ((b[0] - a[0]) / la) * k).toFixed(1)} ${(b[1] - ((b[1] - a[1]) / la) * k).toFixed(1)}Q${b[0]} ${b[1]} ${(b[0] + ((c[0] - b[0]) / lc) * k).toFixed(1)} ${(b[1] + ((c[1] - b[1]) / lc) * k).toFixed(1)}`;
  }
  const z = pts[pts.length - 1];
  return `${d}L${z[0]} ${z[1]}`;
}
const logoPath = (id, x, y, size, fill, cls = '') => {
  const l = LOGOS[id];
  if (!l) throw new Error(`No logo called ${id}`);
  return `<path transform="translate(${x} ${y}) scale(${(size / 24).toFixed(3)})" d="${l.d}" fill="${fill}"${cls ? ` class="${cls}"` : ''}/>`;
};
const lum = (h) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// Lifts a brand colour until it reads on a dark surface, keeping its hue. Black logos become near-white.
function legible(hex, surface = '#262A31', min = 4.3) {
  if (lum(hex) < 0.02) return '#ECEEF1';
  let [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let out = hex;
  for (let i = 0; i < 20 && contrast(out, surface) < min; i++) {
    r += (255 - r) * 0.12; g += (255 - g) * 0.12; b += (255 - b) * 0.12;
    out = `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
  }
  return out;
}
const ALIEN = 'M0-18C-11-18-16-10-16-3-16 7-6 16 0 18 6 16 16 7 16-3 16-10 11-18 0-18Z';
const ALIEN_EYES = 'M-10-3C-6-4-3-1-3 3-7 3-10 1-10-3ZM10-3C6-4 3-1 3 3 7 3 10 1 10-3Z';

// ---------------------------------------------------------------- hero: a live design canvas
function hero() {
  const W = 1000, H = 470;
  const size = 760 / textWidth(cfg.name, 1, 'display', -0.02);
  const nameX = 58, base = 196;
  const nameW = textWidth(cfg.name, size, 'display', -0.02);
  const box = { x: nameX - 16, y: base - size * 0.8, w: nameW + 34, h: size * 1.02 };
  const handles = [[0, 0], [0.5, 0], [1, 0], [0, 1], [0.5, 1], [1, 1], [0, 0.5], [1, 0.5]]
    .map(([a, b]) => `<rect x="${(box.x + a * box.w - 5).toFixed(1)}" y="${(box.y + b * box.h - 5).toFixed(1)}" width="10" height="10" rx="1.5" fill="#fff" stroke="${AMBER}" stroke-width="2"/>`).join('');
  const dims = `W ${Math.round(box.w)}  ×  H ${Math.round(box.h)}`;
  const dimW = textWidth(dims, 12.5, 'mono') + 18;
  const dimX = box.x + box.w / 2 - dimW / 2;

  let rulers = '';
  for (let x = 50; x < W; x += 50) rulers += `<path d="M${x} ${x % 100 ? 18 : 12}V24" stroke="#4A505C"/>` + (x % 100 ? '' : text(String(x), x + 4, 12, 9.5, { f: 'mono', fill: '#6F7886' }));
  for (let y = 50; y < H; y += 50) rulers += `<path d="M${y % 100 ? 18 : 12} ${y}H24" stroke="#4A505C"/>`;

  const cursor = (color, label, dark) => {
    const w = textWidth(label, 13.5, 'title') + 20;
    return `<path d="M0 0L5 19L9.5 11.5L18 10.5Z" fill="${color}" stroke="#14161B" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<g class="cl"><rect x="14" y="16" width="${w.toFixed(1)}" height="25" rx="12.5" fill="${color}"/>${text(label, 24, 33, 13.5, { f: 'title', fill: dark ? '#14161B' : '#fff' })}</g>`;
  };
  const tracks = [
    ['M690 372C780 310 880 380 790 412C680 438 620 350 690 372Z', AMBER, 19, true],
    ['M850 70C900 130 880 240 800 262C730 280 760 120 850 70Z', '#3DDC84', 23, true],
    ['M450 376C530 340 620 360 570 404C510 436 400 420 450 376Z', '#FF6FB5', 17, true],
    ['M640 290C720 250 870 280 860 340C840 400 620 370 640 290Z', '#5BB8FF', 26, true],
  ];
  const starts = [[690, 372], [850, 70], [450, 376], [640, 290]];
  const moving = tracks.map(([d, c, dur, dark], i) => `<g class="mv">${cursor(c, cfg.cursors[i], dark)}<animateMotion dur="${dur}s" begin="-${i * 3}s" repeatCount="indefinite" path="${d}"/></g>`).join('');
  const still = tracks.map(([, c, , dark], i) => `<g class="st" transform="translate(${starts[i][0]} ${starts[i][1]})">${cursor(c, cfg.cursors[i], dark)}</g>`).join('');
  const bioW = textWidth(cfg.bio, 16, 'mono') + 30;

  const style = `.st{display:none}${STILL}{.mv{display:none}.st{display:inline}}` +
    '@media (max-width:560px){.rl,.mt,.pin,.dm,.cl{display:none}}';
  const body =
    `<defs><pattern id="dg" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1" fill="${INK.line}"/></pattern></defs>` +
    `<rect width="${W}" height="${H}" rx="14" fill="${INK.canvas}"/><rect width="${W}" height="${H}" rx="14" fill="url(#dg)"/>` +
    `<g class="rl"><path d="M14 0H${W - 14}Q${W} 0 ${W} 14V24H0V14Q0 0 14 0Z" fill="${INK.raised}"/><path d="M0 24H24V${H - 14}Q24 ${H} 14 ${H}Q0 ${H} 0 ${H - 14}Z" fill="${INK.raised}"/>${rulers}</g>` +
    `<rect x="${box.x.toFixed(1)}" y="${box.y.toFixed(1)}" width="${box.w.toFixed(1)}" height="${box.h.toFixed(1)}" fill="${AMBER}" fill-opacity=".05" stroke="${AMBER}" stroke-width="2"/>` +
    text(cfg.name, nameX, base, size, { f: 'display', track: -0.02 }) + handles +
    `<g class="dm"><rect x="${dimX.toFixed(1)}" y="${(box.y + box.h + 11).toFixed(1)}" width="${dimW.toFixed(1)}" height="23" rx="4" fill="${AMBER}"/>${text(dims, box.x + box.w / 2, Math.round(box.y + box.h + 27), 12.5, { f: 'mono', fill: '#14161B', anchor: 'middle' })}</g>` +
    text(cfg.subtitle, nameX, 300, 47, { f: 'serif', fill: INK.text }) +
    `<g class="mt">${text(cfg.meta, nameX, 339, 14.5, { f: 'mono', fill: INK.muted })}</g>` +
    `<g class="pin"><circle cx="79" cy="408" r="22" fill="#2A2E37"/><g transform="translate(79 408) scale(.85)"><path d="${ALIEN}" fill="#7BE08F"/><path d="${ALIEN_EYES}" fill="#14161B"/></g>` +
    `<path d="M108 384H${(108 + bioW).toFixed(1)}a12 12 0 0 1 12 12V420a12 12 0 0 1-12 12H112a12 12 0 0 1-12-12V392a8 8 0 0 1 8-8Z" fill="#F2F4F7"/>${text(cfg.bio, 116, 414, 16, { f: 'mono', fill: '#14161B' })}</g>` +
    moving + still;
  return svg(W, H, `${cfg.name}. ${cfg.subtitle}`, `A design canvas with the name ${cfg.name} in a selection box, and labelled cursors for ${cfg.cursors.join(', ')}. Bio: ${cfg.bio}.`, style, body);
}

// ---------------------------------------------------------------- statement: a printed poster
function statement() {
  const W = 1000;
  const faces = { display: 'display', serif: 'serif', serifbox: 'serif' };
  const lineWidth = (line, s) => line.reduce((sum, [t, k]) => sum + textWidth(t, k === 'display' ? s : s * 1.18, faces[k], k === 'display' ? -0.02 : 0), 0);
  const widest = Math.max(...cfg.statement.lines.map((l) => lineWidth(l, 1)));
  const size = Math.floor(888 / widest);
  const lead = Math.round(size * 1.14);
  const top = 56 + size * 0.8;
  const H = Math.ceil(top + lead * (cfg.statement.lines.length - 1) + 92);
  let body = `<rect width="${W}" height="${H}" rx="14" fill="${AMBER}"/>`;
  let caret = '';
  cfg.statement.lines.forEach((line, i) => {
    let x = 54;
    const y = Math.round(top + i * lead);
    line.forEach(([t, k]) => {
      const s = k === 'display' ? size : Math.round(size * 1.18);
      const w = textWidth(t, s, faces[k], k === 'display' ? -0.02 : 0);
      if (k === 'serifbox') {
        body += `<rect x="${(x - 8).toFixed(1)}" y="${(y - s * 0.76).toFixed(1)}" width="${(w + 20).toFixed(1)}" height="${(s * 0.98).toFixed(1)}" rx="6" fill="#14161B"/>`;
        body += text(t, x, y, s, { f: 'serif', fill: AMBER });
        caret = `<rect class="cr" x="${(x + w + 20).toFixed(1)}" y="${(y - s * 0.76).toFixed(1)}" width="6" height="${(s * 0.98).toFixed(1)}" fill="#14161B"/>`;
      } else {
        body += text(t, x, y, s, { f: faces[k], fill: '#14161B', track: k === 'display' ? -0.02 : 0 });
      }
      x += w + (k === 'display' ? 4 : 0);
    });
  });
  const y2 = H - 32;
  body += caret + `<g class="fn"><path d="M54 ${y2 - 28}H946" stroke="#14161B" stroke-opacity=".35"/>${text(cfg.statement.footnote, 54, y2, 17, { f: 'mono', fill: '#14161B' })}</g>`;
  const style = `.cr{animation:cr 1.1s steps(1) infinite}@keyframes cr{50%{opacity:0}}${STILL}{.cr{animation:none}}@media (max-width:560px){.fn{display:none}}`;
  return svg(W, H, cfg.statement.alt, '', style, body);
}

// ---------------------------------------------------------------- contact: paint chips
function chip(c) {
  const W = 323, H = 250, block = 164;
  const fill = c.gradient ? 'url(#gr)' : c.color;
  const grad = c.gradient ? `<defs><linearGradient id="gr" x1="0" y1="1" x2="1" y2="0">${c.gradient.map((s, i) => `<stop offset="${i / (c.gradient.length - 1)}" stop-color="${s}"/>`).join('')}</linearGradient></defs>` : '';
  const shape = `M12 0H${W - 12}Q${W} 0 ${W} 12V${block}H0V12Q0 0 12 0Z`;
  const valueSize = Math.min(14.5, (W - 44) / (textWidth(c.value, 1, 'mono')));
  const body = grad +
    `<rect width="${W}" height="${H}" rx="12" fill="#fff"/><rect x=".75" y=".75" width="${W - 1.5}" height="${H - 1.5}" rx="11.5" fill="none" stroke="#D9DDE3" stroke-width="1.5"/>` +
    `<path d="${shape}" fill="${fill}"/>` + logoPath(c.logo, W / 2 - 42, block / 2 - 42, 84, '#fff') +
    `<g class="w">${text(c.name, 22, block + 38, 25, { f: 'title', fill: '#14161B' })}${text(c.value, 22, block + 66, valueSize, { f: 'mono', fill: '#3F4651' })}</g>` +
    `<g class="n">${text(c.name, W / 2, block + 58, 46, { f: 'title', fill: '#14161B', anchor: 'middle' })}</g>`;
  return svg(W, H, `${c.name}: ${c.value}`, '', '.n{display:none}@media (max-width:180px){.w{display:none}.n{display:inline}}', body);
}

// ---------------------------------------------------------------- live sites: browser plus search snippet
function site(s) {
  const W = 492, shotW = 452, shotH = 282, x = 20;
  const jpg = fs.readFileSync(path.join(SOURCES, s.image)).toString('base64');
  const titleLines = wrap(s.seoTitle, W - 2 * x - 10, 17.5, 'title').slice(0, 2);
  const descLines = wrap(s.seoDesc, W - 2 * x - 10, 13.5, 'body').slice(0, 3);
  const top = 62 + shotH + 18;
  let y = top + 22;
  let serp = text(s.domain, x + 2, y, 12.5, { f: 'mono', fill: '#7FD9A0' });
  y += 8;
  titleLines.forEach((t) => { y += 22; serp += text(t, x + 2, y, 17.5, { f: 'title', fill: '#8FC0FF' }); });
  y += 3;
  descLines.forEach((t) => { y += 19; serp += text(t, x + 2, y, 13.5, { f: 'body', fill: INK.text2 }); });
  const H = Math.ceil(y + 22);
  const urlW = textWidth(s.domain, 12.5, 'mono') + 26;
  const body =
    `<rect width="${W}" height="${H}" rx="12" fill="${INK.canvas}"/>` +
    `<path d="M${x} 62V30a10 10 0 0 1 10-10H${x + shotW - 10}a10 10 0 0 1 10 10V62Z" fill="${INK.raised}"/>` +
    [0, 1, 2].map((i) => `<circle cx="${x + 18 + i * 16}" cy="41" r="4.5" fill="#3C424E"/>`).join('') +
    `<rect x="${x + 78}" y="29" width="${urlW}" height="24" rx="12" fill="${INK.canvas}"/>${text(s.domain, x + 91, 45.5, 12.5, { f: 'mono', fill: INK.text2 })}` +
    `<circle class="lv" cx="${x + shotW - 54}" cy="41" r="4.5" fill="#3DDC84"/>${text('LIVE', x + shotW - 16, 45.5, 12.5, { f: 'mono', fill: '#7FD9A0', anchor: 'end' })}` +
    `<defs><clipPath id="s"><path d="M${x} 62H${x + shotW}V${62 + shotH - 8}a8 8 0 0 1-8 8H${x + 8}a8 8 0 0 1-8-8Z"/></clipPath></defs>` +
    `<image href="data:image/jpeg;base64,${jpg}" x="${x}" y="62" width="${shotW}" height="${shotH}" clip-path="url(#s)" preserveAspectRatio="xMidYMin slice"/>` +
    `<g class="sp">${serp}</g>` +
    `<g class="n">${text(s.domain, W / 2, top + 58, 36, { f: 'title', anchor: 'middle', fill: INK.text })}</g>`;
  const style = `.n{display:none}.lv{animation:lv 2s steps(1) infinite}@keyframes lv{50%{opacity:.35}}${STILL}{.lv{animation:none}}@media (max-width:300px){.sp{display:none}.n{display:inline}}`;
  return svg(W, H, `${s.domain}: live website`, s.alt, style, body);
}

// ---------------------------------------------------------------- living illustrations, one per project
const ART = {
  // Metro lines with trains running on them.
  network(x, y, w, h, c) {
    const m = (px, py) => [Math.round(x + px * w), Math.round(y + py * h)];
    const routes = [
      [[0, 0.18], [0.36, 0.18], [0.62, 0.5], [1, 0.5]],
      [[0.08, 0.92], [0.3, 0.92], [0.62, 0.5], [0.8, 0.12], [1, 0.12]],
      [[0, 0.56], [0.28, 0.56], [0.5, 0.86], [1, 0.86]],
    ];
    const colors = [c, '#F2F4F7', '#FF8FB8'];
    let out = '';
    routes.forEach((r, i) => {
      const d = rounded(r.map(([a, b]) => m(a, b)), 12);
      out += `<path id="r${i}" d="${d}" fill="none" stroke="${colors[i]}" stroke-width="6" stroke-linecap="round"/>`;
    });
    const stops = [[0.18, 0.18, 0], [0.78, 0.5, 0], [0.2, 0.92, 1], [0.9, 0.12, 1], [0.14, 0.56, 2], [0.76, 0.86, 2]];
    stops.forEach(([a, b, k]) => { const [px, py] = m(a, b); out += `<circle cx="${px}" cy="${py}" r="6.5" fill="#fff" stroke="${colors[k]}" stroke-width="3.5"/>`; });
    const [ix, iy] = m(0.62, 0.5);
    out += `<circle cx="${ix}" cy="${iy}" r="10" fill="${INK.canvas}" stroke="#fff" stroke-width="3.5"/>`;
    routes.forEach((_, i) => {
      out += `<g class="mv"><rect x="-10" y="-4.5" width="20" height="9" rx="4.5" fill="#14161B" stroke="#fff" stroke-width="2"/><animateMotion dur="${9 + i * 3}s" begin="-${i * 2}s" repeatCount="indefinite" rotate="auto"><mpath href="#r${i}"/></animateMotion></g>`;
    });
    return { out, css: '' };
  },
  // Scrolling EEG channels.
  eeg(x, y, w, h, c) {
    const rand = rng(77);
    const rows = 4;
    let paths = '';
    for (let r = 0; r < rows; r++) {
      const cy = y + ((r + 0.5) * h) / rows;
      const harm = [2, 3, 5, 8, 13].map((k) => [k, (3 + rand() * 6) / Math.sqrt(k), rand() * 6.28]);
      const spikeAt = rand();
      let d = '';
      for (let i = 0; i <= 2 * w; i += 3) {
        const t = (i % w) / w;
        let v = 0;
        harm.forEach(([k, a, ph]) => { v += a * Math.sin(2 * Math.PI * k * t + ph); });
        v += 16 * Math.exp(-(((t - spikeAt) * 40) ** 2)) * Math.sin(t * 240);
        d += `${i ? 'L' : 'M'}${x + i} ${(cy + v).toFixed(1)}`;
      }
      paths += `<g class="sc s${r}"><path d="${d}" fill="none" stroke="${c}" stroke-opacity="${0.55 + r * 0.15}" stroke-width="2" stroke-linejoin="round"/></g>`;
    }
    const css = `.sc{animation:sc 9s linear infinite}.s1{animation-duration:12s}.s2{animation-duration:7.5s}.s3{animation-duration:10.5s}@keyframes sc{to{transform:translateX(-${w}px)}}${STILL}{.sc{animation:none}}`;
    return { out: `<defs><clipPath id="ac"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#ac)">${paths}</g>`, css };
  },
  // A student's phone: a live waveform turning into notes.
  phone(x, y, w, h, c) {
    const pw = 84, ph = h - 4, px = x + w / 2 - pw / 2, py = y + 2;
    let bars = '';
    for (let i = 0; i < 9; i++) bars += `<rect class="b b${i % 4}" x="${px + 12 + i * 7}" y="${py + 16}" width="4" height="30" rx="2" fill="${c}"/>`;
    const notes = [0, 1, 2, 3].map((i) => `<rect class="nl n${i}" x="${px + 12}" y="${py + 60 + i * 13}" width="${[60, 44, 54, 34][i]}" height="6" rx="3" fill="#F2F4F7" fill-opacity=".85"/>`).join('');
    const side = (ox, oy, rot, label) => `<g transform="translate(${ox} ${oy}) rotate(${rot})"><rect x="-30" y="-20" width="60" height="40" rx="6" fill="#262A31" stroke="${c}" stroke-opacity=".6"/>${label}</g>`;
    const out = `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="14" fill="#0F1115" stroke="#F2F4F7" stroke-opacity=".7" stroke-width="2.5"/>${bars}${notes}` +
      side(x + w / 2 - 92, y + h * 0.36, -8, '<path d="M-16-6H16M-16 3H8" stroke="#BDC3CD" stroke-width="3" stroke-linecap="round"/>') +
      side(x + w / 2 + 92, y + h * 0.62, 7, `<path d="M-12 1L-3 9L13-8" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);
    const css = '.b{transform-box:fill-box;transform-origin:center;animation:b .9s ease-in-out infinite alternate}.b1{animation-delay:-.3s}.b2{animation-delay:-.55s}.b3{animation-delay:-.8s}@keyframes b{from{transform:scaleY(.25)}to{transform:scaleY(1)}}' +
      '.nl{animation:nl 6s steps(1) infinite}.n1{animation-delay:.6s}.n2{animation-delay:1.2s}.n3{animation-delay:1.8s}@keyframes nl{0%{opacity:.15}12%{opacity:1}80%{opacity:1}92%{opacity:.15}}' +
      `${STILL}{.b,.nl{animation:none}}`;
    return { out, css };
  },
  // Streaming candles. Filled means up, hollow means down, so colour never carries it alone.
  candles(x, y, w, h, c) {
    const rand = rng(1234);
    const n = Math.floor(w / 15);
    const moves = Array.from({ length: n }, () => (rand() - 0.5) * 34);
    const drift = moves.reduce((a, b) => a + b, 0) / n;
    let level = 0;
    const cs = moves.map((m) => { const o = level; level += m - drift; return [o, level]; });
    const ext = Math.max(...cs.flat().map(Math.abs)) || 1;
    const k = (h * 0.34) / ext;
    const mid = y + h / 2;
    const step = w / n;
    let d = '';
    let line = '';
    for (let copy = 0; copy < 2; copy++) cs.forEach(([o, e], i) => {
      const cx = x + (copy * n + i) * step + step / 2;
      const y1 = mid - o * k, y2 = mid - e * k;
      const hi = Math.min(y1, y2) - 4 - ((i * 7) % 12), lo = Math.max(y1, y2) + 4 + ((i * 5) % 12);
      const up = e >= o;
      d += `<path d="M${cx.toFixed(1)} ${hi.toFixed(1)}V${lo.toFixed(1)}" stroke="${c}" stroke-opacity=".7" stroke-width="1.5"/>`;
      d += `<rect x="${(cx - 5).toFixed(1)}" y="${Math.min(y1, y2).toFixed(1)}" width="10" height="${Math.max(3, Math.abs(y1 - y2)).toFixed(1)}" rx="1.5" fill="${up ? c : INK.canvas}" stroke="${c}" stroke-width="1.5"/>`;
      line += `${line ? 'L' : 'M'}${cx.toFixed(1)} ${(mid - ((o + e) / 2) * k).toFixed(1)}`;
    });
    return {
      out: `<defs><clipPath id="ac"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#ac)"><g class="sc">${d}<path d="${line}" fill="none" stroke="#F2F4F7" stroke-width="2" stroke-linejoin="round"/></g></g>`,
      css: `.sc{animation:sc ${Math.round(n * 0.75)}s linear infinite}@keyframes sc{to{transform:translateX(-${(n * step).toFixed(1)}px)}}${STILL}{.sc{animation:none}}`,
    };
  },
  // A street grid with buses and pulsing demand.
  route(x, y, w, h, c) {
    let grid = '';
    for (let i = 0; i <= 6; i++) grid += `<path d="M${x + (i * w) / 6} ${y}V${y + h}" stroke="${INK.line}" stroke-width="2"/>`;
    for (let i = 0; i <= 4; i++) grid += `<path d="M${x} ${y + (i * h) / 4}H${x + w}" stroke="${INK.line}" stroke-width="2"/>`;
    const p = (a, b) => [Math.round(x + (a * w) / 6), Math.round(y + (b * h) / 4)];
    const r1 = [p(0, 1), p(2, 1), p(2, 3), p(5, 3), p(5, 0)];
    const r2 = [p(1, 4), p(1, 2), p(4, 2), p(4, 1), p(6, 1)];
    const d1 = rounded(r1, 10), d2 = rounded(r2, 10);
    let out = grid + `<path id="r0" d="${d1}" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/><path id="r1" d="${d2}" fill="none" stroke="#F2F4F7" stroke-opacity=".85" stroke-width="5" stroke-linecap="round"/>`;
    [p(2, 1), p(2, 3), p(5, 3), p(1, 2), p(4, 2), p(4, 1)].forEach(([a, b], i) => {
      out += `<circle class="d d${i % 3}" cx="${a}" cy="${b}" r="16" fill="${c}" fill-opacity=".25"/><circle cx="${a}" cy="${b}" r="6" fill="#fff" stroke="${INK.canvas}" stroke-width="2"/>`;
    });
    [0, 1].forEach((i) => { out += `<g class="mv"><rect x="-11" y="-6" width="22" height="12" rx="3" fill="#14161B" stroke="${i ? '#F2F4F7' : c}" stroke-width="2.5"/><animateMotion dur="${11 + i * 3}s" begin="-${i * 4}s" repeatCount="indefinite" rotate="auto"><mpath href="#r${i}"/></animateMotion></g>`; });
    const css = `.d{animation:d 3.6s steps(1) infinite}.d1{animation-delay:1.2s}.d2{animation-delay:2.4s}@keyframes d{0%{opacity:1}33%{opacity:.25}}${STILL}{.d{animation:none}}`;
    return { out, css };
  },
  // A research PDF being scanned into a table.
  doc(x, y, w, h, c) {
    const dw = 92, dh = h - 6, dx = x + w / 2 - 118, dy = y + 3;
    let lines = '';
    for (let i = 0; i < 8; i++) lines += `<rect x="${dx + 12}" y="${(dy + 11 + (i * (dh - 22)) / 7.5).toFixed(1)}" width="${[68, 56, 64, 44, 68, 52, 60, 36][i]}" height="5" rx="2.5" fill="#0F1115" fill-opacity=".55"/>`;
    const tx = x + w / 2 + 16, ty = y + 2, cw = 32, chh = 25;
    let cells = '';
    for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) {
      cells += `<rect class="ce e${(r * 3 + k) % 6}" x="${tx + k * (cw + 4)}" y="${ty + r * (chh + 4)}" width="${cw}" height="${chh}" rx="3" fill="${r === 0 ? '#F2F4F7' : c}" fill-opacity="${r === 0 ? 0.85 : 0.75}"/>`;
    }
    const out = `<rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" rx="6" fill="#E9ECF1"/>${lines}` +
      `<g class="sb"><rect x="${dx - 5}" y="${dy + 8}" width="${dw + 10}" height="5" rx="2.5" fill="${c}"/></g>` +
      `<path d="M${dx + dw + 14} ${y + h / 2}H${tx - 12}m-8-7l8 7-8 7" fill="none" stroke="#F2F4F7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${cells}`;
    const css = `.sb{animation:sb 3.2s ease-in-out infinite alternate}@keyframes sb{to{transform:translateY(${dh - 20}px)}}` +
      '.ce{animation:ce 4.8s steps(1) infinite}.e1{animation-delay:.8s}.e2{animation-delay:1.6s}.e3{animation-delay:2.4s}.e4{animation-delay:3.2s}.e5{animation-delay:4s}@keyframes ce{0%{opacity:1}70%{opacity:1}85%{opacity:.25}}' +
      `${STILL}{.sb,.ce{animation:none}}`;
    return { out, css };
  },
  // Hand landmarks, the way a tracker sees them, with the cursor they steer.
  hand(x, y, w, h, c) {
    const pts = [[0.5, 1], [0.32, 0.87], [0.2, 0.7], [0.11, 0.56], [0.03, 0.46], [0.36, 0.48], [0.33, 0.28], [0.31, 0.15], [0.3, 0.03], [0.5, 0.45], [0.5, 0.22], [0.5, 0.09], [0.5, 0], [0.64, 0.48], [0.66, 0.28], [0.67, 0.16], [0.68, 0.05], [0.77, 0.56], [0.82, 0.41], [0.85, 0.31], [0.88, 0.21]];
    const s = h * 0.98;
    const ox = x + w / 2 - s * 0.62, oy = y + 2;
    const q = ([a, b]) => [(ox + a * s).toFixed(1), (oy + b * s).toFixed(1)];
    const chains = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12], [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]];
    let out = '<g class="hd">';
    chains.forEach((ch) => { out += `<path d="M${ch.map((i) => q(pts[i]).join(' ')).join('L')}" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`; });
    pts.forEach((p) => { const [a, b] = q(p); out += `<circle cx="${a}" cy="${b}" r="4" fill="#F2F4F7"/>`; });
    out += '</g>';
    const [tx, ty] = q(pts[8]);
    const cx = Number(tx) + s * 0.82, cy = Number(ty) + s * 0.14;
    const track = `M0 0C-22 26 18 52 -6 86C-24 58 26 22 0 0Z`;
    out += `<circle cx="${tx}" cy="${ty}" r="8" fill="none" stroke="#F2F4F7" stroke-width="2"/>`;
    out += `<g transform="translate(${cx.toFixed(1)} ${cy.toFixed(1)})"><g class="mv"><path d="M0 0L6 23L11.5 14L22 12.5Z" fill="#F2F4F7" stroke="#14161B" stroke-width="1.5" stroke-linejoin="round"/><animateMotion dur="6s" repeatCount="indefinite" path="${track}"/></g></g>`;
    const css = `.hd{transform-box:fill-box;transform-origin:50% 100%;animation:hd 3s ease-in-out infinite alternate}@keyframes hd{from{transform:rotate(-3.5deg)}to{transform:rotate(3.5deg)}}${STILL}{.hd{animation:none}}`;
    return { out, css };
  },
  // A seasonal series running into a forecast with a widening band. Decorative shape, not results.
  forecast(x, y, w, h, c) {
    const split = 0.62;
    const f = (t) => y + h * 0.5 - h * 0.26 * Math.sin(t * 22) - h * 0.1 * Math.sin(t * 7 + 1) - h * 0.06 * t;
    const noise = rng(9);
    let hist = '', pred = '', upper = [], lower = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const px = x + t * w;
      if (t <= split) hist += `${hist ? 'L' : 'M'}${px.toFixed(1)} ${(f(t) + (noise() - 0.5) * 7).toFixed(1)}`;
      if (t >= split) {
        pred += `${pred ? 'L' : 'M'}${px.toFixed(1)} ${f(t).toFixed(1)}`;
        const spread = 4 + (t - split) * h * 0.55;
        upper.push(`${px.toFixed(1)} ${(f(t) - spread).toFixed(1)}`);
        lower.unshift(`${px.toFixed(1)} ${(f(t) + spread).toFixed(1)}`);
      }
    }
    const sx = x + split * w;
    const out = `<defs><clipPath id="ac"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><path clip-path="url(#ac)" d="M${upper.concat(lower).join('L')}Z" fill="${c}" fill-opacity=".16"/>` +
      `<path d="${hist}" fill="none" stroke="#F2F4F7" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<path d="M${sx.toFixed(1)} ${y}V${y + h}" stroke="${INK.muted}" stroke-dasharray="3 5"/>` +
      `<path id="fp" d="${pred}" fill="none" stroke="${c}" stroke-width="3" stroke-dasharray="7 6"/>` +
      `<g class="mv"><circle r="6.5" fill="${c}" stroke="${INK.canvas}" stroke-width="2"/><animateMotion dur="5s" repeatCount="indefinite"><mpath href="#fp"/></animateMotion></g>`;
    return { out, css: '' };
  },
};

// ---------------------------------------------------------------- bento cards
const CARD_H = 330;
function card(p, wide) {
  const W = wide ? 642 : 340, H = CARD_H;
  const u = `https://github.com/${cfg.user}/${p.repo}`;
  const tint = `<rect width="${W}" height="${H}" rx="12" fill="${INK.canvas}"/><rect width="${W}" height="${H}" rx="12" fill="${p.accent}" fill-opacity=".06"/>`;
  const arrow = `<path d="M${W - 36} 42L${W - 22} 28M${W - 33} 28H${W - 22}V39" fill="none" stroke="${INK.text2}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  const box = wide ? { x: W * 0.5, y: 34, w: W * 0.5 - 28, h: H - 68 } : { x: 24, y: 42, w: W - 66, h: 120 };
  const art = ART[p.art](box.x, box.y, box.w, box.h, p.accent);
  const textX = wide ? 28 : 24;
  const textW = wide ? W * 0.5 - 56 : W - 48;
  let block = '';
  if (wide) {
    const titles = wrap(p.title, textW, 32, 'display');
    let y = 62;
    titles.forEach((t, i) => { if (i) y += 36; block += text(t, textX, y, 32, { f: 'display', track: -0.01 }); });
    y += 14;
    wrap(p.desc, textW, 17, 'body').slice(0, 6).forEach((t) => { y += 25; block += text(t, textX, y, 17, { f: 'body', fill: INK.text2 }); });
    block += text(p.tech, textX, H - 26, 12.5, { f: 'mono', fill: INK.muted });
  } else {
    block += text(p.title, textX, 204, 28, { f: 'display', track: -0.01 });
    let y = 210;
    wrap(p.desc, textW, 16, 'body').slice(0, 3).forEach((t) => { y += 23; block += text(t, textX, y, 16, { f: 'body', fill: INK.text2 }); });
    block += text(p.tech, textX, H - 18, 12, { f: 'mono', fill: INK.muted });
  }
  const phone = text(p.phone, textX, H - 26, wide ? 46 : 44, { f: 'display', track: -0.01 });
  const limit = wide ? 340 : 190;
  const style = `.n{display:none}${STILL}{.mv{display:none}}@media (max-width:${limit}px){.w{display:none}.n{display:inline}}${art.css}`;
  return svg(W, H, `${p.title}. ${p.desc}`, '', style,
    tint + (wide ? '' : '') + art.out +
    `<g class="w">${block}${arrow}</g><g class="n">${phone}</g>`);
}
function smallCard(s) {
  const W = 323, H = 214;
  const hl = !!s.highlight;
  const [bg, fg, fg2] = hl ? ['#F2F4F7', '#14161B', '#3F4651'] : [INK.canvas, INK.text, INK.text2];
  let lx = 22;
  const logos = s.logos.map((id) => {
    const fill = hl ? LOGOS[id].hex : legible(LOGOS[id].hex, INK.canvas);
    const out = logoPath(id, lx, 22, 34, fill);
    lx += 46;
    return out;
  }).join('');
  let y = 112;
  let d = text(s.title, 22, 96, 26, { f: 'display', fill: fg, track: -0.01 });
  wrap(s.desc, W - 44, 15.5, 'body').slice(0, 3).forEach((t) => { y += 22; d += text(t, 22, y, 15.5, { f: 'body', fill: fg2 }); });
  const arrow = `<path d="M${W - 36} 42L${W - 22} 28M${W - 33} 28H${W - 22}V39" fill="none" stroke="${fg2}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  const short = s.title.split(' ').slice(-1)[0];
  const n = text(s.highlight ? 'More work' : short, 22, H - 44, 44, { f: 'display', fill: fg, track: -0.01 });
  return svg(W, H, `${s.title}. ${s.desc}`, '', '.n{display:none}@media (max-width:180px){.w{display:none}.n{display:inline}}',
    `<rect width="${W}" height="${H}" rx="12" fill="${bg}"/>${logos}<g class="w">${d}${arrow}</g><g class="n">${n}</g>`);
}

// ---------------------------------------------------------------- tech stack: a mechanical keyboard
function keyboard() {
  const W = 1000, pad = 26, u = (W - 2 * pad) / 11, keyH = 84, gap = 5, head = 96;
  const rows = cfg.keyboard;
  const H = Math.ceil(head + rows.length * keyH + pad - gap);
  const rand = rng(4242);
  const keys = [];
  rows.forEach((row, r) => {
    let cx = pad;
    const y = head + r * keyH;
    row.forEach((entry) => {
      const kind = entry[0] === '#' ? 'mod' : entry[0] === '!' ? 'fn' : 'tool';
      const [a, b] = (kind === 'tool' ? entry : entry.slice(1)).split(':');
      const w = (kind === 'tool' ? 1 : Number(b)) * u;
      keys.push(kind === 'tool' ? { kind, id: a, label: b, x: cx, y, w } : { kind, label: a, x: cx, y, w });
      cx += w;
    });
    if (Math.abs(cx - (W - pad)) > 1) throw new Error(`Keyboard row ${r + 1} is not 11 units wide`);
  });
  const tools = keys.filter((k) => k.kind === 'tool');
  const order = tools.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const stepS = 0.4;
  const cycle = (tools.length * stepS).toFixed(1);
  const pct = (100 / tools.length).toFixed(2);
  const css = [];
  const cap = (k, top, inner, cls = '') => {
    const w = k.w - gap, h = keyH - gap;
    return `<rect x="${k.x.toFixed(1)}" y="${k.y + 3}" width="${w.toFixed(1)}" height="${h - 3}" rx="9" fill="#050608"/>` +
      `<g class="${cls}"><rect x="${k.x.toFixed(1)}" y="${k.y}" width="${w.toFixed(1)}" height="${h - 5}" rx="9" fill="${top}"/><rect x="${(k.x + 1).toFixed(1)}" y="${k.y + 1}" width="${(w - 2).toFixed(1)}" height="${h - 7}" rx="8" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="1.5"/>${inner}</g>`;
  };
  let body = '';
  keys.forEach((k) => {
    if (k.kind === 'mod') {
      body += cap(k, AMBER, text(k.label, k.x + 13, k.y + 44, 17.5, { f: 'title', fill: '#14161B' }));
    } else if (k.label === 'return') {
      const rx = k.x + k.w - gap - 26;
      body += cap(k, '#1C1F26', `<path d="M${rx} ${k.y + 26}V${k.y + 42}H${rx - 28}m8-8l-8 8 8 8" fill="none" stroke="${INK.muted}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` +
        text('return', k.x + 16, k.y + 46, 15, { f: 'mono', fill: INK.muted }));
    } else if (k.label === 'space') {
      const cx = k.x + (k.w - gap) / 2;
      const bioW = textWidth(cfg.bio, 19, 'mono');
      body += cap(k, '#2E323A', `<g transform="translate(${(cx - bioW / 2 - 22).toFixed(1)} ${k.y + 37}) scale(.72)"><path d="${ALIEN}" fill="#7BE08F"/><path d="${ALIEN_EYES}" fill="#2E323A"/></g>` +
        text(cfg.bio, cx - bioW / 2 + 2, k.y + 44, 19, { f: 'mono', fill: INK.text }));
    } else {
      const idx = tools.indexOf(k);
      css.push(`.p${idx}{animation-delay:${(order.indexOf(idx) * stepS).toFixed(1)}s}`);
      const cx = k.x + (k.w - gap) / 2;
      // The logo sits in its own group, so the phone layout can scale it without losing its position.
      const logo = `<g class="lg">${logoPath(k.id, Math.round(cx - 16), k.y + 11, 32, legible(LOGOS[k.id].hex))}</g>`;
      body += cap(k, '#262A31', logo + `<g class="lb">${text(k.label, cx, k.y + 66, 10.5, { f: 'mono', fill: INK.text2, anchor: 'middle' })}</g>`, `kp p${idx}`);
    }
  });
  const count = `${tools.length} tools. One keyboard.`;
  const style =
    `.kp{animation:kp ${cycle}s steps(1) infinite}${css.join('')}` +
    `@keyframes kp{0%{transform:translateY(3px)}${pct}%{transform:none}100%{transform:none}}` +
    `${STILL}{.kp{animation:none}}` +
    '.lg{transform-box:fill-box;transform-origin:center}' +
    '@media (max-width:560px){.lb,.hc{display:none}.lg{transform:translateY(9px) scale(1.25)}}';
  const list = tools.map((k) => k.label).join(', ');
  return svg(W, H, 'Tech stack, drawn as a mechanical keyboard', `Tools: ${list}.`, style,
    `<rect width="${W}" height="${H}" rx="14" fill="#101216"/><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="13" fill="none" stroke="${INK.line}" stroke-width="2"/>` +
    text('Tech stack', pad + 2, 62, 44, { f: 'display', track: -0.02 }) +
    `<g class="hc">${text(count, W - pad - 2, 60, 26, { f: 'serif', fill: INK.text2, anchor: 'end' })}</g>` + body);
}

// ---------------------------------------------------------------- the one LED object: live departures
const FONT5X7 = {
  '0': '3E5149453E', '1': '00427F4000', '2': '4261514946', '3': '2141494D33', '4': '1814127F10', '5': '2745454539',
  '6': '3C4A494931', '7': '4121110907', '8': '3649494936', '9': '464949291E',
  A: '7C1211127C', B: '7F49494936', C: '3E41414122', D: '7F4141413E', E: '7F49494941', F: '7F09090901', G: '3E41415173',
  H: '7F0808087F', I: '00417F4100', J: '2040413F01', K: '7F08142241', L: '7F40404040', M: '7F021C027F', N: '7F0408107F',
  O: '3E4141413E', P: '7F09090906', Q: '3E4151215E', R: '7F09192946', S: '2649494932', T: '03017F0103', U: '3F4040403F',
  V: '1F2040201F', W: '3F4038403F', X: '6314081463', Y: '0304780403', Z: '6159494D43',
  '-': '0808080808', '.': '0060600000', ':': '0036360000', '/': '2010080402', '+': '08083E0808', '*': '0014081400', ' ': '0000000000',
};
function dots(str, x, y, p) {
  let d = '';
  let cx = x;
  for (const ch of String(str)) {
    const hex = FONT5X7[ch] ?? FONT5X7[' '];
    for (let c = 0; c < 5; c++) {
      const bits = parseInt(hex.slice(c * 2, c * 2 + 2), 16);
      for (let r = 0; r < 7; r++) if (bits & (1 << r)) d += `M${(cx + c * p).toFixed(1)} ${(y + r * p).toFixed(1)}h.01`;
    }
    cx += 6 * p;
  }
  return d;
}
const len = (s, p) => String(s).length * 6 * p;
let layerId = 0;
const lit = (d, p, color = LED.on) => {
  if (!d) return '';
  const id = `l${layerId++}`;
  return `<defs><path id="${id}" d="${d}"/></defs><g fill="none" stroke="${color}" stroke-linecap="round"><use href="#${id}" stroke-width="${(p * 2.3).toFixed(1)}" opacity=".13"/><use href="#${id}" stroke-width="${(p * 0.94).toFixed(2)}"/></g>`;
};
function departures(stats) {
  const W = 900, H = 424, M = 30, R = W - M, P = 2.7;
  const rule = (y) => `<path d="M${M} ${y}H${R}" stroke="${LED.off}" stroke-width="2"/>`;
  const fit = (s, n) => (s.length > n ? `${s.slice(0, n - 2)}..` : s);
  let on = '', dim = '';
  on += dots('DEPARTURES', M, 28, 3.3);
  dim += dots(`UPDATED ${stats.updated}`, R - len(`UPDATED ${stats.updated}`, 2), 33, 2);
  dim += dots('PUSHED', M, 68, 2);
  dim += dots('SERVICE', M + 118, 68, 2);
  dim += dots('LANGUAGE', R - len('LANGUAGE', 2), 68, 2);
  stats.recent.slice(0, 4).forEach((r, i) => {
    const y = 96 + i * 32;
    on += dots(r.when, M, y, P);
    on += dots(fit(r.name, 30), M + 118, y, P);
    const lang = fit(r.lang, 10);
    on += dots(lang, R - len(lang, P), y, P);
  });
  const privCount = Math.max(0, stats.total - stats.pub);
  const yP = 96 + 4 * 32;
  dim += dots('------', M, yP, P);
  dim += dots(`${privCount} PRIVATE SERVICES`, M + 118, yP, P);
  dim += dots('NOT SHOWN', R - len('NOT SHOWN', P), yP, P);

  // Weekly contributions as LED columns. One series, so the title names it; only the peak is labelled.
  const y0 = 346, levels = 8, dp = 5.4;
  const weeks = stats.weeks;
  const peak = Math.max(1, ...weeks.map((w) => w.count));
  const step = (R - M - dp) / Math.max(1, weeks.length - 1);
  let bars = '', base = '';
  weeks.forEach((w, i) => {
    const n = w.count === 0 ? 0 : Math.max(1, Math.round((w.count / peak) * levels));
    const x = M + i * step;
    if (n === 0) base += `M${x.toFixed(1)} ${y0}h.01M${(x + dp).toFixed(1)} ${y0}h.01`;
    for (let l = 0; l < n; l++) bars += `M${x.toFixed(1)} ${(y0 - l * dp).toFixed(1)}h.01M${(x + dp).toFixed(1)} ${(y0 - l * dp).toFixed(1)}h.01`;
  });
  dim += dots(`${stats.contributions} CONTRIBUTIONS / 12 MONTHS / ${stats.activeDays} ACTIVE DAYS`, M, 268, 2);
  const pk = `PEAK ${peak}`;
  dim += dots(pk, R - len(pk, 2), 268, 2);
  const mo = (d) => (d ? `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(2, 4)}` : '');
  const [firstW, lastW] = [mo(weeks[0]?.date), mo(weeks.at(-1)?.date)];
  dim += dots(firstW, M, 358, 1.8);
  dim += dots(lastW, R - len(lastW, 1.8), 358, 1.8);

  const tick = `${stats.total} REPOS ON THE NETWORK   *   ${stats.pub} PUBLIC   *   ${privCount} PRIVATE   *   MOST USED: ${stats.topLangs.join(' + ')}   *   `;
  const tickW = len(tick, 2);
  const tickD = dots(tick + tick, 0, 0, 2);
  const dur = Math.round(tickW / 26);
  const desc = `Departure board. Latest public pushes: ${stats.recent.slice(0, 4).map((r) => `${r.name} (${r.when}, ${r.lang})`).join('; ')}. ${privCount} private services not shown. ${stats.contributions} contributions in 12 months on ${stats.activeDays} active days; busiest week had ${peak}. ${stats.total} repositories in total, ${stats.pub} public.`;
  const style = `.tick{animation:tick ${dur}s linear infinite}@keyframes tick{to{transform:translateX(-${tickW.toFixed(1)}px)}}${STILL}{.tick{animation:none}}`;
  return svg(W, H, `Live departure board for ${cfg.user}`, desc, style,
    `<defs><pattern id="grid" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".65" fill="${LED.off}"/></pattern></defs>` +
    `<rect width="${W}" height="${H}" rx="14" fill="${LED.bg}"/><rect width="${W}" height="${H}" rx="14" fill="url(#grid)"/><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="13" fill="none" stroke="${LED.edge}" stroke-width="2"/>` +
    rule(56) + rule(256) + rule(378) +
    `<defs><clipPath id="c"><rect x="${M - 4}" y="386" width="${W - 2 * M + 8}" height="22"/></clipPath></defs>` +
    lit(dim, 2, LED.dim) + lit(on, P) +
    `<path d="${base}" stroke="${LED.dim}" stroke-width="2" stroke-linecap="round" fill="none" opacity=".55"/>` +
    lit(bars, dp) +
    `<g clip-path="url(#c)"><g transform="translate(${M} 390)"><g class="tick"><path d="${tickD}" stroke="${LED.on}" stroke-width="1.88" stroke-linecap="round" fill="none"/></g></g></g>`);
}

// ---------------------------------------------------------------- live data
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const fmtDay = (iso) => `${iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;
async function getJson(url, token) {
  const res = await fetch(url, { headers: { 'User-Agent': 'arooon-n-profile', Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}
function parseCalendarHtml(html) {
  const days = {};
  for (const m of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})" id="(contribution-day-component-[\d-]+)"/g)) days[m[2]] = { date: m[1], count: 0 };
  for (const m of html.matchAll(/<tool-tip[^>]*for="(contribution-day-component-[\d-]+)"[^>]*>(\d+) contribution/g)) if (days[m[1]]) days[m[1]].count = +m[2];
  return Object.values(days).sort((a, b) => (a.date < b.date ? -1 : 1));
}
async function getCalendarAndTotal() {
  const token = process.env.PROFILE_TOKEN;
  if (token) {
    const q = 'query{viewer{login repositories(ownerAffiliations:OWNER){totalCount} contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}';
    const res = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { 'User-Agent': 'arooon-n-profile', Authorization: `Bearer ${token}` }, body: JSON.stringify({ query: q }) });
    const j = await res.json();
    if (j.errors || !j.data) throw new Error(`GraphQL: ${JSON.stringify(j.errors)}`);
    if (j.data.viewer.login.toLowerCase() !== cfg.user.toLowerCase()) throw new Error('PROFILE_TOKEN belongs to a different user');
    const days = j.data.viewer.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays).map((d) => ({ date: d.date, count: d.contributionCount }));
    return { days, total: j.data.viewer.repositories.totalCount };
  }
  const res = await fetch(`https://github.com/users/${cfg.user}/contributions`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`contributions -> HTTP ${res.status}`);
  const days = parseCalendarHtml(await res.text());
  if (!days.length) throw new Error('Could not read the contribution calendar. Keeping the existing board.');
  return { days, total: null };
}
async function getStats() {
  const token = process.env.GITHUB_TOKEN;
  // This endpoint only ever returns public repos: no private name can reach the board.
  const repos = await getJson(`https://api.github.com/users/${cfg.user}/repos?per_page=100&sort=pushed&type=owner`, token);
  const hasProfileRepo = repos.some((r) => r.name.toLowerCase() === cfg.user.toLowerCase());
  const pub = repos.length - (hasProfileRepo ? 1 : 0);
  const own = repos.filter((r) => !r.fork && !r.private && r.name.toLowerCase() !== cfg.user.toLowerCase());
  const label = { 'Jupyter Notebook': 'NOTEBOOK', TypeScript: 'TYPESCRIPT', JavaScript: 'JAVASCRIPT' };
  const recent = own.slice(0, 4).map((r) => ({ name: cfg.aliases[r.name] ?? r.name.toUpperCase().replace(/_/g, ' '), when: fmtDay(r.pushed_at), lang: label[r.language] ?? (r.language ?? 'REPORT').toUpperCase() }));
  const tally = {};
  own.forEach((r) => { if (r.language) { const k = label[r.language] ?? r.language.toUpperCase(); tally[k] = (tally[k] ?? 0) + 1; } });
  const topLangs = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
  const { days, total } = await getCalendarAndTotal();
  const contributions = days.reduce((s, d) => s + d.count, 0);
  const activeDays = days.filter((d) => d.count > 0).length;
  const weeks = [];
  days.forEach((d, i) => { if (i % 7 === 0) weeks.push({ date: d.date, count: 0 }); weeks.at(-1).count += d.count; });
  // The profile repo is scaffolding, not a project, so it is left out of every count. Without a token the
  // total comes from the config: making a repo public then moves it from private to public and the total holds.
  const fullTotal = total === null ? cfg.repoTotal : total - (hasProfileRepo ? 1 : 0);
  const publicRepos = own.map((r) => ({ name: r.name, url: r.html_url, desc: r.description }));
  return { publicRepos, total: Math.max(fullTotal, pub), pub, recent, topLangs, contributions, activeDays, weeks, updated: fmtDay(new Date().toISOString()) };
}

// ---------------------------------------------------------------- README
function readme(stats) {
  const u = (r) => `https://github.com/${cfg.user}/${r}`;
  const img = (f, alt, width = '100%') => `<img src="assets/${f}" alt="${esc(alt)}" width="${width}">`;
  const link = (href, inner) => `<a href="${esc(href)}">${inner}</a>`;
  const chips = cfg.contacts.map((c) => link(c.url, img(`chip-${c.slug}.svg`, `${c.name}: ${c.value}`, '32.3%'))).join('\n');
  const sites = cfg.sites.map((s) => link(s.url, img(`site-${s.slug}.svg`, s.alt, '49.2%'))).join('\n');
  const bento = cfg.projects.map((row) => row.map((p) =>
    link(u(p.repo), img(`card-${p.slug}.svg`, `${p.title}. ${p.desc} Built with ${p.tech.replace(/\s{2,}/g, ', ')}.`, WIDE_ART.has(p.art) ? '64.2%' : '34%'))
  ).join('\n')).join('<br>\n');
  const small = cfg.smallCards.map((s) => link(s.url ?? u(s.repo), img(`card-${s.slug}.svg`, `${s.title}. ${s.desc}`, '32.3%'))).join('\n');
  const tools = cfg.keyboard.flat().filter((e) => !/^[#!]/.test(e)).map((e) => e.split(':')[1]);
  const projects = cfg.projects.flat().map((p) => `- [${p.title}](${u(p.repo)}): ${p.desc}`);
  const smalls = cfg.smallCards.filter((s) => s.repo).map((s) => `- [${s.title}](${u(s.repo)}): ${s.desc}`);
  const known = new Set([...cfg.projects.flat(), ...cfg.smallCards, ...cfg.otherStops].map((x) => x.repo?.toLowerCase()));
  const auto = stats.publicRepos.filter((r) => !known.has(r.name.toLowerCase())).map((r) => `- [${r.name.replace(/[_-]+/g, ' ')}](${r.url})${r.desc ? `: ${r.desc}` : ''}`);
  const others = [...cfg.otherStops.map((o) => `- [${o.title}](${u(o.repo)}): ${o.desc}`), ...auto];
  return `<!-- Generated by scripts/generate.mjs from network.config.json. Edit those, not this file. -->

<p align="center">
${img('hero.svg', `${cfg.name}. ${cfg.subtitle} ${cfg.statement.alt}`)}
</p>

<p align="center">
${chips}
</p>

<p align="center">
${img('statement.svg', cfg.statement.alt)}
</p>

<p align="center">
${sites}
</p>

<p align="center">
${bento}
</p>

<p align="center">
${small}
</p>

<p align="center">
${img('keyboard.svg', `Tech stack, drawn as a keyboard: ${tools.join(', ')}.`)}
</p>

<p align="center">
${img('departures.svg', `Live departure board, updated weekly. Latest public pushes: ${stats.recent.map((r) => `${r.name} on ${r.when}`).join(', ')}. ${stats.contributions} contributions in the last 12 months across ${stats.activeDays} active days. ${stats.total} repositories, ${stats.pub} public.`)}
</p>

<details>
<summary><sub>Everything on this page, in plain text</sub></summary>

${cfg.statement.alt}

**Live websites**

${cfg.sites.map((s) => `- [${s.domain}](${s.url}): ${s.seoTitle}`).join('\n')}

**Public projects**

${projects.join('\n')}
${smalls.join('\n')}
${others.join('\n')}

**Tech stack**

${tools.join(', ')}

**Contact**

${cfg.contacts.map((c) => `- [${c.name}](${c.url}): ${c.value}`).join('\n')}

</details>
`;
}
// These illustrations need room, so their cards take the wide slot in a bento row.
const WIDE_ART = new Set(['network', 'candles', 'route', 'forecast']);

// ---------------------------------------------------------------- build
const stats = await getStats();
fs.mkdirSync(ASSETS, { recursive: true });
for (const f of fs.readdirSync(ASSETS)) fs.rmSync(path.join(ASSETS, f));
const out = (f, s) => fs.writeFileSync(path.join(ASSETS, f), s);
out('hero.svg', hero());
out('statement.svg', statement());
cfg.contacts.forEach((c) => out(`chip-${c.slug}.svg`, chip(c)));
cfg.sites.forEach((s) => out(`site-${s.slug}.svg`, site(s)));
cfg.projects.flat().forEach((p) => out(`card-${p.slug}.svg`, card(p, WIDE_ART.has(p.art))));
cfg.smallCards.forEach((s) => out(`card-${s.slug}.svg`, smallCard(s)));
out('keyboard.svg', keyboard());
out('departures.svg', departures(stats));
fs.writeFileSync(path.join(ROOT, 'README.md'), readme(stats));

const kb = (f) => (fs.statSync(path.join(ASSETS, f)).size / 1024).toFixed(0);
const total = fs.readdirSync(ASSETS).reduce((s, f) => s + fs.statSync(path.join(ASSETS, f)).size, 0);
console.log(`repos ${stats.total} (public ${stats.pub}), contributions ${stats.contributions}, active days ${stats.activeDays}`);
console.log(`sizes: hero ${kb('hero.svg')}KB, statement ${kb('statement.svg')}KB, keyboard ${kb('keyboard.svg')}KB, board ${kb('departures.svg')}KB, site ${kb(`site-${cfg.sites[0].slug}.svg`)}KB, card ${kb('card-numbat.svg')}KB; all ${(total / 1024).toFixed(0)}KB`);
