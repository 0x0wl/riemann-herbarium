// fig-margin-specimen.js · a small specimen in the margin of each chapter, printed in Lean.
//
// The page's signature device (design §1): a plant drawn procedurally in white on black,
// then printed by glyphprint.js as a field of glyphs whose lit cells read, in order, a real
// excerpt of the proof's source. From a little way off it is a fern or a horsetail; up close
// it is Lean. The mount is
//
//   <div class="margin-specimen" data-figure="margin-specimen" data-kind="KIND" data-text="KEY"
//        aria-hidden="true"><div class="figure-stage"></div></div>
//
// KIND ∈ fern, horsetail, reed, seedhead, root, frond-pair (drawings by rule);
// KEY picks the excerpt below. Every excerpt is copied verbatim from the pinned source
// archive (lean.tar.gz, SHA-256 9631b4f0…c7fc, the tree of Deicyde/riemann-hypothesis at
// a172c464) or from Euler's challenge file; only runs of white space are folded for printing.
// With motion allowed and the stage on screen a few cells a second flicker to other Lean
// tokens; otherwise the print is still. The print is rebuilt only when the stage resizes.

import { glyphPrint, prepareGlyphPrint, frond } from "./glyphprint.js";
import { rng } from "./seed.js";
import { stage, surface, inks, motionGate, watchView, watchPage, frames } from "./fig-common.js";

const NAME = "margin-specimen";

const STATEMENTS = // src/Statements.lean, lines 3–16 (a172c464; 766 bytes)
  "def RiemannZetaZerosOnLine : Prop :=\n  ∀ s : ℂ, riemannZeta s = 0 → (¬∃ n : ℕ, s = -2 * ((n : ℂ) + 1)) → s ≠ 1 → s.re = 1 / 2\n\ndef DirichletLNonvanishingRightOfHalf : Prop :=\n  ∀ (N : ℕ) [NeZero N] (χ : DirichletCharacter ℂ N) (s : ℂ),\n    1 / 2 < s.re → (χ ≠ 1 ∨ s ≠ 1) → DirichletCharacter.LFunction χ s ≠ 0\n\ndef DirichletLZerosOnLine : Prop :=\n  ∀ (N : ℕ) [NeZero N] (χ : DirichletCharacter ℂ N) (s : ℂ),\n    0 < s.re → s.re < 1 → DirichletCharacter.LFunction χ s = 0 → s.re = 1 / 2\n\ndef PrimitiveDirichletLZerosOnLine : Prop :=\n  ∀ (N : ℕ) [NeZero N] (χ : DirichletCharacter ℂ N), χ.IsPrimitive →\n    ∀ s : ℂ, 0 < s.re → s.re < 1 → DirichletCharacter.LFunction χ s = 0 → s.re = 1 / 2";

const GZ = // src/Formalism/StatementOC.lean, lines 11–13 (a172c464; 169 bytes)
  "def Sz (x : ℝ) : ℝ := ∑ n ∈ Finset.Icc 1 ⌊x⌋₊, Λ n * (x / n - 1)\n\ndef Gz (x : ℝ) : ℝ := Sz x - x * Real.log x + (1 + Real.eulerMascheroniConstant) * x";

const WINDOW = // src/Formalism/SharpRestriction/RamificationFrobenius/TotientGaloisClasses/Window.lean, lines 7–31 (a172c464; 1,175 bytes)
  "def HasWindows (S : Set ℝ) (la : ℝ) : Prop :=\n  ∀ y : ℝ, ∃ Y : ℝ, y ≤ Y ∧ ∀ x : ℝ, Y ≤ x → x ≤ Y ^ la → x ∈ S\n\ntheorem HasWindows.mono {S S' : Set ℝ} {la x0 : ℝ} (h : HasWindows S la) (hS : ∀ x ≥ x0, x ∈ S → x ∈ S') :\n    HasWindows S' la := by\n  intro y\n  obtain ⟨Y, hyY, hY⟩ := h (max y x0)\n  exact ⟨Y, (le_max_left _ _).trans hyY,\n    fun x h1 h2 => hS x ((le_max_right _ _).trans (hyY.trans h1)) (hY x h1 h2)⟩\n\ntheorem hasWindows_of_large {S : Set ℝ} {x0 : ℝ} (h : ∀ x ≥ x0, x ∈ S) (la : ℝ) : HasWindows S la :=\n  fun y => ⟨max y x0, le_max_left _ _, fun x h1 _ => h x ((le_max_right _ _).trans h1)⟩\n\nnamespace Level\n\nvariable (Λ : Level)\n\ndef LandauWinAt (la : ℝ) : Prop :=\n  ∀ θ : ℝ, 0 < θ → θ < 1 → (∃ ψ ∈ Λ.KEPT, ∃ s : ℂ, θ < s.re ∧ DirichletCharacter.LFunction ψ.χ s = 0) →\n    ∃ Y0 : ℝ, ∀ Y ≥ Y0, ∃ y : ℝ, Y ≤ y ∧ y ≤ Y ^ la ∧ y ^ θ < Λ.Gm y\n\ndef LandauWin : Prop := ∀ la : ℝ, 1 < la → Λ.LandauWinAt la\n\ndef FormBAt (la : ℝ) : Prop :=\n  ∀ θ : ℝ, 0 < θ → θ < 1 → HasWindows {x | Λ.Gm x ≤ x ^ θ} la → Λ.ZeroFreeAbove θ";

const RH_OF_RIGHT = // src/Formalism/GammaFactorNonvanishing/RhOfRight.lean, lines 5–33 of the proof at 5–62 (a172c464; 1,241 bytes)
  "theorem Formalism.VW.rh_of_right (hz : ∀ s : ℂ, 1 / 2 < s.re → s ≠ 1 → riemannZeta s ≠ 0) : RiemannHypothesis := by\n  unfold RiemannHypothesis\n  intro s hs htriv hs1\n  rcases lt_trichotomy s.re (1 / 2) with hlt | heq | hgt\n  · exfalso\n    have hpi : (Real.pi : ℂ) ≠ 0 := by exact_mod_cast Real.pi_ne_zero\n    have hs0 : s ≠ 0 := by\n      rintro rfl\n      rw [riemannZeta_zero] at hs\n      norm_num at hs\n    have ht : 1 / 2 < (1 - s).re := by\n      rw [Complex.sub_re, Complex.one_re]\n      linarith\n    have h1 : (1 - s) ≠ 1 := by\n      intro h\n      apply hs0\n      linear_combination -h\n    have hnat : ∀ n : ℕ, (1 - s) ≠ -(n : ℂ) := by\n      intro n h\n      have hr := congrArg Complex.re h\n      rw [Complex.sub_re, Complex.one_re, Complex.neg_re, Complex.natCast_re] at hr\n      have : (0 : ℝ) ≤ n := n.cast_nonneg\n      linarith\n    have key := riemannZeta_one_sub hnat h1\n    rw [sub_sub_cancel, hs] at key\n    have hz' := hz (1 - s) ht h1\n    have h2pi : (2 : ℂ) * (2 * (Real.pi : ℂ)) ^ (-(1 - s)) ≠ 0 :=\n      mul_ne_zero two_ne_zero (Complex.cpow_ne_zero_iff.2 (Or.inl (mul_ne_zero two_ne_zero hpi)))\n    have hG : Complex.Gamma (1 - s) ≠ 0 := Complex.Gamma_ne_zero_of_re_pos (by linarith)";

const MAIN_THEOREMS = // src/Supplements/Kernels/MainTheorems.lean, lines 7–16 (a172c464; 517 bytes)
  "theorem allChi : UpperTheory.EveryCharacter := UpperTheory.FinalTheorems.everyCharacter\n\ntheorem rhOfAll : RiemannHypothesis := Formalism.VW.rh_of_every allChi\n\ntheorem critAll (N : ℕ) [NeZero N] (χ : DirichletCharacter ℂ N) (hχ : χ.IsPrimitive) (s : ℂ)\n    (h0 : 0 < s.re) (h1 : s.re < 1) (hz : LFunction χ s = 0) : s.re = 1 / 2 :=\n  Formalism.VW.critLine allChi N χ hχ s h0 h1 hz\n\ntheorem claimAll : Claim.HalfPlane ∧ Claim.Strip ∧ Claim.Zeta :=\n  ⟨allChi, Claim.strip allChi, Claim.zeta allChi⟩";

const MAIN = // src/Main.lean, the whole file, lines 1–12 (a172c464; 432 bytes)
  "import Statements\nimport Supplements.Kernels.MainTheoremsAll\n\ntheorem riemannHypothesis : RiemannHypothesis := rhOfAll\n\ntheorem riemannZeta_eq_zero_re : RiemannZetaZerosOnLine := rhOfAll\n\ntheorem LFunction_ne_zero_of_half_lt_re : DirichletLNonvanishingRightOfHalf := allChi\n\ntheorem LFunction_eq_zero_re : DirichletLZerosOnLine := claimAll.2.1\n\ntheorem LFunction_eq_zero_re_of_isPrimitive : PrimitiveDirichletLZerosOnLine := critAll";

const BUILD = // src/Main.lean, lines 1–2, then lakefile.toml, lines 1–16 (a172c464; 586 bytes)
  "import Statements\nimport Supplements.Kernels.MainTheoremsAll\n\nname = \"tree\"\nsrcDir = \"src\"\ndefaultTargets = [\"BuildAid\", \"CompanionTheory\", \"Development\", \"Formalism\", \"GroundTheory\", \"GroundTheoryFields\", \"Lemmata\", \"PositivityTheory\", \"ReciprocityTheory\", \"Supplements\", \"Main\"]\nmoreLeanArgs = [\"--tstack=400000\"]\n\n[leanOptions]\nautoImplicit = false\nrelaxedAutoImplicit = false\nmaxSynthPendingDepth = 3\npp.unicode.fun = true\nmaxHeartbeats = 4000000\n\n[[require]]\nname = \"mathlib\"\ngit = \"https://github.com/leanprover-community/mathlib4\"\nrev = \"0df444a360eaa60ab8c11dca51a86af692955474\"";

const CHALLENGE = // Challenge.lean, the whole file, lines 1–24: Euler's independent challenge, SHA-256 031f4f2c…3e32, the same bytes as verification/Challenge.lean at a172c464 (1,309 bytes)
  "import Mathlib\n\ndef RiemannZetaZerosOnLine : Prop :=\n  ∀ s : ℂ, riemannZeta s = 0 → (¬∃ n : ℕ, s = -2 * ((n : ℂ) + 1)) → s ≠ 1 → s.re = 1 / 2\n\ndef DirichletLNonvanishingRightOfHalf : Prop :=\n  ∀ (N : ℕ) [NeZero N] (χ : DirichletCharacter ℂ N) (s : ℂ),\n    1 / 2 < s.re → (χ ≠ 1 ∨ s ≠ 1) → DirichletCharacter.LFunction χ s ≠ 0\n\ndef DirichletLZerosOnLine : Prop :=\n  ∀ (N : ℕ) [NeZero N] (χ : DirichletCharacter ℂ N) (s : ℂ),\n    0 < s.re → s.re < 1 → DirichletCharacter.LFunction χ s = 0 → s.re = 1 / 2\n\ndef PrimitiveDirichletLZerosOnLine : Prop :=\n  ∀ (N : ℕ) [NeZero N] (χ : DirichletCharacter ℂ N), χ.IsPrimitive →\n    ∀ s : ℂ, 0 < s.re → s.re < 1 → DirichletCharacter.LFunction χ s = 0 → s.re = 1 / 2\n\n-- Comparator obtains only the expected statements and their definitions here.\n-- The five proofs it judges come from the separately built submission.\ntheorem riemannHypothesis : _root_.RiemannHypothesis := by sorry\ntheorem riemannZeta_eq_zero_re : RiemannZetaZerosOnLine := by sorry\ntheorem LFunction_ne_zero_of_half_lt_re : DirichletLNonvanishingRightOfHalf := by sorry\ntheorem LFunction_eq_zero_re : DirichletLZerosOnLine := by sorry\ntheorem LFunction_eq_zero_re_of_isPrimitive : PrimitiveDirichletLZerosOnLine := by sorry";

// The chapter keys of index.html and the excerpt each one prints.
export const EXCERPTS = Object.freeze({
  primes: STATEMENTS,
  music: GZ,
  window: WINDOW,
  mirror: RH_OF_RIGHT,
  roots: MAIN_THEOREMS,
  forest: MAIN,
  compiler: BUILD,
  export: STATEMENTS,
  replay: CHALLENGE,
  settled: MAIN,
});

const CELL = 8; // CSS px per glyph
const SCALE = 2; // drawing pixels per CSS px, for an even sampling of each cell
const FLICKER = 0.006; // share of dense cells showing another token at a time: a few a second
const TAU = Math.PI * 2;

// ── Drawings by rule (white on black; transparent is black) ──────────────────────────────

// A filled, tapering blade from (x, y) along a quadratic curve to its tip.
function blade(g, x, y, cx, cy, tx, ty, width) {
  const nx = -(ty - y), ny = tx - x;
  const n = Math.hypot(nx, ny) || 1;
  const ox = (nx / n) * width, oy = (ny / n) * width;
  g.beginPath();
  g.moveTo(x + ox * 0.35, y + oy * 0.35);
  g.quadraticCurveTo(cx + ox, cy + oy, tx, ty);
  g.quadraticCurveTo(cx - ox, cy - oy, x - ox * 0.35, y - oy * 0.35);
  g.closePath();
  g.fill();
}

function stem(g, points, width) {
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(points[0], points[1]);
  if (points.length === 8) g.bezierCurveTo(points[2], points[3], points[4], points[5], points[6], points[7]);
  else g.quadraticCurveTo(points[2], points[3], points[4], points[5]);
  g.stroke();
}

// frond() is proportioned for a metre-long print; in a margin its pinnae are about a cell
// wide and would print as strokes only. Laying the drawing down nine times, a third of a
// cell apart, widens every pinna (a dilation), so their interiors read the source.
function thickened(g, w, h, paint) {
  const layer = document.createElement("canvas");
  layer.width = w;
  layer.height = h;
  paint(layer.getContext("2d"));
  const r = CELL * SCALE * 0.34;
  for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [0.7 * r, 0.7 * r], [-0.7 * r, 0.7 * r], [0.7 * r, -0.7 * r], [-0.7 * r, -0.7 * r]]) {
    g.drawImage(layer, dx, dy);
  }
}

const DRAW = {
  fern(g, w, h, seed) {
    thickened(g, w, h, (f) => frond(f, w * 0.56, h * 0.99, h * 0.96, -Math.PI / 2 - 0.1, seed));
  },

  "frond-pair"(g, w, h, seed) {
    thickened(g, w, h, (f) => {
      frond(f, w * 0.44, h * 0.995, h * 0.9, -Math.PI / 2 - 0.24, seed + "-left");
      frond(f, w * 0.58, h * 0.995, h * 0.74, -Math.PI / 2 + 0.3, seed + "-right");
    });
  },

  // Equisetum: a jointed stem, whorls of fine branches at each joint, a cone on top.
  horsetail(g, w, h, seed) {
    const random = rng(seed);
    const cell = CELL * SCALE;
    const x0 = w * 0.5, top = h * 0.12, bottom = h * 0.995;
    const xAt = (y) => x0 + Math.sin((bottom - y) / h * 2.2) * w * 0.035;
    stem(g, [xAt(bottom), bottom, xAt((bottom + top) / 2), (bottom + top) / 2, xAt(top), top], cell * 1.5);
    const nodes = 9;
    for (let i = 1; i < nodes; i++) {
      const y = bottom - ((bottom - top) * i) / nodes;
      const reach = w * (0.44 - 0.32 * (i / nodes)) * (0.85 + 0.25 * random());
      for (let j = 0; j < 7; j++) {
        for (const side of [-1, 1]) {
          const f = j / 6;
          const length = reach * (0.45 + 0.55 * Math.sin(f * Math.PI)) * (0.8 + 0.3 * random());
          const lift = -0.15 - 0.55 * f + (random() - 0.5) * 0.12;
          const tx = xAt(y) + side * length * Math.cos(lift), ty = y + length * Math.sin(lift) + length * 0.18;
          blade(g, xAt(y), y, xAt(y) + side * length * 0.55, y - length * 0.12 * f, tx, ty, cell * 0.42);
        }
      }
    }
    // the joints, as dark bands across the stem
    g.save();
    g.globalCompositeOperation = "destination-out";
    g.lineWidth = cell * 0.28;
    for (let i = 1; i <= nodes; i++) {
      const y = bottom - ((bottom - top) * i) / nodes + cell * 0.5;
      g.beginPath();
      g.moveTo(xAt(y) - cell, y);
      g.lineTo(xAt(y) + cell, y);
      g.stroke();
    }
    g.restore();
    // the cone (strobilus)
    g.beginPath();
    g.ellipse(xAt(top), top - cell * 2.2, cell * 1.35, cell * 3.2, 0, 0, TAU);
    g.fill();
  },

  // A reed with its cattail and three long blades.
  reed(g, w, h, seed) {
    const random = rng(seed);
    const cell = CELL * SCALE;
    const bx = w * 0.46, by = h * 0.995;
    stem(g, [bx, by, w * 0.5, h * 0.55, w * 0.56, h * 0.24, w * 0.585, h * 0.1], cell * 0.9);
    g.beginPath();
    g.ellipse(w * 0.575, h * 0.24, cell * 1.6, cell * 6.5, 0.12, 0, TAU);
    g.fill();
    blade(g, bx, by, w * 0.08, h * 0.62, w * 0.12, h * 0.16 + random() * h * 0.05, cell * 2.6);
    blade(g, bx, by, w * 0.92, h * 0.66, w * 0.95, h * 0.3 + random() * h * 0.05, cell * 2.4);
    blade(g, bx, by, w * 0.34, h * 0.48, w * 0.3, h * 0.05, cell * 1.9);
    blade(g, bx, by, w * 0.7, h * 0.82, w * 0.98, h * 0.7, cell * 1.6);
  },

  // A composite head: florets on the golden angle (a packing layout), a ring of rays, a stem.
  seedhead(g, w, h, seed) {
    const random = rng(seed);
    const cell = CELL * SCALE;
    const cx = w * 0.5, cy = h * 0.3, R = w * 0.33;
    stem(g, [cx + w * 0.02, h * 0.995, cx - w * 0.08, h * 0.7, cx, cy + R * 0.9], cell * 1.1);
    blade(g, cx - w * 0.03, h * 0.78, w * 0.12, h * 0.68, w * 0.06, h * 0.56, cell * 2.2);
    blade(g, cx - w * 0.04, h * 0.66, w * 0.82, h * 0.6, w * 0.9, h * 0.47, cell * 2);
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU + random() * 0.08;
      const r0 = R * 0.96, r1 = R * (1.42 + random() * 0.12);
      blade(g, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a + 0.05) * (r0 + r1) / 2, cy + Math.sin(a + 0.05) * (r0 + r1) / 2,
        cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cell * 0.75);
    }
    const golden = Math.PI * (3 - Math.sqrt(5));
    const count = 340;
    for (let i = 0; i < count; i++) {
      const r = R * Math.sqrt((i + 0.5) / count);
      const a = i * golden;
      g.beginPath();
      g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, R * 0.052, 0, TAU);
      g.fill();
    }
  },

  // A seedling above the ground and a root system many times its size beneath.
  root(g, w, h, seed) {
    const random = rng(seed);
    const cell = CELL * SCALE;
    const ground = h * 0.2, x0 = w * 0.5;
    stem(g, [x0, ground, x0 - w * 0.01, ground - h * 0.07, x0, ground - h * 0.12], cell * 0.8);
    blade(g, x0, ground - h * 0.1, w * 0.3, ground - h * 0.2, w * 0.2, ground - h * 0.1, cell * 1.9);
    blade(g, x0, ground - h * 0.11, w * 0.72, ground - h * 0.21, w * 0.82, ground - h * 0.12, cell * 1.8);
    g.fillRect(w * 0.04, ground, w * 0.92, cell * 0.35);
    const grow = (x, y, angle, length, width, depth) => {
      const bend = (random() - 0.5) * 0.7;
      const tx = x + Math.cos(angle) * length, ty = y + Math.sin(angle) * length;
      const cxp = x + Math.cos(angle + bend) * length * 0.5, cyp = y + Math.sin(angle + bend) * length * 0.5;
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(cxp, cyp, tx, ty);
      g.stroke();
      if (depth <= 0 || width < cell * 0.3) return;
      const branches = 2 + Math.floor(random() * 2);
      for (let i = 0; i < branches; i++) {
        const f = 0.3 + 0.6 * random();
        const bx = x + (tx - x) * f, by = y + (ty - y) * f;
        const side = random() < 0.5 ? -1 : 1;
        grow(bx, by, angle + side * (0.5 + random() * 0.6), length * (0.5 + random() * 0.25), width * 0.62, depth - 1);
      }
      grow(tx, ty, angle + (random() - 0.5) * 0.35, length * 0.62, width * 0.75, depth - 1);
    };
    grow(x0, ground + cell * 0.3, Math.PI / 2, h * 0.3, cell * 1.6, 4);
  },
};

export function mount(el, ctx = {}) {
  const st = stage(el, NAME, "");
  const holder = el.closest("[data-figure]") || el;
  const kind = DRAW[holder.dataset.kind] ? holder.dataset.kind : "fern";
  const key = Object.hasOwn(EXCERPTS, holder.dataset.text || "") ? holder.dataset.text : "forest";
  // Runs of white space fold to one (printed as a faint ·), so the source reads on.
  const text = EXCERPTS[key].replace(/\s+/g, " ");
  const fill = el.getBoundingClientRect().height > 24;

  let plate = null;
  let ink = inks(el);
  let alive = true;
  let inView = false;
  let ready = false;
  let start = performance.now();

  const surf = surface(el, {
    fill,
    height: (w) => Math.round(w * (340 / 260)),
    onResize: () => build(),
  });
  const gate = motionGate(ctx, () => {
    build();
    sync();
  });

  function build() {
    if (!alive || !ready) return;
    const { width, height, dpr } = surf.size;
    if (width < CELL * 4 || height < CELL * 4) return;
    ink = inks(el);
    const source = document.createElement("canvas");
    source.width = Math.round(width * SCALE);
    source.height = Math.round(height * SCALE);
    const sg = source.getContext("2d", { willReadFrequently: true });
    sg.fillStyle = "#fff";
    sg.strokeStyle = "#fff";
    sg.lineCap = "round";
    sg.lineJoin = "round";
    DRAW[kind](sg, source.width, source.height, `margin-${kind}-${key}`);
    const g = surf.begin();
    plate = glyphPrint(g, source, {
      cell: CELL, color: ink.print, dim: ink.print3, text, textOffset: 0, seed: `margin-${key}`,
      flicker: gate.still ? 0 : FLICKER, width, height, pixelRatio: dpr,
    });
    st.paint("ready");
  }

  const loop = frames((time) => {
    if (!plate || gate.still || !inView) return false;
    surf.g.setTransform(surf.size.dpr, 0, 0, surf.size.dpr, 0, 0);
    plate.update(surf.g, (time - start) / 1000);
    return true;
  }, 8);

  function sync() {
    if (!gate.still && inView && plate && !document.hidden) loop.start();
    else loop.stop();
  }

  const view = watchView(el, (visible) => {
    inView = visible;
    sync();
  });
  const unwatchPage = watchPage(() => sync());

  surf.measure();
  st.paint("first");
  prepareGlyphPrint({ text, cell: CELL, color: ink.print, dim: ink.print3, pixelRatio: surf.size.dpr })
    .catch(() => {})
    .then(() => {
      if (!alive) return;
      ready = true;
      start = performance.now();
      build();
      sync();
    });

  return {
    update() {},
    destroy() {
      alive = false;
      loop.stop();
      gate.destroy();
      view.destroy();
      unwatchPage();
      surf.destroy();
      st.restore();
    },
  };
}
