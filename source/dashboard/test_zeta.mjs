// Tests for zeta.js. Reference values come from mpmath 1.3.0 (zeta, siegeltheta, siegelz) at
// 25 digits; the zeros were checked against Odlyzko's table of the first 100 zeros.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ZEROS, zeta, theta, hardyZ, primesUpTo, psiExact, psiSteps, psiFromZeros, logAbsZetaGrid, marchingSquares,
} from "./static/zeta.js";

const close = (actual, expected, tolerance, label) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} differs from ${expected} by more than ${tolerance}`);

test("ζ at classical values", () => {
  const [two, twoIm] = zeta(2);
  close(two, Math.PI ** 2 / 6, 1e-13, "ζ(2)");
  close(twoIm, 0, 1e-15, "Im ζ(2)");
  close(zeta(-1)[0], -1 / 12, 1e-13, "ζ(−1)");
  close(zeta(0.5)[0], -1.4603545088, 1e-10, "ζ(½)");
  close(zeta(0)[0], -0.5, 1e-13, "ζ(0)");
  // ζ(½ + 10i) = 1.5448952202967527… − 0.1153364652712733…i (mpmath 1.3.0, 25 digits)
  const [re, im] = zeta(0.5, 10);
  close(re, 1.5448952202967528, 1e-11, "Re ζ(½ + 10i)");
  close(im, -0.11533646527127338, 1e-11, "Im ζ(½ + 10i)");
  close(Math.hypot(...zeta(-2)), 0, 1e-12, "trivial zero ζ(−2)");
  assert.deepEqual(zeta(1, 0), [Infinity, 0]);
});

test("the table of zeros", () => {
  assert.equal(ZEROS.length, 100);
  close(ZEROS[0], 14.134725142, 1e-9, "γ₁");
  close(ZEROS[99], 236.524229666, 1e-9, "γ₁₀₀");
  for (let k = 1; k < ZEROS.length; k++) assert.ok(ZEROS[k] > ZEROS[k - 1], `zeros increase at ${k}`);
});

test("|ζ(½ + iγ)| < 1e-6 at each of the first 100 zeros", () => {
  for (let k = 0; k < 100; k++) {
    const size = Math.hypot(...zeta(0.5, ZEROS[k]));
    assert.ok(size < 1e-6, `|ζ(½ + i·${ZEROS[k]})| = ${size}`);
  }
});

test("θ(t) and Hardy's Z", () => {
  close(theta(100), 87.97216523178722, 1e-10, "θ(100)");
  close(theta(1), -1.7675479528122904, 1e-12, "θ(1)");
  close(theta(-100), -theta(100), 0, "θ is odd");
  close(hardyZ(100), 2.6926970566644637, 1e-10, "Z(100)");
  close(hardyZ(0), -1.4603545088095868, 1e-10, "Z(0) = ζ(½)");
  // e^{iθ(t)}·ζ(½ + it) is real.
  for (const t of [3, 14, 27.5, 50, 99.9, 180]) {
    const [re, im] = zeta(0.5, t);
    const phase = theta(t);
    close(Math.sin(phase) * re + Math.cos(phase) * im, 0, 1e-10, `Im e^{iθ}ζ at t = ${t}`);
  }
});

test("Z changes sign across each of the first 30 zeros", () => {
  for (let k = 0; k < 30; k++) {
    const gamma = ZEROS[k];
    const below = hardyZ(gamma - 1e-3);
    const above = hardyZ(gamma + 1e-3);
    assert.ok(below * above < 0, `no sign change at γ = ${gamma}: ${below}, ${above}`);
  }
});

test("primes and Chebyshev's ψ", () => {
  assert.deepEqual([...primesUpTo(30)], [2, 3, 5, 7, 11, 13, 17, 19, 23, 29]);
  assert.equal(primesUpTo(1).length, 0);
  assert.equal(primesUpTo(1e6).length, 78498);
  close(psiExact(100), 94.0453112293574, 1e-9, "ψ(100)");
  close(psiExact(100.9), psiExact(100), 0, "ψ is constant between prime powers");
  close(psiExact(8), Math.log(2) * 3 + Math.log(3) + Math.log(5) + Math.log(7), 1e-12, "ψ(8)");
  assert.equal(psiExact(1.5), 0);
  const { x, psi } = psiSteps(30);
  assert.deepEqual([...x], [2, 3, 4, 5, 7, 8, 9, 11, 13, 16, 17, 19, 23, 25, 27, 29]);
  close(psi.at(-1), psiExact(30), 1e-12, "staircase top");
});

test("the explicit formula with 100 pairs of zeros stays within 2 of ψ on [20, 100]", () => {
  const primePowers = psiSteps(120).x;
  let checked = 0;
  for (let x = 20; x <= 100; x += 0.05) {
    if (primePowers.some((q) => Math.abs(x - q) < 0.3)) continue;
    const difference = psiFromZeros(x, 100) - psiExact(x);
    assert.ok(Math.abs(difference) < 2, `at x = ${x.toFixed(2)} the formula is off by ${difference}`);
    checked++;
  }
  assert.ok(checked > 900, `checked ${checked} points`);
  assert.ok(Number.isNaN(psiFromZeros(1, 10)));
  // With no zeros at all only the smooth terms remain.
  close(psiFromZeros(50, 0), 50 - Math.log(2 * Math.PI) - 0.5 * Math.log(1 - 1 / 2500), 1e-12, "n = 0");
});

test("logAbsZetaGrid fills a finite grid in slices", async () => {
  const job = logAbsZetaGrid({ reMin: -0.6, reMax: 1.6, imMin: 0, imMax: 50, cols: 45, rows: 90 });
  assert.equal(job.grid.length, 45 * 90);
  const grid = await job.done;
  assert.equal(grid, job.grid);
  assert.equal(job.progress(), 1);
  for (const value of grid) assert.ok(Number.isFinite(value));
  // Corner check: row 0, col 0 is s = −0.6 + 0i.
  close(grid[0], Math.log(Math.abs(zeta(-0.6, 0)[0])), 1e-6, "grid[0]");
  // The pole lands exactly on a sample here and is clamped, not infinite.
  const pole = await logAbsZetaGrid({ reMin: 0, reMax: 2, imMin: 0, imMax: 1, cols: 3, rows: 2 }).done;
  assert.equal(pole[1], 32);
  for (const value of pole) assert.ok(Number.isFinite(value));
});

test("marchingSquares joins a circle into one closed path", () => {
  const cols = 41;
  const rows = 41;
  const grid = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r * cols + c] = Math.hypot(c - 20, r - 20);
  const paths = marchingSquares(grid, cols, rows, 10.5);
  assert.equal(paths.length, 1);
  const [ring] = paths;
  assert.equal(ring[0], ring.at(-2));
  assert.equal(ring[1], ring.at(-1));
  for (let i = 0; i < ring.length; i += 2) close(Math.hypot(ring[i] - 20, ring[i + 1] - 20), 10.5, 0.1, "radius");
  // An open contour runs from one side of the grid to the other.
  const ramp = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) ramp[r * cols + c] = c;
  const [line, ...rest] = marchingSquares(ramp, cols, rows, 7.25);
  assert.equal(rest.length, 0);
  assert.equal(line.length, 2 * rows);
  for (let i = 0; i < line.length; i += 2) close(line[i], 7.25, 1e-6, "vertical line");
});

test("the contours of log|ζ| ring the first zeros", async () => {
  // Near a zero |ζ(s)| ≈ |ζ′(ρ)|·|s − ρ|, and |ζ′(ρ)| < 2 for the first nine, so the level −1
  // is a closed ring around each of them, wider than the grid spacing.
  const cols = 111;
  const rows = 501;
  const grid = await logAbsZetaGrid({ reMin: -0.6, reMax: 1.6, imMin: 0, imMax: 50, cols, rows }).done;
  const rings = marchingSquares(grid, cols, rows, -1).filter((p) => p[0] === p.at(-2) && p[1] === p.at(-1));
  const encloses = (ring, x, y) => {
    let inside = false;
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const [xi, yi, xj, yj] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
      if (yi > y !== yj > y && x < xi + ((y - yi) * (xj - xi)) / (yj - yi)) inside = !inside;
    }
    return inside;
  };
  const column = ((0.5 + 0.6) / 2.2) * (cols - 1);
  for (const gamma of ZEROS.slice(0, 9)) {
    const row = (gamma / 50) * (rows - 1);
    assert.equal(rings.filter((ring) => encloses(ring, column, row)).length, 1, `one ring around γ = ${gamma}`);
  }
});
