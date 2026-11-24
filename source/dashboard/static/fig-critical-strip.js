// fig-critical-strip.js · Chapter I: the critical strip, and the prime staircase beside it.
//
// Left, the strip 0 < Re s < 1 with the first zeros of ζ set like seeds in one furrow, the
// gold line Re s = ½; the trivial zeros −2, −4, −6 lie faint to the left, past a break in
// the σ axis, and the pole at s = 1 is a knot on the real axis. Every seed is a real control:
// hover or focus it to read ρₙ = ½ + iγₙ. Right (below on phones), Chebyshev's ψ(x), which
// climbs by log p at every prime power p^k, beside the line y = x for x ≤ 100.
// Literal, computed in the reader's browser from zeta.js (ZEROS, psiSteps).

import { ZEROS, psiSteps } from "./zeta.js";
import {
  stage, surface, inks, numbers, drawnBy, whenFonts, label, mono, crisp, element, subscript, fixed,
} from "./fig-common.js";

const NAME = "critical-strip";
const ALT = "A narrow vertical strip between real parts 0 and 1, crossed by a gold line at one half. Small seeds sit exactly on the gold line at heights 14.13, 21.02, 25.01, 30.42, 32.94 and higher; none sit off it. Faint dots to the left mark −2, −4 and −6, and a knot at real part 1 marks the pole. Beside the strip, a staircase rises in uneven steps alongside a straight diagonal line and stays close to it up to 100.";

// The heights to ten decimals, for the reader (mpmath 1.3.0; the research run's §5.2 list).
// They round to zeta.js's nine-decimal ZEROS, which draw the seeds; a mismatch falls back.
const TEN_PLACES = ["14.1347251417", "21.0220396388", "25.0108575801", "30.4248761259", "32.9350615877",
  "37.5861781588", "40.9187190121", "43.3270732809", "48.0051508812", "49.7738324777"];
const T_TOP = 52;
const T_BOTTOM = -2.5;
const LEFT = [-6.6, -1.4]; // σ range left of the break
const MAIN = [-0.35, 1.5]; // σ range of the strip panel proper
const BREAK = 16;

const heightText = (k) => {
  const ten = TEN_PLACES[k];
  return ten && Math.abs(Number(ten) - ZEROS[k]) < 6e-10 ? ten : ZEROS[k].toFixed(9);
};
const rhoText = (k) => `ρ${subscript(k + 1)} = ½ + ${heightText(k)}i`;

export function mount(el, ctx = {}) {
  const st = stage(el, NAME, ALT);
  const wrap = element("div", "fig-frame");
  el.append(wrap);
  const seeds = Array.from(ZEROS).filter((g) => g <= T_TOP - 1);
  const steps = psiSteps(100);

  let ink = inks(el);
  let geo = null;
  let active = -1; // the seed being read

  const tip = element("p", "fig-tip");
  tip.setAttribute("aria-hidden", "true");
  tip.hidden = true;
  const hotspots = seeds.map((g, k) => {
    const button = element("button", "fig-hotspot");
    button.type = "button";
    button.setAttribute("aria-label", rhoText(k));
    button.addEventListener("focus", () => show(k));
    button.addEventListener("blur", () => show(-1));
    button.addEventListener("pointerenter", () => show(k));
    button.addEventListener("pointerleave", () => {
      if (document.activeElement !== button) show(-1);
    });
    return button;
  });
  const layerOfSeeds = element("div", "fig-hotspots");
  layerOfSeeds.setAttribute("role", "group");
  layerOfSeeds.setAttribute("aria-label", "The first zeros on the critical line");
  layerOfSeeds.append(...hotspots);

  const surf = surface(wrap, {
    label: st.alt,
    height: (w) => (w >= 720
      ? Math.min(500, Math.max(340, w * 0.46))
      : Math.min(470, Math.max(360, w * 1.05)) + 24 + Math.min(330, Math.max(240, w * 0.72))),
    onResize: () => {
      layout();
      render();
    },
  });
  wrap.append(layerOfSeeds, tip);

  function layout() {
    const { width, height } = surf.size;
    const wide = width >= 720;
    const stripBox = wide
      ? { x0: 16, x1: Math.round(width * 0.5) - 34, y0: 16, y1: height - 34 }
      : { x0: 12, x1: width - 34, y0: 14, y1: Math.round(Math.min(470, Math.max(360, width * 1.05))) - 30 };
    const psiBox = wide
      ? { x0: Math.round(width * 0.5) + 44, x1: width - 56, y0: 24, y1: height - 34 }
      : { x0: 40, x1: width - 52, y0: stripBox.y1 + 58, y1: height - 34 };
    // ψ is square when there is room
    const side = Math.min(psiBox.x1 - psiBox.x0, psiBox.y1 - psiBox.y0);
    if (wide) {
      psiBox.y0 = Math.round((psiBox.y0 + psiBox.y1 - side) / 2);
      psiBox.y1 = psiBox.y0 + side;
      psiBox.x0 = Math.round((psiBox.x0 + psiBox.x1 - side) / 2);
      psiBox.x1 = psiBox.x0 + side;
    }
    const leftWidth = (stripBox.x1 - stripBox.x0 - BREAK) * 0.24;
    const l0 = stripBox.x0, l1 = l0 + leftWidth, m0 = l1 + BREAK, m1 = stripBox.x1;
    const sx = (s) => (s <= LEFT[1] + 0.2
      ? l0 + (s - LEFT[0]) / (LEFT[1] - LEFT[0]) * (l1 - l0)
      : m0 + (s - MAIN[0]) / (MAIN[1] - MAIN[0]) * (m1 - m0));
    const ty = (t) => stripBox.y1 - (t - T_BOTTOM) / (T_TOP - T_BOTTOM) * (stripBox.y1 - stripBox.y0);
    geo = { wide, stripBox, psiBox, l0, l1, m0, m1, sx, ty };
    hotspots.forEach((button, k) => {
      button.style.left = sx(0.5) + "px";
      button.style.top = ty(seeds[k]) + "px";
    });
  }

  function seedShape(g, x, y, scale = 1) {
    const h = 5.6 * scale, w = 2.9 * scale;
    g.beginPath();
    g.moveTo(x, y - h);
    g.quadraticCurveTo(x + w * 1.55, y, x, y + h);
    g.quadraticCurveTo(x - w * 1.55, y, x, y - h);
  }

  function drawStrip(g) {
    const { sx, ty, l0, l1, m0, m1 } = geo;
    const { dpr } = surf.size;
    const y0 = ty(0), yTop = ty(T_TOP);
    const xs0 = sx(0), xs1 = sx(1), xh = crisp(sx(0.5), dpr, 1.1);

    // The furrows: the strip's soil, ruled parallel to the line.
    g.save();
    g.beginPath();
    g.rect(xs0, yTop, xs1 - xs0, y0 - yTop);
    g.clip();
    g.strokeStyle = ink.print3;
    g.globalAlpha = 0.24;
    g.lineWidth = 0.75;
    g.beginPath();
    for (let x = xs0 + 4.5; x < xs1 - 1; x += 5) {
      if (Math.abs(x - xh) < 3) continue;
      g.moveTo(x, yTop);
      g.lineTo(x, y0);
    }
    g.stroke();
    g.restore();

    g.save();
    g.lineWidth = 1;
    g.strokeStyle = ink.print2;
    g.globalAlpha = 0.75;
    g.beginPath();
    for (const x of [crisp(xs0, dpr), crisp(xs1, dpr)]) {
      g.moveTo(x, y0);
      g.lineTo(x, yTop);
    }
    g.stroke();

    // The real axis, broken between the trivial zeros and the strip.
    const ya = crisp(y0, dpr);
    g.strokeStyle = ink.print3;
    g.globalAlpha = 0.9;
    g.beginPath();
    g.moveTo(l0, ya);
    g.lineTo(l1, ya);
    g.moveTo(m0, ya);
    g.lineTo(m1, ya);
    for (const x of [l1 + 3, m0 - 3]) {
      g.moveTo(x - 3, ya + 5);
      g.lineTo(x + 3, ya - 5);
    }
    g.stroke();
    g.restore();

    // The critical line.
    g.save();
    g.strokeStyle = ink.gold;
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(xh, y0);
    g.lineTo(xh, yTop);
    g.stroke();
    g.restore();

    // Trivial zeros, faint.
    g.save();
    g.strokeStyle = ink.print3;
    g.globalAlpha = 0.75;
    g.lineWidth = 0.9;
    for (const s of [-2, -4, -6]) {
      g.beginPath();
      g.arc(sx(s), y0, 2.6, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();

    // The pole: a knot of short strokes around s = 1.
    g.save();
    const kx = sx(1);
    g.strokeStyle = ink.print;
    g.lineWidth = 1;
    g.beginPath();
    g.arc(kx, y0, 3.2, 0, Math.PI * 2);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      g.moveTo(kx + Math.cos(a) * 5, y0 + Math.sin(a) * 5);
      g.lineTo(kx + Math.cos(a) * 8, y0 + Math.sin(a) * 8);
    }
    g.stroke();
    g.restore();

    // Seeds in the furrow.
    seeds.forEach((gamma, k) => {
      const y = ty(gamma);
      g.save();
      seedShape(g, xh, y, k === active ? 1.25 : 1);
      g.strokeStyle = ink.print;
      g.lineWidth = k === active ? 1.2 : 1;
      g.stroke();
      g.fillStyle = ink.gold;
      g.beginPath();
      g.arc(xh, y, 1.3, 0, Math.PI * 2);
      g.fill();
      if (k === active) {
        g.strokeStyle = ink.print;
        g.globalAlpha = 0.5;
        g.lineWidth = 0.75;
        g.beginPath();
        g.arc(xh, y, 12, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    });

    // Scale: σ under the axis, t at the right edge.
    const font = mono(11);
    const color = ink.print3;
    for (const [s, text] of [[-6, "−6"], [-4, "−4"], [-2, "−2"], [0, "0"], [0.5, "½"], [1, "1"]]) {
      label(g, text, sx(s), y0 + 16, { font, color, align: "center" });
    }
    label(g, "…", l0, y0 - 6, { font, color });
    label(g, "pole", kx + 9, y0 - 7, { font, color: ink.print2 });
    label(g, "Re s = ½", xh + 6, yTop + 9, { font, color: ink.gold });
    g.save();
    g.strokeStyle = color;
    g.lineWidth = 1;
    g.beginPath();
    for (const t of [10, 20, 30, 40, 50]) {
      const y = crisp(ty(t), dpr);
      g.moveTo(m1 - 4, y);
      g.lineTo(m1, y);
    }
    g.moveTo(crisp(m1, dpr), ty(0));
    g.lineTo(crisp(m1, dpr), yTop);
    g.stroke();
    g.restore();
    for (const t of [10, 20, 30, 40, 50]) label(g, String(t), m1 + 5, ty(t) + 4, { font, color });
    label(g, "t", m1 + 5, ty(T_TOP) + 4, { font, color });
    label(g, "σ", m1 + 5, y0 + 16, { font, color });
  }

  function drawPsi(g) {
    const { x0, x1, y0, y1 } = geo.psiBox;
    const { dpr } = surf.size;
    const X = (x) => x0 + (x / 100) * (x1 - x0);
    const Y = (y) => y1 - (y / 100) * (y1 - y0);
    g.save();
    g.strokeStyle = ink.print3;
    g.lineWidth = 1;
    g.beginPath();
    const bx = crisp(x0, dpr), by = crisp(y1, dpr);
    g.moveTo(bx, y0);
    g.lineTo(bx, by);
    g.lineTo(x1, by);
    for (const v of [0, 50, 100]) {
      g.moveTo(crisp(X(v), dpr), by);
      g.lineTo(crisp(X(v), dpr), by + 4);
      g.moveTo(bx - 4, crisp(Y(v), dpr));
      g.lineTo(bx, crisp(Y(v), dpr));
    }
    g.stroke();
    // Primes and prime powers along the x axis: the places where ψ steps.
    g.beginPath();
    for (let i = 0; i < steps.x.length; i++) {
      const n = steps.x[i];
      const jump = steps.psi[i] - (i ? steps.psi[i - 1] : 0);
      const prime = Math.abs(jump - Math.log(n)) < 1e-9;
      const x = crisp(X(n), dpr);
      g.moveTo(x, by - (prime ? 5 : 3));
      g.lineTo(x, by);
    }
    g.globalAlpha = 0.8;
    g.stroke();
    g.restore();

    // y = x
    g.save();
    g.strokeStyle = ink.print3;
    g.lineWidth = 0.9;
    g.setLineDash([3, 4]);
    g.beginPath();
    g.moveTo(X(0), Y(0));
    g.lineTo(X(100), Y(100));
    g.stroke();
    g.restore();

    // ψ(x), the staircase.
    g.save();
    g.strokeStyle = ink.print;
    g.lineWidth = 1.1;
    g.lineJoin = "miter";
    g.beginPath();
    g.moveTo(X(0), Y(0));
    let level = 0;
    for (let i = 0; i < steps.x.length; i++) {
      const x = X(steps.x[i]);
      g.lineTo(x, Y(level));
      level = steps.psi[i];
      g.lineTo(x, Y(level));
    }
    g.lineTo(X(100), Y(level));
    g.stroke();
    g.restore();

    const font = mono(11);
    const color = ink.print3;
    for (const v of [0, 50, 100]) {
      label(g, String(v), X(v), by + 16, { font, color, align: "center" });
      if (v) label(g, String(v), bx - 7, Y(v) + 4, { font, color, align: "right" });
    }
    label(g, "x", x1 + 12, by + 16, { font, color });
    label(g, "ψ(x)", X(100) + 6, Y(level) + 4, { font, color: ink.print });
    label(g, "y = x", X(73), Y(73) - 12, { font, color, align: "right" });
  }

  function render() {
    if (!geo) return;
    ink = inks(el);
    const g = surf.begin();
    drawStrip(g);
    drawPsi(g);
  }

  function show(k) {
    if (k === active) return;
    active = k;
    render();
    if (k < 0) {
      tip.hidden = true;
      return;
    }
    tip.textContent = rhoText(k);
    tip.hidden = false;
    // beside the seed, on whichever side leaves the words inside the stage
    const x = geo.sx(0.5);
    tip.style.left = x + 16 + "px";
    tip.style.top = geo.ty(seeds[k]) + "px";
    if (x + 16 + tip.offsetWidth > wrap.clientWidth - 2) tip.style.left = Math.max(2, x - 16 - tip.offsetWidth) + "px";
  }

  // The pointer finds the nearest seed even between the buttons.
  function onPointer(event) {
    if (!geo) return;
    const rect = surf.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    let best = -1, distance = 14;
    seeds.forEach((gamma, k) => {
      const d = Math.hypot(x - geo.sx(0.5), y - geo.ty(gamma));
      if (d < distance) {
        distance = d;
        best = k;
      }
    });
    if (!hotspots.includes(document.activeElement)) show(best);
  }
  const leave = () => {
    if (!hotspots.includes(document.activeElement)) show(-1);
  };
  surf.canvas.addEventListener("pointermove", onPointer);
  surf.canvas.addEventListener("pointerleave", leave);
  const unfonts = whenFonts(() => render());

  drawnBy(el, st.figure, "zeta.js · ZEROS, psiSteps()");
  surf.measure();
  layout();
  render();
  st.paint("first");
  st.paint("ready");

  numbers(el, [
    {
      caption: "The first ten zeros above the real axis",
      head: ["n", "γₙ", "ρₙ"],
      numeric: [0, 1],
      rows: seeds.slice(0, 10).map((gamma, k) => [String(k + 1), heightText(k), `½ + ${heightText(k)}i`]),
    },
    {
      caption: "The staircase ψ(x), computed in your browser",
      head: ["x", "ψ(x)", "ψ(x) − x"],
      numeric: [0, 1, 2],
      rows: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((x) => {
        let psi = 0;
        for (let i = 0; i < steps.x.length && steps.x[i] <= x; i++) psi = steps.psi[i];
        return [String(x), psi.toFixed(4), fixed(psi - x, 4)];
      }),
    },
  ]);

  return {
    update() {},
    destroy() {
      surf.canvas.removeEventListener("pointermove", onPointer);
      surf.canvas.removeEventListener("pointerleave", leave);
      unfonts();
      surf.destroy();
      st.restore();
    },
  };
}
