// fig-windows.js · Chapter III: a window is enough.
//
// Above, a logarithmic axis of y with windows [Y, Y^(3/2)] marching outward without end, for
// Y = e^20, e^40, e^80, e^160, …, and a one-sided ceiling C·y^θ over them: the hypothesis of
// the analytic engine (Deduction.zeroFree_of_rpow_window) asks for the bound on the windows
// only, and only from above. Both axes are logarithmic, so the ceiling is a straight line;
// the trace beneath it is drawn by rule, not computed.
//
// Below left, the spotlight: the bump u^k·e^(−u)/k! on u = log y, seen against one window
// [U, 3U/2] (the axis is u/U, so every window has the same width). Its peak sits at the
// window's centre when k = 5U/4; as k grows it narrows onto the window. The mass inside is
// computed here with the regularised incomplete gamma function: 67.95%, 83.97%, 95.22% and
// 99.45% for U = 20, 40, 80, 160 — the reading project's atlas gives 68.0, 84.0, 95.2, 99.5.
//
// Below right, the order of choices as three numbered marks on the real axis: a supposed
// zero ρ; then θ between ½ and Re ρ (as Lean picks it, ½ + ½·min(Re ρ − ½, ½)); then ε small
// enough that ½ + 9ε ≤ θ.

import {
  stage, surface, inks, motionGate, watchView, watchPage, frames, numbers, drawnBy, whenFonts, hatch, label,
  mono, crisp, ease, element, superscript,
} from "./fig-common.js";

const NAME = "windows";
const ALT = "A horizontal axis marked in powers of ten. Shaded intervals, each running from Y to Y to the power three halves, repeat further and further to the right. A gently rising ceiling line runs above them. A bell-shaped bump sits over one interval and grows narrower and taller as its order increases. Three small numbered marks read: 1, a zero; 2, theta; 3, epsilon.";

const ATLAS = [[20, "68.0%"], [40, "84.0%"], [80, "95.2%"], [160, "99.5%"]];
const LOG10E = Math.LOG10E;
const X_MAX = 118; // log10 y at the right edge of the upper panel
const THETA = 0.62; // the ceiling's exponent, as drawn
const K_MIN = 10, K_MAX = 200;
const SWEEP_MS = 6500, HOLD_MS = 1800;
const RHO = 0.8, CHOSEN_THETA = 0.5 + 0.5 * Math.min(RHO - 0.5, 0.5), EPSILON = 0.01;

// ── The regularised incomplete gamma function P(a, x) (Numerical Recipes §6.2) ─────────

function logGamma(z) {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function gammaP(a, x) {
  if (x <= 0) return 0;
  const front = a * Math.log(x) - x - logGamma(a);
  if (x < a + 1) {
    let term = 1 / a, sum = term;
    for (let n = 1; n < 1000; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(front);
  }
  // continued fraction for Q = 1 − P (modified Lentz)
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return 1 - Math.exp(front) * h;
}

// Share of u^k e^(−u)/k! (a Gamma(k + 1) density) on [U, 3U/2].
export function spotlightMass(k, U) {
  return gammaP(k + 1, 1.5 * U) - gammaP(k + 1, U);
}

// The bump drawn against v = u/U: U·f(Uv), so its area is still 1.
function bump(k, U, v) {
  const u = U * v;
  return U * Math.exp(k * Math.log(u) - u - logGamma(k + 1));
}

// A trace for the upper panel, drawn by rule: it hugs y^½ with a slow, irregular sway.
function sway(x) {
  return 0.5 * x + 1.1 * Math.sin(x * 0.61 + 0.4) + 0.7 * Math.sin(x * 1.37 + 1.9) + 0.45 * Math.sin(x * 3.1 + 0.2);
}

export function mount(el, ctx = {}) {
  const st = stage(el, NAME, ALT);
  const uid = Math.random().toString(36).slice(2, 8);
  const controls = element("div", "fig-controls");
  const sliderLabel = element("label", "fig-control");
  const slider = element("input");
  slider.type = "range";
  slider.min = String(K_MIN);
  slider.max = String(K_MAX);
  slider.step = "1";
  slider.value = String(K_MAX);
  const ticks = element("datalist");
  ticks.id = `fig-windows-k-${uid}`;
  for (const [U] of ATLAS) {
    const option = element("option");
    option.value = String(1.25 * U);
    ticks.append(option);
  }
  slider.setAttribute("list", ticks.id);
  const out = element("output", "fig-value");
  sliderLabel.append(element("span", "fig-control-name", "Spotlight order k"), slider, out, ticks);
  controls.append(sliderLabel);
  const wrap = element("div", "fig-frame");
  el.append(controls, wrap);

  let ink = inks(el);
  let geo = null;
  let k = K_MAX;
  let touched = false;
  let inView = false;
  let startedAt = 0;

  const surf = surface(wrap, {
    label: st.alt,
    height: (w) => (w >= 720 ? Math.min(560, Math.max(420, w * 0.5)) : 730),
    onResize: () => {
      layout();
      render();
    },
  });

  function layout() {
    const { width, height } = surf.size;
    const wide = width >= 720;
    if (wide) {
      const upperBottom = Math.round(height * 0.47);
      geo = {
        wide,
        upper: { x0: 50, x1: width - 20, y0: 18, y1: upperBottom },
        spot: { x0: 50, x1: Math.round(width * 0.6), y0: upperBottom + 66, y1: height - 30 },
        order: { x0: Math.round(width * 0.66), x1: width - 26, y0: upperBottom + 66, y1: height - 30 },
      };
    } else {
      geo = {
        wide,
        upper: { x0: 40, x1: width - 14, y0: 16, y1: 232 },
        spot: { x0: 40, x1: width - 14, y0: 300, y1: 530 },
        order: { x0: 24, x1: width - 24, y0: 566, y1: height - 10 },
      };
    }
  }

  function windowRange(U) {
    return [U * LOG10E, 1.5 * U * LOG10E]; // log10 of Y and of Y^(3/2), Y = e^U
  }

  function drawUpper(g) {
    const { x0, x1, y0, y1 } = geo.upper;
    const { dpr } = surf.size;
    const yMax = THETA * X_MAX + 6;
    const X = (v) => x0 + (v / X_MAX) * (x1 - x0);
    const Y = (v) => y1 - (v / yMax) * (y1 - y0);
    const ceiling = (x) => 3 + THETA * x;
    const windows = [20, 40, 80, 160, 320];
    const U = k / 1.25;
    const near = ATLAS.reduce((best, [u]) => (Math.abs(Math.log(u / U)) < Math.abs(Math.log(best / U)) ? u : best), 20);

    // windows: hatched columns, the one in the spotlight a little stronger
    for (const w of windows) {
      const [a, b] = windowRange(w);
      if (a >= X_MAX) continue;
      const left = X(a), right = X(Math.min(b, X_MAX));
      g.save();
      g.beginPath();
      g.rect(left, y0, right - left, y1 - y0);
      g.clip();
      g.strokeStyle = ink.print3;
      g.globalAlpha = w === near ? 0.5 : 0.28;
      hatch(g, left, y0, right, y1, { angle: -Math.PI / 4, spacing: 4.2, width: 0.75 });
      g.restore();
      g.save();
      g.strokeStyle = ink.print2;
      g.globalAlpha = w === near ? 0.9 : 0.55;
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(crisp(left, dpr), y0);
      g.lineTo(crisp(left, dpr), y1);
      if (b <= X_MAX) {
        g.moveTo(crisp(right, dpr), y0);
        g.lineTo(crisp(right, dpr), y1);
      }
      g.stroke();
      g.restore();
    }

    // the ceiling: solid over the windows, dotted between them
    g.save();
    g.strokeStyle = ink.print;
    g.lineWidth = 1;
    g.setLineDash([1.5, 3.5]);
    g.beginPath();
    g.moveTo(X(0), Y(ceiling(0)));
    g.lineTo(X(X_MAX), Y(ceiling(X_MAX)));
    g.globalAlpha = 0.55;
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 1;
    g.lineWidth = 1.2;
    g.beginPath();
    for (const w of windows) {
      const [a, b] = windowRange(w);
      if (a >= X_MAX) continue;
      g.moveTo(X(a), Y(ceiling(a)));
      g.lineTo(X(Math.min(b, X_MAX)), Y(ceiling(Math.min(b, X_MAX))));
    }
    g.stroke();
    g.restore();

    // the trace: bright where it is held down (on windows), faint elsewhere
    const inWindow = (x) => windows.some((w) => {
      const [a, b] = windowRange(w);
      return x >= a && x <= b;
    });
    g.save();
    g.lineJoin = "round";
    for (const held of [false, true]) {
      g.beginPath();
      let drawing = false;
      for (let i = 0; i <= 600; i++) {
        const x = (i / 600) * X_MAX;
        if (inWindow(x) !== held) {
          drawing = false;
          continue;
        }
        const yy = Math.min(sway(x), ceiling(x) - 0.4);
        if (drawing) g.lineTo(X(x), Y(yy));
        else g.moveTo(X(x), Y(yy));
        drawing = true;
      }
      g.strokeStyle = held ? ink.print : ink.print3;
      g.globalAlpha = held ? 0.95 : 0.6;
      g.lineWidth = held ? 1.1 : 0.85;
      g.stroke();
    }
    g.restore();

    // axis in powers of ten, with the road going on
    g.save();
    g.strokeStyle = ink.print3;
    g.lineWidth = 1;
    g.beginPath();
    const by = crisp(y1, dpr);
    g.moveTo(x0, by);
    g.lineTo(x1, by);
    g.moveTo(x1 - 6, by - 4);
    g.lineTo(x1, by);
    g.lineTo(x1 - 6, by + 4);
    for (let e = 0; e <= 100; e += 20) {
      g.moveTo(crisp(X(e), dpr), by);
      g.lineTo(crisp(X(e), dpr), by + 4);
    }
    g.stroke();
    g.restore();
    const font = mono(11);
    for (let e = 0; e <= 100; e += 20) label(g, e === 0 ? "1" : "10" + superscript(e), X(e), by + 16, { font, color: ink.print3, align: "center" });
    label(g, "y", x1, by + 16, { font, color: ink.print3, align: "right" });
    label(g, "…", x1 - 12, y1 - 8, { font, color: ink.print2, align: "right" });
    const [a20, b20] = windowRange(20);
    label(g, "[Y, Y³ᐟ²]", (X(a20) + X(b20)) / 2, y0 + 12, { font, color: ink.print2, align: "center", halo: ink.ground });
    const cx = X(X_MAX * 0.83);
    label(g, "C·yᶿ", cx, Y(ceiling(X_MAX * 0.83)) - 8, { font, color: ink.print, align: "center", halo: ink.ground });
    label(g, "Gₘ(y), drawn by rule", x0 + 6, y1 - 8, { font, color: ink.print3, alpha: geo.wide ? 1 : 0, halo: ink.ground });
    return { X, near };
  }

  function drawSpot(g, upper) {
    const { x0, x1, y0, y1 } = geo.spot;
    const { dpr } = surf.size;
    const v0 = 0.55, v1 = 2.0;
    const X = (v) => x0 + ((v - v0) / (v1 - v0)) * (x1 - x0);
    // the tallest bump reaches two thirds of the panel, leaving the top for words
    const top = bump(200, 160, 1.25) * 1.5;
    const Y = (h) => y1 - (h / top) * (y1 - y0);
    const U = k / 1.25;

    // zoom lines from the window in the upper panel to this one
    const [a, b] = windowRange(upper.near);
    g.save();
    g.strokeStyle = ink.print3;
    g.globalAlpha = 0.5;
    g.lineWidth = 0.75;
    g.setLineDash([1.5, 3]);
    g.beginPath();
    g.moveTo(upper.X(a), geo.upper.y1 + 22);
    g.lineTo(X(1), y0 - 4);
    g.moveTo(upper.X(Math.min(b, X_MAX)), geo.upper.y1 + 22);
    g.lineTo(X(1.5), y0 - 4);
    g.stroke();
    g.restore();

    // the window
    g.save();
    g.beginPath();
    g.rect(X(1), y0, X(1.5) - X(1), y1 - y0);
    g.clip();
    g.strokeStyle = ink.print3;
    g.globalAlpha = 0.3;
    hatch(g, X(1), y0, X(1.5), y1, { angle: -Math.PI / 4, spacing: 4.2, width: 0.75 });
    g.restore();
    g.save();
    g.strokeStyle = ink.print2;
    g.lineWidth = 0.9;
    g.beginPath();
    for (const v of [1, 1.5]) {
      g.moveTo(crisp(X(v), dpr), y0);
      g.lineTo(crisp(X(v), dpr), y1);
    }
    g.stroke();
    g.restore();

    const curve = (kk, UU) => {
      g.beginPath();
      for (let i = 0; i <= 260; i++) {
        const v = v0 + ((v1 - v0) * i) / 260;
        const x = X(v), yy = Y(bump(kk, UU, v));
        if (i) g.lineTo(x, yy);
        else g.moveTo(x, yy);
      }
    };
    // the atlas's four bumps, faint
    g.save();
    g.strokeStyle = ink.print3;
    g.lineWidth = 0.8;
    g.globalAlpha = 0.75;
    for (const [UU] of ATLAS) {
      curve(1.25 * UU, UU);
      g.stroke();
    }
    g.restore();
    // the current bump; its mass inside the window hatched
    g.save();
    curve(k, U);
    g.lineTo(X(v1), y1);
    g.lineTo(X(v0), y1);
    g.closePath();
    g.clip();
    g.beginPath();
    g.rect(X(1), y0 - 2, X(1.5) - X(1), y1 - y0 + 2);
    g.clip();
    g.strokeStyle = ink.print;
    g.globalAlpha = 0.55;
    hatch(g, X(1), y0, X(1.5), y1, { angle: Math.PI / 4, spacing: 3, width: 0.75 });
    g.restore();
    g.save();
    g.strokeStyle = ink.print;
    g.lineWidth = 1.2;
    g.lineJoin = "round";
    curve(k, U);
    g.stroke();
    g.restore();

    g.save();
    g.strokeStyle = ink.print3;
    g.lineWidth = 1;
    g.beginPath();
    const by = crisp(y1, dpr);
    g.moveTo(x0, by);
    g.lineTo(x1, by);
    for (const v of [1, 1.25, 1.5]) {
      g.moveTo(crisp(X(v), dpr), by);
      g.lineTo(crisp(X(v), dpr), by + 4);
    }
    g.stroke();
    g.restore();
    const font = mono(11);
    label(g, "U", X(1), by + 16, { font, color: ink.print3, align: "center" });
    label(g, "5U/4", X(1.25), by + 16, { font, color: ink.print3, align: "center" });
    label(g, "3U/2", X(1.5), by + 16, { font, color: ink.print3, align: "center" });
    label(g, "u = log y", x1, by + 16, { font, color: ink.print3, align: "right" });
    label(g, "uᵏe⁻ᵘ/k!", x0 + 4, y0 + 10, { font, color: ink.print2, halo: ink.ground });
    label(g, `k = ${k} · U = ${Number.isInteger(U) ? U : U.toFixed(1)} · ${(100 * spotlightMass(k, U)).toFixed(2)}% inside`, x0 + 4, y0 + 26, { font, color: ink.print, halo: ink.ground });
    // the atlas's figures, at the panel's right edge
    ATLAS.forEach(([UU, text], i) => {
      const yy = y0 + 46 + i * 15;
      label(g, `U = ${UU}`, x1 - 52, yy, { font, color: ink.print3, align: "right" });
      label(g, text, x1, yy, { font, color: Math.abs(UU - U) < 0.01 ? ink.print : ink.print3, align: "right" });
    });
    label(g, "atlas", x1, y0 + 30, { font, color: ink.print3, align: "right" });
  }

  function drawOrder(g) {
    const { x0, x1, y0, y1 } = geo.order;
    const { dpr } = surf.size;
    const X = (s) => x0 + ((s - 0.45) / (1.02 - 0.45)) * (x1 - x0);
    const axisY = Math.round(y0 + (y1 - y0) * 0.45);
    const font = mono(11);
    g.save();
    g.strokeStyle = ink.print3;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(X(0.45), crisp(axisY, dpr));
    g.lineTo(X(1.02), crisp(axisY, dpr));
    for (const s of [0.5, 1]) {
      g.moveTo(crisp(X(s), dpr), axisY - 4);
      g.lineTo(crisp(X(s), dpr), axisY + 4);
    }
    g.stroke();
    g.restore();
    // ½ is the critical line itself
    g.save();
    g.strokeStyle = ink.gold;
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(crisp(X(0.5), dpr, 1.1), axisY - 14);
    g.lineTo(crisp(X(0.5), dpr, 1.1), axisY + 8);
    g.stroke();
    g.restore();
    label(g, "½", X(0.5), axisY + 20, { font, color: ink.gold, align: "center" });
    label(g, "1", X(1), axisY + 20, { font, color: ink.print3, align: "center" });
    label(g, "Re s", X(1.02), axisY - 10, { font, color: ink.print3, align: "right" });

    const marks = [
      [RHO, "1", "1 · a zero ρ"],
      [CHOSEN_THETA, "2", "2 · θ between ½ and Re ρ"],
      [0.5 + 9 * EPSILON, "3", "3 · ε with ½ + 9ε ≤ θ"],
    ];
    marks.forEach(([s, n], i) => {
      const x = X(s);
      g.save();
      g.strokeStyle = ink.print;
      g.lineWidth = 1;
      g.beginPath();
      if (i === 0) {
        g.setLineDash([2, 2]);
        g.arc(x, axisY, 4, 0, Math.PI * 2);
      } else {
        g.moveTo(crisp(x, dpr), axisY - 6);
        g.lineTo(crisp(x, dpr), axisY + 6);
      }
      g.stroke();
      g.setLineDash([]);
      const cy = axisY - 20 - (i === 2 ? 14 : 0);
      g.beginPath();
      g.arc(x, cy, 7, 0, Math.PI * 2);
      g.lineWidth = 0.9;
      g.stroke();
      g.restore();
      label(g, n, x, cy + 4, { font, color: ink.print, align: "center" });
    });
    marks.forEach(([, , text], i) => label(g, text, x0, axisY + 40 + i * 16, { font, color: ink.print2 }));
  }

  function render() {
    if (!geo) return;
    ink = inks(el);
    const g = surf.begin();
    const upper = drawUpper(g);
    drawSpot(g, upper);
    drawOrder(g);
  }

  function setK(value, fromUser) {
    k = Math.max(K_MIN, Math.min(K_MAX, Math.round(value)));
    if (String(k) !== slider.value) slider.value = String(k);
    const U = k / 1.25;
    out.textContent = `${(100 * spotlightMass(k, U)).toFixed(1)}% inside`;
    slider.setAttribute("aria-valuetext", `k = ${k}, U = ${Number.isInteger(U) ? U : U.toFixed(1)}: ${(100 * spotlightMass(k, U)).toFixed(1)}% of the bump inside the window`);
    if (fromUser) {
      touched = true;
      loop.stop();
    }
    render();
  }

  // In view and with motion allowed, the spotlight narrows from k = 10 to 200, rests, repeats.
  const loop = frames((time) => {
    if (touched || gate.still || !inView) return false;
    const cycle = (time - startedAt) % (SWEEP_MS + HOLD_MS);
    const f = ease(Math.min(1, cycle / SWEEP_MS));
    const next = Math.round(K_MIN + (K_MAX - K_MIN) * f);
    if (next !== k) setK(next, false);
    return true;
  }, 20);
  const gate = motionGate(ctx, (still) => {
    if (still) {
      loop.stop();
      if (!touched) setK(K_MAX, false);
    } else play();
  });
  function play() {
    if (touched || gate.still || !inView || loop.running) return;
    startedAt = performance.now();
    loop.start();
  }
  const view = watchView(el, (visible) => {
    inView = visible;
    if (visible) play();
    else loop.stop();
  });
  const unwatchPage = watchPage((visible) => {
    if (visible) play();
  });
  slider.addEventListener("input", () => setK(Number(slider.value), true));
  const unfonts = whenFonts(() => render());

  drawnBy(el, st.figure, "fig-windows.js · spotlightMass() (incomplete gamma), windows drawn by rule");
  surf.measure();
  layout();
  setK(K_MAX, false);
  st.paint("first");
  st.paint("ready");

  const computed = ATLAS.map(([U]) => (100 * spotlightMass(1.25 * U, U)).toFixed(2) + "%");
  numbers(el, {
    caption: "The engine’s quantities",
    head: ["Quantity", "Value", "Source"],
    rows: [
      ["Window", "[Y, Y^(3/2)] (hosts of width 3/2)", "source"],
      ["Ceiling exponent supplied", "½ + (e_D + e_L + 7)·ε with e_D = 2, e_L = 0, so ½ + 9ε", "source"],
      ["θ as Lean chooses it", "½ + ½·min(Re ρ − ½, ½), then ε", "source (level_of_tiedWin)"],
      ["Spotlight mass inside the window, U = 20 / 40 / 80 / 160", "68.0% / 84.0% / 95.2% / 99.5%", "reading project’s atlas"],
      ["Recomputed here, with the peak at the window’s centre (k = 5U/4)", computed.join(" / "), "computed in your browser (the atlas’s exact kernel may differ in detail)"],
      ["“Prime windows ⇒ RH”, checked on its own", "fresh Lean replay over 10,530 modules; nanoda on 61,697 exported declarations", "reading project, status 20 Nov 2026, 6:51 p.m. EST"],
    ],
  });

  return {
    update() {},
    destroy() {
      loop.stop();
      gate.destroy();
      view.destroy();
      unwatchPage();
      unfonts();
      surf.destroy();
      st.restore();
    },
  };
}
