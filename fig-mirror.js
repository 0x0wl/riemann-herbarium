// fig-mirror.js · Chapter IV: the mirror at one half.
//
// The critical strip, upright, with the gold line Re s = ½ as its waterline. A supposed zero
// at real part ⅓ is reflected by ρ ↦ 1 − ρ̄ to a twin at real part ⅔, which lands in the
// half-plane Re s > ½ that chapter III leaves without zeros; so the twin cannot exist, and
// neither can the zero at ⅓. Five steps (the words are the page's copy), stepped with Back
// and Next, or played while the figure is on screen and motion is allowed. The geometry is
// literal; the supposed zero is a supposition, and the reed with its reflection is a picture.

import { ZEROS } from "./zeta.js";
import {
  stage, surface, inks, motionGate, watchView, watchPage, frames, numbers, drawnBy, whenFonts, hatch, label,
  mono, crisp, ease, element,
} from "./fig-common.js";

const NAME = "mirror";
const ALT = "A vertical strip with a gold centre line at one half; the right half is hatched. A dot at one third, left of the line, is joined by a dashed arc to its mirror image at two thirds, inside the hatching. The mirror image is struck through.";
const STEPS = [
  "Suppose ζ had a zero with real part ⅓.",
  "Reflect it: ρ ↦ 1 − ρ̄ puts a twin at real part ⅔.",
  "Chapter III has already shown there is no zero to the right of ½.",
  "So the twin cannot exist, and neither can the zero at ⅓.",
  "Every zero in the strip lies on the line.",
];
const S0 = -0.14, S1 = 1.14, T0 = 0, T1 = 40;
const SUPPOSED_T = 18;
const STEP_MS = 3400, LAST_MS = 5200, TWEEN_MS = 520;

export function mount(el, ctx = {}) {
  const st = stage(el, NAME, ALT);
  const layoutBox = element("div", "fig-mirror");
  const wrap = element("div", "fig-frame");
  const aside = element("div", "fig-steps");
  const counter = element("p", "fig-step-count");
  const text = element("p", "fig-step-text");
  text.setAttribute("aria-live", "polite");
  const buttons = element("div", "fig-step-buttons");
  const back = element("button", "button", "Back");
  const next = element("button", "button", "Next");
  const play = element("button", "button fig-play", "Play");
  for (const b of [back, next, play]) b.type = "button";
  buttons.append(back, next, play);
  aside.append(counter, text, buttons);
  layoutBox.append(wrap, aside);
  counter.textContent = `Step ${STEPS.length} of ${STEPS.length}`;
  text.textContent = STEPS[STEPS.length - 1];
  el.append(layoutBox);

  const seeds = Array.from(ZEROS).filter((g) => g < T1 - 1);
  let ink = inks(el);
  let geo = null;
  let step = 5; // 1 … 5
  let tween = 1; // 0 … 1, how far the current step has arrived
  let tweenStart = 0;
  let playing = false;
  let readerStopped = false; // Back, Next or Pause was pressed: no autoplay until Play
  let inView = false;
  let stepStart = 0;

  const surf = surface(wrap, {
    label: st.alt,
    height: (w) => Math.min(460, Math.max(300, w * 0.72)),
    onResize: () => {
      layout();
      render();
    },
  });
  // Paused motion stops the autoplay and settles on the last step (the still frame); the
  // reader's own stepping is left where it is. Resumed motion resumes the autoplay only if
  // the reader had not stopped it.
  const gate = motionGate(ctx, (still) => {
    if (still) {
      const wasPlaying = playing;
      setPlaying(false);
      if (wasPlaying) show(STEPS.length, { announce: false });
      tween = 1;
      render();
    } else if (inView && !readerStopped) {
      if (step === STEPS.length) show(1);
      setPlaying(true);
    }
  });

  function layout() {
    const { width, height } = surf.size;
    const x0 = 34, x1 = width - 16, y0 = 16, y1 = height - 30;
    const sx = (s) => x0 + ((s - S0) / (S1 - S0)) * (x1 - x0);
    const ty = (t) => y1 - ((t - T0) / (T1 - T0)) * (y1 - y0);
    geo = { x0, x1, y0, y1, sx, ty };
  }

  // How visible each part is at this step (and how far the step's own entrance has come).
  function visibility() {
    const arrive = gate.still ? 1 : ease(tween);
    const at = (n) => (step > n ? 1 : step === n ? arrive : 0);
    return {
      stone: at(1),
      arc: at(2),
      twin: at(2),
      hatch: at(3),
      struck: at(4),
      line: at(5),
    };
  }

  function seed(g, x, y, scale = 1) {
    const h = 6 * scale, w = 3 * scale;
    g.beginPath();
    g.moveTo(x, y - h);
    g.quadraticCurveTo(x + w * 1.55, y, x, y + h);
    g.quadraticCurveTo(x - w * 1.55, y, x, y - h);
  }

  // A reed by the water and its reflection, the reflection broken by ripples. A picture,
  // not data: shapes are given in (σ, t) and mirrored by σ ↦ 1 − σ, the same map as ρ ↦ 1 − ρ̄.
  function reed(g, mirror, alpha) {
    const { sx, ty } = geo;
    const X = (s) => sx(mirror ? 1 - s : s);
    const move = (s, t) => g.moveTo(X(s), ty(t));
    const quad = (cs, ct, s, t) => g.quadraticCurveTo(X(cs), ty(ct), X(s), ty(t));
    g.save();
    g.strokeStyle = ink.print2;
    g.globalAlpha = alpha;
    g.lineWidth = 0.9;
    g.lineCap = "round";
    g.lineJoin = "round";
    if (mirror) g.setLineDash([7, 3, 2, 3]);
    g.beginPath();
    // the stem, leaning a little toward the water
    move(0.09, 0.3);
    g.bezierCurveTo(X(0.105), ty(12), X(0.165), ty(25), X(0.205), ty(32.4));
    // the cattail: a spindle on the stem, and its spike
    move(0.205, 32.4);
    quad(0.193, 35.4, 0.232, 37.6);
    move(0.205, 32.4);
    quad(0.24, 34.6, 0.232, 37.6);
    move(0.232, 37.6);
    quad(0.236, 38.6, 0.241, 39.4);
    // three blades
    move(0.094, 1.2);
    quad(0.03, 10, 0.022, 23);
    quad(0.056, 11, 0.1, 1.8);
    move(0.1, 2.4);
    quad(0.19, 5.4, 0.27, 12.4);
    quad(0.17, 7.8, 0.104, 3.4);
    move(0.102, 4.2);
    quad(0.128, 14, 0.158, 27.5);
    quad(0.142, 13.5, 0.108, 5);
    g.stroke();
    // fine hatching across the cattail
    g.lineWidth = 0.75;
    g.beginPath();
    for (let t = 33.2; t < 37.2; t += 0.55) {
      const centre = 0.205 + ((t - 32.4) / 5.2) * 0.027;
      move(centre - 0.008, t);
      g.lineTo(X(centre + 0.008), ty(t + 0.35));
    }
    g.stroke();
    g.restore();
  }

  function render() {
    if (!geo) return;
    ink = inks(el);
    const g = surf.begin();
    const { x0, x1, y0, y1, sx, ty } = geo;
    const { dpr } = surf.size;
    const v = visibility();
    const xh = crisp(sx(0.5), dpr, 1.1);
    const font = mono(11);

    // The half-plane right of ½, hatched once chapter III is invoked.
    if (v.hatch > 0) {
      g.save();
      g.beginPath();
      g.rect(xh + 1, ty(T1), x1 - xh - 1, ty(T0) - ty(T1));
      g.clip();
      g.strokeStyle = ink.print3;
      g.globalAlpha = 0.5 * v.hatch;
      hatch(g, xh, ty(T1), x1, ty(T0), { angle: -Math.PI / 4, spacing: 5, width: 0.75 });
      g.restore();
      label(g, "no zeros: Re s > ½", sx(0.78), ty(T1) + 14, { font, color: ink.print2, align: "center", alpha: v.hatch, halo: ink.ground });
    }

    // Water on the left: a few ripple strokes parallel to the line.
    g.save();
    g.strokeStyle = ink.print3;
    g.globalAlpha = 0.32;
    g.lineWidth = 0.75;
    g.beginPath();
    for (let i = 0; i < 14; i++) {
      const t = 3 + i * 2.6;
      const s = 0.38 + ((i * 7) % 5) * 0.018;
      g.moveTo(sx(s), ty(t));
      g.lineTo(sx(s), ty(t + 1.1));
    }
    g.stroke();
    g.restore();

    reed(g, false, 0.85);
    reed(g, true, 0.42);

    // The strip's banks, the real axis, and the waterline.
    g.save();
    g.strokeStyle = ink.print2;
    g.globalAlpha = 0.8;
    g.lineWidth = 1;
    g.beginPath();
    for (const s of [0, 1]) {
      g.moveTo(crisp(sx(s), dpr), ty(T0));
      g.lineTo(crisp(sx(s), dpr), ty(T1));
    }
    g.moveTo(x0, crisp(ty(0), dpr));
    g.lineTo(x1, crisp(ty(0), dpr));
    g.stroke();
    g.restore();
    g.save();
    g.strokeStyle = ink.gold;
    g.lineWidth = 1.1 + 0.4 * v.line;
    g.beginPath();
    g.moveTo(xh, ty(T0));
    g.lineTo(xh, ty(T1));
    g.stroke();
    g.restore();

    // The real zeros, on the line from the start; brighter at the end.
    seeds.forEach((gamma) => {
      const y = ty(gamma);
      g.save();
      g.strokeStyle = ink.print;
      g.globalAlpha = 0.55 + 0.45 * v.line;
      g.lineWidth = 0.9;
      seed(g, xh, y);
      g.stroke();
      g.fillStyle = ink.gold;
      g.beginPath();
      g.arc(xh, y, 1.2, 0, Math.PI * 2);
      g.fill();
      g.restore();
    });

    const ys = ty(SUPPOSED_T);
    const xa = sx(1 / 3), xb = sx(2 / 3);
    const fade = 1 - 0.45 * v.line;
    // The supposed zero at ⅓.
    if (v.stone > 0) {
      g.save();
      g.globalAlpha = v.stone * fade;
      g.fillStyle = ink.print;
      g.beginPath();
      g.arc(xa, ys, 3.6, 0, Math.PI * 2);
      g.fill();
      g.restore();
      label(g, "ρ = ⅓ + 18i", xa - 8, ys + 18, { font, color: ink.print, align: "center", alpha: v.stone * fade, halo: ink.ground });
      label(g, "supposed", xa - 8, ys + 32, { font, color: ink.print3, align: "center", alpha: v.stone * fade, halo: ink.ground });
    }
    // The reflection: a dashed arc over the water to the twin at ⅔.
    if (v.arc > 0) {
      const lift = (xb - xa) * 0.42;
      g.save();
      g.strokeStyle = ink.print;
      g.globalAlpha = 0.9 * fade;
      g.lineWidth = 1;
      g.setLineDash([4, 3]);
      g.beginPath();
      const n = Math.max(2, Math.round(40 * v.arc));
      for (let i = 0; i <= n; i++) {
        const u = (i / 40);
        const x = xa + (xb - xa) * u;
        const y = ys - 4 * lift * u * (1 - u);
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
      g.setLineDash([]);
      if (v.arc >= 1) {
        // the arrowhead, along the arc's last tangent, stopping short of the twin
        const dx = xb - xa, dy = 4 * lift;
        const len = Math.hypot(dx, dy);
        const ux = dx / len, uy = dy / len;
        const tx = xb - ux * 6, ty2 = ys - uy * 6;
        g.beginPath();
        g.moveTo(tx - ux * 7 - uy * 4, ty2 - uy * 7 + ux * 4);
        g.lineTo(tx, ty2);
        g.lineTo(tx - ux * 7 + uy * 4, ty2 - uy * 7 - ux * 4);
        g.stroke();
      }
      g.restore();
      // beside the arc's crest, clear of the waterline
      label(g, "ρ ↦ 1 − ρ̄", xh + 12, ys - lift - 6, { font, color: ink.print2, alpha: v.arc * fade, halo: ink.ground });
    }
    if (v.twin > 0) {
      g.save();
      g.globalAlpha = v.twin * fade;
      g.strokeStyle = ink.print;
      g.lineWidth = 1.1;
      g.beginPath();
      g.arc(xb, ys, 3.6, 0, Math.PI * 2);
      g.stroke();
      g.restore();
      label(g, "⅔ + 18i", xb + 8, ys + 18, { font, color: ink.print, align: "center", alpha: v.twin * fade, halo: ink.ground });
    }
    // Struck through.
    if (v.struck > 0) {
      g.save();
      g.strokeStyle = ink.print;
      g.lineWidth = 1.2;
      g.globalAlpha = v.struck * fade;
      const r = 8 * ease(v.struck);
      g.beginPath();
      g.moveTo(xb - r, ys - r);
      g.lineTo(xb + r, ys + r);
      g.moveTo(xb + r, ys - r);
      g.lineTo(xb - r, ys + r);
      g.moveTo(xa - r, ys - r);
      g.lineTo(xa + r, ys + r);
      g.stroke();
      g.restore();
    }

    // Scale.
    for (const [s, t] of [[0, "0"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [1, "1"]]) {
      label(g, t, sx(s), ty(0) + 16, { font, color: s === 0.5 ? ink.gold : ink.print3, align: "center" });
    }
    label(g, "σ", x1, ty(0) + 16, { font, color: ink.print3, align: "right" });
    g.save();
    g.strokeStyle = ink.print3;
    g.lineWidth = 1;
    g.beginPath();
    for (const t of [10, 20, 30]) {
      g.moveTo(x0 - 4, crisp(ty(t), dpr));
      g.lineTo(x0, crisp(ty(t), dpr));
    }
    g.moveTo(crisp(x0, dpr), ty(0));
    g.lineTo(crisp(x0, dpr), ty(T1));
    g.stroke();
    g.restore();
    for (const t of [10, 20, 30]) label(g, String(t), x0 - 7, ty(t) + 4, { font, color: ink.print3, align: "right" });
    label(g, "t", x0 - 7, y0 + 8, { font, color: ink.print3, align: "right" });
  }

  function show(n, { announce = true } = {}) {
    step = Math.max(1, Math.min(STEPS.length, n));
    counter.textContent = `Step ${step} of ${STEPS.length}`;
    if (announce) text.textContent = STEPS[step - 1];
    // aria-disabled rather than disabled, so a focused button keeps its focus at either end
    back.setAttribute("aria-disabled", String(step === 1));
    next.setAttribute("aria-disabled", String(step === STEPS.length));
    stepStart = performance.now();
    if (gate.still) {
      tween = 1;
      render();
    } else {
      tween = 0;
      tweenStart = performance.now();
      loop.start();
    }
  }

  const loop = frames((time) => {
    let busy = false;
    if (tween < 1) {
      tween = Math.min(1, (time - tweenStart) / TWEEN_MS);
      render();
      busy = tween < 1;
    }
    if (playing && inView) {
      const wait = step === STEPS.length ? LAST_MS : STEP_MS;
      if (time - stepStart >= wait) show(step === STEPS.length ? 1 : step + 1);
      busy = true;
    }
    return busy;
  });

  function setPlaying(on) {
    playing = on;
    play.textContent = on ? "Pause" : "Play";
    if (on) {
      stepStart = performance.now();
      loop.start();
    }
  }

  back.addEventListener("click", () => {
    if (step === 1) return;
    readerStopped = true;
    setPlaying(false);
    show(step - 1);
  });
  next.addEventListener("click", () => {
    if (step === STEPS.length) return;
    readerStopped = true;
    setPlaying(false);
    show(step + 1);
  });
  play.addEventListener("click", () => {
    if (playing) {
      readerStopped = true;
      setPlaying(false);
    } else {
      readerStopped = false;
      if (step === STEPS.length) show(1);
      setPlaying(true);
    }
  });

  let autoplayed = false;
  const view = watchView(el, (visible) => {
    inView = visible;
    if (visible && !autoplayed && !gate.still && !readerStopped) {
      autoplayed = true;
      show(1);
      setPlaying(true);
    } else if (visible && playing) loop.start();
  }, { threshold: 0.35 });
  const unwatchPage = watchPage((visible) => {
    if (visible && playing) loop.start();
  });
  const unfonts = whenFonts(() => render());

  drawnBy(el, st.figure, "fig-mirror.js · drawn by rule");
  surf.measure();
  layout();
  show(STEPS.length, { announce: false });
  st.paint("first");
  st.paint("ready");

  numbers(el, {
    caption: "The reflection",
    head: ["Point", "Real part", "Height t"],
    rows: [
      ["Supposed zero ρ", "⅓", String(SUPPOSED_T)],
      ["Its twin 1 − ρ̄", "⅔", String(SUPPOSED_T)],
      ["The waterline", "½", "all"],
      ["Zeros drawn on the line", "½", seeds.map((g) => g.toFixed(2)).join(", ")],
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
