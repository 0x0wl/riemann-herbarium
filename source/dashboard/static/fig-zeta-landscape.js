// fig-zeta-landscape.js · Frontispiece: the ζ landscape, printed as a cyanotype.
//
// Contours of log|ζ(σ + it)| over σ ∈ [−0.6, 1.6], t ∈ [0, 50], computed in the reader's
// browser by zeta.js (logAbsZetaGrid, then marchingSquares). Where rings tighten to a point,
// ζ vanishes, and every such point here lies on the gold line Re s = ½; the pole at s = 1 is
// the bright knot at t = 0. The innermost rings come from finer local grids around each zero
// and around the pole, so they stay round where the main grid would be too coarse.
//
// On first view the print develops like an exposure (2.4 s): the wash clears, the hatching
// and contours come up, the rings close on the zeros, and the gold line is drawn from t = 0
// upwards. With motion paused it appears developed. Wide stages run t from left to right
// with σ increasing upwards; narrow (portrait) stages run t upwards, σ to the right.

import { ZEROS, zeta, logAbsZetaGrid, marchingSquares } from "./zeta.js";
import {
  stage, surface, layer, inks, motionGate, watchView, watchPage, frames, sliced, numbers, drawnBy, whenFonts,
  hatch, label, mono, crisp, ease, element, scientific, grouped,
} from "./fig-common.js";

const NAME = "zeta-landscape";
const ALT = "A blue print of contour lines over a rectangle, with a gold line at real part one half. Along the gold line, nested rings tighten to points at ten heights between 14 and 50. At t = 0, at real part 1, the lines crowd into a bright knot.";

const S0 = -0.6, S1 = 1.6, T0 = 0, T1 = 50;
const COLS = 300; // samples along σ
const ROWS = 900; // samples along t
const LEVELS = Array.from({ length: 21 }, (_, i) => -2 + i / 4); // log|ζ| = −2 … 3 in quarters
const RING_LEVELS = [-1.5, -2, -2.5, -3, -3.5];
const KNOT_LEVELS = [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const RING_BOX = { s0: 0.08, s1: 0.92, half: 0.42, n: 85 }; // local grid around each zero
const KNOT_BOX = { s0: 0.55, s1: 1.45, t0: 0, t1: 0.45, cols: 91, rows: 46 }; // around s = 1
const DEVELOP_MS = 2400;

// marchingSquares works in grid units; the figure keeps every path in (σ, t).
function toPlane(path, s0, ds, t0, dt) {
  const out = new Float32Array(path.length);
  for (let i = 0; i < path.length; i += 2) {
    out[i] = s0 + path[i] * ds;
    out[i + 1] = t0 + path[i + 1] * dt;
  }
  return out;
}

function within(path, s0, s1, t0, t1) {
  for (let i = 0; i < path.length; i += 2) {
    if (path[i] < s0 || path[i] > s1 || path[i + 1] < t0 || path[i + 1] > t1) return false;
  }
  return true;
}

async function localContours(reMin, reMax, imMin, imMax, cols, rows, levels, alive) {
  const job = logAbsZetaGrid({ reMin, reMax, imMin, imMax, cols, rows });
  const grid = await job.done;
  if (!alive()) return null;
  const ds = (reMax - reMin) / (cols - 1);
  const dt = (imMax - imMin) / (rows - 1);
  return levels.map((level) => ({
    level,
    paths: marchingSquares(grid, cols, rows, level).map((p) => toPlane(p, reMin, ds, imMin, dt)),
  }));
}

async function compute(alive, onJob) {
  const started = performance.now();
  const job = logAbsZetaGrid({ reMin: S0, reMax: S1, imMin: T0, imMax: T1, cols: COLS, rows: ROWS });
  onJob(job);
  const grid = await job.done;
  if (!alive()) return null;
  const gridMs = performance.now() - started;
  const zeros = Array.from(ZEROS).filter((g) => g <= T1);
  const ds = (S1 - S0) / (COLS - 1);
  const dt = (T1 - T0) / (ROWS - 1);

  // The main grid's own rings around zeros and the pole are too coarse below −1.5 and above
  // 1.5; the local grids draw those, so the coarse copies are left out.
  const coarse = (level, path) =>
    (level <= RING_LEVELS[0] && zeros.some((g) => within(path, RING_BOX.s0, RING_BOX.s1, g - RING_BOX.half, g + RING_BOX.half))) ||
    (level >= KNOT_LEVELS[0] && within(path, KNOT_BOX.s0, KNOT_BOX.s1, KNOT_BOX.t0, KNOT_BOX.t1));
  const contours = [];
  await sliced((function* () {
    for (const level of LEVELS) {
      const paths = marchingSquares(grid, COLS, ROWS, level).map((p) => toPlane(p, S0, ds, T0, dt));
      contours.push({ level, paths: paths.filter((p) => !coarse(level, p)) });
      yield;
    }
  })(), { cancelled: () => !alive() });
  if (!alive()) return null;

  const rings = [];
  for (const g of zeros) {
    const local = await localContours(RING_BOX.s0, RING_BOX.s1, g - RING_BOX.half, g + RING_BOX.half,
      RING_BOX.n, RING_BOX.n, RING_LEVELS, alive);
    if (!local) return null;
    rings.push({ zero: g, levels: local });
  }
  const knot = await localContours(KNOT_BOX.s0, KNOT_BOX.s1, KNOT_BOX.t0, KNOT_BOX.t1,
    KNOT_BOX.cols, KNOT_BOX.rows, KNOT_LEVELS, alive);
  if (!knot) return null;

  let low = Infinity, high = -Infinity;
  for (const v of grid) {
    if (v < low) low = v;
    if (v > high) high = v;
  }
  const residues = zeros.map((g) => Math.hypot(...zeta(0.5, g)));
  return { grid, contours, rings, knot, zeros, residues, low, high, gridMs, totalMs: performance.now() - started };
}

export function mount(el, ctx = {}) {
  const st = stage(el, NAME, ALT);
  const fill = el.dataset.fit === "fill";
  const wrap = element("div", "fig-frame");
  el.append(wrap);
  const readout = element("p", "fig-readout fig-readout-corner");
  readout.setAttribute("aria-hidden", "true");
  wrap.append(readout);

  let data = null;
  let alive = true;
  let job = null;
  let progress = 0; // 0 … 1 of the development; 1 = developed
  let developing = false;
  let developStart = 0;
  let developed = false;
  let inView = false;
  let geo = null;
  let ink = inks(el);
  let hatchLayer = null;
  let contourLayer = null;
  let masks = null;

  const surf = surface(wrap, {
    fill,
    label: st.alt,
    height: (w) => (w < 600 ? Math.min(720, Math.max(440, w * 1.5)) : Math.min(600, Math.max(300, w * 0.42))),
    onResize: () => {
      layout();
      render();
    },
  });

  const gate = motionGate(ctx, (still) => {
    if (still && developing) finishDevelop();
  });

  function layout() {
    const { width, height } = surf.size;
    const vertical = fill ? height > width * 1.05 : width < 600;
    const m = vertical ? { l: 34, r: 14, t: 12, b: 30 } : { l: 38, r: 18, t: 14, b: 30 };
    const x0 = m.l, x1 = width - m.r, y0 = m.t, y1 = height - m.b;
    const sx = (x1 - x0) / (vertical ? S1 - S0 : T1 - T0);
    const sy = (y1 - y0) / (vertical ? T1 - T0 : S1 - S0);
    geo = vertical
      ? { vertical, x0, x1, y0, y1, px: (s) => x0 + (s - S0) * sx, py: (t) => y1 - (t - T0) * sy }
      : { vertical, x0, x1, y0, y1, px: (t) => x0 + (t - T0) * sx, py: (s) => y1 - (s - S0) * sy };
    // x(σ, t) and y(σ, t) for either orientation
    geo.x = vertical ? (s) => geo.px(s) : (s, t) => geo.px(t);
    geo.y = vertical ? (s, t) => geo.py(t) : (s) => geo.py(s);
    geo.unmap = vertical
      ? (x, y) => [S0 + (x - x0) / sx, T0 + (y1 - y) / sy]
      : (x, y) => [S0 + (y1 - y) / sy, T0 + (x - x0) / sx];
    hatchLayer = null;
    contourLayer = null;
  }

  function trace(g, path) {
    g.moveTo(geo.x(path[0], path[1]), geo.y(path[0], path[1]));
    for (let i = 2; i < path.length; i += 2) g.lineTo(geo.x(path[i], path[i + 1]), geo.y(path[i], path[i + 1]));
  }

  // A soft mask of the valleys of |ζ|, in the orientation of the plate, at grid resolution.
  function mask(alphaOf) {
    const w = geo.vertical ? COLS : ROWS;
    const h = geo.vertical ? ROWS : COLS;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d");
    const image = g.createImageData(w, h);
    const px = image.data;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const a = alphaOf(data.grid[row * COLS + col]);
        if (a <= 0) continue;
        const ix = geo.vertical ? col : row;
        const iy = geo.vertical ? ROWS - 1 - row : COLS - 1 - col;
        const k = (iy * w + ix) * 4;
        px[k] = px[k + 1] = px[k + 2] = 255;
        px[k + 3] = Math.round(Math.min(1, a) * 255);
      }
    }
    g.putImageData(image, 0, 0);
    return canvas;
  }

  function buildLayers() {
    const size = surf.size;
    const { x0, x1, y0, y1 } = geo;
    if (!masks || masks.vertical !== geo.vertical) {
      masks = {
        vertical: geo.vertical,
        valley: mask((v) => (-0.5 - v) / 0.3),
        deep: mask((v) => (-1.25 - v) / 0.3),
      };
    }
    hatchLayer = layer(size);
    for (const [source, angle, alpha, spacing] of [[masks.valley, Math.PI / 4, 0.42, 3.4], [masks.deep, -Math.PI / 4, 0.34, 3.4]]) {
      const tone = layer(size);
      tone.g.strokeStyle = ink.print;
      tone.g.globalAlpha = alpha;
      hatch(tone.g, x0, y0, x1, y1, { angle, spacing, width: 0.75 });
      tone.g.globalAlpha = 1;
      tone.g.globalCompositeOperation = "destination-in";
      tone.g.imageSmoothingEnabled = true;
      tone.g.drawImage(source, x0, y0, x1 - x0, y1 - y0);
      hatchLayer.g.drawImage(tone.canvas, 0, 0, size.width, size.height);
    }

    contourLayer = layer(size);
    const g = contourLayer.g;
    g.save();
    g.beginPath();
    g.rect(x0, y0, x1 - x0, y1 - y0);
    g.clip();
    g.lineJoin = "round";
    g.lineCap = "round";
    for (const { level, paths } of data.contours) {
      if (!paths.length) continue;
      const major = Number.isInteger(level);
      const half = !major && Number.isInteger(level * 2);
      g.beginPath();
      for (const p of paths) trace(g, p);
      g.lineWidth = major ? (level === 0 ? 1.15 : 1) : half ? 0.85 : 0.75;
      g.strokeStyle = major ? ink.print : half ? ink.print2 : ink.print3;
      g.globalAlpha = major ? 0.88 : half ? 0.7 : 0.55;
      g.stroke();
    }
    g.restore();
  }

  function axes(g) {
    const { x0, x1, y0, y1, vertical } = geo;
    const { dpr } = surf.size;
    g.save();
    g.strokeStyle = ink.print3;
    g.fillStyle = ink.print3;
    g.lineWidth = 1;
    g.globalAlpha = 0.9;
    g.beginPath();
    // frame: two engraved rules, along the t axis and the σ axis
    const bx = crisp(x0, dpr), by = crisp(y1, dpr);
    g.moveTo(bx, y0);
    g.lineTo(bx, by);
    g.lineTo(x1, by);
    const sTicks = [[0, "0"], [0.5, "½"], [1, "1"]];
    const tTicks = [0, 10, 20, 30, 40, 50];
    if (vertical) {
      for (const [s] of sTicks) {
        const x = crisp(geo.px(s), dpr);
        g.moveTo(x, by);
        g.lineTo(x, by + 4);
      }
      for (const t of tTicks) {
        const y = crisp(geo.py(t), dpr);
        g.moveTo(bx - 4, y);
        g.lineTo(bx, y);
      }
    } else {
      for (const [s] of sTicks) {
        const y = crisp(geo.py(s), dpr);
        g.moveTo(bx - 4, y);
        g.lineTo(bx, y);
      }
      for (const t of tTicks) {
        const x = crisp(geo.px(t), dpr);
        g.moveTo(x, by);
        g.lineTo(x, by + 4);
      }
    }
    g.stroke();
    const font = mono(11);
    const color = ink.print3;
    if (vertical) {
      for (const [s, text] of sTicks) label(g, text, geo.px(s), by + 15, { font, color, align: "center" });
      label(g, "σ", x1, by + 15, { font, color, align: "right" });
      for (const t of tTicks) label(g, String(t), bx - 7, geo.py(t) + 4, { font, color, align: "right" });
      label(g, "t", bx - 7, y0 + 4, { font, color, align: "right", baseline: "top" });
    } else {
      for (const [s, text] of sTicks) label(g, text, bx - 8, geo.py(s) + 4, { font, color, align: "right" });
      label(g, "σ", bx - 8, y0 + 4, { font, color, align: "right", baseline: "top" });
      for (const t of tTicks) label(g, String(t), geo.px(t), by + 16, { font, color, align: "center" });
      label(g, "t", bx - 8, by + 16, { font, color, align: "right" });
    }
    g.restore();
  }

  function stripEdges(g) {
    g.save();
    g.strokeStyle = ink.print3;
    g.globalAlpha = 0.55;
    g.lineWidth = 0.75;
    g.setLineDash([2, 4]);
    g.beginPath();
    for (const s of [0, 1]) {
      g.moveTo(geo.x(s, T0), geo.y(s, T0));
      g.lineTo(geo.x(s, T1), geo.y(s, T1));
    }
    g.stroke();
    g.restore();
  }

  function knot(g, p) {
    const x = geo.x(1, 0), y = geo.y(1, 0);
    const glow = g.createRadialGradient(x, y, 0, x, y, 16);
    glow.addColorStop(0, ink.print);
    glow.addColorStop(1, "transparent");
    g.save();
    g.globalAlpha = 0.28 * ease((p - 0.55) / 0.3);
    g.fillStyle = glow;
    g.beginPath();
    g.arc(x, y, 16, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.save();
    g.beginPath();
    g.rect(geo.x0, geo.y0, geo.x1 - geo.x0, geo.y1 - geo.y0);
    g.clip();
    g.strokeStyle = ink.print;
    g.lineWidth = 0.9;
    data.knot.forEach(({ paths }, i) => {
      const a = ease((p - 0.3 - 0.05 * i) / 0.25);
      if (a <= 0) return;
      g.globalAlpha = a;
      g.beginPath();
      for (const path of paths) trace(g, path);
      g.stroke();
    });
    g.restore();
    const a = ease((p - 0.7) / 0.2);
    if (a > 0) {
      g.save();
      g.globalAlpha = a;
      g.fillStyle = ink.print;
      g.beginPath();
      g.arc(x, y, 2.2, 0, Math.PI * 2);
      g.fill();
      g.restore();
      const lx = geo.vertical ? x + 10 : x + 13;
      const ly = geo.vertical ? y - 12 : y + 4;
      label(g, "s = 1", lx, ly, { font: mono(11), color: ink.print2, alpha: a, halo: ink.ground });
    }
  }

  function rings(g, p) {
    g.save();
    g.strokeStyle = ink.print;
    g.lineWidth = 0.9;
    g.lineJoin = "round";
    for (const { levels } of data.rings) {
      levels.forEach(({ paths }, i) => {
        const a = ease((p - 0.35 - 0.07 * i) / 0.25);
        if (a <= 0 || !paths.length) return;
        g.globalAlpha = a * (0.95 - 0.08 * i);
        g.beginPath();
        for (const path of paths) trace(g, path);
        g.stroke();
      });
    }
    g.restore();
  }

  function goldLine(g, p) {
    const reach = T0 + (T1 - T0) * ease((p - 0.45) / 0.5);
    if (reach <= T0) return;
    const { dpr } = surf.size;
    g.save();
    g.strokeStyle = ink.gold;
    g.lineWidth = 1.1;
    g.beginPath();
    if (geo.vertical) {
      const x = crisp(geo.px(0.5), dpr, 1.1);
      g.moveTo(x, geo.py(T0));
      g.lineTo(x, geo.py(reach));
    } else {
      const y = crisp(geo.py(0.5), dpr, 1.1);
      g.moveTo(geo.px(T0), y);
      g.lineTo(geo.px(reach), y);
    }
    g.stroke();
    g.fillStyle = ink.gold;
    for (const zero of data.zeros) {
      const a = Math.min(1, Math.max(0, (reach - zero) / 1.5));
      if (a <= 0) continue;
      g.globalAlpha = a;
      g.beginPath();
      g.arc(geo.x(0.5, zero), geo.y(0.5, zero), 1.7, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    const a = ease((p - 0.9) / 0.1);
    if (a > 0) {
      const font = mono(11);
      // in the quiet stretch between the pole and the first zero
      if (geo.vertical) label(g, "Re s = ½", geo.px(0.5) + 7, geo.py(6), { font, color: ink.gold, alpha: a, halo: ink.ground });
      else label(g, "Re s = ½", geo.px(5), geo.py(0.5) - 7, { font, color: ink.gold, alpha: a, halo: ink.ground });
      const z = data.zeros[0];
      const zx = geo.x(0.5, z), zy = geo.y(0.5, z);
      if (geo.vertical) label(g, "ρ₁", zx + 12, zy + 4, { font, color: ink.print2, alpha: a, halo: ink.ground });
      else label(g, "ρ₁", zx + 12, geo.py(0.5) - 7, { font, color: ink.print2, alpha: a, halo: ink.ground });
    }
  }

  function render() {
    if (!geo || !alive) return;
    ink = inks(el);
    const g = surf.begin();
    if (!data) {
      // Unexposed: the sheet, its rules, and a faint sensitizer wash while ζ is computed.
      g.save();
      g.globalAlpha = 0.22;
      g.fillStyle = ink.wash;
      g.fillRect(geo.x0, geo.y0, geo.x1 - geo.x0, geo.y1 - geo.y0);
      g.restore();
      stripEdges(g);
      axes(g);
      return;
    }
    if (!hatchLayer || !contourLayer) buildLayers();
    const p = progress;
    const { width, height } = surf.size;
    if (p < 1) {
      g.save();
      g.globalAlpha = 0.22 * (1 - ease(p / 0.6));
      g.fillStyle = ink.wash;
      g.fillRect(geo.x0, geo.y0, geo.x1 - geo.x0, geo.y1 - geo.y0);
      g.restore();
    }
    g.save();
    g.globalAlpha = ease((p - 0.05) / 0.45);
    g.drawImage(hatchLayer.canvas, 0, 0, width, height);
    g.globalAlpha = ease((p - 0.1) / 0.55);
    g.drawImage(contourLayer.canvas, 0, 0, width, height);
    g.restore();
    stripEdges(g);
    rings(g, p);
    knot(g, p);
    goldLine(g, p);
    axes(g);
  }

  const loop = frames((time) => {
    if (!developing) return false;
    progress = Math.min(1, (time - developStart) / DEVELOP_MS);
    render();
    if (progress >= 1) {
      developing = false;
      developed = true;
      st.paint("developed");
      return false;
    }
    return true;
  });

  function finishDevelop() {
    loop.stop();
    developing = false;
    developed = true;
    progress = 1;
    render();
  }

  function maybeDevelop() {
    if (!data || developed || developing || !alive) return;
    if (gate.still || document.hidden) {
      finishDevelop();
      st.paint("ready");
      return;
    }
    if (!inView) return;
    developing = true;
    developStart = performance.now();
    progress = 0;
    st.paint("ready");
    loop.start();
  }

  const view = watchView(el, (visible) => {
    inView = visible;
    maybeDevelop();
  });
  const unwatchPage = watchPage((visible) => {
    if (!visible && developing) finishDevelop();
  });
  const unfonts = whenFonts(() => render());

  function onPointer(event) {
    if (!data || !geo) return;
    const rect = surf.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    if (x < geo.x0 || x > geo.x1 || y < geo.y0 || y > geo.y1) {
      readout.textContent = "";
      return;
    }
    const [s, t] = geo.unmap(x, y);
    const [re, im] = zeta(s, t);
    const size = Math.hypot(re, im);
    const sign = s < 0 ? "−" : "";
    readout.textContent = `s = ${sign}${Math.abs(s).toFixed(3)} + ${t.toFixed(3)}i · |ζ(s)| = ${size < 1e-3 ? scientific(size, 1) : size.toFixed(4)}`;
  }
  const clearReadout = () => {
    readout.textContent = "";
  };
  surf.canvas.addEventListener("pointermove", onPointer);
  surf.canvas.addEventListener("pointerleave", clearReadout);

  drawnBy(el, st.figure, "zeta.js · logAbsZetaGrid(), marchingSquares()");
  surf.measure();
  layout();
  render();
  st.paint("first");

  compute(() => alive, (j) => {
    job = j;
  }).then((result) => {
    if (!result || !alive) return;
    data = result;
    const worst = Math.max(...result.residues);
    numbers(el, {
      caption: "The landscape, computed in your browser",
      head: ["Quantity", "Value"],
      rows: [
        ["Zeros in view, t ≤ 50", `ten, on Re s = ½ (listed in chapter I)`],
        ["|ζ(½ + iγ)| at those ten heights", `at most ${scientific(worst, 1)} (the heights are rounded to nine decimals)`],
        ["Pole", "s = 1"],
        ["Contour grid", `σ ∈ [−0.6, 1.6], t ∈ [0, 50], computed at ${COLS} × ${ROWS} points`],
        ["Contour levels", "log |ζ| = −2 to 3 in quarters; rings to −3.5 around each zero and to 5 around the pole, from finer local grids"],
        ["log |ζ| on the grid", `from ${result.low.toFixed(2).replace("-", "−")} to ${result.high.toFixed(2).replace("-", "−")} (held within ±32)`],
        ["Time on this device", `${grouped(Math.round(result.gridMs))} ms for the grid of ${grouped(COLS * ROWS)} values, ${grouped(Math.round(result.totalMs))} ms in all`],
      ],
    });
    hatchLayer = null;
    contourLayer = null;
    render();
    maybeDevelop();
  }).catch(() => {
    /* a failed computation leaves the unexposed sheet and the text alternative */
  });

  return {
    update() {},
    destroy() {
      alive = false;
      job?.cancel?.();
      loop.stop();
      gate.destroy();
      view.destroy();
      unwatchPage();
      unfonts();
      surf.canvas.removeEventListener("pointermove", onPointer);
      surf.canvas.removeEventListener("pointerleave", clearReadout);
      surf.destroy();
      st.restore();
    },
  };
}
