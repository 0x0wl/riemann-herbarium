// Chapter VI · the capitulum: every module of the formalization as one floret of a single flower head.
//
// The arrangement is drawn by rule. Florets sit on Vogel's golden-angle spiral (H. Vogel, 1979):
// floret k at radius √k and angle k · 137.5077…°, which packs equal florets evenly. Phyllotaxis has no
// mathematical link to ζ or to this proof; it is a packing layout and nothing more.
// What the rule is given is data:
//   ring    the module's import distance from Main (Main is the centre floret; 44 rings, 0–43).
//           A ring's area is the number of modules at that distance.
//   sector  within a ring, florets are grouped by top-level name, so a name's share of the ring is its
//           share of the angle. The largest name, Development, is centred below; the rest fan out above.
//   seat    within one ring and one name, florets are shuffled by a fixed seed. The seat means nothing.
// Ring and name counts come from library-imports.js (depth_layers), so the name and distance stains draw
// at once. capitulum.png (capitulum-data.js) adds each module's compile minute and seconds on Euler, for
// the compile-time stain, its replay and the floret readout. Neither asset holds a module name.

import {libraryImports} from "./library-imports.js";
import {capitulumSummary, loadCapitulum} from "./capitulum-data.js";
import {rng} from "./seed.js";
import {motion} from "./motion.js";
import {easternWhen} from "./eastern.js";

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TAU = 2 * Math.PI;
const count = new Intl.NumberFormat("en-US");
const DIMMED = 256;           // palette offset of the faded copy of every colour
const BUD = 255;              // compile stain: a floret whose module had not finished yet
const TIME_STEPS = 254;       // compile stain: colours 0…253 run from the first finished module to Main
const PLAY_SECONDS = 18;      // the replay shows the 64 hours in this many seconds
const FRAME_MS = 1000 / 30;
const PERIOD_MINUTES = 16 * 60; // the compile stain's legend: four spans of sixteen hours since the first module

// The page's inks (ink.css custom properties), read from the figure so a theme or forced colours reach the canvas.
const INK = {
  print: ["--print", "#eaf0f4"], print2: ["--print-2", "#b6c7d8"], print3: ["--print-3", "#809ab6"],
  gold: ["--gold", "#e0b862"], goldDim: ["--gold-dim", "rgb(224 184 98 / .38)"], live: ["--live", "#93d9e6"],
  heather: ["--heather", "#c6a9e0"], vermilion: ["--vermilion", "#e8603f"], groundDeep: ["--ground-deep", "#071a31"],
};
const forcedColours = typeof matchMedia === "function" ? matchMedia("(forced-colors: active)") : null;

function readInk(node) {
  const style = getComputedStyle(node), out = {};
  for (const [key, [name, fallback]] of Object.entries(INK)) out[key] = style.getPropertyValue(name).trim() || fallback;
  if (forcedColours?.matches) {
    for (const key of ["print", "print2", "print3", "live", "heather", "vermilion"]) out[key] = "CanvasText";
    out.gold = out.goldDim = "Highlight";
    out.groundDeep = "Canvas";
  }
  return out;
}

/* Colour, by rule: OKLCH → sRGB, chroma reduced until the colour is displayable. */

function linearFromOklch(L, C, h) {
  const a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3;
  const m = (L - .1055613458 * a - .0638541728 * b) ** 3;
  const s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s,
    -.0041960863 * l - .7034186147 * m + 1.707614701 * s];
}

const displayable = rgb => rgb.every(v => v >= -1e-6 && v <= 1 + 1e-6);
const encode = v => Math.round(255 * (v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055));

export function oklch(L, C, h) {
  let rgb = linearFromOklch(L, C, h);
  if (!displayable(rgb)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (displayable(linearFromOklch(L, mid, h))) lo = mid; else hi = mid;
    }
    rgb = linearFromOklch(L, lo, h);
  }
  return rgb.map(v => encode(Math.min(1, Math.max(0, v))));
}

const css = ([r, g, b], alpha = 1) => alpha < 1 ? `rgb(${r} ${g} ${b} / ${alpha})` : `rgb(${r} ${g} ${b})`;

// The eleven top-level names, largest first; their order is also the order of the sectors.
export const names = Object.entries(libraryImports.libraries)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([name, modules]) => ({name, modules}));
const nameIndex = new Map(names.map(({name}, i) => [name, i]));

// Eleven hues in equal steps over 115°–380° of the OKLCH circle, which leaves out 20°–115°: vermilion
// through gold carry verdicts on this site, and gold means kernel-checked. The largest name takes the step
// nearest cyanotype blue (230°); each next name takes the free step farthest from the steps already used.
// Lightness alternates by step so neighbouring hues separate. Development, four fifths of the head, is
// kept pale and quiet; small names are saturated so they still read as single florets.
(function paintNames() {
  const from = 115, span = 265, steps = names.length;
  const hues = Array.from({length: steps}, (_, j) => from + (j + .5) * span / steps);
  const gap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  const used = [];
  names.forEach((entry, i) => {
    let slot = -1, best = -Infinity;
    hues.forEach((hue, j) => {
      if (used.includes(j)) return;
      const score = i === 0 ? -gap(hue, 230) : Math.min(...used.map(u => gap(hue, hues[u])));
      if (score > best) { best = score; slot = j; }
    });
    used.push(slot);
    entry.hue = hues[slot] % 360;
    entry.rgb = i === 0 ? oklch(.86, .05, entry.hue) : oklch(slot % 2 ? .75 : .83, .12, entry.hue);
    entry.css = css(entry.rgb);
  });
})();

// Growth rings: pale at Main, deeper outwards; even and odd rings alternate like early and late wood.
function ringRgb(d, rings) {
  const u = rings > 1 ? d / (rings - 1) : 0;
  return oklch(.93 - .36 * u + (d % 2 ? -.032 : .032), .035 + .085 * u, 205 + 70 * u);
}

// Compile time: the first modules deep and blue, the last ones (Main among them) pale as paper.
function timeRgb(u) {
  return oklch(.62 + .34 * u, .11 - .08 * u, 258 - 46 * u);
}

const BUD_RGB = [128, 154, 182];  // --print-3

// Times are US Eastern and say so: "20 November 2026, 12:52 p.m. EST"; labels abbreviate the
// month (copy §6.20): "21 Nov 2026, 4:13 a.m. EST".
const longWhen = ms => easternWhen(ms, {long: true});
const stamp = ms => easternWhen(ms);

const periodOf = minute => Math.min(3, Math.floor(minute / PERIOD_MINUTES));

function ordinal(n) {
  const tens = n % 100, ones = n % 10;
  const suffix = tens >= 11 && tens <= 13 ? "th" : ones === 1 ? "st" : ones === 2 ? "nd" : ones === 3 ? "rd" : "th";
  return count.format(n) + suffix;
}

function seconds(s) {
  if (s < 60) return s.toFixed(1) + " s";
  return s.toFixed(1) + " s (" + Math.floor(s / 60) + " min " + Math.round(s % 60) + " s)";
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* The arrangement. */

function cellsFromLayers() {
  const layers = libraryImports.depth_layers;
  const rings = 1 + Math.max(...layers.map(layer => layer.depth));
  const cells = new Uint32Array(rings * names.length);
  for (const layer of layers) {
    for (const [name, n] of Object.entries(layer.by_namespace)) cells[layer.depth * names.length + nameIndex.get(name)] += n;
  }
  return {rings, cells};
}

function cellsFromPlate(plate, rankOf) {
  let rings = 0;
  for (let i = 0; i < plate.count; i++) if (plate.depth[i] >= rings) rings = plate.depth[i] + 1;
  const cells = new Uint32Array(rings * names.length);
  for (let i = 0; i < plate.count; i++) cells[plate.depth[i] * names.length + rankOf[plate.namespace[i]]]++;
  return {rings, cells};
}

const sameCells = (a, b) => a.rings === b.rings && a.cells.every((n, i) => n === b.cells[i]);

const mod1 = v => v - Math.floor(v);

// The packing's own spiral families. Floret k lies on parastichy k mod F of the family with F arms (F a
// Fibonacci number); because c² ≡ ±1 (mod F) for c the Fibonacci number before F, the phase c·k mod F steps by
// one from a parastichy to its neighbour, so a narrow peak of that phase marks every 29th parastichy as a fine
// groove that follows the true spiral (3, 5, 8 … 55 grooves per family, Fibonacci again). As on a sunflower, the
// families that read best change with the radius: each is weighted where its spirals cross the radius near 45°
// (F ≈ 987 at the rim, about F/987 of the way out), and consecutive families wind opposite ways, so neighbours
// cross. spirals(N)[k] ∈ [0, 1] is how deep floret k lies in a groove. Drawn by rule; the grooves carry no data.
const FAMILIES = [[89, 55, 3], [144, 89, 5], [233, 144, 8], [377, 233, 13], [610, 377, 21], [987, 610, 34], [1597, 987, 55]];

function spirals(N) {
  const out = new Float32Array(N), weights = new Float32Array(N), BINS = 1024;
  for (const [m, c, grooves] of FAMILIES) {
    const wave = new Float32Array(m), near = new Float32Array(BINS + 1), at = m / 987;
    for (let j = 0; j < m; j++) wave[j] = ((1 + Math.cos(TAU * grooves * j / m)) / 2) ** 6;
    for (let i = 0; i <= BINS; i++) near[i] = Math.exp(-((Math.log(Math.max(i, .5) / BINS / at) / .55) ** 2));
    for (let k = 0; k < N; k++) {
      const w = near[Math.round(Math.sqrt((k + .5) / N) * BINS)];
      if (w < .01) continue;
      out[k] += w * wave[(c * k) % m];
      weights[k] += w;
    }
  }
  for (let k = 0; k < N; k++) if (weights[k]) out[k] /= Math.max(weights[k], 1);
  return out;
}

function arrange({rings, cells}) {
  const S = names.length, B = S + 1, ringStart = new Uint32Array(rings + 1), totals = new Uint32Array(rings);
  for (let d = 0; d < rings; d++) {
    for (let s = 0; s < S; s++) totals[d] += cells[d * S + s];
    ringStart[d + 1] = ringStart[d] + totals[d];
  }
  const N = ringStart[rings];
  if (N >= 262144) throw new Error("capitulum: too many florets for the seat index");
  // Each ring's sector boundaries, in turns clockwise from twelve o'clock, the largest name centred at six.
  const own = new Float64Array(rings * B);
  for (let d = 0; d < rings; d++) {
    if (!totals[d]) continue;
    let at = .5 - .5 * cells[d * S] / totals[d];
    for (let j = 0; j < B; j++) {
      own[d * B + j] = at;
      if (j < S) at += cells[d * S + j] / totals[d];
    }
  }
  // Where two rings meet, their boundaries meet halfway; inside a ring they slide from one seam to the other
  // and are exactly the ring's own at its middle. Florets are ordered along these sliding boundaries and then
  // split by the exact counts, so every cell keeps its modules while the sector edges run on as smooth arcs.
  const seam = (d, e, j) => e < 0 || e >= rings || !totals[e] ? own[d * B + j] : (own[d * B + j] + own[e * B + j]) / 2;
  const x = new Float32Array(N), y = new Float32Array(N), ring = new Uint8Array(N), name = new Uint8Array(N);
  const keys = new Float64Array(N), inner = new Float64Array(B), outer = new Float64Array(B), here = new Float64Array(B);
  for (let d = 0; d < rings; d++) {
    const first = ringStart[d], last = ringStart[d + 1];
    if (first === last) continue;
    const mine = own.subarray(d * B, d * B + B), rIn = Math.sqrt(first / N), rOut = Math.sqrt(last / N);
    for (let j = 0; j < B; j++) { inner[j] = seam(d, d - 1, j); outer[j] = seam(d, d + 1, j); }
    for (let k = first; k < last; k++) {
      const r = Math.sqrt((k + .5) / N), turn = mod1(k * GOLDEN_ANGLE / TAU);
      x[k] = r * Math.sin(turn * TAU);
      y[k] = -r * Math.cos(turn * TAU);
      ring[k] = d;
      const t = Math.min(1, Math.max(0, (r - rIn) / (rOut - rIn)));
      for (let j = 0; j < B; j++) {
        here[j] = t < .5 ? inner[j] + (mine[j] - inner[j]) * 2 * t : mine[j] + (outer[j] - mine[j]) * (2 * t - 1);
      }
      const angle = here[0] + mod1(turn - here[0]);
      let j = 0;
      while (j < S - 1 && angle >= here[j + 1]) j++;
      const span = here[j + 1] - here[j];
      const along = mine[j] + (span > 1e-12 ? (angle - here[j]) / span : 0) * (mine[j + 1] - mine[j]);
      keys[k] = (d * 1048576 + Math.min(1048575, Math.floor(mod1(along - mine[0]) * 1048576))) * 262144 + k;
    }
  }
  keys.sort();
  const order = new Uint32Array(N);
  for (let j = 0; j < N; j++) order[j] = keys[j] % 262144;
  for (let d = 0, j = 0; d < rings; d++) {
    for (let s = 0; s < S; s++) for (let n = cells[d * S + s]; n > 0; n--) name[order[j++]] = s;
  }
  return {N, rings, cells, ringStart, x, y, ring, name, order, spiral: spirals(N)};
}

// Seat each module of the plate in its cell (ring × name); within a cell the seats are shuffled.
function seat(layout, plate, rankOf) {
  const S = names.length, total = layout.rings * S;
  const offsets = new Uint32Array(total + 1);
  for (let c = 0; c < total; c++) offsets[c + 1] = offsets[c] + layout.cells[c];
  const cursor = offsets.slice(0, total), sequence = new Uint32Array(layout.N);
  for (let i = 0; i < plate.count; i++) sequence[cursor[plate.depth[i] * S + rankOf[plate.namespace[i]]]++] = i;
  const random = rng("capitulum " + capitulumSummary.crc32);
  for (let c = 0; c < total; c++) {
    for (let k = offsets[c + 1] - 1; k > offsets[c]; k--) {
      const j = offsets[c] + Math.floor(random() * (k - offsets[c] + 1));
      const held = sequence[k]; sequence[k] = sequence[j]; sequence[j] = held;
    }
  }
  const moduleAt = new Uint32Array(layout.N), seatOf = new Uint32Array(layout.N);
  for (let j = 0; j < layout.N; j++) {
    moduleAt[layout.order[j]] = sequence[j];
    seatOf[sequence[j]] = layout.order[j];
  }
  return {moduleAt, seatOf};
}

/* Rasterising. Where florets are at least two device pixels apart each is a distinct antialiased dot with a
   small gap round it, so the head reads as florets and the lattice shows its spirals; finer heads (phones,
   standard screens) are drawn area-weighted through a small tent filter, every floret sharing its colour with
   the pixels round it, which keeps the regular lattice from beating against the pixel grid into moiré.
   shade[k] scales the floret's colour (tone and spiral bands); palette gives each slot's colour and opacity. */

function discKernel(f) {
  const Q = 8, reach = Math.ceil(f + .5), starts = new Uint32Array(Q * Q + 1), dx = [], dy = [], w = [];
  for (let qy = 0; qy < Q; qy++) {
    for (let qx = 0; qx < Q; qx++) {
      const ox = (qx + .5) / Q, oy = (qy + .5) / Q;
      for (let by = -reach; by <= reach; by++) {
        for (let bx = -reach; bx <= reach; bx++) {
          const cover = Math.min(1, f + .5 - Math.hypot(bx + .5 - ox, by + .5 - oy));
          if (cover > .03) { dx.push(bx); dy.push(by); w.push(cover); }
        }
      }
      starts[qy * Q + qx + 1] = w.length;
    }
  }
  return {Q, starts, dx: Int8Array.from(dx), dy: Int8Array.from(dy), w: Float32Array.from(w), soft: false};
}

// For fine heads: a tent 1.25 px wide each way, weights summing to one, so a floret spreads its colour over
// the pixels around it instead of snapping to one.
function tentKernel(radius = 1.25) {
  const Q = 8, reach = Math.ceil(radius), starts = new Uint32Array(Q * Q + 1), dx = [], dy = [], w = [];
  for (let qy = 0; qy < Q; qy++) {
    for (let qx = 0; qx < Q; qx++) {
      const ox = (qx + .5) / Q, oy = (qy + .5) / Q, cell = [];
      let sum = 0;
      for (let by = -reach; by <= reach; by++) {
        for (let bx = -reach; bx <= reach; bx++) {
          const weight = Math.max(0, 1 - Math.abs(bx + .5 - ox) / radius) * Math.max(0, 1 - Math.abs(by + .5 - oy) / radius);
          if (weight > 0) { cell.push([bx, by, weight]); sum += weight; }
        }
      }
      for (const [bx, by, weight] of cell) { dx.push(bx); dy.push(by); w.push(weight / sum); }
      starts[qy * Q + qx + 1] = w.length;
    }
  }
  return {Q, starts, dx: Int8Array.from(dx), dy: Int8Array.from(dy), w: Float32Array.from(w), soft: true};
}

function raster(image, geometry, layout, slots, palette, kernel, shade) {
  const {data, width, height} = image, {x, y, N} = layout, {cx, cy, R} = geometry;
  data.fill(0);
  if (kernel.soft) return rasterSoft(image, geometry, layout, slots, palette, kernel, shade);
  const {Q, starts, dx, dy, w} = kernel;
  for (let k = 0; k < N; k++) {
    const p = slots[k] * 4, A = palette[p + 3];
    if (!A) continue;
    const fx = cx + x[k] * R, fy = cy + y[k] * R, ix = Math.floor(fx), iy = Math.floor(fy);
    // The gaps between distinct florets darken the head a little; their colour is lifted to make up for it.
    const v = ((fy - iy) * Q | 0) * Q + ((fx - ix) * Q | 0), m = shade[k] * 1.1;
    const r = Math.min(255, palette[p] * m), g = Math.min(255, palette[p + 1] * m), b = Math.min(255, palette[p + 2] * m);
    for (let e = starts[v], end = starts[v + 1]; e < end; e++) {
      const px = ix + dx[e], py = iy + dy[e];
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const o = (py * width + px) * 4, a = w[e] * A;
      if (a > data[o + 3]) { data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a; }
    }
  }
}

let sums = null;
function rasterSoft(image, geometry, layout, slots, palette, kernel, shade) {
  const {data, width, height} = image, {x, y, N} = layout, {cx, cy, R, spacing} = geometry;
  const {Q, starts, dx, dy, w} = kernel;
  if (!sums || sums.length !== width * height * 4) sums = new Float32Array(width * height * 4);
  else sums.fill(0);
  const area = .86 * spacing * spacing / 255;   // each floret covers its share of the head, less a little ground
  for (let k = 0; k < N; k++) {
    const p = slots[k] * 4, A = palette[p + 3] * area;
    if (!A) continue;
    const fx = cx + x[k] * R, fy = cy + y[k] * R, ix = Math.floor(fx), iy = Math.floor(fy);
    const v = ((fy - iy) * Q | 0) * Q + ((fx - ix) * Q | 0), m = shade[k];
    const r = Math.min(255, palette[p] * m), g = Math.min(255, palette[p + 1] * m), b = Math.min(255, palette[p + 2] * m);
    for (let e = starts[v], end = starts[v + 1]; e < end; e++) {
      const px = ix + dx[e], py = iy + dy[e];
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const o = (py * width + px) * 4, a = w[e] * A;
      sums[o] += r * a; sums[o + 1] += g * a; sums[o + 2] += b * a; sums[o + 3] += a;
    }
  }
  for (let o = 0; o < data.length; o += 4) {
    const a = sums[o + 3];
    if (!a) continue;
    data[o] = sums[o] / a; data[o + 1] = sums[o + 1] / a; data[o + 2] = sums[o + 2] / a; data[o + 3] = Math.min(1, a) * 255;
  }
}

function palette(entries) {
  const out = new Uint8ClampedArray(512 * 4);
  entries.forEach((rgb, slot) => {
    if (!rgb) return;
    const [r, g, b, a = 1] = rgb;
    out.set([r, g, b, Math.round(255 * a)], slot * 4);
    out.set([r, g, b, Math.round(255 * a * .16)], (slot + DIMMED) * 4);
  });
  return out;
}

let instances = 0;

export function createCapitulum() {
  const id = "capitulum-" + (++instances);
  // The census (modules per ring and name) is known at once; the arrangement of 175,187 seats (about 25 ms,
  // most of it one sort) waits until the head first comes into view, so a page load never pays for it.
  let census = null, layout = null, rings = 0, ringStart = null, ringTotals = [], widest = 0;
  function adoptCensus(next) {
    census = next;
    rings = next.rings;
    ringTotals = Array.from({length: rings}, (_, d) =>
      next.cells.subarray(d * names.length, (d + 1) * names.length).reduce((sum, n) => sum + n, 0));
    ringStart = new Uint32Array(rings + 1);
    ringTotals.forEach((n, d) => { ringStart[d + 1] = ringStart[d] + n; });
    widest = ringTotals.indexOf(Math.max(...ringTotals));
    layout = null;
  }
  adoptCensus(cellsFromLayers());
  const N = ringStart[rings];
  // Arranged on first sight; a new arrangement drops the shades and pictures made for the old one.
  let shades = new Map();
  function ensureLayout() {
    if (!layout) {
      layout = arrange(census);
      shades = new Map();
      cache = new Map();
    }
    return layout;
  }

  // How bright each floret is drawn in a colouring. By name, each name runs through a tonal range, lighter
  // towards Main and deeper towards the rim (the ring is the import distance, so this follows it); in every
  // colouring the spiral bands of two of the packing's own families add a little light and shade (drawn by rule).
  function shadeFor(stain) {
    let out = shades.get(stain);
    if (!out) {
      out = new Float32Array(N);
      const spiral = layout.spiral;
      for (let k = 0; k < N; k++) {
        out[k] = stain === "name"
          ? (1.1 - .17 * Math.sqrt((k + .5) / N)) * (1 - .22 * spiral[k])
          : 1 - .16 * spiral[k];
      }
      shades.set(stain, out);
    }
    return out;
  }

  /* Figure: the head, its readout and the replay. */
  const figure = el("div", "capitulum");
  figure.dataset.stain = "name";
  const stage = el("div", "capitulum-stage");
  const head = el("canvas", "capitulum-head");
  head.setAttribute("aria-hidden", "true");
  const lens = el("canvas", "capitulum-lens");
  lens.tabIndex = 0;
  lens.setAttribute("role", "application");
  lens.setAttribute("aria-roledescription", "flower head");
  lens.setAttribute("aria-label", `A round head of ${count.format(N)} tiny florets, evenly packed, in eleven colours. ` +
    "One colour covers about four fifths of the head. Each floret is one module; its ring is the module's import " +
    "distance from Main, at the centre.");
  lens.setAttribute("aria-describedby", id + "-keys");
  const wait = el("p", "capitulum-wait", "Developing…");
  stage.append(head, lens, wait);
  const readout = el("p", "capitulum-readout");
  const spoken = el("p", "sr-only");
  spoken.setAttribute("aria-live", "polite");
  const keys = el("p", "sr-only", "Arrow keys move the hand lens from floret to floret; with Shift it moves eight florets. " +
    "Page Up and Page Down cross to the next ring inwards or outwards. Home returns to Main. Escape puts the lens down.");
  keys.id = id + "-keys";

  const replay = el("div", "capitulum-replay");
  replay.hidden = true;
  const play = el("button", "button capitulum-play", "Play the 64 hours");
  play.type = "button";
  const track = el("div", "capitulum-track");
  const growthDim = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const growthLit = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  for (const svg of [growthDim, growthLit]) {
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("preserveAspectRatio", "none");
  }
  growthDim.setAttribute("class", "capitulum-growth");
  growthLit.setAttribute("class", "capitulum-growth is-lit");
  const scrub = el("input", "capitulum-scrub");
  scrub.type = "range";
  scrub.min = "0";
  scrub.step = "1";
  scrub.setAttribute("aria-label", "Hours since the first module");
  track.append(growthDim, growthLit, scrub);
  const ends = el("div", "capitulum-ends");
  ends.append(el("span", "", "First module " + stamp(Date.parse(capitulumSummary.start))),
    el("span", "", "Main " + stamp(Date.parse(capitulumSummary.end))));
  const clock = el("output", "capitulum-clock");
  const stillNote = el("p", "capitulum-still", "Motion is paused. Drag the scrubber to replay the build.");
  stillNote.hidden = true;
  const replayHead = el("div", "capitulum-replay-head");
  replayHead.append(play, clock);
  replay.append(replayHead, track, ends, stillNote);
  figure.append(stage, readout, replay, keys, spoken);

  /* Panel: the stains and their legends. */
  const panel = el("div", "structure-inspector capitulum-panel");
  panel.dataset.structureInspector = "";
  const title = el("h3", "", `${count.format(N)} florets`);
  const stains = el("div", "capitulum-stains");
  stains.setAttribute("role", "group");
  stains.setAttribute("aria-label", "Colour the florets");
  const stainButtons = [["name", "By name"], ["depth", "By import distance"], ["time", "By compile time"]].map(([value, text]) => {
    const button = el("button", "toggle", text);
    button.type = "button";
    button.dataset.stain = value;
    stains.append(button);
    return button;
  });
  const legendTitle = el("p", "capitulum-legend-title");
  const legend = el("div", "capitulum-legend");
  const note = el("p", "capitulum-note");
  const kernelNote = el("p", "capitulum-kernel");
  panel.append(el("div", "structure-kicker", "Capitulum"), title, stains, legendTitle, legend, note, kernelNote);

  /* State. */
  const state = {
    stain: "name", hover: -1, focus: -1, touched: false, transient: null, pinned: null,
    time: 0, playing: false, kernel: {state: "pending", label: ""}, active: true,
  };
  let plate = null, seats = null, plateError = null, minutes = 0, cumulative = null, startMs = 0;
  let periods = [];
  let ink = Object.fromEntries(Object.entries(INK).map(([key, [, fallback]]) => [key, fallback]));
  let size = null, kernel = null, image = null, cache = new Map();
  let shown = "", drawnUpTo = 0;
  let frame = 0, lastFrame = 0, lastFull = 0, dirtyHead = true, dirtyLens = true;
  let visible = false, started = false;
  const headCtx = head.getContext("2d");
  const lensCtx = lens.getContext("2d");

  const stainPalettes = {};
  stainPalettes.name = palette(names.map(n => n.rgb));
  stainPalettes.depth = palette(ringTotals.map((_, d) => ringRgb(d, rings)));
  const timeEntries = Array.from({length: TIME_STEPS}, (_, i) => timeRgb(i / (TIME_STEPS - 1)));
  timeEntries[BUD] = [...BUD_RGB, .2];
  stainPalettes.time = palette(timeEntries);
  let slots = new Uint16Array(N);

  const highlight = () => state.transient || state.pinned;
  const highlightKey = h => h ? h.kind + h.index : "";
  const timeStep = minute => Math.min(TIME_STEPS - 1, Math.floor(minute / Math.max(1, minutes) * TIME_STEPS));

  function slotOf(k, stain, h, time) {
    let slot, dim = false;
    if (stain === "name") slot = layout.name[k];
    else if (stain === "depth") slot = layout.ring[k];
    else {
      const minute = plate.minute[seats.moduleAt[k]];
      slot = minute <= time ? timeStep(minute) : BUD;
      if (h?.kind === "hours") dim = periodOf(minute) !== h.index;
    }
    if (h?.kind === "name") dim = layout.name[k] !== h.index;
    else if (h?.kind === "ring") dim = layout.ring[k] !== h.index;
    return dim ? slot + DIMMED : slot;
  }

  /* Geometry. */
  function measure(width) {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(width * ratio));
    // The head leaves a tenth of its radius round it for the involucre of bracts.
    const R = W / 2 / 1.11;
    const spacing = R * Math.sqrt(Math.PI / N);
    // At two device pixels apart or more, each floret is a dot about three quarters of the spacing wide, so a
    // little ground shows round every one; closer than that they are drawn area-weighted (soft).
    const soft = spacing < 2;
    const f = Math.min(2.6, Math.max(.62, spacing * .37));
    return {css: width, ratio, W, cx: W / 2, cy: W / 2, R, spacing, f, soft, unit: Math.sqrt(Math.PI / N)};
  }

  function resize(width) {
    if (!(width > 0)) return;
    if (size && Math.abs(size.css - width) < .5 && size.ratio === Math.min(2, window.devicePixelRatio || 1)) return;
    size = measure(width);
    ink = readInk(figure);
    head.width = head.height = lens.width = lens.height = size.W;
    kernel = size.soft ? tentKernel() : discKernel(size.f);
    image = headCtx.createImageData(size.W, size.W);
    cache = new Map();
    shown = "";
    dirtyHead = dirtyLens = true;
    schedule();
  }

  /* Drawing the head. */
  function renderHead() {
    const stain = state.stain, h = highlight();
    const time = stain === "time" ? state.time : 0;
    const key = stain + "|" + highlightKey(h) + "|" + time;
    if (key === shown) return;
    if (stain === "time" && !h && shown.startsWith("time||") && state.time >= drawnUpToMinute()) {
      openFlorets();
      shown = key;
      return;
    }
    const cacheable = !h && (stain !== "time" || time === minutes);
    let pixels = cacheable ? cache.get(key) : null;
    if (!pixels) {
      for (let k = 0; k < N; k++) slots[k] = slotOf(k, stain, h, time);
      raster(image, size, layout, slots, stainPalettes[stain], kernel, shadeFor(stain));
      pixels = image;
      if (cacheable) {
        pixels = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
        cache.set(key, pixels);
      }
      lastFull = performance.now();
    }
    headCtx.putImageData(pixels, 0, 0);
    involucre(headCtx);
    shown = key;
    drawnUpTo = stain === "time" ? cumulative[time] : 0;
    wait.hidden = true;
  }

  // The involucre: two rows of engraved bracts round the head, 55 and 34 of them, as on a pressed sunflower.
  // Pure decoration, drawn by rule with a fixed seed; it frames the head and carries no data.
  function involucre(ctx) {
    const {cx, cy, R, ratio: r} = size, random = rng("capitulum involucre");
    ctx.save();
    ctx.strokeStyle = ink.print3;
    ctx.lineWidth = .75 * r;
    ctx.lineJoin = "round";
    ctx.globalAlpha = .55;
    for (const [count, base, length, offset] of [[34, 1.022, .07, .5], [55, 1.004, .05, 0]]) {
      for (let j = 0; j < count; j++) {
        const angle = (j + offset) / count * TAU + random.range(-.01, .01);
        const ux = Math.sin(angle), uy = -Math.cos(angle), nx = -uy, ny = ux;
        const bx = cx + ux * R * base, by = cy + uy * R * base;
        const reach = R * length * random.range(.88, 1.12), half = R * (count === 55 ? .026 : .034) * random.range(.9, 1.1);
        const tx = bx + ux * reach, ty = by + uy * reach;
        const mx = bx + ux * reach * .38, my = by + uy * reach * .38;
        // Each bract first erases what lies under it (the page shows through, whatever its ground), then is
        // engraved, so the inner row lies over the outer one like scales.
        ctx.beginPath();
        ctx.moveTo(bx - nx * half * .55, by - ny * half * .55);
        ctx.quadraticCurveTo(mx - nx * half * 1.6, my - ny * half * 1.6, tx, ty);
        ctx.quadraticCurveTo(mx + nx * half * 1.6, my + ny * half * 1.6, bx + nx * half * .55, by + ny * half * .55);
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 1;
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = .55;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + ux * reach * .72, by + uy * reach * .72);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawnUpToMinute() {
    return drawnUpTo ? plate.minute[drawnUpTo - 1] : -1;
  }

  // During the replay only the florets that open in this frame are painted, in compile order.
  function openFlorets() {
    const target = cumulative[state.time], shade = shadeFor("time");
    if (target <= drawnUpTo) return;
    const {cx, cy, R, f} = size;
    let style = null;
    headCtx.save();
    headCtx.globalAlpha = size.soft ? .86 : 1;
    headCtx.beginPath();
    for (let i = drawnUpTo; i < target; i++) {
      const k = seats.seatOf[i], next = shadedStyle("time", timeStep(plate.minute[i]), shade[k]);
      if (next !== style) {
        if (style) headCtx.fill();
        headCtx.fillStyle = style = next;
        headCtx.beginPath();
      }
      const fx = cx + layout.x[k] * R, fy = cy + layout.y[k] * R;
      headCtx.moveTo(fx + f, fy);
      headCtx.arc(fx, fy, f, 0, TAU);
    }
    if (style) headCtx.fill();
    headCtx.restore();
    drawnUpTo = target;
  }

  // A floret's colour as CSS: its slot's colour scaled by its shade, quantised to 1/64 so strings are reused.
  const styleCache = new Map();
  function shadedStyle(stain, slot, m) {
    const level = Math.round(m * 64), key = `${stain}${slot}:${level}`;
    let style = styleCache.get(key);
    if (style === undefined) {
      const colours = stainPalettes[stain], p = slot * 4, alpha = colours[p + 3] / 255, s = level / 64;
      style = alpha ? css([0, 1, 2].map(i => Math.min(255, Math.round(colours[p + i] * s))), Math.round(alpha * 1000) / 1000) : null;
      styleCache.set(key, style);
    }
    return style;
  }

  /* Drawing the lens layer: Main's ring, ring marks, highlights, the hand lens. Inks come from ink.css. */
  function floretStyle(k) {
    return shadedStyle(state.stain, slotOf(k, state.stain, highlight(), state.time), shadeFor(state.stain)[k]);
  }

  function point(k) {
    return [size.cx + layout.x[k] * size.R, size.cy + layout.y[k] * size.R];
  }

  function stroke(ctx, colour, width, alpha = 1, dash = null) {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    ctx.setLineDash(dash || []);
  }

  function circle(ctx, x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.stroke();
  }

  function label(ctx, text, x, y) {
    const r = size.ratio;
    ctx.font = `${11 * r}px "Lark Mono", ui-monospace, "Cascadia Mono", Consolas, monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    stroke(ctx, ink.groundDeep, 3 * r, .9);
    ctx.strokeText(text, x, y);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ink.print;
    ctx.fillText(text, x, y);
  }

  function ringRadius(d) {
    return size.R * Math.sqrt(ringStart[d] / N);
  }

  function renderLens() {
    const ctx = lensCtx, r = size.ratio, h = highlight();
    ctx.clearRect(0, 0, size.W, size.W);
    ctx.save();
    // The rim needs no line of its own: the involucre on the head layer frames it.
    if (state.stain === "depth") {
      // Every fifth ring boundary dashed; the largest ring drawn in full and labelled with its count.
      stroke(ctx, ink.groundDeep, r, .55, [2 * r, 3 * r]);
      for (let d = 5; d < rings; d += 5) circle(ctx, size.cx, size.cy, ringRadius(d));
      stroke(ctx, ink.print, r, .7);
      for (const d of [widest, widest + 1]) circle(ctx, size.cx, size.cy, ringRadius(d));
      const angle = Math.PI / 4;
      for (const d of [widest, 15, 20, rings - 1]) {
        const middle = size.R * Math.sqrt((ringStart[d] + ringTotals[d] / 2) / N);
        label(ctx, d === widest ? `${d} · ${count.format(ringTotals[d])}` : String(d),
          size.cx + Math.sin(angle) * middle + 4 * r, size.cy - Math.cos(angle) * middle);
      }
    }
    if (h?.kind === "ring") {
      stroke(ctx, ink.print, 1.25 * r);
      for (const d of [h.index, h.index + 1]) {
        if (d <= rings) circle(ctx, size.cx, size.cy, Math.max(ringRadius(d), size.f + 2 * r));
      }
    }
    if (h?.kind === "name" && names[h.index].modules <= 200) {
      // Too few florets to see on their own: ring each one.
      stroke(ctx, ink.print, r);
      ctx.beginPath();
      for (let k = 0; k < N; k++) {
        if (layout.name[k] !== h.index) continue;
        const [x, y] = point(k);
        ctx.moveTo(x + 5 * r, y);
        ctx.arc(x, y, 5 * r, 0, TAU);
      }
      ctx.stroke();
    }
    // Main, the centre floret, carries the determination of its five theorems for the selected input (design
    // §3.1): gold when con-leche accepted them, vermilion if it rejected one, live while it replays, heather when
    // the record is inconclusive, unconfirmed or unavailable, and a dashed pencil ring while nothing is decided.
    const [mx, my] = point(0), verdict = state.kernel.state;
    const solid = {failed: ink.vermilion, running: ink.live, inconclusive: ink.heather}[verdict];
    if (verdict === "passed") {
      stroke(ctx, ink.goldDim, 3 * r);
      circle(ctx, mx, my, 9 * r);
      stroke(ctx, ink.gold, 1.25 * r);
      circle(ctx, mx, my, 7 * r);
    } else if (solid) {
      stroke(ctx, solid, 1.25 * r);
      circle(ctx, mx, my, 7 * r);
    } else {
      stroke(ctx, ink.print2, 1.1 * r, 1, [2 * r, 2.5 * r]);
      circle(ctx, mx, my, 7 * r);
    }
    label(ctx, "Main", mx + 13 * r, my);
    // The hand lens follows the pointer; a floret chosen by keyboard or touch keeps it while the head has
    // focus (or after a tap), and otherwise is only ringed where the lens was put down.
    if (state.hover >= 0) loupe(ctx, state.hover);
    else if (state.focus >= 0 && (state.touched || document.activeElement === lens)) loupe(ctx, state.focus);
    else if (state.focus >= 0) {
      const [fx, fy] = point(state.focus);
      stroke(ctx, ink.print, 1.25 * r);
      circle(ctx, fx, fy, 4 * r);
    }
    ctx.restore();
  }

  function nearSeats(xu, yu, radius, visit) {
    const ru = Math.hypot(xu, yu);
    const lo = Math.max(0, Math.floor(N * Math.max(0, ru - radius) ** 2 - .5));
    const hi = Math.min(N - 1, Math.ceil(N * (ru + radius) ** 2));
    const r2 = radius * radius;
    for (let k = lo; k <= hi; k++) {
      const dx = layout.x[k] - xu, dy = layout.y[k] - yu, d2 = dx * dx + dy * dy;
      if (d2 <= r2) visit(k, d2);
    }
  }

  function nearest(xu, yu, radius, except = -1) {
    let best = -1, bestD = Infinity;
    nearSeats(xu, yu, radius, (k, d2) => {
      if (k !== except && d2 < bestD) { best = k; bestD = d2; }
    });
    return best;
  }

  // A hand lens: the florets around the active one, magnified until each can be seen on its own.
  function loupe(ctx, k) {
    const r = size.ratio, [ax, ay] = point(k);
    const radius = Math.min(64 * r, size.W * .17);
    const magnify = Math.max(3, Math.min(16, 11 * r / size.spacing));
    let lx = ax, ly = ay - radius - 22 * r;
    if (ly - radius < 2 * r) ly = ay + radius + 22 * r;
    lx = Math.min(size.W - radius - 2 * r, Math.max(radius + 2 * r, lx));
    ly = Math.min(size.W - radius - 2 * r, Math.max(radius + 2 * r, ly));
    const toward = Math.atan2(ly - ay, lx - ax);
    ctx.save();
    stroke(ctx, ink.print, r, .5);
    ctx.beginPath();
    ctx.moveTo(ax + Math.cos(toward) * 4 * r, ay + Math.sin(toward) * 4 * r);
    ctx.lineTo(lx - Math.cos(toward) * radius, ly - Math.sin(toward) * radius);
    ctx.stroke();
    stroke(ctx, ink.print, r);
    circle(ctx, ax, ay, 3.5 * r);
    ctx.beginPath();
    ctx.arc(lx, ly, radius, 0, TAU);
    ctx.globalAlpha = .94;
    ctx.fillStyle = ink.groundDeep;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.clip();
    const reach = radius / magnify / size.R;
    const floret = Math.max(1.2 * r, size.f * magnify * .92);
    nearSeats(layout.x[k], layout.y[k], reach * 1.05, seatK => {
      const style = floretStyle(seatK);
      if (!style) return;
      const [fx, fy] = point(seatK);
      ctx.fillStyle = style;
      ctx.beginPath();
      ctx.arc(lx + (fx - ax) * magnify, ly + (fy - ay) * magnify, floret, 0, TAU);
      ctx.fill();
    });
    stroke(ctx, ink.print, 1.25 * r);
    circle(ctx, lx, ly, floret + 3.5 * r);
    ctx.restore();
    stroke(ctx, ink.print, r, .7);
    circle(ctx, lx, ly, radius);
    ctx.globalAlpha = 1;
  }

  /* Words. */
  function describe(k) {
    const d = layout.ring[k], nameText = names[layout.name[k]].name;
    const where = d === 0 ? "Main itself" : `${d} import step${d === 1 ? "" : "s"} from Main`;
    const parts = [nameText, where];
    if (seats) {
      const i = seats.moduleAt[k];
      const by = Math.min(startMs + (plate.minute[i] + 1) * 60000, Date.parse(plate.end));
      parts.push(`finished by ${stamp(by)}, the ${ordinal(i + 1)} of ${count.format(N)} to finish`,
        `compiled in ${seconds(plate.seconds[i])}`);
    } else if (plateError) {
      parts.push("compile record unavailable");
    } else {
      parts.push("reading the compile record…");
    }
    return parts;
  }

  function showReadout(announce) {
    const k = state.hover >= 0 ? state.hover : state.focus;
    if (k < 0) {
      readout.replaceChildren(document.createTextNode(
        "Point at a floret, or focus the head and use the arrow keys. The plate holds no module names."));
      return;
    }
    const [nameText, ...rest] = describe(k);
    const swatch = el("span", "capitulum-swatch");
    swatch.style.setProperty("--swatch", names[layout.name[k]].css);
    readout.replaceChildren(swatch, el("b", "", nameText), document.createTextNode(" · " + rest.join(" · ")));
    if (announce) spoken.textContent = [nameText, ...rest].join(", ") + ".";
  }

  /* Legends: every entry is a button; pointing or focusing shows its florets, pressing pins them. */
  function legendButton(kind, index, text, value, colour, describeIt) {
    const button = el("button", "legend-item");
    button.type = "button";
    button.dataset.kind = kind;
    button.dataset.index = index;
    button.setAttribute("aria-pressed", String(state.pinned?.kind === kind && state.pinned.index === index));
    button.setAttribute("aria-label", describeIt);
    const swatch = el("span", "legend-swatch");
    if (Array.isArray(colour)) {
      swatch.classList.add("is-ramp");
      swatch.style.setProperty("--from", colour[0]);
      swatch.style.setProperty("--to", colour[1]);
    } else swatch.style.setProperty("--swatch", colour);
    button.append(swatch, el("span", "legend-name", text), el("span", "legend-count", value));
    const item = el("li");
    item.append(button);
    return item;
  }

  function legendNames() {
    const list = el("ul", "legend-names");
    names.forEach(({name, modules, css: colour}, index) => {
      list.append(legendButton("name", index, name, count.format(modules), colour,
        `${name} · ${count.format(modules)} module${modules === 1 ? "" : "s"}`));
    });
    return [list];
  }

  function legendRings() {
    const bars = el("div", "legend-rings");
    bars.setAttribute("role", "group");
    bars.setAttribute("aria-label", "Rings by import distance from Main; arrow keys move between rings");
    const most = Math.max(...ringTotals);
    const pressed = state.pinned?.kind === "ring" ? state.pinned.index : -1;
    ringTotals.forEach((n, d) => {
      const bar = el("button", "legend-ring");
      bar.type = "button";
      bar.dataset.kind = "ring";
      bar.dataset.index = d;
      bar.tabIndex = d === (pressed >= 0 ? pressed : widest) ? 0 : -1;
      bar.setAttribute("aria-pressed", String(d === pressed));
      bar.setAttribute("aria-label", `${d} import step${d === 1 ? "" : "s"} from Main · ${count.format(n)} module${n === 1 ? "" : "s"}`);
      bar.style.setProperty("--share", (n / most).toFixed(4));
      bar.style.setProperty("--swatch", css(ringRgb(d, rings)));
      bars.append(bar);
    });
    const axis = el("div", "legend-axis");
    axis.setAttribute("aria-hidden", "true");
    for (const d of [0, 10, 20, 30, rings - 1]) {
      const tick = el("span", "", String(d));
      tick.style.setProperty("--at", (d / (rings - 1)).toFixed(4));
      axis.append(tick);
    }
    const focusText = el("p", "legend-focus");
    focusText.dataset.ringText = "";
    return [bars, axis, focusText];
  }

  function legendHours() {
    if (!seats) {
      return [el("p", "legend-wait", plateError
        ? "The compile record did not load, so this colouring is unavailable (" + plateError.message + ")."
        : "Reading the compile record…")];
    }
    const list = el("ul", "legend-names legend-hours");
    periods.forEach(({from, to, modules, first, last}, index) => {
      const ramp = [css(timeRgb(timeStep(first) / (TIME_STEPS - 1))), css(timeRgb(timeStep(last) / (TIME_STEPS - 1)))];
      list.append(legendButton("hours", index, `hours ${from}–${to}`, count.format(modules), ramp,
        `Hours ${from} to ${to} after the first module · ${count.format(modules)} modules finished`));
    });
    return [list];
  }

  function ringFocusText(d) {
    const target = legend.querySelector("[data-ring-text]");
    if (!target) return;
    const at = d >= 0 ? d : widest, n = ringTotals[at];
    target.textContent = `${at} step${at === 1 ? "" : "s"} · ${count.format(n)} module${n === 1 ? "" : "s"}` +
      (at === widest ? " · the widest ring" : at === 0 ? " · Main" : "");
  }

  const titles = {name: "Eleven top-level names", depth: "Import distance from Main", time: "Hours since the first module"};
  const notes = {
    name: () => `Within each ring the florets are grouped by name, so a name’s share of the ring is its share of ` +
      `the angle. ${names[0].name}, ${Math.round(100 * names[0].modules / N)}% of the modules, is centred below. ` +
      "Each name is lighter towards Main; the faint spiral grooves follow the packing’s own spirals and carry no data.",
    depth: () => `Main is the centre floret. The widest ring, ${widest} steps out, holds ` +
      `${count.format(ringTotals[widest])} modules; the farthest modules are ${rings - 1} steps away. ` +
      "Each ring’s area is its module count.",
    time: () => seats
      ? `Florets open in the order the modules finished compiling on Euler, from ${longWhen(startMs)} ` +
        `to ${longWhen(Date.parse(plate.end))}.`
      : "",
  };

  function buildLegend() {
    const builders = {name: legendNames, depth: legendRings, time: legendHours};
    legendTitle.textContent = titles[state.stain];
    legend.replaceChildren(...builders[state.stain]());
    legend.dataset.stain = state.stain;
    const text = notes[state.stain]();
    if (state.stain === "time" && text) {
      // Compile times are Euler's own measurements: the one claim on this plate that is neither rule nor source.
      const mark = el("span", "tag", "measured");
      mark.dataset.tag = "measured";
      mark.title = "A live measurement of the host or a process.";
      note.replaceChildren(mark, " " + text);
    } else note.textContent = text;
    if (state.stain === "depth") ringFocusText(state.pinned?.kind === "ring" ? state.pinned.index : -1);
  }

  function setStain(stain) {
    if (stain === "time" && !seats) return;
    if (state.stain === stain) return;
    stopPlaying();
    state.stain = stain;
    state.transient = null;
    if (state.pinned && state.pinned.kind !== {name: "name", depth: "ring", time: "hours"}[stain]) state.pinned = null;
    figure.dataset.stain = stain;
    replay.hidden = stain !== "time";
    for (const button of stainButtons) button.setAttribute("aria-pressed", String(button.dataset.stain === stain));
    buildLegend();
    showReadout(false);
    dirtyHead = dirtyLens = true;
    schedule();
  }

  function setHighlight(next, pinned) {
    if (pinned) {
      state.pinned = next && highlightKey(next) !== highlightKey(state.pinned) ? next : null;
      state.transient = null;
      for (const button of legend.querySelectorAll("[data-kind]")) {
        button.setAttribute("aria-pressed", String(!!state.pinned && button.dataset.kind === state.pinned.kind &&
          Number(button.dataset.index) === state.pinned.index));
      }
    } else {
      if (highlightKey(next) === highlightKey(state.transient)) return;
      state.transient = next;
    }
    if (state.stain === "depth") {
      const h = highlight();
      ringFocusText(h?.kind === "ring" ? h.index : -1);
    }
    dirtyHead = dirtyLens = true;
    schedule();
  }

  /* Replay. */
  function updateClock() {
    if (!seats) return;
    // A floret's minute is the minute after the first module in which it finished, so the clock shows the end
    // of that minute (never past Main): "by 21 Nov 2026, 4:13 a.m. EST".
    const done = cumulative[state.time];
    const at = Math.min(startMs + (state.time + 1) * 60000, Date.parse(plate.end)), when = stamp(at);
    const elapsed = Math.floor((at - startMs) / 60000), hours = Math.floor(elapsed / 60), rest = elapsed % 60;
    clock.value = `by ${when} · ${hours} h ${rest} min in · ${count.format(done)} of ${count.format(N)} finished`;
    scrub.value = String(state.time);
    scrub.setAttribute("aria-valuetext", `${when}, ${count.format(done)} of ${count.format(N)} modules finished`);
    growthLit.style.clipPath = `inset(0 ${(100 * (1 - state.time / minutes)).toFixed(3)}% 0 0)`;
  }

  // The replay obeys the shared motion switch: with motion paused (by the reader, by
  // prefers-reduced-motion, or because the tab is hidden) it stops and Play is disabled; the scrubber
  // still works, one still frame at a time.
  function reflectMotion() {
    const still = motion.preference === "paused";
    play.disabled = still;
    stillNote.hidden = !still;
    if (motion.paused) stopPlaying();
  }

  function startPlaying() {
    if (!seats || motion.paused) return;
    if (state.time >= minutes) {
      state.time = 0;
      dirtyHead = true;
    }
    state.playing = true;
    play.textContent = "Pause";
    lastFrame = 0;
    schedule();
  }

  function stopPlaying() {
    if (!state.playing) return;
    state.playing = false;
    play.textContent = state.time >= minutes ? "Play the 64 hours" : "Resume";
    shown = "";
    dirtyHead = true;
    schedule();
  }

  /* The frame loop runs only while something is dirty or the replay plays. */
  function schedule() {
    if (!frame && state.active && visible) frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    frame = 0;
    if (!size || !state.active) return;
    if (!layout) {
      // Arrange in this frame, draw in the next, so neither frame carries both.
      ensureLayout();
      dirtyHead = dirtyLens = true;
      schedule();
      return;
    }
    if (state.playing) {
      if (now - lastFrame < FRAME_MS - 2) { schedule(); return; }
      const elapsed = lastFrame ? Math.min(250, now - lastFrame) : 0;
      lastFrame = now;
      state.time = Math.min(minutes, state.time + Math.max(1, Math.round(elapsed / 1000 * minutes / PLAY_SECONDS)));
      if (highlight() && now - lastFull < 100) { schedule(); return; }
      dirtyHead = true;
      if (state.hover >= 0 || state.focus >= 0) dirtyLens = true;
      updateClock();
      if (state.time >= minutes) stopPlaying();
    }
    if (dirtyHead) { dirtyHead = false; renderHead(); }
    if (dirtyLens) { dirtyLens = false; renderLens(); }
    if (state.playing) schedule();
  }

  /* Loading the plate. */
  function begin() {
    if (started) return;
    started = true;
    loadCapitulum().then(decoded => {
      const rankOf = decoded.namespaces.map(({name}) => {
        if (!nameIndex.has(name)) throw new Error(`unknown top-level name ${name}`);
        return nameIndex.get(name);
      });
      if (decoded.count !== N) throw new Error(`the plate holds ${decoded.count} modules, the source map ${N}`);
      const fromPlate = cellsFromPlate(decoded, rankOf);
      if (!sameCells(fromPlate, census)) {
        // The plate is the per-module record; if the summary ever disagrees, the plate decides the arrangement.
        adoptCensus(fromPlate);
        stainPalettes.depth = palette(ringTotals.map((_, d) => ringRgb(d, rings)));
        styleCache.clear();
        cache = new Map();
        shown = "";
        dirtyHead = true;
        if (state.stain === "depth") buildLegend();
      }
      plate = decoded;
      seats = seat(ensureLayout(), plate, rankOf);
      minutes = plate.perMinute.length - 1;
      cumulative = new Uint32Array(minutes + 1);
      for (let m = 0, run = 0; m <= minutes; m++) cumulative[m] = run += plate.perMinute[m];
      startMs = Date.parse(plate.start);
      periods = [];
      for (let m = 0; m <= minutes; m++) {
        const p = periodOf(m);
        periods[p] ??= {from: p * 16, to: Math.min((p + 1) * 16, Math.ceil(minutes / 60)), modules: 0, first: m, last: m};
        periods[p].modules += plate.perMinute[m];
        periods[p].last = m;
      }
      periods.at(-1).to = Math.round(minutes / 60);
      state.time = minutes;
      scrub.max = String(minutes);
      drawGrowth();
      updateClock();
      stainButtons[2].disabled = false;
      stainButtons[2].removeAttribute("title");
      if (state.stain === "time") buildLegend();
      showReadout(false);
      dirtyLens = true;
      schedule();
    }).catch(error => {
      plateError = error;
      stainButtons[2].title = "The compile record did not load";
      if (state.stain === "time") buildLegend();
      showReadout(false);
    });
  }

  function drawGrowth() {
    const hours = Math.ceil((minutes + 1) / 60), perHour = new Uint32Array(hours);
    for (let m = 0; m <= minutes; m++) perHour[Math.floor(m / 60)] += plate.perMinute[m];
    const most = Math.max(...perHour);
    for (const svg of [growthDim, growthLit]) {
      svg.setAttribute("viewBox", `0 0 ${hours} 100`);
      svg.replaceChildren(...Array.from(perHour, (n, hour) => {
        const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        const height = n ? Math.max(1.5, 100 * n / most) : 0;
        bar.setAttribute("x", String(hour + .12));
        bar.setAttribute("width", ".76");
        bar.setAttribute("y", String(100 - height));
        bar.setAttribute("height", String(height));
        return bar;
      }));
    }
  }

  /* Pointer and keyboard. */
  function unitFromEvent(event) {
    const box = lens.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width * size.W, y = (event.clientY - box.top) / box.height * size.W;
    return [(x - size.cx) / size.R, (y - size.cy) / size.R];
  }

  lens.addEventListener("pointermove", event => {
    if (!size || !layout) return;
    const [xu, yu] = unitFromEvent(event);
    const k = Math.hypot(xu, yu) > 1 + size.unit * 3 ? -1 : nearest(xu, yu, size.unit * 3);
    if (k === state.hover) return;
    state.hover = k;
    showReadout(false);
    dirtyLens = true;
    schedule();
  });
  lens.addEventListener("pointerleave", () => {
    if (state.hover < 0) return;
    state.hover = -1;
    showReadout(false);
    dirtyLens = true;
    schedule();
  });
  lens.addEventListener("pointerdown", event => {
    if (!size || !layout) return;
    const [xu, yu] = unitFromEvent(event);
    const k = Math.hypot(xu, yu) > 1 + size.unit * 3 ? -1 : nearest(xu, yu, size.unit * 3);
    state.touched = k >= 0 && event.pointerType !== "mouse";
    state.focus = k;
    if (event.pointerType !== "mouse") state.hover = -1;
    showReadout(false);
    dirtyLens = true;
    schedule();
  });

  function move(dx, dy, far) {
    if (state.focus < 0) return 0;
    const from = state.focus;
    for (let step = far ? 8 : 1.2, tries = 0; tries < 5; tries++, step *= 1.8) {
      const reach = size ? size.unit * step : .01;
      const k = nearest(layout.x[from] + dx * reach, layout.y[from] + dy * reach, reach * .9, from);
      if (k >= 0) return k;
    }
    return from;
  }

  function crossRing(direction) {
    const k = state.focus, d = Math.min(rings - 1, Math.max(0, layout.ring[k] + direction));
    if (d === layout.ring[k]) return k;
    if (d === 0) return 0;
    const middle = Math.sqrt((ringStart[d] + ringTotals[d] / 2) / N);
    const angle = Math.atan2(layout.x[k], -layout.y[k]);
    const target = [Math.sin(angle) * middle, -Math.cos(angle) * middle];
    const found = nearest(target[0], target[1], size.unit * 6);
    return found >= 0 ? found : k;
  }

  lens.addEventListener("keydown", event => {
    if (!size || !layout) return;
    const arrows = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
    let next = null;
    if (event.key in arrows) next = state.focus < 0 ? 0 : move(...arrows[event.key], event.shiftKey);
    else if (event.key === "Home") next = 0;
    else if (event.key === "PageUp") next = state.focus < 0 ? 0 : crossRing(-1);
    else if (event.key === "PageDown") next = state.focus < 0 ? 0 : crossRing(1);
    else if (event.key === "Escape" && state.focus >= 0) next = -1;
    if (next === null) return;
    event.preventDefault();
    state.focus = next;
    state.hover = -1;
    state.touched = false;
    showReadout(next >= 0);
    if (next < 0) spoken.textContent = "Lens put down.";
    dirtyLens = true;
    schedule();
  });
  for (const type of ["focus", "blur"]) {
    lens.addEventListener(type, () => {
      if (type === "blur") state.touched = false;
      if (state.focus < 0) return;
      dirtyLens = true;
      schedule();
    });
  }

  stains.addEventListener("click", event => {
    const button = event.target.closest("button[data-stain]");
    if (button && !button.disabled) setStain(button.dataset.stain);
  });
  const legendTarget = event => {
    const button = event.target.closest?.("button[data-kind]");
    return button && legend.contains(button) ? {kind: button.dataset.kind, index: Number(button.dataset.index)} : null;
  };
  legend.addEventListener("click", event => {
    const target = legendTarget(event);
    if (target) setHighlight(target, true);
  });
  legend.addEventListener("pointerover", event => setHighlight(legendTarget(event), false));
  legend.addEventListener("pointerleave", () => setHighlight(null, false));
  legend.addEventListener("focusin", event => setHighlight(legendTarget(event), false));
  legend.addEventListener("focusout", event => {
    if (!legend.contains(event.relatedTarget)) setHighlight(null, false);
  });
  legend.addEventListener("keydown", event => {
    const button = event.target.closest?.(".legend-ring");
    if (button && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      const bars = [...legend.querySelectorAll(".legend-ring")], at = bars.indexOf(button);
      const next = event.key === "Home" ? 0 : event.key === "End" ? bars.length - 1
        : Math.min(bars.length - 1, Math.max(0, at + (event.key === "ArrowRight" ? 1 : -1)));
      event.preventDefault();
      bars[at].tabIndex = -1;
      bars[next].tabIndex = 0;
      bars[next].focus();
    } else if (event.key === "Escape") {
      setHighlight(null, false);
      if (state.pinned) setHighlight(state.pinned, true);
    }
  });

  play.addEventListener("click", () => (state.playing ? stopPlaying() : startPlaying()));
  scrub.addEventListener("input", () => {
    stopPlaying();
    state.time = Number(scrub.value);
    updateClock();
    dirtyHead = true;
    if (state.hover >= 0 || state.focus >= 0) dirtyLens = true;
    schedule();
  });

  const stopListening = motion.onChange(reflectMotion);

  // The first size draws at once; later ones (a window being dragged) settle for 120 ms before the head is
  // set again, while CSS scales the last drawing.
  let settle = 0;
  const resizer = new ResizeObserver(entries => {
    const width = entries[entries.length - 1].contentRect.width;
    clearTimeout(settle);
    if (!size) resize(width);
    else settle = setTimeout(() => resize(width), 120);
  });
  resizer.observe(stage);
  const watcher = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (visible) { begin(); schedule(); } else stopPlaying();
  }, {rootMargin: "100% 0px"});
  watcher.observe(stage);
  document.fonts?.load?.('11px "Lark Mono"').then(() => { dirtyLens = true; schedule(); }, () => {});
  const onForcedColours = () => {
    ink = readInk(figure);
    dirtyLens = true;
    schedule();
  };
  forcedColours?.addEventListener?.("change", onForcedColours);

  stainButtons[0].setAttribute("aria-pressed", "true");
  stainButtons[1].setAttribute("aria-pressed", "false");
  stainButtons[2].setAttribute("aria-pressed", "false");
  stainButtons[2].disabled = true;
  stainButtons[2].title = "Loading the compile record";
  buildLegend();
  showReadout(false);
  reflectMotion();
  scrub.max = String(capitulumSummary.minutes);
  scrub.value = scrub.max;

  return {
    figure, panel,
    // Called on every feed refresh. Only Main's ring depends on the feed, so this redraws the lens layer at
    // most, and only when the determination or its sentence changed. kernel: {state, label}, with state one
    // of passed | failed | running | pending.
    update({kernel: next} = {}) {
      if (!next || (next.state === state.kernel.state && next.label === state.kernel.label)) return;
      state.kernel = next;
      const mark = el("span", "capitulum-ring-mark");
      mark.dataset.state = next.state;
      kernelNote.replaceChildren(mark, document.createTextNode(next.label));
      dirtyLens = true;
      schedule();
    },
    setActive(active) {
      state.active = !!active;
      if (!active) stopPlaying();
      else { dirtyLens = true; schedule(); }
    },
    destroy() {
      stopPlaying();
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      resizer.disconnect();
      watcher.disconnect();
      stopListening();
      forcedColours?.removeEventListener?.("change", onForcedColours);
    },
  };
}
