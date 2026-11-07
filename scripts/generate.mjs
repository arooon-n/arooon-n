// Builds every SVG in assets/ and README.md from network.config.json.
//   npm run build                     public data only; repoTotal comes from the config
//   PROFILE_TOKEN=xxx npm run build   counts private repos and contributions automatically
//
// Privacy rule: private repositories are only ever COUNTED. Their names are never
// requested, stored or drawn. A private project appears by name only if you add it
// to network.config.json yourself.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'network.config.json'), 'utf8'));
const ASSETS = path.join(ROOT, 'assets');
fs.mkdirSync(ASSETS, { recursive: true });

// ---------------------------------------------------------------- tokens
const THEMES = {
  dark: {
    interFill: '#0E1520', surface: '#0E1520', page: '#0D1117', text: '#E8EDF3', text2: '#A9B4C2', muted: '#8491A1',
    stationFill: '#F4F7FA', trainFill: '#FFFFFF', priv: '#7F8DA0', hairline: '#263242', alien: '#7BE08F',
  },
  light: {
    interFill: '#FFFFFF', surface: '#F4F6F8', page: '#FFFFFF', text: '#15202B', text2: '#445261', muted: '#5D6A79',
    stationFill: '#FFFFFF', trainFill: '#15202B', priv: '#76859A', hairline: '#D5DBE2', alien: '#1E9A47',
  },
};
const LED = { bg: '#0B0A08', on: '#FFB000', dim: '#A87400', off: '#1C1710' };

const font = (f) => opentype.loadSync(path.join(ROOT, 'fonts', f));
const F = { 500: font('overpass-500.ttf'), 700: font('overpass-700.ttf'), 800: font('overpass-800.ttf'), mono: font('overpassmono-500.ttf') };

// ---------------------------------------------------------------- text as outlines
// README images cannot load web fonts, so text is converted to paths and looks the
// same everywhere. Each SVG carries a <title>/<desc> so it stays readable to screen readers.
// Glyphs are defined once per SVG and reused with <use>, which keeps files small.
let glyphDefs = new Map();
const resetGlyphs = () => { glyphDefs = new Map(); };
const defsOut = () => `<defs>${[...glyphDefs.values()].join('')}</defs>`;
function textPath(str, x, y, size, { w = 500, anchor = 'start', fill, track = 0 } = {}) {
  const f = F[w];
  const upm = f.unitsPerEm;
  const glyphs = f.stringToGlyphs(str);
  let pen = 0;
  let uses = '';
  glyphs.forEach((g, i) => {
    const d = g.getPath(0, 0, upm).toPathData(0);
    if (d) {
      const id = `g${w}-${g.index}`;
      if (!glyphDefs.has(id)) glyphDefs.set(id, `<path id="${id}" d="${d}"/>`);
      uses += `<use href="#${id}" x="${Math.round(pen)}"/>`;
    }
    pen += g.advanceWidth + (glyphs[i + 1] ? f.getKerningValue(g, glyphs[i + 1]) : 0) + track * upm;
  });
  const s = size / upm;
  const width = pen * s;
  const sx = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x;
  return `<g transform="translate(${sx.toFixed(1)} ${y}) scale(${s.toFixed(4)})"${fill ? ` fill="${fill}"` : ''}>${uses}</g>`;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------- rounded polylines
function rounded(pts, r = 14) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    const la = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const k = Math.min(r, la / 2, lc / 2);
    const p1 = [b[0] - ((b[0] - a[0]) / la) * k, b[1] - ((b[1] - a[1]) / la) * k];
    const p2 = [b[0] + ((c[0] - b[0]) / lc) * k, b[1] + ((c[1] - b[1]) / lc) * k];
    d += `L${p1[0].toFixed(1)} ${p1[1].toFixed(1)}Q${b[0]} ${b[1]} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  const z = pts[pts.length - 1];
  return `${d}L${z[0]} ${z[1]}`;
}

// ---------------------------------------------------------------- hero map
// Beck-style geometry: every segment runs at 0, 45 or 90 degrees. All lines leave the
// "hello world" terminus together and fan out; x reads roughly as time.
const ROUTES = {
  ml: [[60, 322], [72, 322], [179, 215], [540, 215], [745, 420]],
  ai: [[60, 331], [110, 331], [151, 290], [590, 290], [640, 340]],
  product: [[60, 340], [640, 340]],
  data: [[60, 349], [80, 349], [151, 420], [838, 420]],
  private: [[60, 358], [70, 358], [212, 500], [838, 500]],
};
const TIER = { ml: 215, ai: 290, product: 340, data: 420 };

function hero(themeName, stats) {
  resetGlyphs();
  const t = THEMES[themeName];
  const col = Object.fromEntries(cfg.lines.map((l) => [l.id, l[themeName]]));
  const W = 960, H = 610;
  const privCount = Math.max(0, stats.total - stats.pub);

  const lines = ['private', 'data', 'product', 'ai', 'ml'].map((id) => {
    const d = rounded(ROUTES[id]);
    return id === 'private'
      ? `<path id="r-private" class="ln priv" d="${d}" stroke="${t.priv}" stroke-dasharray="2 9"/>`
      : `<path id="r-${id}" class="ln draw d-${id}" pathLength="1" d="${d}" stroke="${col[id]}"/>`;
  }).join('');

  // Trains: SMIL motion along each route. Hidden entirely under reduced motion; the map still reads.
  const trains = [['ml', 26, -3], ['ai', 22, -9], ['product', 24, -15], ['data', 30, -20], ['private', 38, -12]].map(([id, dur, begin]) =>
    `<g class="train"><rect x="-10" y="-4" width="20" height="8" rx="4" fill="${t.trainFill}" stroke="${id === 'private' ? t.priv : col[id]}" stroke-width="2"/>` +
    `<animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" rotate="auto" keyPoints="0;1;1" keyTimes="0;0.92;1" calcMode="linear"><mpath href="#r-${id}"/></animateMotion></g>`
  ).join('');

  const stations = cfg.map.map((s) => {
    const y = TIER[s.line];
    const inter = !!s.also;
    const r = inter ? 10 : s.bold ? 8.5 : 7;
    const ring = inter ? t.text : col[s.line];
    return `<circle class="st" cx="${s.x}" cy="${y}" r="${r}" fill="${inter ? t.interFill : t.stationFill}" stroke="${ring}" stroke-width="${inter ? 4 : 4}"/>`;
  }).join('');

  const labels = cfg.map.map((s) => {
    const y = TIER[s.line];
    const size = 15.5, w = s.bold ? 700 : 500, fill = s.bold ? t.text : t.text2;
    const [ly, anchor, lx] = {
      above: [y - 17, 'middle', s.x], below: [y + 30, 'middle', s.x],
      'below-end': [y + 30, 'end', s.x + 6], 'below-start': [y + 30, 'start', s.x - 6],
    }[s.pos];
    return textPath(s.label, lx, ly, size, { w, anchor, fill });
  }).join('');

  // Private line: one small ring per private repo. Count is real; positions are not dated.
  const ghosts = [];
  const x0 = 246, x1 = 826;
  for (let i = 0; i < privCount; i++) {
    const x = privCount === 1 ? x0 : x0 + ((x1 - x0) * i) / (privCount - 1);
    ghosts.push(`<circle cx="${x.toFixed(1)}" cy="500" r="4.5" fill="${t.surface}" stroke="${t.priv}" stroke-width="2.5"/>`);
  }
  const privLabel = textPath(`${privCount} private projects, closed to public boarding`, 246, 530, 15.5, { w: 500, fill: t.text2 });

  // Terminus and alien, from the bio
  const terminus =
    `<rect x="48" y="312" width="24" height="56" rx="12" fill="${t.stationFill}" stroke="${t.text}" stroke-width="3.5"/>` +
    `<g class="labels">${textPath('hello', 22, 392, 15.5, { w: 700, fill: t.text })}${textPath('world', 22, 410, 15.5, { w: 700, fill: t.text })}${textPath('2023', 22, 428, 13.5, { w: 'mono', fill: t.muted })}</g>`;
  const alien =
    `<g transform="translate(60 285)"><path d="M0-18C-11-18-16-10-16-3-16 7-6 16 0 18 6 16 16 7 16-3 16-10 11-18 0-18Z" fill="${t.alien}"/>` +
    `<path d="M-10-3C-6-4-3-1-3 3-7 3-10 1-10-3ZM10-3C6-4 3-1 3 3 7 3 10 1 10-3Z" fill="${t.surface}"/></g>`;

  // Open-ended extension to the right: the next station has not been announced.
  const next = `<path class="ln" d="M838 420H922" stroke="${col.data}" stroke-dasharray="2 9"/>` ;

  // Line guide, top right
  const legendRows = [...cfg.lines.map((l) => ({ name: l.name, color: l[themeName], n: cfg.map.filter((s) => s.line === l.id || s.also === l.id).length })),
    { name: 'Private', color: t.priv, n: privCount, dashed: true }];
  const lx = 612, ly0 = 62;
  const legend = textPath('LINE GUIDE', lx, ly0 - 20, 12.5, { w: 'mono', fill: t.muted, track: 0.08 }) + textPath('STATIONS', 916, ly0 - 20, 12.5, { w: 'mono', anchor: 'end', fill: t.muted, track: 0.08 }) + legendRows.map((l, i) => {
    const y = ly0 + i * 23;
    return `<path d="M${lx} ${y - 5}H${lx + 34}" stroke="${l.color}" stroke-width="${l.dashed ? 5 : 6}" stroke-linecap="round" fill="none"${l.dashed ? ' stroke-dasharray="1 8"' : ''}/>` +
      textPath(l.name, lx + 48, y, 15.5, { w: 500, fill: t.text }) +
      textPath(String(l.n), 916, y, 14, { w: 'mono', anchor: 'end', fill: t.text2 });
  }).join('');

  // Time axis. Schematic, so it only marks years.
  const axisY = 572;
  const axis = `<path d="M40 ${axisY - 16}H920" stroke="${t.hairline}"/>` +
    [['2024', 190], ['2025', 372], ['2026', 656]].map(([y, x]) => `<path d="M${x} ${axisY - 21}V${axisY - 11}" stroke="${t.muted}"/>` + textPath(y, x, axisY + 6, 13.5, { w: 'mono', anchor: 'middle', fill: t.muted })).join('') +
    textPath('Schematic. Not to scale.', 920, axisY + 6, 13.5, { w: 'mono', anchor: 'end', fill: t.muted });

  const title = textPath(cfg.name, 40, 92, 62, { w: 800, fill: t.text, track: -0.02 });
  const sub = textPath(cfg.tagline, 42, 130, 23, { w: 500, fill: t.text2 });
  const meta = textPath(cfg.meta, 42, 159, 13.5, { w: 'mono', fill: t.muted });

  const desc = `Transit-map diagram of ${cfg.name}'s projects since 2024. Lines: ${cfg.lines.map((l) => l.name).join(', ')}, and a private line with ${privCount} unnamed stations. Stations: ${cfg.map.map((s) => s.label).join(', ')}.`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
<title id="t">${esc(cfg.name)}: a transit map of my work</title><desc id="d">${esc(desc)}</desc>
<style>
.ln{fill:none;stroke-width:6;stroke-linecap:round;stroke-linejoin:round}
.priv{stroke-width:5}
.draw{stroke-dasharray:1;animation:draw 1.5s cubic-bezier(.22,1,.36,1) backwards}
.d-ai{animation-delay:.12s}.d-product{animation-delay:.24s}.d-data{animation-delay:.36s}
.fade{animation:fade .5s ease-out .9s backwards}
@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.train{display:none}.draw,.fade{animation:none}}
@media (max-width:560px){.labels,.legend,.axis,.meta,.pl{display:none}.ln{stroke-width:9}.priv{stroke-width:8}.head{transform:translate(0,12px) scale(1.42)}.sub{transform:translate(0,12px)}}
</style>
${defsOut()}<rect width="${W}" height="${H}" rx="14" fill="${t.surface}"/>
<g class="head">${title}${sub}</g><g class="meta">${meta}</g>
<g class="legend">${legend}</g>
<g class="axis">${axis}</g>
${next}${lines}${ghosts.join('')}${trains}${terminus}${alien}
<g class="fade">${stations}<g class="labels">${labels}</g></g>
<g class="pl">${privLabel}</g>
</svg>`;
}

// ---------------------------------------------------------------- station rows
// Stacked image rows that join into one continuous vertical line down the README.
function row(item, themeName, { first, last }) {
  resetGlyphs();
  const t = THEMES[themeName];
  const c = cfg.lines.find((l) => l.id === item.line)[themeName];
  const c2 = item.also ? cfg.lines.find((l) => l.id === item.also)[themeName] : null;
  const W = 900, H = 132, cx = 34, cy = H / 2;
  const seg = `<path d="M${cx} ${first ? cy : 0}V${last ? cy : H}" stroke="${c}" stroke-width="8" fill="none"/>`;
  const dot = c2
    ? `<circle cx="${cx}" cy="${cy}" r="15" fill="${t.stationFill}" stroke="${t.text}" stroke-width="3.5"/><circle cx="${cx - 4.5}" cy="${cy}" r="4.5" fill="${c}"/><circle cx="${cx + 4.5}" cy="${cy}" r="4.5" fill="${c2}"/>`
    : `<circle cx="${cx}" cy="${cy}" r="13" fill="${t.stationFill}" stroke="${c}" stroke-width="5"/>`;
  const x = 76;
  const lineName = cfg.lines.find((l) => l.id === item.line).name;
  const lock = item.private ? 'PRIVATE' : null;
  const wide =
    `<g class="wide">${textPath(item.title, x, 40, 25, { w: 700, fill: t.text, track: -0.005 })}` +
    textPath(item.desc, x, 66, 16.5, { w: 500, fill: t.text2 }) +
    textPath(item.desc2, x, 88, 16.5, { w: 500, fill: t.text2 }) +
    textPath(item.tech, x, 113, 13.5, { w: 'mono', fill: t.muted }) +
    textPath(item.date, W - 8, 40, 13.5, { w: 'mono', anchor: 'end', fill: t.muted }) +
    (lock ? textPath(lock, W - 8, 64, 13.5, { w: 'mono', anchor: 'end', fill: t.text2 }) :
      `<path d="M${W - 22} 66L${W - 10} 54M${W - 20} 54H${W - 10}V64" stroke="${t.text2}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`) +
    `</g>`;
  const narrow =
    `<g class="narrow">${textPath(item.title, x, 62, 39, { w: 700, fill: t.text, track: -0.01 })}` +
    textPath(item.short, x, 104, 29, { w: 500, fill: t.text2 }) + `</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t">
<title id="t">${esc(`${item.title} (${lineName} line). ${item.desc} ${item.desc2}`)}</title>
<style>.narrow{display:none}@media (max-width:560px){.wide{display:none}.narrow{display:inline}}</style>
${defsOut()}${seg}${dot}${wide}${narrow}
</svg>`;
}

// ---------------------------------------------------------------- LED departure board
// Hand-built 5x7 dot font. Each dot is a zero-length round stroke, so a whole board stays small.
const FONT5X7 = {
  '0': '3E5149453E', '1': '00427F4000', '2': '4261514946', '3': '2141494D33', '4': '1814127F10', '5': '2745454539',
  '6': '3C4A494931', '7': '4121110907', '8': '3649494936', '9': '464949291E',
  A: '7C1211127C', B: '7F49494936', C: '3E41414122', D: '7F4141413E', E: '7F49494941', F: '7F09090901', G: '3E41415173',
  H: '7F0808087F', I: '00417F4100', J: '2040413F01', K: '7F08142241', L: '7F40404040', M: '7F021C027F', N: '7F0408107F',
  O: '3E4141413E', P: '7F09090906', Q: '3E4151215E', R: '7F09192946', S: '2649494932', T: '03017F0103', U: '3F4040403F',
  V: '1F2040201F', W: '3F4038403F', X: '6314081463', Y: '0304780403', Z: '6159494D43',
  '-': '0808080808', '.': '0060600000', ':': '0036360000', '/': '2010080402', '+': '08083E0808', '*': '0014081400', "'": '0000030000', ' ': '0000000000',
};
function ledDots(str, x, y, p) {
  let d = '';
  let cx = x;
  for (const ch of String(str).toUpperCase()) {
    const hex = FONT5X7[ch] ?? FONT5X7[' '];
    for (let c = 0; c < 5; c++) {
      const bits = parseInt(hex.slice(c * 2, c * 2 + 2), 16);
      for (let r = 0; r < 7; r++) if (bits & (1 << r)) d += `M${(cx + c * p).toFixed(1)} ${(y + r * p).toFixed(1)}h.01`;
    }
    cx += 6 * p;
  }
  return d;
}
const ledLen = (s, p) => String(s).length * 6 * p;
let ledId = 0;
// Geometry lives in defs with no stroke of its own, so each <use> can set its own width.
const ledPath = (d, p, color) => {
  const id = `l${ledId++}`;
  return `<defs><path id="${id}" d="${d}"/></defs><g fill="none" stroke="${color}" stroke-linecap="round">` +
    `<use href="#${id}" stroke-width="${(p * 2.3).toFixed(1)}" opacity=".13"/>` +
    `<use href="#${id}" stroke-width="${(p * 0.94).toFixed(2)}"/></g>`;
};

function board(stats) {
  const W = 900, H = 424, m = 30;
  const P = 2.7;
  const fit = (s, n) => (s.length > n ? `${s.slice(0, n - 2)}..` : s);
  let on = '', dim = '';
  const R = W - m;

  on += ledDots('DEPARTURES', m, 28, 3.3);
  dim += ledDots(`UPDATED ${stats.updated}`, R - ledLen(`UPDATED ${stats.updated}`, 2), 33, 2);
  dim += ledDots('PUSHED', m, 68, 2);
  dim += ledDots('SERVICE', m + 118, 68, 2);
  dim += ledDots('LANGUAGE', R - ledLen('LANGUAGE', 2), 68, 2);

  stats.recent.slice(0, 4).forEach((r, i) => {
    const y = 96 + i * 32;
    on += ledDots(r.when, m, y, P);
    on += ledDots(fit(r.name, 30), m + 118, y, P);
    const lang = fit(r.lang, 10);
    on += ledDots(lang, R - ledLen(lang, P), y, P);
  });
  const privCount = Math.max(0, stats.total - stats.pub);
  const yP = 96 + 4 * 32;
  dim += ledDots('------', m, yP, P);
  dim += ledDots(`${privCount} PRIVATE SERVICES`, m + 118, yP, P);
  dim += ledDots('NOT SHOWN', R - ledLen('NOT SHOWN', P), yP, P);

  // Weekly contributions as LED columns. One series, so the title names it; only the peak is labelled.
  const y0 = 346, levels = 8, dp = 5.4;
  const weeks = stats.weeks;
  const peak = Math.max(1, ...weeks.map((w) => w.count));
  const peakIdx = weeks.findIndex((w) => w.count === peak);
  const step = (R - m - dp) / Math.max(1, weeks.length - 1);
  let bars = '', base = '';
  weeks.forEach((w, i) => {
    const n = w.count === 0 ? 0 : Math.max(1, Math.round((w.count / peak) * levels));
    const x = m + i * step;
    if (n === 0) base += `M${x.toFixed(1)} ${y0}h.01M${(x + dp).toFixed(1)} ${y0}h.01`;
    for (let l = 0; l < n; l++) {
      bars += `M${x.toFixed(1)} ${(y0 - l * dp).toFixed(1)}h.01M${(x + dp).toFixed(1)} ${(y0 - l * dp).toFixed(1)}h.01`;
    }
  });
  dim += ledDots(`${stats.contributions} CONTRIBUTIONS / 12 MONTHS / ${stats.activeDays} ACTIVE DAYS`, m, 268, 2);
  const pkLabel = `PEAK ${peak}`;
  dim += ledDots(pkLabel, R - ledLen(pkLabel, 2), 268, 2);
  const first = weeks[0]?.date ?? '', lastW = weeks.at(-1)?.date ?? '';
  const mo = (d) => (d ? `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(2, 4)}` : '');
  dim += ledDots(mo(first), m, 358, 1.8);
  dim += ledDots(mo(lastW), R - ledLen(mo(lastW), 1.8), 358, 1.8);
  void peakIdx;

  // Ticker: duplicated string translated by exactly one copy for a seamless loop.
  const tick = `${stats.total} REPOS ON THE NETWORK   *   ${stats.pub} PUBLIC   *   ${privCount} PRIVATE   *   MOST USED: ${stats.topLangs.join(' + ')}   *   `;
  const tickW = ledLen(tick, 2);
  const tickD = ledDots(tick + tick, 0, 0, 2);
  const durS = Math.round(tickW / 26);

  const desc = `Departure board. Latest public pushes: ${stats.recent.slice(0, 4).map((r) => `${r.name} (${r.when}, ${r.lang})`).join('; ')}. ${privCount} private services not shown. ${stats.contributions} contributions in 12 months on ${stats.activeDays} active days; busiest week had ${peak}. ${stats.total} repositories in total, ${stats.pub} public.`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
<title id="t">Live departure board for ${esc(cfg.user)}</title><desc id="d">${esc(desc)}</desc>
<style>
.tick{animation:tick ${durS}s linear infinite}
@keyframes tick{to{transform:translateX(-${tickW.toFixed(1)}px)}}
@media (prefers-reduced-motion:reduce){.tick{animation:none}}
</style>
<defs><clipPath id="c"><rect x="${m - 4}" y="386" width="${W - 2 * m + 8}" height="22"/></clipPath>
<pattern id="grid" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".65" fill="${LED.off}"/></pattern></defs>
<rect width="${W}" height="${H}" rx="14" fill="${LED.bg}"/>
<rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="10" fill="url(#grid)"/>
<path d="M${m} 56H${R}M${m} 256H${R}M${m} 378H${R}" stroke="${LED.off}" stroke-width="2"/>
${ledPath(dim, 2, LED.dim)}${ledPath(on, P, LED.on)}
<path d="${base}" stroke="${LED.dim}" stroke-width="2" stroke-linecap="round" fill="none" opacity=".55"/>
${ledPath(bars, dp, LED.on).replace(/stroke-width="4\.64"/, 'stroke-width="4.4"')}
<g clip-path="url(#c)"><g transform="translate(${m} 390)"><g class="tick"><path d="${tickD}" stroke="${LED.on}" stroke-width="1.75" stroke-linecap="round" fill="none"/></g></g></g>
</svg>`;
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
    const q = `query{viewer{login repositories(ownerAffiliations:OWNER){totalCount} contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`;
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
  const recent = own.slice(0, 4).map((r) => ({ name: cfg.aliases[r.name] ?? r.name.toUpperCase(), when: fmtDay(r.pushed_at), lang: label[r.language] ?? (r.language ?? 'REPORT').toUpperCase() }));
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
function picture(base, alt, extra = '') {
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="assets/${base}-dark.svg"><source media="(prefers-color-scheme: light)" srcset="assets/${base}-light.svg"><img src="assets/${base}-light.svg" alt="${esc(alt)}" width="100%"${extra}></picture>`;
}
function readme(stats) {
  const privCount = Math.max(0, stats.total - stats.pub);
  const u = (r) => `https://github.com/${cfg.user}/${r}`;
  const rows = cfg.featured.map((f) => {
    const alt = `${f.title}. ${f.desc} ${f.desc2} Built with ${f.tech.replace(/\s{2,}/g, ', ')}.`;
    const pic = picture(`station-${f.slug}`, alt, ' align="top"');
    return f.repo && !f.private ? `<a href="${u(f.repo)}">${pic}</a><br>` : `${pic}<br>`;
  }).join('\n');
  const guide = cfg.lines.map((l) => `| **${l.name}** | ${l.tools} |`).join('\n');
  // A public repo missing from the config still gets listed, so "every public stop" stays true.
  const known = new Set([...cfg.featured, ...cfg.otherStops].map((x) => x.repo?.toLowerCase()));
  const auto = stats.publicRepos.filter((r) => !known.has(r.name.toLowerCase()))
    .map((r) => `- [${r.name.replace(/[_-]+/g, ' ')}](${r.url})${r.desc ? `: ${r.desc}` : ''}`);
  const others = [...cfg.otherStops.map((o) => `- [${o.title}](${u(o.repo)}): ${o.desc}`), ...auto].join('\n');
  const allFeatured = cfg.featured.map((f) => `- ${f.private ? f.title : `[${f.title}](${u(f.repo)})`}: ${f.short}`).join('\n');
  const contact = cfg.links.length ? `\n<p align="center">${cfg.links.map((l) => `<a href="${l.url}">${l.label}</a>`).join(' &nbsp;/&nbsp; ')}</p>\n` : '';
  const alt = `Transit map of ${cfg.name}'s work since 2024: ${cfg.lines.map((l) => l.name).join(', ')} lines, plus a private line with ${privCount} unnamed stations.`;
  return `<!-- Generated by scripts/generate.mjs from network.config.json. Edit those, not this file. -->

${picture('hero', alt)}

I build systems that turn messy, real-world data into decisions, from metro and bus networks to live market streams, plus a robotic arm steered by EEG signals and AI tools that people can use on their phones. This profile is drawn as a network: each line is a discipline and each station is a real project.

**${stats.total} repositories, ${stats.pub} of them public.** My strongest work often lives on the private line, so what you see here is only part of the map.

## Stations worth stopping at

<p>
${rows}
</p>

## Live departures

Real activity from this account, refreshed every week by a GitHub Action.

<img src="assets/departures.svg" alt="Departure board. ${esc(`Latest public pushes: ${stats.recent.map((r) => `${r.name} on ${r.when}`).join(', ')}. ${stats.contributions} contributions in the last 12 months across ${stats.activeDays} active days.`)}" width="100%">

## Line guide

| Line | What runs on it |
|:---|:---|
${guide}

<details>
<summary><b>Every public stop, in plain text</b></summary>

${allFeatured}
${others}

</details>
${contact}
<p align="center"><sub><code>${esc(cfg.bio)}</code> 👽</sub></p>
`;
}

// ---------------------------------------------------------------- build
const stats = await getStats();
for (const f of fs.readdirSync(ASSETS)) if (f.startsWith('station-')) fs.rmSync(path.join(ASSETS, f));
for (const th of ['dark', 'light']) {
  fs.writeFileSync(path.join(ASSETS, `hero-${th}.svg`), hero(th, stats));
  cfg.featured.forEach((f, i) => fs.writeFileSync(path.join(ASSETS, `station-${f.slug}-${th}.svg`), row(f, th, { first: i === 0, last: i === cfg.featured.length - 1 })));
}
fs.writeFileSync(path.join(ASSETS, 'departures.svg'), board(stats));
fs.writeFileSync(path.join(ROOT, 'README.md'), readme(stats));

const kb = (f) => (fs.statSync(path.join(ASSETS, f)).size / 1024).toFixed(0);
console.log(`repos ${stats.total} (public ${stats.pub}), contributions ${stats.contributions}, active days ${stats.activeDays}, weeks ${stats.weeks.length}`);
console.log(`sizes: hero ${kb('hero-dark.svg')}KB, board ${kb('departures.svg')}KB, row ${kb('station-numbat-dark.svg')}KB`);
