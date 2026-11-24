// fig-five-flowers.js · Chapter IV: one statement read five ways.
//
// The five exported theorems of Main.lean as flowers on four stems, all rising from one
// term, allChi (no Dirichlet L-function vanishes for Re s > ½). riemannHypothesis and
// riemannZeta_eq_zero_re share a stem: both are the very same term rhOfAll. Each flower takes
// the colour of its determination for the chosen input, read only from the replay receipts
// in the feed (replay-view.js: receiptForInput, selectReplay; proof-structure.js:
// targetEvidence): gold once accepted, pencil while pending. Each flower is a link to its
// line of Main.lean at the pinned commit; focusing it shows the statement in words (its TeX,
// between dollar signs, typeset by math.js) and in Lean.

import { receiptForInput, selectReplay } from "./replay-view.js";
import { targetEvidence } from "./proof-structure.js";
import { stage, element, svgElement, numbers, drawnBy, stateInk, SOURCE_ROOT } from "./fig-common.js";
import { mathText, renderMath } from "./math.js";

const NAME = "five-flowers";
const ALT = "One stem labelled allChi divides into four: rhOfAll, allChi itself, claimAll.2.1 and critAll. rhOfAll carries two flowers; the other three carry one each, five in all. Each flower is coloured by its current receipt state.";

const TARGETS = [
  {
    id: "riemannHypothesis", label: "Riemann hypothesis", term: "rhOfAll", line: 4,
    words: "Every zero of the Riemann zeta function that is not a trivial zero ($-2, -4, -6, \\dots$) has real part $\\tfrac12$. The clause $s\\neq1$ is there because Mathlib gives $\\zeta$ a conventional value at its pole.",
    lean: "RiemannHypothesis, Mathlib’s definition: ∀ (s : ℂ), riemannZeta s = 0 → (¬∃ n : ℕ, s = -2 * (n + 1)) → s ≠ 1 → s.re = 1 / 2",
    short: "Every zero of ζ that is not a trivial zero has real part ½.",
  },
  {
    id: "riemannZeta_eq_zero_re", label: "Zeta zeros", term: "rhOfAll", line: 6,
    words: "The same assertion, written out without Mathlib’s name for it.",
    lean: "∀ s : ℂ, riemannZeta s = 0 → (¬ ∃ n : ℕ, s = -2 * ((n : ℂ) + 1)) → s ≠ 1 → s.re = 1 / 2",
    short: "The same assertion, written out without Mathlib’s name.",
  },
  {
    id: "LFunction_ne_zero_of_half_lt_re", label: "L-function nonvanishing", term: "allChi", line: 8,
    words: "For every modulus $N\\ge1$ and every Dirichlet character $\\chi\\bmod N$, primitive or not, $L(\\chi,s)$ has no zero with $\\Re s>\\tfrac12$. The only point excluded is the pole of the trivial character at $s=1$.",
    lean: "∀ (N : ℕ) [NeZero N] (χ : DirichletCharacter ℂ N) (s : ℂ), 1 / 2 < s.re → (χ ≠ 1 ∨ s ≠ 1) → DirichletCharacter.LFunction χ s ≠ 0",
    short: "No Dirichlet L-function has a zero with Re s > ½, except the pole.",
  },
  {
    id: "LFunction_eq_zero_re", label: "L-function zeros", term: "claimAll.2.1", line: 10,
    words: "Every zero of every Dirichlet L-function inside the open critical strip, $0<\\Re s<1$, lies on the line $\\Re s=\\tfrac12$.",
    lean: "∀ (N : ℕ) [NeZero N] (χ : DirichletCharacter ℂ N) (s : ℂ), 0 < s.re → s.re < 1 → DirichletCharacter.LFunction χ s = 0 → s.re = 1 / 2",
    short: "Every zero of every Dirichlet L-function in the open strip lies on Re s = ½.",
  },
  {
    id: "LFunction_eq_zero_re_of_isPrimitive", label: "Primitive L-function zeros", term: "critAll", line: 12,
    words: "The same for primitive characters: the form in which the Generalized Riemann Hypothesis for Dirichlet L-functions is usually stated.",
    lean: "∀ (N : ℕ) [NeZero N] (χ : DirichletCharacter ℂ N), χ.IsPrimitive → ∀ s : ℂ, 0 < s.re → s.re < 1 → DirichletCharacter.LFunction χ s = 0 → s.re = 1 / 2",
    short: "The same, for primitive characters.",
  },
];
const TERM_LINES = { allChi: "L7", rhOfAll: "L9", critAll: "L11-L13", "claimAll.2.1": "L15-L16" };
const TERMS_FILE = SOURCE_ROOT + "Supplements/Kernels/MainTheorems.lean#";
const INPUTS = [["local_export", "Euler’s own export"], ["reference_export", "the published export"]];

// Positions in two drawings: a wide one, and a tall one for narrow stages.
const PLANS = {
  wide: {
    box: [0, 0, 1000, 570],
    base: [500, 512], node: [500, 366],
    stems: {
      rhOfAll: { path: "M500,366 C452,336 362,304 300,238", end: [300, 238], at: [372, 322], align: "end" },
      allChi: { path: "M500,366 C507,282 495,186 503,108", end: [503, 108], at: [512, 262], align: "start" },
      "claimAll.2.1": { path: "M500,366 C560,328 652,250 686,146", end: [686, 146], at: [630, 284], align: "start" },
      critAll: { path: "M500,366 C604,346 782,290 846,190", end: [846, 190], at: [744, 330], align: "start" },
    },
    flowers: {
      riemannHypothesis: { at: [206, 128], from: [300, 238] },
      riemannZeta_eq_zero_re: { at: [360, 112], from: [300, 238] },
      LFunction_ne_zero_of_half_lt_re: { at: [503, 82], from: null },
      LFunction_eq_zero_re: { at: [686, 120], from: null },
      LFunction_eq_zero_re_of_isPrimitive: { at: [846, 164], from: null },
    },
    radius: 27,
  },
  tall: {
    box: [0, 0, 600, 900],
    base: [300, 842], node: [300, 640],
    stems: {
      rhOfAll: { path: "M300,640 C250,600 190,520 170,430", end: [170, 430], at: [212, 572], align: "end" },
      allChi: { path: "M300,640 C306,540 292,300 300,142", end: [300, 142], at: [310, 480], align: "start" },
      "claimAll.2.1": { path: "M300,640 C350,600 404,460 410,322", end: [410, 322], at: [362, 560], align: "start" },
      critAll: { path: "M300,640 C380,640 480,560 500,442", end: [500, 442], at: [432, 628], align: "start" },
    },
    flowers: {
      riemannHypothesis: { at: [100, 300], from: [170, 430] },
      riemannZeta_eq_zero_re: { at: [228, 262], from: [170, 430] },
      LFunction_ne_zero_of_half_lt_re: { at: [300, 116], from: null },
      LFunction_eq_zero_re: { at: [410, 296], from: null },
      LFunction_eq_zero_re_of_isPrimitive: { at: [500, 416], from: null, lines: ["Primitive", "L-function zeros"] },
    },
    radius: 26,
    tall: true,
  },
};

function petalPath(cx, cy, r, angle) {
  const inner = 5;
  const p = (a, d) => `${(cx + Math.cos(a) * d).toFixed(1)},${(cy + Math.sin(a) * d).toFixed(1)}`;
  return `M${p(angle, inner)} Q${p(angle - 0.5, r * 0.72)} ${p(angle, r)} Q${p(angle + 0.5, r * 0.72)} ${p(angle, inner)}Z`;
}

function flowerGroup(cx, cy, r) {
  const group = svgElement("g", { class: "fig-flower-bloom" });
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 3;
    group.append(svgElement("path", { d: petalPath(cx, cy, r, a), class: "fig-petal" }));
    const v1 = `${(cx + Math.cos(a) * 7).toFixed(1)},${(cy + Math.sin(a) * 7).toFixed(1)}`;
    const v2 = `${(cx + Math.cos(a) * r * 0.78).toFixed(1)},${(cy + Math.sin(a) * r * 0.78).toFixed(1)}`;
    group.append(svgElement("path", { d: `M${v1} L${v2}`, class: "fig-vein" }));
  }
  group.append(svgElement("circle", { cx, cy, r: 4.2, class: "fig-floret" }));
  return group;
}

function leaf(x, y, angle, length) {
  const p = (a, d) => `${(x + Math.cos(a) * d).toFixed(1)},${(y + Math.sin(a) * d).toFixed(1)}`;
  return svgElement("path", {
    d: `M${x},${y} Q${p(angle - 0.35, length * 0.6)} ${p(angle, length)} Q${p(angle + 0.35, length * 0.6)} ${x},${y}Z M${x},${y} L${p(angle, length * 0.9)}`,
    class: "fig-leaf",
  });
}

export function mount(el, ctx = {}) {
  const st = stage(el, NAME, ALT);
  // Which input the flowers show is the reader's choice for the whole page (chapter IX's
  // input buttons); the page passes it as feed.view.input. Default: Euler's own export.
  const which = element("p", "fig-note fig-flowers-input");
  which.setAttribute("aria-live", "polite");
  const holder = element("div", "fig-flowers");
  const card = element("div", "fig-card");
  el.append(which, holder, card);

  let feed = null;
  let plan = null;
  let focused = TARGETS[0].id;
  const parts = new Map(); // id → {group, link}

  const currentInput = () => (INPUTS.some(([value]) => value === feed?.view?.input) ? feed.view.input : "local_export");

  function evidenceFor(id) {
    const receipt = receiptForInput(feed?.replay, currentInput());
    const view = receipt ? selectReplay(feed?.run_id, receipt, []) : null;
    return targetEvidence(view, id);
  }

  function build() {
    const narrow = el.clientWidth < 620;
    const next = narrow ? PLANS.tall : PLANS.wide;
    if (next === plan) return;
    plan = next;
    parts.clear();
    const [bx, by, bw, bh] = plan.box;
    const svg = svgElement("svg", { viewBox: `${bx} ${by} ${bw} ${bh}`, class: "fig-flowers-svg" + (plan.tall ? " is-tall" : ""), role: "group", "aria-label": st.alt });
    // soil line and the root term
    const [x0, y0] = plan.base;
    const [nx, ny] = plan.node;
    svg.append(svgElement("path", { d: `M${x0 - 160},${y0 + 8} L${x0 + 160},${y0 + 8}`, class: "fig-soil" }));
    svg.append(svgElement("path", { d: `M${x0},${y0} C${x0 - 2},${(y0 + ny) / 2 + 30} ${x0 + 2},${(y0 + ny) / 2 - 30} ${nx},${ny}`, class: "fig-stem fig-stem-main" }));
    svg.append(svgElement("ellipse", { cx: x0, cy: y0 - 4, rx: 15, ry: 10, class: "fig-bulb" }));
    const rootLabel = svgElement("text", { x: x0, y: y0 + 32, class: "fig-term fig-term-root", "text-anchor": "middle" });
    rootLabel.textContent = "allChi : UpperTheory.EveryCharacter";
    const rootLink = svgElement("a", { href: TERMS_FILE + TERM_LINES.allChi, class: "fig-term-link" });
    rootLink.append(rootLabel);
    svg.append(rootLink);
    // leaves along the main stem, drawn by rule
    svg.append(leaf(x0 - 1, y0 - 50, Math.PI + 0.55, 46), leaf(x0 + 1, y0 - 86, -0.5, 40));

    for (const [term, stem] of Object.entries(plan.stems)) {
      svg.append(svgElement("path", { d: stem.path, class: "fig-stem" }));
      const text = svgElement("text", { x: stem.at[0], y: stem.at[1], class: "fig-term", "text-anchor": stem.align });
      text.textContent = term;
      const link = svgElement("a", { href: TERMS_FILE + TERM_LINES[term], class: "fig-term-link" });
      link.append(text);
      svg.append(link);
    }
    for (const target of TARGETS) {
      const spot = plan.flowers[target.id];
      const [cx, cy] = spot.at;
      if (spot.from) svg.append(svgElement("path", { d: `M${spot.from[0]},${spot.from[1]} Q${(spot.from[0] + cx) / 2 + (cx < spot.from[0] ? -14 : 14)},${(spot.from[1] + cy) / 2} ${cx},${cy + plan.radius - 4}`, class: "fig-stem" }));
      const link = svgElement("a", { href: `${SOURCE_ROOT}Main.lean#L${target.line}`, class: "fig-flower-link" });
      const group = svgElement("g", { class: "fig-flower", "data-key": target.id });
      group.append(svgElement("circle", { cx, cy, r: plan.radius + 9, class: "fig-flower-focus" }));
      group.append(flowerGroup(cx, cy, plan.radius));
      // words above the bloom, where no stem arrives (two lines where one would cross a stem)
      const lines = spot.lines || [target.label];
      const lead = plan.tall ? 23 : 20;
      const name = svgElement("text", { x: cx, y: cy - plan.radius - 12 - (lines.length - 1) * lead, class: "fig-flower-label", "text-anchor": "middle" });
      lines.forEach((line, i) => {
        const span = svgElement("tspan", { x: cx, dy: i ? lead : 0 });
        span.textContent = line;
        name.append(span);
      });
      group.append(name);
      link.append(group);
      link.addEventListener("focus", () => select(target.id));
      link.addEventListener("pointerenter", () => select(target.id));
      svg.append(link);
      parts.set(target.id, { group, link });
    }
    holder.replaceChildren(svg);
    paintStates();
  }

  function paintStates() {
    const chosen = INPUTS.find(([value]) => value === currentInput())[1];
    const text = `Determination for ${chosen}`;
    if (which.textContent !== text) which.textContent = text;
    const rows = [];
    for (const target of TARGETS) {
      const evidence = evidenceFor(target.id);
      const part = parts.get(target.id);
      const tone = stateInk(evidence.state);
      if (part) {
        part.group.dataset.state = tone === "pending" && evidence.state === "Outside scope" ? "outside" : tone;
        part.link.setAttribute("aria-label",
          `${target.label}: ${target.id}, Main.lean line ${target.line}. Proof term ${target.term}. Determination for ${chosen}: ${evidence.state}.`);
      }
      rows.push([target.id, target.term === "rhOfAll" && target.line === 6 ? "rhOfAll (same term)" : target.term, `line ${target.line}`, target.short, evidence.state]);
    }
    numbers(el, {
      caption: "The five exported theorems",
      head: ["Theorem", "Proof term", "Main.lean", "Plain words", `Determination (${chosen})`],
      rows,
    });
    select(focused, true);
  }

  function select(id, force = false) {
    if (id === focused && !force && card.childElementCount) return;
    focused = id;
    const target = TARGETS.find((t) => t.id === id);
    const evidence = evidenceFor(id);
    const tone = stateInk(evidence.state);
    for (const [key, part] of parts) part.group.classList.toggle("is-selected", key === id);
    const head = element("p", "fig-card-head");
    const state = element("span", "fig-state", evidence.state);
    state.dataset.state = tone;
    head.append(element("strong", null, target.label), " · ", element("code", null, target.id), " · ", state);
    const words = element("p", "fig-card-words");
    words.append(mathText(target.words));
    const lean = element("pre", "lean fig-card-lean");
    lean.append(element("code", null, target.lean));
    const meta = element("p", "fig-card-meta");
    const termLink = element("a", null, target.term);
    termLink.href = TERMS_FILE + TERM_LINES[target.term];
    const lineLink = element("a", null, `Main.lean, line ${target.line}`);
    lineLink.href = `${SOURCE_ROOT}Main.lean#L${target.line}`;
    meta.append("Proof term: ", termLink, " · ", lineLink, " · ",
      evidence.gates.map(([gate, value]) => `${gate}: ${value}`).join(" · "));
    card.replaceChildren(head, words, lean, meta);
    renderMath(card).catch((error) => console.error("five-flowers: mathematics", error));
  }

  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => build()) : null;
  observer?.observe(el);

  drawnBy(el, st.figure, "fig-five-flowers.js · targetEvidence(), receiptForInput()");
  feed = ctx.getFeed?.() || null;
  build();
  st.paint("first");
  st.paint("ready");

  return {
    update(next) {
      feed = next || feed;
      paintStates();
    },
    destroy() {
      observer?.disconnect();
      st.restore();
    },
  };
}
