// fig-root-depth.js · Chapter V: where the weight lives.
//
// Two literal measures under one ground line.
//
// Left, the whole closure as a plant: the 37 modules within four imports of Main stand above
// ground (Main the flower; 2, 2, 7 and 25 modules at distances 1–4), and the other 175,150
// hang below as roots, one ring per import distance 5 … 43 (library-imports.js,
// depth_layers). Each ring's spread is proportional to its module count (widest at distance
// 10, 15,539 modules); one strand stands for about 50 modules. Ring spacing, strands and
// stem are drawn by rule.
//
// Right, the tap roots, drawn to scale in modules: the longest import chain beneath each named
// module (from the pinned source; math-story §1.4). RhOfRight, the reflection for ζ, imports
// only Mathlib, so its chain is one module long, just under the surface; MainConclusion, where
// the half-plane theorem is assembled, stands on 199; the longest chain ending at Main is 203.

import { libraryImports } from "./library-imports.js";
import {
  stage, surface, inks, numbers, drawnBy, whenFonts, label, mono, crisp, element, grouped,
} from "./fig-common.js";

const NAME = "root-depth";
const ALT = "A small flowering stem above a ground line, and beneath it a root system many times its height. Labels: RhOfRight, depth 1, just under the surface; MainConclusion, 199, deep below; the deepest root, 203.";

// Longest import chain beneath each module, in modules (pinned source, recomputed from the
// archive in the research run). Sorted long to short: drawn left to right.
const CHAINS = [
  { module: "MainConclusion", full: "Development.AutomorphicArithmetic.CharacterBoxes.MainConclusion", distance: 4, chain: 199, note: "holds everyCharacter" },
  { module: "CritLine", full: "Formalism.GammaFactorNonvanishing.CritLine", distance: 4, chain: 91 },
  { module: "ZeroFreeOfRpowWindow", full: "Development.AutomorphicArithmetic.DedekindLFunctions.LandauTheorems.ZeroFreeOfRpowWindow", distance: 9, chain: 7, note: "the window criterion" },
  { module: "ClaimStrip", full: "Development.AutomorphicArithmetic.CharacterBoxes.ClaimStrip", distance: 4, chain: 2 },
  { module: "RhOfRight", full: "Formalism.GammaFactorNonvanishing.RhOfRight", distance: 5, chain: 1, note: "reflection for ζ; imports only Mathlib" },
];
const STEM = [
  ["Main", 0, 203],
  ["Supplements.Kernels.MainTheoremsAll", 1, 202],
  ["Supplements.Kernels.MainTheoremsCritical", 2, 201],
  ["Supplements.Kernels.MainTheorems", 3, 200],
];
const LONGEST = 203;
const MODULES_PER_STRAND = 50;
const GROUND_AFTER = 4; // distances 0–4 stand above ground

// A small deterministic generator, so the strands are the same on every visit.
function generator(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mount(el, ctx = {}) {
  const st = stage(el, NAME, ALT);
  const layers = libraryImports.depth_layers || [];
  const counts = layers.map((layer) => layer.total);
  const widest = counts.reduce((best, n, d) => (n > counts[best] ? d : best), 0);
  const maxDepth = layers.length - 1;

  const controls = element("div", "fig-controls");
  const sliderLabel = element("label", "fig-control");
  const slider = element("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = String(maxDepth);
  slider.step = "1";
  slider.value = String(widest);
  sliderLabel.append(element("span", "fig-control-name", "Import distance from Main"), slider);
  const readout = element("p", "fig-readout fig-ring-readout");
  readout.setAttribute("aria-live", "polite");
  controls.append(sliderLabel, readout);
  const wrap = element("div", "fig-frame");
  el.append(wrap, controls);

  let ink = inks(el);
  let geo = null;
  let strands = null;
  let ring = widest;

  const surf = surface(wrap, {
    label: st.alt,
    height: (w) => (w >= 720 ? Math.min(700, Math.max(500, w * 0.6)) : Math.min(1000, Math.max(860, w * 2.3))),
    onResize: () => {
      layout();
      render();
    },
  });

  function layout() {
    const { width, height } = surf.size;
    const wide = width >= 720;
    const top = 18, bottom = height - 26;
    if (wide) {
      const split = Math.round(width * 0.6);
      const groundY = Math.round(top + (bottom - top) * 0.25);
      geo = {
        wide,
        mass: { x0: 56, x1: split - 20, groundY, y1: bottom, top },
        rods: { x0: split + 24, x1: width - 16, groundY, y1: bottom, top },
      };
    } else {
      const massBottom = Math.round(height * 0.6);
      const groundY = Math.round(top + (massBottom - top) * 0.26);
      const rodsGround = massBottom + 58;
      geo = {
        wide,
        mass: { x0: 40, x1: width - 12, groundY, y1: massBottom, top },
        rods: { x0: 18, x1: width - 12, groundY: rodsGround, y1: bottom, top: massBottom + 30 },
      };
    }
    strands = null;
  }

  // y of ring d (d > 4) in the root mass; rings evenly spaced from the ground down.
  const ringY = (d) => {
    const { groundY, y1 } = geo.mass;
    return groundY + ((d - GROUND_AFTER - 0.5) / (maxDepth - GROUND_AFTER)) * (y1 - groundY - 6);
  };
  const halfWidth = (d) => (counts[d] / counts[widest]) * ((geo.mass.x1 - geo.mass.x0) / 2 - 4);

  // Strands from ring to ring: each strand of ring d picks a parent in ring d − 1 at the same
  // relative place; where the rings thin out below the widest, strands end as root tips.
  function buildStrands() {
    const random = generator(0x5eed);
    const cx = (geo.mass.x0 + geo.mass.x1) / 2;
    const rings = [];
    for (let d = GROUND_AFTER + 1; d <= maxDepth; d++) {
      const n = Math.max(1, Math.round(counts[d] / MODULES_PER_STRAND));
      const hw = halfWidth(d);
      const y = ringY(d);
      const xs = [];
      for (let j = 0; j < n; j++) {
        const f = n === 1 ? 0.5 : (j + 0.5) / n;
        xs.push(cx + (f * 2 - 1) * hw + (random() - 0.5) * Math.min(10, (2 * hw) / n));
      }
      rings.push({ d, y, xs });
    }
    const segments = [];
    let previous = { y: geo.mass.groundY, xs: [cx] };
    for (const current of rings) {
      const m = previous.xs.length;
      current.xs.forEach((x, j) => {
        const f = current.xs.length === 1 ? 0.5 : j / (current.xs.length - 1);
        const parent = previous.xs[Math.min(m - 1, Math.round(f * (m - 1)))];
        const bend = (random() - 0.5) * 8;
        segments.push([parent, previous.y, x + bend, (previous.y + current.y) / 2, x, current.y, current.d]);
      });
      previous = current;
    }
    strands = segments;
  }

  function drawPlant(g) {
    const { x0, x1, groundY, top } = geo.mass;
    const { dpr } = surf.size;
    const cx = (x0 + x1) / 2;
    const height = groundY - top - 10;
    const nodeY = (d) => groundY - (height * (GROUND_AFTER - d + 0.15)) / (GROUND_AFTER + 0.4);
    const font = mono(11);

    // the ground, with soil hatching just beneath
    g.save();
    g.strokeStyle = ink.print2;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x0 - 30, crisp(groundY, dpr));
    g.lineTo(x1, crisp(groundY, dpr));
    g.stroke();
    g.strokeStyle = ink.print3;
    g.globalAlpha = 0.45;
    g.lineWidth = 0.75;
    g.beginPath();
    for (let x = x0 - 26; x < x1; x += 7) {
      g.moveTo(x, groundY + 2);
      g.lineTo(x - 4, groundY + 7);
    }
    g.stroke();
    g.restore();

    // the stem, Main at the top
    g.save();
    g.strokeStyle = ink.print;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(cx, groundY);
    g.bezierCurveTo(cx - 3, groundY - height * 0.4, cx + 3, groundY - height * 0.7, cx, nodeY(0) + 12);
    g.stroke();
    // leaves, one per module at distances 1–4 (2, 2, 7 and 25): opposite pairs on the stem,
    // a whorl of seven, and a rosette of twenty-five blades at the ground
    const blade = (bx, by, angle, length, width) => {
      const tx = bx + Math.cos(angle) * length, ty = by + Math.sin(angle) * length;
      const mx = bx + Math.cos(angle) * length * 0.5, my = by + Math.sin(angle) * length * 0.5;
      const nx = -Math.sin(angle) * width, ny = Math.cos(angle) * width;
      g.moveTo(bx, by);
      g.quadraticCurveTo(mx + nx, my + ny, tx, ty);
      g.quadraticCurveTo(mx - nx, my - ny, bx, by);
    };
    g.lineWidth = 0.9;
    g.beginPath();
    for (let d = 1; d <= GROUND_AFTER; d++) {
      const n = counts[d] || 0;
      const y = nodeY(d);
      for (let j = 0; j < n; j++) {
        const f = n === 1 ? 0.5 : j / (n - 1);
        if (d === GROUND_AFTER) {
          const angle = -Math.PI + 0.22 + f * (Math.PI - 0.44);
          blade(cx, groundY - 1, angle, 9 + 6 * Math.sin(f * Math.PI) + (j % 3) * 1.5, 1.6);
        } else if (n === 2) {
          blade(cx, y, -Math.PI / 2 + (j ? 1.05 : -1.05), 15 + d * 2, 3.6);
        } else {
          blade(cx, y, -Math.PI / 2 - 1.25 + f * 2.5, 12, 2.8);
        }
      }
    }
    g.stroke();
    // the flower: Main
    const fy = nodeY(0);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 2;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * 7, fy + Math.sin(a) * 7, 6.5, 3.2, a, 0, Math.PI * 2);
      g.lineWidth = 0.9;
      g.stroke();
    }
    g.fillStyle = ink.print;
    g.beginPath();
    g.arc(cx, fy, 2, 0, Math.PI * 2);
    g.fill();
    g.restore();

    label(g, "Main", cx + 18, fy + 4, { font, color: ink.print });
    label(g, `${counts.slice(1, GROUND_AFTER + 1).reduce((a, b) => a + b, 0) + 1} modules above ground`, x0 - 30, top + 8, { font, color: ink.print3, baseline: "top" });
    label(g, "Mathlib, the soil", x1, groundY - 6, { font, color: ink.print3, align: "right" });
  }

  function drawMass(g) {
    const { x0, x1, groundY, y1 } = geo.mass;
    const { dpr } = surf.size;
    if (!strands) buildStrands();
    g.save();
    g.strokeStyle = ink.print;
    g.lineWidth = 0.75;
    g.globalAlpha = 0.28;
    g.lineCap = "round";
    g.beginPath();
    for (const [ax, ay, bx, by, cx, cy] of strands) {
      g.moveTo(ax, ay);
      g.quadraticCurveTo(bx, by, cx, cy);
    }
    g.stroke();
    g.restore();

    // the selected ring
    if (ring > GROUND_AFTER) {
      const y = crisp(ringY(ring), dpr);
      const hw = halfWidth(ring);
      const cx = (x0 + x1) / 2;
      g.save();
      g.strokeStyle = ink.print;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx - hw - 6, y);
      g.lineTo(cx + hw + 6, y);
      g.stroke();
      g.restore();
    }

    // scale of import distance
    const font = mono(11);
    g.save();
    g.strokeStyle = ink.print3;
    g.lineWidth = 1;
    g.beginPath();
    const ax = crisp(x0 - 22, dpr);
    g.moveTo(ax, groundY);
    g.lineTo(ax, y1);
    const ticks = [5, 10, 20, 30, maxDepth];
    for (const d of ticks) {
      g.moveTo(ax - 4, crisp(ringY(d), dpr));
      g.lineTo(ax, crisp(ringY(d), dpr));
    }
    g.stroke();
    g.restore();
    for (const d of ticks) label(g, String(d), ax - 7, ringY(d) + 4, { font, color: ink.print3, align: "right" });
    const cx = (x0 + x1) / 2;
    // words for the widest ring and for the selected one, at the ring's right end
    const ringWords = (d, text, color) => label(g, text, cx + Math.max(halfWidth(d), 40), ringY(d) - 7,
      { font, color, align: "right", halo: ink.ground });
    ringWords(widest, `distance ${widest} · ${grouped(counts[widest])} modules, the widest ring`, ink.print2);
    if (ring > GROUND_AFTER && ring !== widest) ringWords(ring, `distance ${ring} · ${grouped(counts[ring])} modules`, ink.print);
    label(g, `${maxDepth} · ${counts[maxDepth]}`, cx + 12, ringY(maxDepth) + 4, { font, color: ink.print3 });
    label(g, "import distance from Main", ax + 6, y1 + 16, { font, color: ink.print3, alpha: 1 });
  }

  function drawRods(g) {
    const { x0, x1, groundY, y1, top } = geo.rods;
    const { dpr } = surf.size;
    const font = mono(11);
    // room under the deepest tip for its two lines of words
    const Y = (n) => groundY + (n / LONGEST) * (y1 - groundY - 40);
    // rods spread over the panel, leaving room on the right for the last root's words
    const step = (x1 - x0 - 118) / (CHAINS.length - 1);

    if (!geo.wide) {
      g.save();
      g.strokeStyle = ink.print2;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x0, crisp(groundY, dpr));
      g.lineTo(x1, crisp(groundY, dpr));
      g.stroke();
      g.restore();
    }
    label(g, "longest import chain beneath, in modules", x0, top + 4, { font, color: ink.print3, baseline: "top" });

    // scale
    g.save();
    g.strokeStyle = ink.print3;
    g.lineWidth = 1;
    g.beginPath();
    const sx = crisp(x1, dpr);
    g.moveTo(sx, groundY);
    g.lineTo(sx, Y(LONGEST));
    for (const n of [0, 50, 100, 150, 200]) {
      g.moveTo(sx, crisp(Y(n), dpr));
      g.lineTo(sx - 4, crisp(Y(n), dpr));
    }
    g.stroke();
    g.restore();
    for (const n of [50, 100, 150, 200]) label(g, String(n), x1 - 7, Y(n) + 4, { font, color: ink.print3, align: "right" });

    // Long roots are labelled at their tips. The short ones end just under the surface, so
    // their words step down in rows, the rightmost root on the top row: each label then runs
    // to the right beneath the ends of the shorter roots' leaders. A dotted leader joins tip
    // and words.
    const short = CHAINS.map((root, i) => (root.chain < 20 ? i : -1)).filter((i) => i >= 0);
    CHAINS.forEach((root, i) => {
      const x = crisp(x0 + 6 + step * i, dpr);
      const tip = Y(root.chain);
      g.save();
      g.strokeStyle = ink.print;
      g.lineWidth = root.chain > 50 ? 1.25 : 1;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(x, groundY);
      g.bezierCurveTo(x - 3, groundY + (tip - groundY) * 0.35, x + 3, groundY + (tip - groundY) * 0.7, x, tip);
      g.stroke();
      g.fillStyle = ink.print;
      g.beginPath();
      g.arc(x, tip, 1.8, 0, Math.PI * 2);
      g.fill();
      g.restore();
      const words = `${root.module} · ${root.chain}`;
      if (root.chain >= 20) {
        label(g, words, x + 7, tip + 4, { font, color: ink.print });
        if (i === 0) {
          label(g, `+ 4 above ground = ${LONGEST},`, x + 7, tip + 20, { font, color: ink.print2 });
          label(g, "the longest chain to Main", x + 7, tip + 35, { font, color: ink.print2 });
        }
        return;
      }
      const row = short.filter((j) => j > i).length;
      const ly = Math.max(tip, groundY) + 22 + row * 26;
      g.save();
      g.strokeStyle = ink.print3;
      g.lineWidth = 0.75;
      g.setLineDash([1.5, 2.5]);
      g.beginPath();
      g.moveTo(x, tip + 3);
      g.lineTo(x, ly - 4);
      g.stroke();
      g.restore();
      label(g, words, x + 4, ly + 4, { font, color: ink.print });
    });
  }

  function render() {
    if (!geo) return;
    ink = inks(el);
    const g = surf.begin();
    drawMass(g);
    drawPlant(g);
    drawRods(g);
  }

  function describe() {
    const layer = layers[ring];
    const names = Object.entries(layer?.by_namespace || {}).sort((a, b) => b[1] - a[1]);
    const where = ring === 0 ? "Main itself" : ring <= GROUND_AFTER ? "above ground" : "below ground";
    readout.textContent = `Distance ${ring} (${where}): ${grouped(layer?.total || 0)} modules · ` +
      names.slice(0, 3).map(([name, n]) => `${name} ${grouped(n)}`).join(" · ") + (names.length > 3 ? ` · ${names.length - 3} more names` : "");
    slider.setAttribute("aria-valuetext", `distance ${ring}, ${grouped(layer?.total || 0)} modules`);
  }

  slider.addEventListener("input", () => {
    ring = Number(slider.value);
    describe();
    render();
  });
  const unfonts = whenFonts(() => render());

  drawnBy(el, st.figure, "fig-root-depth.js · library-imports.js depth_layers");
  describe();
  surf.measure();
  layout();
  render();
  st.paint("first");
  st.paint("ready");

  numbers(el, [
    {
      caption: "Import distance and the longest chain beneath, for the modules named here",
      head: ["Module", "Import distance from Main", "Longest chain beneath it (modules)"],
      numeric: [1, 2],
      rows: [
        ...STEM.map(([name, d, chain]) => [name, String(d), String(chain)]),
        ...CHAINS.map((root) => [root.full + (root.note ? ` (${root.note})` : ""), String(root.distance), String(root.chain)]),
        ["Development.AutomorphicArithmetic.DedekindLFunctions.CharFamily (the prime sum’s definitions)", "11", "1 (imports only Mathlib)"],
      ],
    },
    {
      caption: "Every module by its import distance from Main (the rings)",
      head: ["Distance", "Modules", "Largest names"],
      numeric: [0, 1],
      rows: layers.map((layer) => [
        String(layer.depth),
        grouped(layer.total),
        Object.entries(layer.by_namespace).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n} ${grouped(c)}`).join(", "),
      ]),
    },
    {
      caption: "The reading project’s tiers (status 20 Nov 2026, 6:51 p.m. EST)",
      head: ["Tier", "Landmarks"],
      numeric: [1],
      rows: [
        ["checked by two kernels", "5"],
        ["kernel-checked at the pin", "18"],
        ["inside a checked closure", "19"],
        ["source-read", "65"],
        ["motivation", "2"],
        ["total", "109"],
        ["In Lean, the chain length of RankVal (source)", "between √(xδ₁) and 2√(xδ₁)"],
      ],
    },
  ]);

  return {
    update() {},
    destroy() {
      unfonts();
      surf.destroy();
      st.restore();
    },
  };
}
