// Builds every image in assets/ and README.md from network.config.json. No dependencies.
//   npm run build                     public data only; repoTotal comes from the config
//   PROFILE_TOKEN=xxx npm run build   counts private repos and contributions automatically
//
// The whole profile is one LED system: a 5x7 dot font, amber on near-black, green only for
// "this is live". Boards are stacks of separate rounded modules, so each row can be its own link.
// Images cannot join seamlessly: browsers draw them at fractional positions when zoomed, and the
// page shows through. Like a real LED sign, the modules sit apart with a deliberate gap instead.
//
// Privacy rule: private repositories are only ever COUNTED. Their names are never requested,
// stored or drawn. A private project appears by name only if you add it to the config yourself.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'network.config.json'), 'utf8'));
const LOGOS = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'logos.json'), 'utf8'));
const ASSETS = path.join(ROOT, 'assets');
const SOURCES = path.join(ROOT, 'sources');

// ---------------------------------------------------------------- tokens
const LED = { bg: '#0B0A08', on: '#FFB000', dim: '#A87400', off: '#1C1710', edge: '#332A1B', live: '#3DDC84' };
const W = 900, M = 30, R = W - M;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------- 5x7 dot font
// Each dot is a near-zero-length round stroke, so a whole board stays small.
const FONT5X7 = {
  '0': '3E5149453E', '1': '00427F4000', '2': '4261514946', '3': '2141494D33', '4': '1814127F10', '5': '2745454539',
  '6': '3C4A494931', '7': '4121110907', '8': '3649494936', '9': '464949291E',
  A: '7C1211127C', B: '7F49494936', C: '3E41414122', D: '7F4141413E', E: '7F49494941', F: '7F09090901', G: '3E41415173',
  H: '7F0808087F', I: '00417F4100', J: '2040413F01', K: '7F08142241', L: '7F40404040', M: '7F021C027F', N: '7F0408107F',
  O: '3E4141413E', P: '7F09090906', Q: '3E4151215E', R: '7F09192946', S: '2649494932', T: '03017F0103', U: '3F4040403F',
  V: '1F2040201F', W: '3F4038403F', X: '6314081463', Y: '0304780403', Z: '6159494D43',
  a: '2054545478', b: '7F48444438', c: '3844444420', d: '384444487F', e: '3854545418', f: '087E090102',
  h: '7F08040478', i: '00447D4000', k: '7F10284400', l: '00417F4000', m: '7C04180478', n: '7C08040478',
  o: '3844444438', r: '7C08040408', s: '4854545420', t: '043F444020', u: '3C4040207C',
  v: '1C2040201C', w: '3C4030403C', x: '4428102844', z: '4464544C44',
  '-': '0808080808', '.': '0060600000', ',': '0050300000', ':': '0036360000', '/': '2010080402', '+': '08083E0808',
  '*': '0014081400', "'": '0000030000', '"': '0007000700', '_': '4040404040', '@': '324979413E', '&': '3649552250',
  '(': '001C224100', ')': '0041221C00', '>': '0041221408', '<': '0814224100', '!': '00005F0000', '?': '0201510906', ' ': '0000000000',
};
// Letters with tails drop two rows below the baseline. Without this a 5x7 "g" reads as a 9,
// which would turn gmail into 9mail. Each number is one column, bit n = row n.
const DESCENDERS = {
  g: [0x038, 0x144, 0x144, 0x144, 0x0FC],
  j: [0x000, 0x100, 0x100, 0x0FD, 0x000],
  p: [0x1FC, 0x044, 0x044, 0x044, 0x038],
  q: [0x038, 0x044, 0x044, 0x044, 0x1FC],
  y: [0x03C, 0x140, 0x140, 0x140, 0x0FC],
};
function columns(ch) {
  if (DESCENDERS[ch]) return DESCENDERS[ch];
  const hex = FONT5X7[ch] ?? FONT5X7[' '];
  return [0, 1, 2, 3, 4].map((c) => parseInt(hex.slice(c * 2, c * 2 + 2), 16));
}
function dots(str, x, y, p) {
  let d = '';
  let cx = x;
  for (const ch of String(str)) {
    columns(ch).forEach((bits, c) => {
      for (let r = 0; r < 9; r++) if (bits & (1 << r)) d += `M${(cx + c * p).toFixed(1)} ${(y + r * p).toFixed(1)}h.01`;
    });
    cx += 6 * p;
  }
  return d;
}
const len = (s, p) => String(s).length * 6 * p;

// A lit layer: a soft glow plus sharp dots. Geometry sits in defs with no stroke of its own,
// so each <use> can set its own width.
let layerId = 0;
const lit = (d, p, color = LED.on, cls = '') => {
  if (!d) return '';
  const id = `l${layerId++}`;
  return `<defs><path id="${id}" d="${d}"/></defs><g fill="none" stroke="${color}" stroke-linecap="round"${cls ? ` class="${cls}"` : ''}>` +
    `<use href="#${id}" stroke-width="${(p * 2.3).toFixed(1)}" opacity=".13"/>` +
    `<use href="#${id}" stroke-width="${(p * 0.94).toFixed(2)}"/></g>`;
};

// ---------------------------------------------------------------- panel shell
function panel(h, { w = W, r = 12 } = {}) {
  return `<defs><pattern id="grid" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".65" fill="${LED.off}"/></pattern></defs>` +
    `<rect width="${w}" height="${h}" rx="${r}" fill="${LED.bg}"/><rect width="${w}" height="${h}" rx="${r}" fill="url(#grid)"/>` +
    `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="${r - 1}" fill="none" stroke="${LED.edge}" stroke-width="2"/>`;
}
const rule = (y, x0 = M, x1 = R) => `<path d="M${x0} ${y}H${x1}" stroke="${LED.off}" stroke-width="2"/>`;
const svg = (w, h, title, desc, style, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="t${desc ? ' d' : ''}">` +
  `<title id="t">${esc(title)}</title>${desc ? `<desc id="d">${esc(desc)}</desc>` : ''}${style ? `<style>${style}</style>` : ''}${body}</svg>`;
const NARROW = '@media (max-width:560px)';
const STILL = '@media (prefers-reduced-motion:reduce)';

// ---------------------------------------------------------------- brand logos seen through an LED mask
const logoDefs = (pitch = 2.4) =>
  `<defs><pattern id="dotp" width="${pitch}" height="${pitch}" patternUnits="userSpaceOnUse"><circle cx="${pitch / 2}" cy="${pitch / 2}" r="${(pitch * 0.46).toFixed(2)}" fill="#fff"/></pattern>` +
  `<mask id="ledm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="2000"><rect width="${W}" height="2000" fill="url(#dotp)"/></mask></defs>`;
function logo(id, x, y, size, color = LED.on) {
  const d = LOGOS[id];
  if (!d) throw new Error(`No logo called ${id}`);
  const s = (size / 24).toFixed(3);
  return `<path transform="translate(${x} ${y}) scale(${s})" d="${d}" fill="${color}"/>`;
}

// ---------------------------------------------------------------- destination sign
// Roles swap instantly, the way a real LED sign does: no fades.
function alienBitmap(x, y, p) {
  const art = [
    '...#####...',
    '.#########.',
    '###########',
    '###########',
    '#..#####..#',
    '#...###...#',
    '##..###..##',
    '###.###.###',
    '.#########.',
    '..#######..',
    '...#####...',
    '....###....',
  ];
  const at = (c, r) => `M${(x + c * p).toFixed(1)} ${(y + r * p).toFixed(1)}h.01`;
  let body = '';
  art.forEach((row, r) => [...row].forEach((c, i) => { if (c === '#') body += at(i, r); }));
  // The bio's alien in dots: green head with dark eyes that flash amber for a moment now and then.
  const eyes = [[1, 4], [2, 4], [1, 5], [2, 5], [3, 5], [2, 6], [3, 6], [3, 7], [8, 4], [9, 4], [7, 5], [8, 5], [9, 5], [7, 6], [8, 6], [7, 7]].map(([c, r]) => at(c, r)).join('');
  return lit(body, p, LED.live) + lit(eyes, p, LED.on, 'eyes');
}
function sign(stats) {
  const H = 268;
  const pN = 9.6;
  const dimTop = dots(cfg.org, M, 22, 2) + dots(cfg.location, R - len(cfg.location, 2), 22, 2);
  const name = dots(cfg.name, M, 74, pN);
  const step = 3;
  const cycle = cfg.roles.length * step;
  const onShare = (100 / cfg.roles.length).toFixed(2);
  const roles = cfg.roles.map((r, i) => lit(dots(r, M, 170, 4.6), 4.6, LED.on, `role r${i}`)).join('');
  const delays = cfg.roles.map((_, i) => `.r${i}{animation-delay:${i === 0 ? 0 : -(cycle - i * step)}s}`).join('');
  const tick = cfg.callingAt;
  const tickW = len(tick, 2.2);
  const tickD = dots(tick + tick, 0, 0, 2.2);
  const dur = Math.round(tickW / 30);
  const style =
    `.role{opacity:0;animation:role ${cycle}s steps(1) infinite}.r0{opacity:1}${delays}` +
    `@keyframes role{0%{opacity:1}${onShare}%{opacity:0}100%{opacity:0}}` +
    `.eyes{opacity:0;animation:blink 7s steps(1) infinite}@keyframes blink{0%{opacity:0}92%{opacity:1}96%{opacity:0}}` +
    `.tick{animation:tick ${dur}s linear infinite}@keyframes tick{to{transform:translateX(-${tickW.toFixed(1)}px)}}` +
    `${STILL}{.role,.eyes,.tick{animation:none}}` +
    `${NARROW}{.top{display:none}}`;
  const desc = `LED destination sign for ${cfg.name}. Roles: ${cfg.roles.join(', ')}. ${stats.total} repositories.`;
  return svg(W, H, `${cfg.name}: ${cfg.roles.join(', ')}`, desc, style,
    panel(H) +
    `<g class="top">${lit(dimTop, 2, LED.dim)}${rule(50)}</g>` +
    lit(name, pN) + alienBitmap(758, 62, pN) +
    roles + rule(222) +
    `<defs><clipPath id="c"><rect x="${M - 4}" y="232" width="${W - 2 * M + 8}" height="24"/></clipPath></defs>` +
    `<g clip-path="url(#c)"><g transform="translate(${M} 236)"><g class="tick"><path d="${tickD}" stroke="${LED.on}" stroke-width="2.05" stroke-linecap="round" fill="none"/></g></g></g>`);
}

// ---------------------------------------------------------------- contact rows
function contact(c) {
  const H = 88;
  const arrow = dots('>', R - 12, 34, 2.6);
  const style = `.n{display:none}${NARROW}{.w{display:none}.n{display:inline}}`;
  const wide = lit(dots(c.name, 96, 33, 3.2), 3.2) + lit(dots(c.value, R - 30 - len(c.value, 2.4), 36, 2.4), 2.4) + lit(arrow, 2.6);
  const narrow = lit(dots(c.name, 104, 12, 4.2), 4.2) + lit(dots(c.value, 104, 50, 3.1), 3.1);
  return svg(W, H, `${c.name}: ${c.value}`, '', style,
    panel(H) + logoDefs() +
    `<g opacity=".28">${logo(c.logo, M, 22, 44)}</g><g mask="url(#ledm)">${logo(c.logo, M, 22, 44)}</g>` +
    `<g class="w">${wide}</g><g class="n">${narrow}</g>`);
}

// ---------------------------------------------------------------- poster panels for live sites
function poster(site) {
  const w = 450, h = 340;
  const jpg = fs.readFileSync(path.join(SOURCES, site.image)).toString('base64');
  const domainP = 2.6;
  const style = '@media (max-width:300px){.cap{display:none}}';
  return svg(w, h, `${site.domain}: live website`, site.alt, style,
    panel(h, { w }) +
    lit(dots(site.domain, 20, 18, domainP), domainP) +
    `<defs><clipPath id="s"><rect x="20" y="50" width="410" height="256" rx="6"/></clipPath></defs>` +
    `<image href="data:image/jpeg;base64,${jpg}" x="20" y="50" width="410" height="256" clip-path="url(#s)" preserveAspectRatio="xMidYMin slice"/>` +
    `<g class="cap">${lit(dots(site.what, 20, 316, 1.7), 1.7, LED.dim)}</g>` +
    lit(dots('LIVE', w - 20 - len('LIVE', 1.7), 316, 1.7), 1.7, LED.live));
}

// ---------------------------------------------------------------- project boards
function boardHead(title) {
  const H = 64;
  return svg(W, H, title, '', `.n{display:none}${NARROW}{.w{display:none}.n{display:inline}}`,
    panel(H) +
    `<g class="w">${lit(dots(title, M, 20, 3.3), 3.3)}${lit(dots('STATUS', R - len('STATUS', 2), 26, 2), 2, LED.dim)}</g>` +
    `<g class="n">${lit(dots(title, M, 14, 5.4), 5.4)}</g>`);
}
function boardRow(item) {
  const H = 108;
  const x = 118;
  const status = item.status ?? (item.private ? 'PRIVATE' : 'REPO >');
  const statusColor = item.private && !item.url ? LED.dim : LED.on;
  const style = `.n{display:none}${NARROW}{.w{display:none}.n{display:inline}}`;
  const wide =
    lit(dots(item.date, M, 20, 2), 2, LED.dim) +
    lit(dots(item.title, x, 16, 3.2), 3.2) +
    lit(dots(status, R - len(status, 2), 20, 2), 2, statusColor) +
    lit(dots(item.desc, x, 48, 2), 2, item.private && !item.url ? LED.dim : LED.on) +
    (item.via ? lit(dots(item.via, x, 76, 1.6), 1.6, LED.dim) : '');
  const nt = item.narrowTitle ?? item.title;
  const narrow = lit(dots(nt, M, 16, 4.8), 4.8) + lit(dots(item.short, M, 62, 3.4), 3.4, item.private && !item.url ? LED.dim : LED.on);
  return svg(W, H, `${item.title}. ${item.desc}.`, '', style,
    panel(H) +
    `<g class="w">${wide}</g><g class="n">${narrow}</g>`);
}

// ---------------------------------------------------------------- tech stack board
// Each logo is defined once and reused: dim base, dot-masked layer, and a chase highlight that
// lights one logo at a time, like a sign running through its list. Steps keep repaints rare.
function stackBoard() {
  const perRow = 9;
  const cell = (R - M) / perRow;
  const size = 42;
  const rowH = 82;
  const stepS = 0.45;
  const total = cfg.stack.reduce((sum, g) => sum + g.items.length, 0);
  const cycle = (total * stepS).toFixed(2);
  const keyPct = (100 / total).toFixed(2);
  const scale = (size / 24).toFixed(3);
  let y = 72, defs = '', lights = '', labels = '', heads = '', headsN = '', chase = '', idx = 0;
  const css = [];
  cfg.stack.forEach((group, gi) => {
    if (gi) { heads += rule(y); y += 18; }
    heads += lit(dots(group.title, M, y, 2.2), 2.2);
    headsN += lit(dots(group.title, M, y - 6, 3.8), 3.8);
    y += 40;
    group.items.forEach(([id, label], i) => {
      if (!LOGOS[id]) throw new Error(`No logo called ${id}`);
      const cx = M + (i % perRow) * cell + cell / 2;
      const ty = y + Math.floor(i / perRow) * rowH;
      const at = `translate(${Math.round(cx - size / 2)} ${ty}) scale(${scale})`;
      defs += `<path id="L${idx}" d="${LOGOS[id]}"/>`;
      lights += `<use href="#L${idx}" transform="${at}"/>`;
      labels += dots(label, cx - len(label, 1.4) / 2 + 0.6, ty + size + 10, 1.4);
      chase += `<use class="k k${idx}" href="#L${idx}" transform="${at}"/>`;
      css.push(`.k${idx}{animation-delay:${(idx * stepS).toFixed(2)}s}`);
      idx++;
    });
    y += Math.ceil(group.items.length / perRow) * rowH + 8;
  });
  const H = Math.ceil((y + 6) / 4) * 4;
  const count = `${total} TOOLS`;
  const style =
    `.k{opacity:0;animation:k ${cycle}s steps(1) infinite}${css.join('')}` +
    `@keyframes k{0%{opacity:.95}${keyPct}%{opacity:0}100%{opacity:0}}` +
    `.hn{display:none}${STILL}{.k{display:none}}` +
    `${NARROW}{.lb,.hw,.c{display:none}.hn{display:inline}}`;
  const list = cfg.stack.map((g) => `${g.title}: ${g.items.map((x) => x[1]).join(', ')}`).join('. ');
  return svg(W, H, 'Tech stack', list, style,
    panel(H) + logoDefs() + `<defs>${defs}</defs>` +
    `<g class="hw">${lit(dots('TECH STACK', M, 20, 3.3), 3.3)}</g><g class="hn">${lit(dots('TECH STACK', M, 12, 5.4), 5.4)}</g>` +
    `<g class="c">${lit(dots(count, R - len(count, 2), 26, 2), 2, LED.dim)}</g>` + rule(56) +
    `<g class="hw">${heads}</g><g class="hn">${headsN}</g>` +
    `<g fill="${LED.on}" opacity=".3">${lights}</g><g fill="${LED.on}" mask="url(#ledm)">${lights}</g>` +
    `<g fill="#FFD27A">${chase}</g>` +
    `<g class="lb">${lit(labels, 1.4, LED.dim)}</g>`);
}

// ---------------------------------------------------------------- live departures board
function departures(stats) {
  const H = 424, P = 2.7;
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
    panel(H) + rule(56) + rule(256) + rule(378) +
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
  const img = (f, alt, extra = ' width="100%"') => `<img src="assets/${f}" alt="${esc(alt)}"${extra}>`;
  const contactRows = cfg.contacts.map((c) => `<a href="${esc(c.url)}">${img(`contact-${c.slug}.svg`, `${c.name}: ${c.value}`)}</a><br>`).join('\n');
  const posters = cfg.sites.map((s) => `<a href="${esc(s.url)}">${img(`site-${s.slug}.svg`, s.alt, ' width="49%"')}</a>`).join('\n');
  const boards = cfg.boards.map((b) => {
    const rows = b.rows.map((r) => {
      const pic = img(`row-${r.slug}.svg`, `${r.title}. ${r.desc}.${r.via ? ` Built with ${r.via.replace(/\s{2,}/g, ', ')}.` : ''}`);
      const href = r.url ?? (r.repo && !r.private ? u(r.repo) : null);
      return href ? `<a href="${esc(href)}">${pic}</a><br>` : `${pic}<br>`;
    }).join('\n');
    return `<p>\n${img(`head-${b.slug}.svg`, b.title)}<br>\n${rows}\n</p>`;
  }).join('\n\n');
  const stackAlt = `Tech stack. ${cfg.stack.map((g) => `${g.title}: ${g.items.map((x) => x[1]).join(', ')}`).join('. ')}.`;
  const allRows = cfg.boards.flatMap((b) => b.rows).filter((r) => r.repo).map((r) => `- [${r.title}](${u(r.repo)}): ${r.desc}`);
  const known = new Set([...cfg.boards.flatMap((b) => b.rows), ...cfg.otherStops].map((x) => x.repo?.toLowerCase()));
  const auto = stats.publicRepos.filter((r) => !known.has(r.name.toLowerCase())).map((r) => `- [${r.name.replace(/[_-]+/g, ' ')}](${r.url})${r.desc ? `: ${r.desc}` : ''}`);
  const others = [...cfg.otherStops.map((o) => `- [${o.title}](${u(o.repo)}): ${o.desc}`), ...auto];
  const sites = cfg.sites.map((s) => `- [${s.domain.toLowerCase()}](${s.url}): ${s.alt.split(', ').slice(1).join(', ')}`);
  const stackText = cfg.stack.map((g) => `- **${g.title}:** ${g.items.map((x) => x[1]).join(', ')}`);
  return `<!-- Generated by scripts/generate.mjs from network.config.json. Edit those, not this file. -->

<p>
${img('sign.svg', `${cfg.name}: ${cfg.roles.join(', ')}.`)}<br>
${contactRows}
</p>

${cfg.intro}

<p align="center">
${posters}
</p>

${boards}

${img('stack.svg', stackAlt, ' width="100%"')}

${img('departures.svg', `Live departure board. Latest public pushes: ${stats.recent.map((r) => `${r.name} on ${r.when}`).join(', ')}. ${stats.contributions} contributions in the last 12 months across ${stats.activeDays} active days. ${stats.total} repositories, ${stats.pub} public.`, ' width="100%"')}

${cfg.privateNote} The board above updates itself every week from this account.

<details>
<summary><b>Everything on this page, in plain text</b></summary>

**Live websites**

${sites.join('\n')}

**Public projects**

${allRows.join('\n')}
${others.join('\n')}

**Tech stack**

${stackText.join('\n')}

</details>

<p align="center"><sub><code>${esc(cfg.bio)}</code> 👽</sub></p>
`;
}

// ---------------------------------------------------------------- build
const stats = await getStats();
fs.mkdirSync(ASSETS, { recursive: true });
for (const f of fs.readdirSync(ASSETS)) fs.rmSync(path.join(ASSETS, f));
const out = (f, s) => fs.writeFileSync(path.join(ASSETS, f), s);
out('sign.svg', sign(stats));
cfg.contacts.forEach((c) => out(`contact-${c.slug}.svg`, contact(c)));
cfg.sites.forEach((s) => out(`site-${s.slug}.svg`, poster(s)));
cfg.boards.forEach((b) => {
  out(`head-${b.slug}.svg`, boardHead(b.title));
  b.rows.forEach((r) => out(`row-${r.slug}.svg`, boardRow(r)));
});
out('stack.svg', stackBoard());
out('departures.svg', departures(stats));
fs.writeFileSync(path.join(ROOT, 'README.md'), readme(stats));

const kb = (f) => (fs.statSync(path.join(ASSETS, f)).size / 1024).toFixed(0);
console.log(`repos ${stats.total} (public ${stats.pub}), contributions ${stats.contributions}, active days ${stats.activeDays}`);
console.log(`sizes: sign ${kb('sign.svg')}KB, stack ${kb('stack.svg')}KB, board ${kb('departures.svg')}KB, poster ${kb(`site-${cfg.sites[0].slug}.svg`)}KB, row ${kb(`row-${cfg.boards[0].rows[0].slug}.svg`)}KB`);
