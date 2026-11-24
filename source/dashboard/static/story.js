// story.js · the walk up the critical line.
//
// Reading down the herbarium is climbing the critical line Re s = ½. Every plate is pinned
// to a zero ½ + iγ of ζ: the frontispiece to t = 0, plates I–X and the two appendices to the
// first twelve zeros, the colophon to t = 60. This module
//
//   · draws that line as a rail: fixed at the left on wide screens, a slim strip under the
//     masthead on narrow ones. Hardy's Z(t) climbs it as a vine (true values, scaled) and the
//     zeros are ticks at their true heights, each a link to its plate;
//   · maps the scroll position to a height t, piecewise linearly between plate anchors, and
//     marks the plate actually in view in the masthead and on the rail (aria-current);
//   · mounts the figure modules (fig-<name>.js) as their plates come near, and passes them
//     every feed refresh;
//   · has math.js typeset the page's formulas (TeX in .math elements) with KaTeX.
//
// startStory({mode, getFeed}) → {update(feed)}

import { motion } from "./motion.js";
import { ZEROS, hardyZ } from "./zeta.js";

const T_MAX = 60;
const SVG = "http://www.w3.org/2000/svg";
const WIDE = matchMedia("(min-width: 1100px)");
const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";
const subscript = n => String(n).replace(/\d/g, d => SUBSCRIPTS[d]);
const svg = (name, attrs = {}) => {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};
const element = (name, className, text) => {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// Hardy's Z on the rail's range, sampled once: |Z| ≤ 3.67 for t ≤ 60 (largest near t = 45.6).
const STEP = 0.05;
const VINE = Array.from({length: Math.round(T_MAX / STEP) + 1}, (_, i) => {
  const t = i * STEP;
  return [t, hardyZ(t)];
});
const Z_MAX = Math.max(...VINE.map(([, z]) => Math.abs(z)));
// Leaves sit where the vine turns (local extrema of Z): drawn by rule, placed by the data.
const LEAVES = VINE.filter(([, z], i) => i > 0 && i < VINE.length - 1 &&
  (z - VINE[i - 1][1]) * (VINE[i + 1][1] - z) < 0 && Math.abs(z) > 0.35);

function readPlates() {
  return [...document.querySelectorAll("main .plate[id]")].map(el => {
    const zero = Number(el.dataset.zero) || 0;
    const t = el.dataset.t !== undefined ? Number(el.dataset.t) : zero > 0 ? ZEROS[zero - 1] : 0;
    return {
      el, id: el.id, zero, t,
      numeral: el.querySelector(".plate-head .numeral")?.textContent.trim() || "",
      title: el.querySelector(".plate-title")?.textContent.trim() || "",
    };
  });
}

const zeroLabel = (zero, t) => "ρ" + subscript(zero) + " · ½ + " + t.toFixed(4) + "i";
// "I. The count of primes", or the appendix title as it stands.
const plateName = plate => /^Appendix/.test(plate.title) || !plate.numeral ? plate.title : plate.numeral + ". " + plate.title;

export function startStory({ mode = "public", getFeed = () => null } = {}) {
  const header = document.querySelector(".masthead");
  const plates = readPlates().sort((a, b) => a.t - b.t);
  const navLinks = new Map();
  for (const link of document.querySelectorAll('.masthead-nav a[href^="#"]')) navLinks.set(link.hash.slice(1), link);

  // ── The rail ──────────────────────────────────────────────────────────────────────────
  const rail = element("nav", "rail");
  rail.setAttribute("aria-label", "The critical line, Re s = ½, from t = 0 to 60. Each mark is a zero of ζ and a link to its plate.");
  const art = svg("svg", { class: "rail-art", "aria-hidden": "true", focusable: "false" });
  const clip = svg("clipPath", { id: "rail-reach" });
  const clipRect = svg("rect");
  clip.append(clipRect);
  const defs = svg("defs");
  defs.append(clip);
  const line = svg("line", { class: "rail-line" });
  const ghost = svg("path", { class: "rail-vine-ghost" });
  const grown = svg("g", { "clip-path": "url(#rail-reach)" });
  const vine = svg("path", { class: "rail-vine" });
  const leaves = svg("path", { class: "rail-leaves" });
  grown.append(vine, leaves);
  const ticks = svg("g", { class: "rail-zeros" });
  const tooltip = svg("title");
  tooltip.textContent = "computed · Hardy’s Z(t), real along the line, changes sign at each of these zeros. True values, scaled. Drawn by zeta.js · hardyZ().";
  art.append(tooltip, defs, line, ghost, grown, ticks);

  const list = element("ol", "rail-ticks");
  const tickLinks = new Map();
  for (const plate of plates.filter(p => p.zero > 0)) {
    const item = element("li");
    const link = element("a", "rail-tick");
    link.href = "#" + plate.id;
    const label = element("span", "rail-label");
    label.append(element("span", "rail-rho", zeroLabel(plate.zero, plate.t)), " · ", element("span", "rail-title", plateName(plate)));
    link.append(label);
    item.append(link);
    list.append(item);
    tickLinks.set(plate.id, link);
  }
  const marker = element("span", "rail-marker");
  marker.setAttribute("aria-hidden", "true");
  const readout = element("span", "rail-readout", "t ≈ 0");
  readout.setAttribute("aria-hidden", "true");
  const foot = element("span", "rail-end rail-start", "t = 0");
  const top = element("span", "rail-end rail-stop", "60");
  foot.setAttribute("aria-hidden", "true");
  top.setAttribute("aria-hidden", "true");
  rail.append(art, list, marker, readout, foot, top);
  if (header) header.after(rail);
  else document.body.prepend(rail);

  let geometry = null;
  function measureRail() {
    const vertical = WIDE.matches;
    const width = rail.clientWidth, height = rail.clientHeight;
    if (!width || !height) return null;
    const pad = vertical ? { lo: 40, hi: 54 } : { lo: 56, hi: 66 };
    const span = (vertical ? height : width) - pad.lo - pad.hi;
    const along = t => vertical ? height - pad.lo - (t / T_MAX) * span : pad.lo + (t / T_MAX) * span;
    const centre = vertical ? Math.round(width * 0.5) + 0.5 : Math.round(height * 0.5) + 0.5;
    const amplitude = (vertical ? Math.min(22, width * 0.3) : Math.min(11, height * 0.32)) / Z_MAX;
    const point = (t, z) => vertical ? [centre + z * amplitude, along(t)] : [along(t), centre - z * amplitude];
    return { vertical, width, height, along, centre, amplitude, point, span };
  }

  function drawRail() {
    geometry = measureRail();
    if (!geometry) return;
    const { vertical, width, height, along, centre, point } = geometry;
    art.setAttribute("viewBox", "0 0 " + width + " " + height);
    art.setAttribute("width", width);
    art.setAttribute("height", height);
    const [x1, y1] = vertical ? [centre, along(0)] : [along(0), centre];
    const [x2, y2] = vertical ? [centre, along(T_MAX)] : [along(T_MAX), centre];
    Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => line.setAttribute(k, v));
    const path = VINE.map(([t, z], i) => (i ? "L" : "M") + point(t, z).map(v => v.toFixed(1)).join(" ")).join("");
    vine.setAttribute("d", path);
    ghost.setAttribute("d", path);
    // A leaf at each turn of the vine, pointing away from the line.
    const leafLength = vertical ? 7 : 5;
    leaves.setAttribute("d", LEAVES.map(([t, z]) => {
      const [x, y] = point(t, z);
      const out = Math.sign(z) || 1;
      const [dx, dy] = vertical ? [out * leafLength, -leafLength * 0.55] : [leafLength * 0.55, -out * leafLength];
      const [nx, ny] = [-dy * 0.35, dx * 0.35];
      return "M" + x.toFixed(1) + " " + y.toFixed(1) +
        "Q" + (x + dx / 2 + nx).toFixed(1) + " " + (y + dy / 2 + ny).toFixed(1) + " " + (x + dx).toFixed(1) + " " + (y + dy).toFixed(1) +
        "Q" + (x + dx / 2 - nx).toFixed(1) + " " + (y + dy / 2 - ny).toFixed(1) + " " + x.toFixed(1) + " " + y.toFixed(1) + "Z";
    }).join(""));
    ticks.replaceChildren();
    const half = vertical ? 7 : 6;
    for (const plate of plates.filter(p => p.zero > 0)) {
      const a = along(plate.t);
      const mark = vertical ? svg("line", { x1: centre - half, x2: centre + half, y1: a, y2: a })
        : svg("line", { x1: a, x2: a, y1: centre - half, y2: centre + half });
      mark.dataset.plate = plate.id;
      ticks.append(mark, svg("circle", vertical ? { cx: centre, cy: a, r: 1.6 } : { cx: a, cy: centre, r: 1.6 }));
      const link = tickLinks.get(plate.id);
      link.style.setProperty("--at", a.toFixed(1) + "px");
      // On the strip, labels of the later zeros open leftwards so they stay in the view.
      link.dataset.side = !vertical && a > width * 0.55 ? "end" : "start";
    }
    foot.style.setProperty("--at", along(0).toFixed(1) + "px");
    top.style.setProperty("--at", along(T_MAX).toFixed(1) + "px");
    paintPosition(true);
  }

  // ── Scroll position → t, and the plate in view ──────────────────────────────────────
  let anchors = [], spy = [], current = null, pinned = null, pinnedSeen = false, lastT = -1;

  function chromeHeight() {
    const bar = header ? header.getBoundingClientRect().bottom : 0;
    const strip = WIDE.matches ? 0 : Math.max(0, rail.getBoundingClientRect().bottom);
    return Math.max(0, bar, strip);
  }
  function readingLine() {
    const chrome = chromeHeight();
    return chrome + (innerHeight - chrome) * 0.3;
  }
  function layout() {
    const lineY = readingLine();
    const reach = Math.max(0, document.documentElement.scrollHeight - innerHeight) + lineY;
    anchors = plates.map(p => p.el.getBoundingClientRect().top + scrollY);
    // The top of the page is the foot of the line: t = 0 before any scrolling.
    if (anchors.length) anchors[0] = lineY;
    // Plates too close to the end to reach the reading line share the last stretch of scroll,
    // so the walk still ends at t = 60 and the last plate is marked at the bottom.
    let last = anchors.length - 1;
    while (last > 0 && anchors[last] > reach - 1) last--;
    for (let j = last + 1; j < anchors.length; j++) {
      anchors[j] = anchors[last] + (reach - anchors[last]) * (j - last) / (anchors.length - 1 - last);
    }
    for (let j = 1; j < anchors.length; j++) anchors[j] = Math.max(anchors[j], anchors[j - 1] + 1e-3);
    // A plate is "in view" from the middle of the critical-line segment that leads to it:
    // the gap between two plates belongs half to each.
    spy = plates.map((p, j) => {
      const rule = p.el.previousElementSibling;
      if (!j || !rule?.matches?.("hr.rule-line")) return anchors[j];
      const box = rule.getBoundingClientRect();
      return Math.min(anchors[j], box.top + scrollY + box.height / 2);
    });
    for (let j = 1; j < spy.length; j++) spy[j] = Math.max(spy[j], spy[j - 1] + 1e-3);
  }
  function position() {
    const s = scrollY + readingLine();
    if (!anchors.length) return { t: 0, index: -1 };
    let index = 0;
    while (index < spy.length - 1 && s >= spy[index + 1]) index++;
    if (s <= anchors[0]) return { t: plates[0].t, index };
    for (let i = 0; i < anchors.length - 1; i++) {
      if (s < anchors[i + 1]) {
        const f = (s - anchors[i]) / (anchors[i + 1] - anchors[i]);
        return { t: plates[i].t + f * (plates[i + 1].t - plates[i].t), index };
      }
    }
    return { t: plates.at(-1).t, index: plates.length - 1 };
  }
  function visible(el) {
    const box = el.getBoundingClientRect();
    return box.bottom > chromeHeight() + 8 && box.top < innerHeight - 8;
  }
  function markCurrent(id) {
    if (id === current) return;
    navLinks.get(current)?.removeAttribute("aria-current");
    tickLinks.get(current)?.removeAttribute("aria-current");
    current = id;
    navLinks.get(id)?.setAttribute("aria-current", "location");
    tickLinks.get(id)?.setAttribute("aria-current", "location");
    for (const mark of ticks.querySelectorAll("line")) mark.classList.toggle("is-current", mark.dataset.plate === id);
    const plate = plates.find(p => p.id === id);
    const here = document.querySelector(".masthead-here");
    if (here) {
      here.replaceChildren();
      if (plate && plate.zero > 0) here.append(element("span", "here-num", /^Appendix/.test(plate.title) ? "" : plate.numeral), " ", element("span", "here-title", plate.title));
    }
  }
  function paintPosition(force = false) {
    const { t, index } = position();
    let id = plates[index]?.id ?? null;
    if (pinned) {
      const target = document.getElementById(pinned);
      const seen = target && visible(target);
      if (seen) pinnedSeen = true;
      if (target && (seen || !pinnedSeen)) id = pinned;
      else pinned = null;
    }
    markCurrent(id);
    if (!geometry || (!force && Math.abs(t - lastT) < 0.005)) return;
    lastT = t;
    const { vertical, along, centre } = geometry;
    // The vine grows with the reader; a reader who has paused motion sees it whole.
    const reach = motion.preference === "paused" ? T_MAX : t;
    const a = along(t), r = along(reach);
    if (vertical) Object.entries({ x: 0, y: r - 2, width: geometry.width, height: Math.max(0, along(0) - r + 6) }).forEach(([k, v]) => clipRect.setAttribute(k, v));
    else Object.entries({ x: 0, y: 0, width: Math.max(0, r + 2), height: geometry.height }).forEach(([k, v]) => clipRect.setAttribute(k, v));
    marker.style.setProperty("--x", (vertical ? centre : a).toFixed(1) + "px");
    marker.style.setProperty("--y", (vertical ? a : centre).toFixed(1) + "px");
    readout.style.setProperty("--at", a.toFixed(1) + "px");
    readout.textContent = "t ≈ " + t.toFixed(t < 10 ? 2 : 1);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      paintPosition();
    });
  }
  let relayoutPending = false;
  function relayout() {
    if (relayoutPending) return;
    relayoutPending = true;
    requestAnimationFrame(() => {
      relayoutPending = false;
      layout();
      drawRail();
    });
  }
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", relayout);
  WIDE.addEventListener("change", relayout);
  new ResizeObserver(relayout).observe(document.body);
  new ResizeObserver(relayout).observe(rail);
  motion.onChange(() => paintPosition(true));

  // A link to a plate pins the mark on that plate until it has been seen and left, so a
  // short plate near the end is still the one marked after its link is followed.
  function pin(id) {
    if (!plates.some(p => p.id === id)) return;
    pinned = id;
    pinnedSeen = false;
    schedule();
  }
  document.addEventListener("click", event => {
    const link = event.target.closest?.('a[href^="#"]');
    if (link && link.hash.length > 1) pin(decodeURIComponent(link.hash.slice(1)));
  });
  addEventListener("hashchange", () => pin(decodeURIComponent(location.hash.slice(1))));
  if (location.hash.length > 1) pin(decodeURIComponent(location.hash.slice(1)));
  addEventListener("wheel", () => { if (pinnedSeen) pinned = null; }, { passive: true });
  addEventListener("touchmove", () => { if (pinnedSeen) pinned = null; }, { passive: true });

  // ── The plate menu on narrow screens ─────────────────────────────────────────────────
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".masthead-nav");
  if (toggle && nav) {
    const close = (focus) => {
      toggle.setAttribute("aria-expanded", "false");
      nav.removeAttribute("data-open");
      if (focus) toggle.focus();
    };
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      if (open) nav.setAttribute("data-open", "");
      else nav.removeAttribute("data-open");
    });
    nav.addEventListener("click", event => { if (event.target.closest("a")) close(false); });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") close(true);
    });
    document.addEventListener("click", event => {
      if (toggle.getAttribute("aria-expanded") === "true" && !nav.contains(event.target) && !toggle.contains(event.target)) close(false);
    });
  }

  // ── Figures ─────────────────────────────────────────────────────────────────────────
  // Each figure module exports mount(stage, ctx) → {update(feed), destroy()}. A module that
  // cannot be loaded leaves the stage's text alternative in place.
  const mounted = new Map();
  const context = { motion, mode, getFeed };
  async function mountFigure(figure) {
    const name = figure.dataset.figure;
    const stage = figure.querySelector(".figure-stage");
    if (!stage || !/^[a-z][a-z-]*$/.test(name || "")) return;
    figure.dataset.figureState = "loading";
    let module;
    try {
      module = await import("./fig-" + name + ".js");
    } catch {
      figure.dataset.figureState = "fallback";
      return;
    }
    const fallback = [...stage.childNodes];
    const alt = stage.textContent.trim().replace(/\s+/g, " ");
    try {
      stage.replaceChildren();
      if (alt) stage.dataset.alt = alt;
      const handle = module.mount(stage, context);
      mounted.set(figure, handle || {});
      figure.dataset.figureState = "mounted";
      const feed = getFeed();
      if (feed) handle?.update?.(feed);
    } catch (error) {
      mounted.get(figure)?.destroy?.();
      mounted.delete(figure);
      stage.replaceChildren(...fallback);
      figure.dataset.figureState = "fallback";
      figure.dataset.figureError = String(error?.message || error).slice(0, 200);
    }
  }
  // Figures, and the decorative margin specimens beside the plate heads (aria-hidden, no
  // caption: a specimen that cannot load simply stays empty).
  const figures = [...document.querySelectorAll("[data-figure]")];
  if ("IntersectionObserver" in window) {
    const watcher = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        watcher.unobserve(entry.target);
        mountFigure(entry.target);
      }
    }, { rootMargin: "100% 0px 100% 0px" });
    figures.forEach(figure => watcher.observe(figure));
  } else {
    figures.forEach(mountFigure);
  }

  // ── Mathematics ───────────────────────────────────────────────────────────────────
  // Every formula is TeX in a .math element; math.js typesets them with KaTeX, which loads
  // here, off the path of the first paint. The ResizeObserver on the body relays the page.
  import("./math.js").then(({ renderMath }) => renderMath(document)).catch(error => console.error("story: mathematics", error));

  layout();
  drawRail();
  return {
    update(feed) {
      for (const handle of mounted.values()) {
        try { handle.update?.(feed); } catch { /* a figure that fails to update keeps its last frame */ }
      }
    },
    relayout,
  };
}
