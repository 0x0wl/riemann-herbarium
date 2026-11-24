// glyphprint.js · printing drawings in Lean.
//
// A drawing (light on dark) is cut into square cells, and each cell is printed with one
// glyph taken from the formalization. For every cell we measure
//
//   · its mean luminance L, and
//   · the structure tensor J = Σ ∇L ∇Lᵀ of the luminance gradient over the cell, whose
//     eigenvalues λ₁ ≥ λ₂ say how strong (λ₁ + λ₂) and how coherent ((λ₁ − λ₂)/(λ₁ + λ₂))
//     an edge there is, and whose leading eigenvector points across that edge. Strength is
//     read in the cell itself; coherence and direction over the cell and its neighbours.
//
// A strong, coherent edge is printed with a stroke that runs along it (- \ | /, or their
// box-drawing and Lean cousins); a bright interior with a Lean token (∀ ∃ → ↔ ⟨ ⟩ ζ ∑ λ :=
// ℂ ℝ ≠ ≤ ½ ·), or with the next letter of a Lean text when one is given, so that up close
// the drawing reads as source; dimmer light with the same tokens in the dim colour; faint
// light with dots. Glyph choices come from a hash of the seed and the cell, so the same
// seed prints the same plate. Glyphs are rendered once into an atlas per (font, cell size,
// colours, pixel ratio) and stamped with drawImage.
//
//   glyphPrint(target, source, options)  → plate {cols, rows, cell, counts, atlas, draw, update}
//   prepareGlyphPrint(options)           → Promise: loads the font and builds the atlas
//   leanAlphabet()                       → the glyphs used by default
//   frond(ctx, x, y, length, angle, seed) draws a fern frond to print (white, on any ground)

import { hashString, rng } from "./seed.js";

const MONO_STACK = '"Lark Mono", ui-monospace, "Cascadia Mono", Consolas, monospace';

// Lean from the specimen itself (commit a172c464): Main.lean line 4, then the statements
// RiemannZetaZerosOnLine and DirichletLNonvanishingRightOfHalf from Statements.lean.
const LEAN_SOURCE =
  "theorem riemannHypothesis : RiemannHypothesis := rhOfAll " +
  "∀ s : ℂ, riemannZeta s = 0 → (¬∃ n : ℕ, s = -2 * ((n : ℂ) + 1)) → s ≠ 1 → s.re = 1 / 2 " +
  "∀ (N : ℕ) [NeZero N] (χ : DirichletCharacter ℂ N) (s : ℂ), 1 / 2 < s.re → " +
  "(χ ≠ 1 ∨ s ≠ 1) → DirichletCharacter.LFunction χ s ≠ 0 ";

// The default alphabet.
//   edges   stroke glyphs by the direction of the edge on screen; the first of each list is
//           used for about half of the cells, the others share the rest
//   dense   Lean tokens for bright interiors (multi-letter tokens are condensed into a cell)
//   faint   marks for faint light
//   source  a Lean text that dense cells can read in order (options.text = true)
export function leanAlphabet() {
  return {
    edges: {
      horizontal: ["-", "─", "→", "="],
      falling: ["\\", "╲"],
      vertical: ["|", "│", "∣"],
      rising: ["/", "╱"],
    },
    dense: ["∀", "∃", "→", "↔", "⟨", "⟩", "ζ", "∑", "λ", ":=", "ℂ", "ℝ", "≠", "≤", "½", "·"],
    faint: ["·", ".", ","],
    source: LEAN_SOURCE,
  };
}

// ── Tuning ────────────────────────────────────────────────────────────────────────────
const SAMPLES_PER_CELL = 3; // luminance samples along each side of a cell
const EDGE_STRENGTH = 0.02; // mean |∇L|² per sample above which a cell has an edge
const EDGE_COHERENCE = 0.5; // (λ₁ − λ₂)/(λ₁ + λ₂) above which the edge has one direction
const EDGE_MAX_LUMINANCE = 0.6; // brighter cells are interiors even on an edge
const DENSE_LUMINANCE = 0.5; // tokens in the print colour
const HALF_LUMINANCE = 0.2; // tokens in the dim colour
const FAINT_LUMINANCE = 0.045; // dots in the dim colour
const FLICKER_RATE = 2.5; // how often a flickering cell may change, per second
const BRIGHT = 0;
const DIM = 1;

// ── Hashing (deterministic by seed) ──────────────────────────────────────────────────
// The seed is hashed by seed.js; each cell then mixes it with its own index, so a cell's
// glyph does not depend on the order in which cells are visited.
function mix(a, b) {
  let h = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

// ── Canvases ─────────────────────────────────────────────────────────────────────────
function makeCanvas(width, height) {
  if (globalThis.document?.createElement) {
    const canvas = globalThis.document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return new OffscreenCanvas(width, height);
}

function pixelScale(target, fallback) {
  const matrix = target?.getTransform?.();
  if (matrix) return Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d)) || 1;
  return fallback ?? Math.min(2, globalThis.devicePixelRatio || 1);
}

// ── Options ──────────────────────────────────────────────────────────────────────────
function resolveAlphabet(alphabet) {
  const base = leanAlphabet();
  if (alphabet == null || alphabet === "lean") return base;
  if (typeof alphabet === "string") return { ...base, dense: [...alphabet].filter((ch) => ch.trim()) };
  if (Array.isArray(alphabet)) return { ...base, dense: [...alphabet] };
  return { ...base, ...alphabet, edges: { ...base.edges, ...alphabet.edges } };
}

function resolveOptions(source, options) {
  const alphabet = resolveAlphabet(options.alphabet);
  const text = options.text === true ? alphabet.source : typeof options.text === "string" ? options.text : "";
  return {
    cell: options.cell ?? 9,
    color: options.color ?? "#eaf0f4",
    dim: options.dim ?? "#809ab6",
    font: options.font ?? MONO_STACK,
    weight: options.weight ?? 400,
    seed: hashString(options.seed ?? "lark"),
    flicker: Math.max(0, Math.min(1, options.flicker ?? 0)),
    time: options.time ?? 0,
    x: options.x ?? 0,
    y: options.y ?? 0,
    width: options.width ?? source?.width ?? 0,
    height: options.height ?? source?.height ?? 0,
    pixelRatio: options.pixelRatio,
    alphabet,
    text: [...text].map((ch) => (ch.trim() ? ch : "·")),
    // where the reading of `text` begins (a letter index); by default a seeded place in it
    textOffset: Number.isInteger(options.textOffset) && options.textOffset >= 0 ? options.textOffset : null,
  };
}

function glyphsNeeded(settings) {
  const { edges, dense, faint } = settings.alphabet;
  return new Set([...Object.values(edges).flat(), ...dense, ...faint, ...settings.text, "·"]);
}

// ── The atlas: every glyph pre-rendered once, in both colours ─────────────────────────
const atlases = new Map();
const pendingFonts = new Set();

function fontSpec(settings, px) {
  return `${settings.weight} ${px}px ${settings.font}`;
}

function fontReady(spec) {
  const fonts = globalThis.document?.fonts;
  if (!fonts) return true;
  try {
    return fonts.check(spec);
  } catch {
    return true;
  }
}

function atlasFor(target, settings) {
  const slot = Math.max(4, Math.round(settings.cell * pixelScale(target, settings.pixelRatio)));
  const key = `${settings.font}|${settings.weight}|${slot}|${settings.color}|${settings.dim}`;
  const wanted = glyphsNeeded(settings);
  const existing = atlases.get(key);
  if (existing && [...wanted].every((glyph) => existing.index.has(glyph))) return existing;
  if (existing) for (const glyph of existing.index.keys()) wanted.add(glyph);

  const glyphs = [...wanted];
  const perRow = 32;
  const bandRows = Math.ceil(glyphs.length / perRow);
  const canvas = makeCanvas(perRow * slot, 2 * bandRows * slot);
  const ctx = canvas.getContext("2d");
  const fontPx = Math.round(slot * 1.15);
  const spec = fontSpec(settings, fontPx);
  ctx.font = spec;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  [settings.color, settings.dim].forEach((colour, band) => {
    ctx.fillStyle = colour;
    glyphs.forEach((glyph, i) => {
      const x = (i % perRow) * slot;
      const y = (band * bandRows + Math.floor(i / perRow)) * slot;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, slot, slot);
      ctx.clip();
      ctx.fillText(glyph, x + slot / 2, y + slot / 2 + slot * 0.04, slot * 0.94);
      ctx.restore();
    });
  });

  const atlas = { canvas, slot, perRow, bandRows, index: new Map(glyphs.map((glyph, i) => [glyph, i])) };
  atlases.set(key, atlas);
  // Printed before the webfont arrived: forget this atlas once it has, so the next print uses it.
  if (!fontReady(spec) && !pendingFonts.has(spec)) {
    pendingFonts.add(spec);
    globalThis.document.fonts.load(spec).then(
      () => {
        pendingFonts.delete(spec);
        if (atlases.get(key) === atlas) atlases.delete(key);
      },
      () => pendingFonts.delete(spec),
    );
  }
  return atlas;
}

// Loads the mono font and builds the atlas, so the first print is fast and in the right face.
export async function prepareGlyphPrint(options = {}) {
  const settings = resolveOptions(null, options);
  const fonts = globalThis.document?.fonts;
  if (fonts) {
    try {
      await fonts.load(fontSpec(settings, 12), [...glyphsNeeded(settings)].join(""));
    } catch {
      // An unknown family simply falls back to the next one in the stack.
    }
  }
  atlasFor(null, settings);
}

// ── Reading the drawing ──────────────────────────────────────────────────────────────
function readPixels(source) {
  let ctx = null;
  try {
    ctx = source.getContext?.("2d", { willReadFrequently: true }) ?? null;
  } catch {
    ctx = null;
  }
  if (!ctx) {
    const copy = makeCanvas(source.width, source.height);
    ctx = copy.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0);
  }
  return ctx.getImageData(0, 0, source.width, source.height).data;
}

// Mean luminance (0 … 1, transparent counts as dark) on a grid of SAMPLES_PER_CELL² samples
// per cell: an exact box average when a sample covers at least a pixel, else the nearest pixel.
function sampleLuminance(source, cols, rows, settings) {
  const width = source.width;
  const height = source.height;
  const pixels = readPixels(source);
  const sampleCols = cols * SAMPLES_PER_CELL;
  const sampleRows = rows * SAMPLES_PER_CELL;
  const pixelsPerSampleX = ((settings.cell / settings.width) * width) / SAMPLES_PER_CELL;
  const pixelsPerSampleY = ((settings.cell / settings.height) * height) / SAMPLES_PER_CELL;
  const luminance = new Float32Array(sampleCols * sampleRows);
  const scale = 1 / (255 * 256 * 255);

  if (pixelsPerSampleX >= 1 && pixelsPerSampleY >= 1) {
    const columnOf = new Int32Array(width);
    const rowOf = new Int32Array(height);
    const columnCount = new Float32Array(sampleCols);
    const rowCount = new Float32Array(sampleRows);
    for (let px = 0; px < width; px++) {
      const c = Math.floor(px / pixelsPerSampleX);
      columnOf[px] = c < sampleCols ? c : -1;
      if (c < sampleCols) columnCount[c]++;
    }
    for (let py = 0; py < height; py++) {
      const r = Math.floor(py / pixelsPerSampleY);
      rowOf[py] = r < sampleRows ? r : -1;
      if (r < sampleRows) rowCount[r]++;
    }
    for (let py = 0; py < height; py++) {
      const r = rowOf[py];
      if (r < 0) continue;
      const base = r * sampleCols;
      for (let px = 0, o = py * width * 4; px < width; px++, o += 4) {
        const c = columnOf[px];
        if (c >= 0 && pixels[o + 3] !== 0) {
          luminance[base + c] += (54 * pixels[o] + 183 * pixels[o + 1] + 19 * pixels[o + 2]) * pixels[o + 3];
        }
      }
    }
    for (let r = 0, i = 0; r < sampleRows; r++) {
      for (let c = 0; c < sampleCols; c++, i++) luminance[i] *= scale / Math.max(1, columnCount[c] * rowCount[r]);
    }
  } else {
    for (let r = 0, i = 0; r < sampleRows; r++) {
      const py = Math.min(height - 1, Math.floor((r + 0.5) * pixelsPerSampleY));
      for (let c = 0; c < sampleCols; c++, i++) {
        const px = Math.min(width - 1, Math.floor((c + 0.5) * pixelsPerSampleX));
        const o = (py * width + px) * 4;
        luminance[i] = (54 * pixels[o] + 183 * pixels[o + 1] + 19 * pixels[o + 2]) * pixels[o + 3] * scale;
      }
    }
  }
  return { luminance, sampleCols, sampleRows };
}

// Per cell: mean luminance, and the structure tensor summed over the cell's samples.
function measureCells(sampled, cols, rows) {
  const { luminance: L, sampleCols, sampleRows } = sampled;
  const cells = cols * rows;
  const mean = new Float32Array(cells);
  const jxx = new Float32Array(cells);
  const jyy = new Float32Array(cells);
  const jxy = new Float32Array(cells);
  for (let r = 0; r < sampleRows; r++) {
    const up = r > 0 ? -sampleCols : 0;
    const down = r < sampleRows - 1 ? sampleCols : 0;
    const cellRow = ((r / SAMPLES_PER_CELL) | 0) * cols;
    for (let c = 0; c < sampleCols; c++) {
      const i = r * sampleCols + c;
      const gx = L[c < sampleCols - 1 ? i + 1 : i] - L[c > 0 ? i - 1 : i];
      const gy = L[i + down] - L[i + up];
      const cell = cellRow + ((c / SAMPLES_PER_CELL) | 0);
      mean[cell] += L[i];
      jxx[cell] += gx * gx;
      jyy[cell] += gy * gy;
      jxy[cell] += gx * gy;
    }
  }
  const perCell = 1 / (SAMPLES_PER_CELL * SAMPLES_PER_CELL);
  for (let k = 0; k < cells; k++) {
    mean[k] *= perCell;
    // Central differences span two samples: halve them to get |∇L|² per sample.
    jxx[k] *= perCell / 4;
    jyy[k] *= perCell / 4;
    jxy[k] *= perCell / 4;
  }
  return { mean, jxx, jyy, jxy };
}

// A 1-2-1 blur in each direction. The tensor is read at this slightly larger scale for the
// direction of an edge, so fine serrations (a fern's pinnules) follow the outline of the
// whole leaf rather than their own; whether a cell has an edge at all stays a local question.
function blur121(values, cols, rows) {
  const across = new Float32Array(values.length);
  for (let r = 0; r < rows; r++) {
    for (let c = 0, k = r * cols; c < cols; c++, k++) {
      const left = c > 0 ? values[k - 1] : values[k];
      const right = c < cols - 1 ? values[k + 1] : values[k];
      across[k] = (left + 2 * values[k] + right) / 4;
    }
  }
  const blurred = new Float32Array(values.length);
  for (let r = 0; r < rows; r++) {
    for (let c = 0, k = r * cols; c < cols; c++, k++) {
      const up = r > 0 ? across[k - cols] : across[k];
      const down = r < rows - 1 ? across[k + cols] : across[k];
      blurred[k] = (up + 2 * across[k] + down) / 4;
    }
  }
  return blurred;
}

// ── Composing the plate ──────────────────────────────────────────────────────────────
function pick(list, h) {
  // the first glyph about half the time, the others sharing the rest
  if (list.length === 1 || (h & 255) < 128) return list[0];
  return list[1 + ((h >>> 8) % (list.length - 1))];
}

function composePlate(source, settings, atlas) {
  const { cell, alphabet } = settings;
  const cols = Math.floor(settings.width / cell);
  const rows = Math.floor(settings.height / cell);
  const { mean, jxx, jyy, jxy } = measureCells(sampleLuminance(source, cols, rows, settings), cols, rows);
  const wideXX = blur121(jxx, cols, rows);
  const wideYY = blur121(jyy, cols, rows);
  const wideXY = blur121(jxy, cols, rows);
  const directions = [alphabet.edges.horizontal, alphabet.edges.falling, alphabet.edges.vertical, alphabet.edges.rising];
  const { slot, perRow, bandRows, index } = atlas;
  const sourceX = (glyph) => (index.get(glyph) % perRow) * slot;
  const sourceY = (glyph, band) => (band * bandRows + Math.floor(index.get(glyph) / perRow)) * slot;

  const cellsDrawn = [];
  const counts = { edge: 0, dense: 0, half: 0, faint: 0 };
  let letter = !settings.text.length ? 0
    : settings.textOffset != null ? settings.textOffset % settings.text.length
    : mix(settings.seed, 1) % settings.text.length;

  for (let k = 0; k < cols * rows; k++) {
    const luminance = mean[k];
    if (luminance < FAINT_LUMINANCE) continue;
    const h = mix(settings.seed, k);
    const strength = jxx[k] + jyy[k];
    const wide = wideXX[k] + wideYY[k];
    const coherence = wide > 0 ? Math.sqrt((wideXX[k] - wideYY[k]) ** 2 + 4 * wideXY[k] ** 2) / wide : 0;
    let glyph;
    let band = BRIGHT;
    let dense = false;
    if (strength > EDGE_STRENGTH && coherence > EDGE_COHERENCE && luminance < EDGE_MAX_LUMINANCE) {
      // The gradient's direction is ½·atan2(2Jxy, Jxx − Jyy); the edge runs at right angles to it.
      const along = 0.5 * Math.atan2(2 * wideXY[k], wideXX[k] - wideYY[k]) + Math.PI / 2;
      const sector = ((Math.round(along / (Math.PI / 4)) % 4) + 4) % 4;
      glyph = pick(directions[sector], h);
      counts.edge++;
    } else if (luminance >= HALF_LUMINANCE) {
      dense = luminance >= DENSE_LUMINANCE;
      band = dense ? BRIGHT : DIM;
      if (settings.text.length) {
        glyph = settings.text[letter];
        letter = (letter + 1) % settings.text.length;
        if (glyph === "·") band = DIM;
      } else {
        glyph = alphabet.dense[h % alphabet.dense.length];
      }
      counts[dense ? "dense" : "half"]++;
    } else {
      glyph = alphabet.faint[h % alphabet.faint.length];
      band = DIM;
      counts.faint++;
    }
    cellsDrawn.push(k, sourceX(glyph), sourceY(glyph, band), dense ? h : 0, dense ? 1 : 0);
  }

  const n = cellsDrawn.length / 5;
  const at = new Float32Array(2 * n);
  const glyphX = new Uint16Array(n);
  const glyphY = new Uint16Array(n);
  const hashes = new Uint32Array(n);
  const flickers = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const k = cellsDrawn[5 * i];
    at[2 * i] = settings.x + (k % cols) * cell;
    at[2 * i + 1] = settings.y + Math.floor(k / cols) * cell;
    glyphX[i] = cellsDrawn[5 * i + 1];
    glyphY[i] = cellsDrawn[5 * i + 2];
    hashes[i] = cellsDrawn[5 * i + 3];
    flickers[i] = cellsDrawn[5 * i + 4];
  }
  const tokenX = alphabet.dense.map((glyph) => sourceX(glyph));
  const tokenY = alphabet.dense.map((glyph) => sourceY(glyph, BRIGHT));
  const shownX = new Uint16Array(glyphX);
  const shownY = new Uint16Array(glyphY);
  const flicker = settings.flicker;

  // Which token a dense cell shows at `time`: its own, or for a fraction `flicker` of the
  // cells in each interval of 1/FLICKER_RATE seconds (staggered per cell), another one.
  const flickerToken = (h, time) => {
    const interval = Math.floor(time * FLICKER_RATE + (h & 1023) / 1024);
    const roll = mix(h, interval);
    return roll / 4294967296 < flicker ? (roll >>> 7) % tokenX.length : -1;
  };

  const plate = {
    cols,
    rows,
    cell,
    counts, // cells printed as edge strokes, dense and half-lit tokens, and faint dots
    atlas: atlas.canvas, // the type case: every glyph, in the print colour and the dim one
    // Draw every cell (the caller clears or paints the ground first).
    draw(target, time = 0) {
      const image = atlas.canvas;
      for (let i = 0; i < n; i++) {
        let sx = glyphX[i];
        let sy = glyphY[i];
        if (flicker > 0 && flickers[i]) {
          const token = flickerToken(hashes[i], time);
          if (token >= 0) {
            sx = tokenX[token];
            sy = tokenY[token];
          }
        }
        shownX[i] = sx;
        shownY[i] = sy;
        target.drawImage(image, sx, sy, slot, slot, at[2 * i], at[2 * i + 1], cell, cell);
      }
    },
    // Redraw only the cells whose glyph changed since the last draw or update. The target must
    // be a layer of its own (transparent where nothing is printed): changed cells are cleared.
    update(target, time) {
      if (!(flicker > 0)) return 0;
      const image = atlas.canvas;
      let changed = 0;
      for (let i = 0; i < n; i++) {
        if (!flickers[i]) continue;
        const token = flickerToken(hashes[i], time);
        const sx = token >= 0 ? tokenX[token] : glyphX[i];
        const sy = token >= 0 ? tokenY[token] : glyphY[i];
        if (sx === shownX[i] && sy === shownY[i]) continue;
        shownX[i] = sx;
        shownY[i] = sy;
        target.clearRect(at[2 * i], at[2 * i + 1], cell, cell);
        target.drawImage(image, sx, sy, slot, slot, at[2 * i], at[2 * i + 1], cell, cell);
        changed++;
      }
      return changed;
    },
  };
  return plate;
}

// Prints `source` (a canvas, offscreen canvas or image: a light drawing on a dark or
// transparent ground) into `target` (a 2D context) over the rectangle {x, y, width, height}
// of the target's user space (default: at the origin, one unit per source pixel). The source
// is read once; for animation keep the returned plate and call plate.draw(ctx, time) or, on
// a layer of its own, plate.update(ctx, time), which only touches cells that changed.
//
// options: cell (9, in target units), color ('#eaf0f4'), dim ('#809ab6'), alphabet ('lean',
// a string of glyphs, an array of tokens or an object shaped like leanAlphabet()), text
// (true for the Lean source, or any string, read in order through the lit interior cells),
// textOffset (the letter of `text` the reading starts from; default a place chosen by seed),
// seed ('lark'), flicker (0 … 1: the share of dense cells showing another token at a time),
// time (seconds), x, y, width, height, font, weight, pixelRatio (for prepareGlyphPrint).
//
// Reading the source is fastest when its context was created with willReadFrequently.
export function glyphPrint(target, source, options = {}) {
  const settings = resolveOptions(source, options);
  const atlas = atlasFor(target, settings);
  const plate = composePlate(source, settings, atlas);
  plate.draw(target, settings.time);
  return plate;
}

// ── A fern to print ──────────────────────────────────────────────────────────────────
//
// frond(ctx, x, y, length, angle, seed) draws a fern frond in white: a rachis from (x, y)
// heading at `angle` (radians, canvas convention: 0 points right, −π/2 points up), a bare
// stipe, then fifteen or so alternate pinnae a side, longest a third of the way up. Each
// pinna is a toothed, lance-shaped leaflet whose midvein is cut out (destination-out, so
// the ground shows through; paint the ground black or leave it transparent for a print).
// The proportions are made for printing: at a length of 600–1,000 px a pinna is two to four
// 9 px cells wide and the pinnae stand about two cells apart, so a print keeps every
// leaflet and its direction. Everything that varies comes from `seed` (through seed.js),
// so the same seed draws the same frond.

function axisPoints(x, y, length, angle, bend, steps) {
  const points = new Float64Array(3 * (steps + 1));
  const step = length / steps;
  let heading = angle;
  points[0] = x;
  points[1] = y;
  points[2] = heading;
  for (let i = 1; i <= steps; i++) {
    heading += (bend / steps) * (0.4 + 1.2 * (i / steps));
    points[3 * i] = points[3 * i - 3] + Math.cos(heading) * step;
    points[3 * i + 1] = points[3 * i - 2] + Math.sin(heading) * step;
    points[3 * i + 2] = heading;
  }
  return points;
}

function strokeAxis(ctx, points, steps, width) {
  for (let i = 0; i < steps; i++) {
    ctx.lineWidth = Math.max(0.6, width * (1 - (0.85 * i) / steps));
    ctx.beginPath();
    ctx.moveTo(points[3 * i], points[3 * i + 1]);
    ctx.lineTo(points[3 * i + 3], points[3 * i + 4]);
    ctx.stroke();
  }
}

function leaflet(ctx, x, y, length, angle, bend, halfWidth) {
  const steps = Math.max(8, Math.round(length / 4));
  const axis = axisPoints(x, y, length, angle, bend, steps);
  const teeth = Math.max(3, Math.round(length / (1.4 * halfWidth)));
  const width = (u) => {
    const swell = 0.55 + 0.45 * Math.sin((Math.min(1, u / 0.3) * Math.PI) / 2);
    const tooth = 1 + 0.18 * (1 - 2 * Math.abs(((u * teeth) % 1) - 0.5));
    return halfWidth * swell * Math.pow(1 - u, 0.75) * tooth;
  };
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const w = width(i / steps);
    const heading = axis[3 * i + 2];
    ctx.lineTo(axis[3 * i] - Math.sin(heading) * w, axis[3 * i + 1] + Math.cos(heading) * w);
  }
  for (let i = steps; i >= 0; i--) {
    const w = width(i / steps);
    const heading = axis[3 * i + 2];
    ctx.lineTo(axis[3 * i] + Math.sin(heading) * w, axis[3 * i + 1] - Math.cos(heading) * w);
  }
  ctx.closePath();
  ctx.fill();
  // The midvein, cut out of the leaflet from a little above its base to most of its length.
  const first = Math.round(steps * 0.1);
  const last = Math.round(steps * 0.8);
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineWidth = Math.max(0.8, halfWidth * 0.14);
  ctx.beginPath();
  ctx.moveTo(axis[3 * first], axis[3 * first + 1]);
  for (let i = first + 1; i <= last; i++) ctx.lineTo(axis[3 * i], axis[3 * i + 1]);
  ctx.stroke();
  ctx.restore();
}

export function frond(ctx, x, y, length, angle, seed = "frond") {
  const random = rng(seed);
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const steps = 160;
  const rachis = axisPoints(x, y, length, angle, (random() - 0.5) * 0.6, steps);
  strokeAxis(ctx, rachis, steps, Math.max(1.5, length * 0.01));

  const stipe = 0.16;
  const perSide = 14 + Math.floor(random() * 3);
  for (let k = 0; k < 2 * perSide; k++) {
    const v = k / (2 * perSide - 1); // 0 at the lowest pinna, 1 at the tip
    const i = Math.round((stipe + (0.96 - stipe) * v) * steps);
    const side = k % 2 ? 1 : -1;
    const envelope = 0.08 + 0.92 * Math.pow(1 - v, 0.85) * (0.62 + 0.38 * Math.min(1, v * 3.2));
    const reach = length * 0.29 * envelope * (0.92 + 0.16 * random());
    const spread = side * (1.25 - 0.45 * v + (random() - 0.5) * 0.1);
    const curl = -side * (0.25 + 0.2 * random()); // pinnae sweep towards the tip
    leaflet(ctx, rachis[3 * i], rachis[3 * i + 1], reach, rachis[3 * i + 2] + spread, curl, length * 0.018 * (1 - 0.45 * v));
  }
  const tip = 3 * steps;
  leaflet(ctx, rachis[tip], rachis[tip + 1], length * 0.06, rachis[tip + 2], 0, length * 0.012);
  ctx.restore();
}
