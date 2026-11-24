// fig-common.js · what the herbarium's figures share.
//
// Each figure is a module fig-<name>.js exporting mount(el, ctx) → {update(feed), destroy()}.
// `el` is the .figure-stage inside <figure class="figure" data-figure="<name>">; story.js has
// already emptied it and left the figure's text alternative in el.dataset.alt (a page that
// mounts a figure by hand may leave the text inside the stage instead). `ctx` is
// {motion, mode: "public" | "local", getFeed()}, with `motion` the shared switch of motion.js.
//
// This file holds the plumbing they have in common, so that each figure can be about its
// mathematics: a canvas that fits its stage (ResizeObserver, device pixels capped at 2), the
// ink read from the CSS custom properties of ink.css, motion that obeys the shared switch and
// stops when the tab is hidden, work cut into slices of at most 8 ms, the "Read the numbers"
// tables, and the small formatting habits of the page (true minus, grouped thousands).

const PIN = "a172c464fd4bcfc4f53e394dcba45d742b1409a6";
export const SOURCE_ROOT = `https://github.com/Deicyde/riemann-hypothesis/blob/${PIN}/src/`;
const SVG_NS = "http://www.w3.org/2000/svg";

// The faces of ink.css, with its fallbacks, for words drawn on a canvas.
const MONO = '"Lark Mono", ui-monospace, "Cascadia Mono", Consolas, monospace';
const TEXT = '"Lark Text", "Lark Mono", "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif';
export const mono = (px = 11, weight = 400) => `${weight} ${px}px ${MONO}`;
const serif = (px = 14, style = "normal", weight = 400) => `${style} ${weight} ${px}px ${TEXT}`;

const now = () => performance.now();

// ── Ink ────────────────────────────────────────────────────────────────────────────────
// The palette lives in ink.css; figures read it from the stage so that a theme change (or
// the forest theme) reaches the canvas too. The fallbacks are the herbarium's own values.

const INK = {
  ground: ["--ground", "#0c2544"],
  groundDeep: ["--ground-deep", "#071a31"],
  groundLift: ["--ground-lift", "#123359"],
  wash: ["--wash", "#1b406e"],
  print: ["--print", "#eaf0f4"],
  print2: ["--print-2", "#b6c7d8"],
  print3: ["--print-3", "#809ab6"],
  hair: ["--hair", "rgb(234 240 244 / 0.16)"],
  gold: ["--gold", "#e0b862"],
  goldDim: ["--gold-dim", "rgb(224 184 98 / 0.38)"],
  live: ["--live", "#93d9e6"],
  heather: ["--heather", "#c6a9e0"],
  vermilion: ["--vermilion", "#e8603f"],
  paper: ["--paper", "#efe8d6"],
  paperInk: ["--paper-ink", "#1c2632"],
};

const forcedColors = typeof matchMedia === "function" ? matchMedia("(forced-colors: active)") : null;

export function inks(el) {
  const style = getComputedStyle(el);
  const out = {};
  for (const [key, [name, fallback]] of Object.entries(INK)) out[key] = style.getPropertyValue(name).trim() || fallback;
  if (forcedColors?.matches) {
    // In forced colours the canvas keeps only two inks: the system's text and highlight.
    for (const key of ["print", "print2", "print3", "hair", "live", "heather", "vermilion", "paperInk"]) out[key] = "CanvasText";
    for (const key of ["gold", "goldDim"]) out[key] = "Highlight";
    for (const key of ["ground", "groundDeep", "groundLift", "wash", "paper"]) out[key] = "Canvas";
  }
  return out;
}

// The colour a determination is drawn in (design §3.1 state mapping), from targetEvidence's
// state words or a receipt's result.
export function stateInk(state) {
  switch (String(state || "").toLowerCase()) {
    case "passed": case "accepted": case "complete": case "verified": return "gold";
    case "running": case "replaying": case "live": case "writing": return "live";
    case "rejected": case "failed": return "vermilion";
    case "inconclusive": case "unconfirmed": case "unavailable": case "stopped": return "heather";
    default: return "pending";
  }
}

// ── The stage ──────────────────────────────────────────────────────────────────────────

export function stage(el, name, defaultAlt = "") {
  const figure = el.closest("figure");
  const saved = [...el.childNodes];
  const alt = (el.dataset.alt || el.textContent || "").replace(/\s+/g, " ").trim() || defaultAlt;
  el.replaceChildren();
  el.classList.add("fig-live");
  el.dataset.figureName = name;
  const born = now();
  let painted = false;
  return {
    figure,
    alt,
    born,
    // Tells the page how long the figure took: "first" once, when something is on screen;
    // "ready" when the final drawing (or the start of its development) is in place.
    paint(kind = "first") {
      if (kind === "first") {
        if (painted) return;
        painted = true;
      }
      el.dispatchEvent(new CustomEvent("figurepaint", { bubbles: true, detail: { figure: name, kind, ms: now() - born } }));
    },
    restore() {
      el.replaceChildren(...saved);
      el.classList.remove("fig-live");
      delete el.dataset.figureName;
    },
  };
}

export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function svgElement(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) if (value != null) node.setAttribute(key, String(value));
  return node;
}

// The small "drawn by" note every figure carries (design §1). Skipped when the caption
// already names the code that draws the figure ("Drawn by <code>…</code>", or a .drawn-by).
export function drawnBy(el, figure, text) {
  const caption = figure?.querySelector("figcaption");
  if (caption) {
    if (caption.querySelector(".drawn-by")) return null;
    const words = [...caption.childNodes].filter((node) => !node.classList?.contains("tag")).map((node) => node.textContent).join("");
    if (/\bdrawn by\b/i.test(words)) return null;
  }
  const note = element("p", "drawn-by fig-drawn-by");
  note.append("drawn by ", element("code", null, text));
  el.append(note);
  return note;
}

// ── Canvas that fits its stage ─────────────────────────────────────────────────────────
// height(width) gives the CSS height for a CSS width; with fill: true the canvas takes the
// size the page gives the stage instead (the stage then needs a height in CSS).

export function surface(host, { height = (w) => w * 0.5, fill = false, label = "", className = "", onResize } = {}) {
  const canvas = element("canvas", "fig-canvas" + (fill ? " is-fill" : "") + (className ? " " + className : ""));
  if (label) {
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", label);
  } else canvas.setAttribute("aria-hidden", "true");
  host.append(canvas);
  const g = canvas.getContext("2d");
  const size = { width: 0, height: 0, dpr: 1 };
  let frame = 0;
  let alive = true;

  const apply = () => {
    frame = 0;
    if (!alive) return;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const cssHeight = Math.max(1, Math.round(fill ? canvas.clientHeight : height(width)));
    if (!fill && canvas.style.height !== cssHeight + "px") canvas.style.height = cssHeight + "px";
    const dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    if (width === size.width && cssHeight === size.height && dpr === size.dpr) return;
    size.width = width;
    size.height = cssHeight;
    size.dpr = dpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    onResize?.(width, cssHeight, dpr);
  };
  const schedule = () => {
    if (!frame && alive) frame = requestAnimationFrame(apply);
  };
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
  observer?.observe(fill ? canvas : host);
  // A zoom changes devicePixelRatio without resizing anything, so the window's resize counts too.
  addEventListener("resize", schedule);

  return {
    canvas,
    g,
    size,
    // Measures now (the first frame should not wait for the observer's first callback).
    measure() {
      if (frame) cancelAnimationFrame(frame);
      apply();
      return size;
    },
    // Scaled to CSS pixels and cleared.
    begin() {
      g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      g.clearRect(0, 0, size.width, size.height);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      return g;
    },
    destroy() {
      alive = false;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      removeEventListener("resize", schedule);
      canvas.remove();
    },
  };
}

// An offscreen layer the size of a surface, drawn once and composited many times.
export function layer(size) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(size.width * size.dpr));
  canvas.height = Math.max(1, Math.round(size.height * size.dpr));
  const g = canvas.getContext("2d");
  g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
  return { canvas, g };
}

// A hairline that lands on whole device pixels.
export function crisp(v, dpr, width = 1) {
  const w = Math.max(1, Math.round(width * dpr));
  return (Math.round(v * dpr - w / 2) + w / 2) / dpr;
}

// Parallel hatching across a box, clipped to whatever path the caller has set up with
// g.clip() beforehand (or to the box itself). Angle in radians, spacing in CSS px.
export function hatch(g, x0, y0, x1, y1, { angle = Math.PI / 4, spacing = 4, width = 0.75 } = {}) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const r = Math.hypot(x1 - x0, y1 - y0) / 2 + spacing;
  g.save();
  g.translate(cx, cy);
  g.rotate(angle);
  g.beginPath();
  for (let y = -r; y <= r; y += spacing) {
    g.moveTo(-r, y);
    g.lineTo(r, y);
  }
  g.lineWidth = width;
  g.stroke();
  g.restore();
}

// Words on a canvas. `halo` (a ground colour) clears a small plate behind the letters, so a
// label stays legible where it crosses lines or hatching.
export function label(g, text, x, y, { font = mono(11), color, align = "left", baseline = "alphabetic", alpha = 1, halo } = {}) {
  if (alpha <= 0) return;
  g.save();
  g.font = font;
  g.textAlign = align;
  g.textBaseline = baseline;
  g.globalAlpha *= alpha;
  if (halo) {
    const m = g.measureText(text);
    const left = x - (m.actualBoundingBoxLeft || 0) - 3;
    const top = y - (m.actualBoundingBoxAscent || 9) - 2;
    const width = (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width) + 6;
    const height = (m.actualBoundingBoxAscent || 9) + (m.actualBoundingBoxDescent || 3) + 4;
    g.fillStyle = halo;
    g.globalAlpha *= 0.82;
    g.fillRect(left, top, width, height);
    g.globalAlpha /= 0.82;
  }
  if (color) g.fillStyle = color;
  g.fillText(text, x, y);
  g.restore();
}

// Fonts arrive after the first frame; figures redraw their labels once they have.
export function whenFonts(callback) {
  const fonts = document.fonts;
  if (!fonts?.load) return () => {};
  let alive = true;
  Promise.all([fonts.load(mono(11)), fonts.load(serif(14))])
    .then(() => fonts.ready)
    .then(() => {
      if (alive) callback();
    })
    .catch(() => {});
  return () => {
    alive = false;
  };
}

// ── Motion ─────────────────────────────────────────────────────────────────────────────
// `still` is true when the reader (or the system) has asked for no motion: every figure then
// shows its final frame. motion.js keeps html[data-motion] and fires `larkmotion`; a page
// without motion.js falls back to prefers-reduced-motion.

const reducedMotion = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

export function motionGate(ctx, onChange) {
  const shared = ctx?.motion;
  // motion.paused also turns true while the tab is hidden; figures handle hiding themselves
  // (their loops stop), so the gate follows the reader's preference alone.
  const read = () => {
    if (typeof shared?.preference === "string") return shared.preference === "paused";
    if (typeof shared?.paused === "boolean") return shared.paused;
    return !!reducedMotion?.matches;
  };
  let still = read();
  let alive = true;
  let unsubscribe = null;
  const check = () => {
    if (!alive) return;
    const next = read();
    if (next === still) return;
    still = next;
    onChange?.(still);
  };
  if (typeof shared?.onChange === "function") {
    try {
      const off = shared.onChange(check);
      if (typeof off === "function") unsubscribe = off;
    } catch {
      /* an older motion.js without onChange still fires larkmotion */
    }
  }
  addEventListener("larkmotion", check);
  document.addEventListener("visibilitychange", check);
  reducedMotion?.addEventListener?.("change", check);
  return {
    get still() {
      return still;
    },
    destroy() {
      alive = false;
      unsubscribe?.();
      removeEventListener("larkmotion", check);
      document.removeEventListener("visibilitychange", check);
      reducedMotion?.removeEventListener?.("change", check);
    },
  };
}

// Whether the stage is on screen; callback(inView) on every change.
export function watchView(el, callback, { threshold = 0.12, rootMargin = "0px" } = {}) {
  if (typeof IntersectionObserver !== "function") {
    callback(true);
    return { destroy() {} };
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) callback(entry.isIntersecting);
  }, { threshold, rootMargin });
  observer.observe(el);
  return { destroy: () => observer.disconnect() };
}

export function watchPage(callback) {
  const handler = () => callback(!document.hidden);
  document.addEventListener("visibilitychange", handler);
  return () => document.removeEventListener("visibilitychange", handler);
}

// A requestAnimationFrame loop capped at `fps` that stops by itself when the tab is hidden.
// step(now) returns false to stop.
export function frames(step, fps = 30) {
  let id = 0;
  let last = -Infinity;
  let running = false;
  const interval = 1000 / fps - 2;
  const tick = (time) => {
    id = 0;
    if (!running) return;
    if (document.hidden) {
      running = false;
      return;
    }
    if (time - last >= interval) {
      last = time;
      if (step(time) === false) {
        running = false;
        return;
      }
    }
    id = requestAnimationFrame(tick);
  };
  return {
    start() {
      if (running) return;
      running = true;
      last = -Infinity;
      id = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      if (id) cancelAnimationFrame(id);
      id = 0;
    },
    get running() {
      return running;
    },
  };
}

export const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

// ── Work in slices ─────────────────────────────────────────────────────────────────────
// steps is an iterator whose next() does a small unit of work; between slices of at most
// `budget` ms the page gets the main thread back. Resolves with the iterator's return value,
// or undefined if cancelled() turned true.

function yieldToPage() {
  const scheduler = globalThis.scheduler;
  if (scheduler && typeof scheduler.yield === "function") return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function sliced(steps, { budget = 8, cancelled = () => false } = {}) {
  let end = now() + budget;
  for (;;) {
    const result = steps.next();
    if (result.done) return result.value;
    if (cancelled()) return undefined;
    if (now() >= end) {
      await yieldToPage();
      if (cancelled()) return undefined;
      end = now() + budget;
    }
  }
}

// ── "Read the numbers" ─────────────────────────────────────────────────────────────────
// The figure owns the tables inside its <details class="numbers">: it fills the first ones
// in order and creates any that are missing. Anything else in the disclosure (a summary,
// notes) is left as the page wrote it. Each spec is {caption, head: [...], rows: [[...]],
// numeric: [column indexes]}; the first cell of a row is its header.

export function numbers(el, specs) {
  const details = el.closest("figure")?.querySelector("details.numbers");
  if (!details) return;
  const list = Array.isArray(specs) ? specs : [specs];
  const tables = [...details.querySelectorAll("table")];
  list.forEach((spec, index) => {
    let table = tables[index];
    if (!table) {
      table = element("table");
      if (tables[index - 1]) tables[index - 1].after(table);
      else details.append(table);
      tables[index] = table;
    }
    fillTable(table, spec);
  });
  for (const extra of tables.slice(list.length)) if (extra.dataset.figureTable != null) extra.remove();
}

function fillTable(table, { caption, head = [], rows = [], numeric = [] }) {
  table.dataset.figureTable = "";
  table.replaceChildren();
  if (caption) table.createCaption().textContent = caption;
  if (head.length) {
    const row = table.createTHead().insertRow();
    head.forEach((text, i) => {
      const cell = element("th", numeric.includes(i) ? "num" : null, text);
      cell.scope = "col";
      row.append(cell);
    });
  }
  const body = table.createTBody();
  for (const cells of rows) {
    const row = body.insertRow();
    cells.forEach((text, i) => {
      const cell = element(i === 0 ? "th" : "td", numeric.includes(i) ? "num" : null, text);
      if (i === 0) cell.scope = "row";
      row.append(cell);
    });
  }
}

// ── Numbers as the page writes them ────────────────────────────────────────────────────

export const minus = (value) => String(value).replace(/-/g, "\u2212");
export const fixed = (value, digits) => minus(Number(value).toFixed(digits));
export const signed = (value, digits) => (value > 0 ? "+" : value < 0 ? "\u2212" : "") + Math.abs(value).toFixed(digits);
const grouping = new Intl.NumberFormat("en-US");
export const grouped = (value) => grouping.format(value);

const SUPERSCRIPT = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻", "−": "⁻" };
const SUBSCRIPT = { 0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉" };
export const superscript = (value) => String(value).replace(/[0-9\-−]/g, (c) => SUPERSCRIPT[c]);
export const subscript = (value) => String(value).replace(/[0-9]/g, (c) => SUBSCRIPT[c]);

// "1.2 × 10⁻¹³"
export function scientific(value, digits = 1) {
  if (!Number.isFinite(value) || value === 0) return String(value);
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / 10 ** exponent;
  return `${minus(mantissa.toFixed(digits))} × 10${superscript(exponent)}`;
}
