// make.fun news-image-20261119 authored PNG encoder.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const W = 1024;
const H = 1024;

const C = {
  bg: [10, 13, 20],
  panel: [20, 26, 38],
  panelHi: [26, 33, 48],
  border: [45, 56, 76],
  faint: [28, 36, 52],
  grid: [34, 44, 62],
  gold: [232, 180, 74],
  goldDim: [148, 114, 48],
  cyan: [79, 195, 247],
  cyanDim: [44, 116, 150],
  red: [239, 83, 80],
  green: [102, 187, 106],
  purple: [179, 136, 255],
  white: [240, 243, 248],
  soft: [170, 182, 200],
  mute: [110, 124, 146],
  mapFill: [48, 66, 92],
  mapEdge: [104, 134, 172],
};

const px = new Uint8Array(W * H * 3);

function setPixel(x, y, c) {
  x = x | 0;
  y = y | 0;
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x, y, w, h, c) {
  const x0 = Math.max(0, x | 0);
  const y0 = Math.max(0, y | 0);
  const x1 = Math.min(W, (x + w) | 0);
  const y1 = Math.min(H, (y + h) | 0);
  for (let yy = y0; yy < y1; yy++) {
    const base = yy * W;
    for (let xx = x0; xx < x1; xx++) {
      const i = (base + xx) * 3;
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
    }
  }
}

function rect(x, y, w, h, c, t) {
  t = t || 1;
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}

function line(x0, y0, x1, y1, c, t) {
  x0 = x0 | 0; y0 = y0 | 0; x1 = x1 | 0; y1 = y1 | 0;
  t = t || 1;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const half = Math.floor(t / 2);
  while (true) {
    fillRect(x0 - half, y0 - half, t, t, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function circle(cx, cy, r, c, filled, t) {
  cx = cx | 0; cy = cy | 0; r = r | 0;
  t = t || 1;
  const rr = r * r;
  const ir = Math.max(0, r - t) * Math.max(0, r - t);
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (filled ? d <= rr : (d <= rr && d >= ir)) setPixel(cx + x, cy + y, c);
    }
  }
}

function polygon(points, c) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  minX = Math.max(0, Math.floor(minX));
  maxX = Math.min(W - 1, Math.ceil(maxX));
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(H - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i][0], yi = points[i][1];
        const xj = points[j][0], yj = points[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
      }
      if (inside) setPixel(x, y, c);
    }
  }
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    line(a[0], a[1], b[0], b[1], C.mapEdge, 1);
  }
}

const FONT = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'I': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  'J': ['..###', '....#', '....#', '....#', '#...#', '#...#', '.###.'],
  'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '%': ['##..#', '##.#.', '..#..', '..#..', '.#.##', '#..##', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '·': ['.....', '.....', '.....', '..#..', '.....', '.....', '.....'],
};

function glyph(ch) {
  return FONT[ch] || FONT['?'];
}

function textWidth(str, scale) {
  return str.length * 6 * scale - scale;
}

function fitScale(str, maxW, maxH) {
  let s = 1;
  while (textWidth(str, s + 1) <= maxW && 7 * (s + 1) <= maxH) s++;
  return s;
}

function drawText(str, x, y, scale, color) {
  const up = str.toUpperCase();
  let cx = x | 0;
  const cy = y | 0;
  for (let k = 0; k < up.length; k++) {
    const g = glyph(up[k]);
    for (let row = 0; row < 7; row++) {
      const bits = g[row];
      for (let col = 0; col < 5; col++) {
        if (bits[col] === '#') fillRect(cx + col * scale, cy + row * scale, scale, scale, color);
      }
    }
    cx += 6 * scale;
  }
}

function wrapText(str, maxW, scale) {
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const test = cur ? cur + ' ' + w : w;
    if (textWidth(test, scale) <= maxW || !cur) cur = test;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawTextWrapped(str, x, y, maxW, scale, color, gap) {
  gap = gap === undefined ? 6 : gap;
  const lines = wrapText(str, maxW, scale);
  let yy = y;
  for (let i = 0; i < lines.length; i++) {
    drawText(lines[i], x, yy, scale, color);
    yy += 7 * scale + gap;
  }
  return yy;
}

function panel(x, y, w, h, fill, border) {
  fillRect(x, y, w, h, fill);
  rect(x, y, w, h, border, 1);
  setPixel(x, y, C.bg);
  setPixel(x + w - 1, y, C.bg);
  setPixel(x, y + h - 1, C.bg);
  setPixel(x + w - 1, y + h - 1, C.bg);
}

function icon(kind, x, y, c) {
  const X = x | 0, Y = y | 0;
  if (kind === 'globe') {
    circle(X + 8, Y + 8, 7, c, false, 1);
    line(X + 1, Y + 8, X + 15, Y + 8, c, 1);
    line(X + 8, Y + 1, X + 8, Y + 15, c, 1);
    line(X + 3, Y + 4, X + 13, Y + 12, c, 1);
    line(X + 13, Y + 4, X + 3, Y + 12, c, 1);
  } else if (kind === 'bars') {
    fillRect(X + 2, Y + 10, 3, 4, c);
    fillRect(X + 7, Y + 6, 3, 8, c);
    fillRect(X + 12, Y + 2, 3, 12, c);
  } else if (kind === 'alert') {
    for (let r = 0; r < 14; r++) {
      const hw = Math.min(7, Math.floor(r / 2) + 1);
      fillRect(X + 8 - hw, Y + 2 + r, hw * 2 + 1, 1, c);
    }
    fillRect(X + 7, Y + 7, 2, 5, C.panel);
    fillRect(X + 7, Y + 13, 2, 2, C.panel);
  } else if (kind === 'chip') {
    rect(X + 3, Y + 3, 10, 10, c, 1);
    fillRect(X + 6, Y + 6, 4, 4, c);
    for (let i = 0; i < 3; i++) {
      fillRect(X + 5 + i * 3, Y, 2, 3, c);
      fillRect(X + 5 + i * 3, Y + 13, 2, 3, c);
      fillRect(X, Y + 5 + i * 3, 3, 2, c);
      fillRect(X + 13, Y + 5 + i * 3, 3, 2, c);
    }
  } else if (kind === 'leaf') {
    circle(X + 7, Y + 7, 6, c, true);
    line(X + 3, Y + 12, X + 12, Y + 3, C.panel, 2);
  } else if (kind === 'bolt') {
    for (let r = 0; r < 14; r++) {
      const off = r < 7 ? Math.round(r * 0.4) : Math.round((14 - r) * 0.4);
      fillRect(X + 6 + off, Y + r, 4, 1, c);
    }
  } else if (kind === 'shield') {
    for (let r = 0; r < 15; r++) {
      const hw = r < 9 ? 7 : Math.max(0, 7 - (r - 8) * 2);
      fillRect(X + 8 - hw, Y + r, hw * 2 + 1, 1, c);
    }
    fillRect(X + 7, Y + 5, 2, 6, C.panel);
    fillRect(X + 7, Y + 12, 2, 2, C.panel);
  } else if (kind === 'wave') {
    for (let x = 0; x < 16; x++) {
      const yy = Y + 8 + Math.round(Math.sin(x * 0.6) * 4);
      fillRect(X + x, yy, 1, 3, c);
    }
  } else if (kind === 'star') {
    for (let r = 0; r < 15; r++) {
      const hw = r < 6 ? Math.round(r * 1.2) : Math.round((14 - r) * 1.2);
      fillRect(X + 8 - hw, Y + r, hw * 2, 1, c);
    }
  } else if (kind === 'doc') {
    fillRect(X + 4, Y + 2, 9, 13, c);
    fillRect(X + 6, Y + 5, 5, 1, C.panel);
    fillRect(X + 6, Y + 8, 5, 1, C.panel);
    fillRect(X + 6, Y + 11, 3, 1, C.panel);
  }
}

function barChart(x, y, w, h, values, color, accent) {
  const pad = 8;
  const n = values.length;
  let max = 1;
  for (let i = 0; i < n; i++) if (values[i] > max) max = values[i];
  const bw = Math.max(2, Math.floor((w - pad * 2 - (n - 1) * 4) / n));
  const ih = h - pad * 2;
  for (let i = 0; i < n; i++) {
    const bh = Math.max(2, Math.round(ih * values[i] / max));
    const bx = x + pad + i * (bw + 4);
    fillRect(bx, y + h - pad - bh, bw, bh, i === n - 1 ? accent : color);
  }
  line(x, y + h - pad, x + w, y + h - pad, C.border, 1);
}

function sparkline(x, y, w, h, values, color, accent) {
  let hi = -1e9, lo = 1e9;
  for (let i = 0; i < values.length; i++) {
    if (values[i] > hi) hi = values[i];
    if (values[i] < lo) lo = values[i];
  }
  const span = hi - lo || 1;
  const n = values.length;
  const py = function (v) { return y + h - 1 - Math.round((v - lo) / span * (h - 1)); };
  for (let i = 0; i < n - 1; i++) {
    const x0 = x + Math.round(i * (w - 1) / (n - 1));
    const x1 = x + Math.round((i + 1) * (w - 1) / (n - 1));
    line(x0, py(values[i]), x1, py(values[i + 1]), i === n - 2 ? accent : color, 2);
  }
  circle(x + w - 1, py(values[n - 1]), 2, accent, true);
}

const MAP = [
  [[6, 18], [16, 12], [27, 13], [37, 11], [44, 17], [40, 25], [33, 27], [29, 37], [23, 41], [19, 33], [11, 29], [7, 24]],
  [[29, 37], [34, 39], [36, 47], [32, 45], [28, 41]],
  [[34, 49], [44, 47], [50, 53], [48, 65], [43, 79], [37, 88], [34, 76], [31, 62], [30, 54]],
  [[45, 21], [54, 16], [62, 19], [59, 27], [51, 30], [46, 27]],
  [[46, 33], [59, 31], [66, 39], [62, 57], [54, 71], [48, 62], [44, 47]],
  [[62, 15], [78, 11], [92, 17], [94, 29], [86, 37], [78, 41], [70, 37], [66, 29], [60, 25]],
  [[71, 39], [78, 41], [76, 51], [70, 47]],
  [[82, 43], [88, 45], [87, 53], [80, 49]],
  [[83, 65], [94, 63], [96, 73], [88, 78], [81, 71]],
  [[50, 30], [54, 31], [52, 34], [48, 33]],
];

const CITIES = [[18, 24], [38, 20], [52, 24], [58, 37], [72, 28], [88, 70], [40, 60], [85, 48]];

function drawMap(bx, by, bw, bh) {
  for (let i = 1; i < 4; i++) line(bx + Math.round(bw * i / 4), by, bx + Math.round(bw * i / 4), by + bh, C.grid, 1);
  for (let i = 1; i < 3; i++) line(bx, by + Math.round(bh * i / 3), bx + bw, by + Math.round(bh * i / 3), C.grid, 1);
  const sx = bw / 100, sy = bh / 100;
  for (let i = 0; i < MAP.length; i++) {
    const pts = [];
    for (let j = 0; j < MAP[i].length; j++) pts.push([bx + MAP[i][j][0] * sx, by + MAP[i][j][1] * sy]);
    polygon(pts, C.mapFill);
  }
  for (let i = 0; i < CITIES.length; i++) {
    const cx = bx + CITIES[i][0] * sx, cy = by + CITIES[i][1] * sy;
    circle(cx, cy, 4, C.goldDim, false, 1);
    circle(cx, cy, 2, C.gold, true);
  }
}

const CARDS = [
  { tag: 'DIPLOMACY', title: 'Climate cooperation pact signed by 18 nations', accent: C.gold, icon: 'globe', metric: '+18', unit: 'SIGNATORIES', vals: [18, 24, 22, 31, 36, 40, 52] },
  { tag: 'ECONOMY', title: 'Markets steady as inflation cools to 2.1 percent', accent: C.cyan, icon: 'bars', metric: '2.1%', unit: 'INFLATION', vals: [58, 52, 47, 44, 38, 35, 29] },
  { tag: 'TECHNOLOGY', title: 'New chip fabrication plant breaks ground', accent: C.purple, icon: 'chip', metric: '$4B', unit: 'INVESTMENT', vals: [12, 18, 26, 24, 35, 44, 50] },
  { tag: 'HEALTH', title: 'Vaccination drive passes seventy percent target', accent: C.green, icon: 'shield', metric: '70%', unit: 'COVERAGE', vals: [22, 30, 38, 46, 55, 63, 70] },
  { tag: 'ENERGY', title: 'Renewables reach record share of power grid', accent: C.cyan, icon: 'bolt', metric: '46%', unit: 'GRID SHARE', vals: [24, 27, 31, 34, 39, 43, 46] },
  { tag: 'SECURITY', title: 'Ceasefire holds across the northern border', accent: C.red, icon: 'alert', metric: '30D', unit: 'WITHOUT INCIDENT', vals: [8, 6, 9, 5, 4, 3, 2] },
  { tag: 'CULTURE', title: 'Heritage site reopens after long restoration', accent: C.gold, icon: 'doc', metric: '1.2M', unit: 'VISITORS PER YEAR', vals: [30, 42, 38, 55, 61, 70, 78] },
  { tag: 'SCIENCE', title: 'Deep sea survey charts a vast new coral reef', accent: C.green, icon: 'wave', metric: '210', unit: 'NEW SPECIES', vals: [14, 22, 30, 28, 41, 52, 64] },
];

function render() {
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const c = [Math.round(10 + 6 * t), Math.round(13 + 8 * t), Math.round(20 + 12 * t)];
    fillRect(0, y, W, 1, c);
  }
  for (let y = 20; y < H; y += 28) {
    for (let x = 20; x < W; x += 28) setPixel(x, y, C.faint);
  }

  fillRect(0, 0, W, 7, C.gold);
  fillRect(0, 7, W, 2, C.goldDim);
  drawText('GLOBAL EDITION / DAILY DIGEST', 32, 20, 2, C.gold);
  drawText('THE WORLD BRIEF', 32, 40, 5, C.white);
  drawText('19 NOVEMBER 2026', 700, 22, 3, C.white);
  drawText('THURSDAY / NO. 323', 742, 56, 2, C.soft);
  fillRect(32, 104, 960, 1, C.border);

  panel(32, 120, 628, 180, C.panel, C.border);
  fillRect(32, 120, 6, 180, C.gold);
  drawText('LEAD STORY', 56, 138, 2, C.gold);
  drawTextWrapped('NATIONS GATHER FOR GLOBAL SUMMIT', 56, 162, 380, 4, C.white, 6);
  drawText('40 NATIONS / 3 DAYS', 56, 270, 2, C.soft);
  drawText('SUMMIT INDEX', 456, 140, 1, C.mute);
  barChart(456, 152, 168, 118, [32, 45, 38, 60, 55, 72, 68, 85], C.cyanDim, C.cyan);

  panel(676, 120, 316, 180, C.panel, C.border);
  fillRect(676, 120, 316, 4, C.cyanDim);
  drawText('GLOBAL PULSE', 692, 134, 2, C.cyan);
  drawMap(690, 158, 288, 132);

  drawText('TOP STORIES', 32, 303, 2, C.gold);
  fillRect(152, 311, 840, 1, C.border);

  for (let i = 0; i < CARDS.length; i++) {
    const card = CARDS[i];
    const cx = 32 + (i % 2) * 492;
    const cy = 324 + Math.floor(i / 2) * 146;
    const cw = 468, ch = 132;
    panel(cx, cy, cw, ch, C.panel, C.border);
    fillRect(cx, cy, 5, ch, card.accent);
    icon(card.icon, cx + 16, cy + 14, card.accent);
    drawText(card.tag, cx + 42, cy + 16, 2, card.accent);
    drawTextWrapped(card.title, cx + 42, cy + 40, 276, 2, C.white, 6);
    drawText('7D TREND', cx + cw - 140, cy + 46, 1, C.mute);
    sparkline(cx + cw - 140, cy + 60, 124, 44, card.vals, card.accent === C.red ? C.red : C.cyanDim, card.accent);
    drawText(card.metric, cx + 42, cy + 90, 3, C.white);
    drawText(card.unit, cx + 42, cy + 116, 1, C.mute);
  }

  fillRect(0, 906, W, 1, C.border);
  fillRect(32, 906, 120, 2, C.gold);
  drawText('THE WORLD BRIEF', 32, 926, 3, C.white);
  drawText('INDEPENDENT GLOBAL EDITION / NO. 323', 32, 958, 2, C.mute);
  drawText('19 NOV 2026', 790, 926, 3, C.gold);
  drawText('VOL. 12 / PAGE 01', 800, 958, 2, C.soft);
  fillRect(0, 1016, W, 8, C.goldDim);
}

function crcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
}
const TBL = crcTable();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = TBL[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const out = Buffer.alloc(len + 12);
  out.writeUInt32BE(len, 0);
  out.write(type, 4, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + len)), 8 + len);
  return out;
}

function encodePNG() {
  const raw = Buffer.alloc(H * (1 + W * 3));
  let o = 0;
  for (let y = 0; y < H; y++) {
    raw[o++] = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      raw[o++] = px[i];
      raw[o++] = px[i + 1];
      raw[o++] = px[i + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', deflateSync(raw, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function main() {
  render();
  const png = encodePNG();
  const dir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'entry.png'), png);
}

main();
