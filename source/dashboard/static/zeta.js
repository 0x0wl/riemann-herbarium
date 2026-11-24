// zeta.js · the Riemann zeta function, its zeros and the primes, computed in your browser.
//
// Every figure on the herbarium marked "computed" is drawn from this file. It has no
// dependencies, and each function says how it works and how far it can be trusted.
//
//   ZEROS                  heights γ of the first 100 zeros ½ + iγ
//   zeta(σ, t)             ζ(σ + it) as [re, im]
//   theta(t), hardyZ(t)    the Riemann–Siegel θ, and Hardy's Z: ζ on the critical line, made real
//   primesUpTo(n)          the primes ≤ n
//   psiExact(x)            Chebyshev's ψ(x), counted from the primes
//   psiSteps(xMax)         where ψ jumps, for drawing its staircase
//   psiFromZeros(x, n)     ψ(x) rebuilt from the first n pairs of zeros
//   logAbsZetaGrid(opts)   log|ζ| over a rectangle, computed in slices of at most 8 ms
//   marchingSquares(...)   contour lines of a grid, joined into paths

const TWO_PI = 2 * Math.PI;
const LOG_PI = Math.log(Math.PI);
const LOG_2PI = Math.log(TWO_PI);

// Heights γ of the first 100 nontrivial zeros ½ + iγ of ζ, rounded to 9 decimals.
// Computed with mpmath 1.3.0 (zetazero, 30 digits) and checked against Andrew Odlyzko's
// table of the first 100 zeros to 1,000 digits ("zeros2"): before rounding the two agree
// to within 5·10⁻²³. Rounding moves each value by at most 5·10⁻¹⁰.
export const ZEROS = new Float64Array([
   14.134725142,  21.022039639,  25.010857580,  30.424876126,  32.935061588,
   37.586178159,  40.918719012,  43.327073281,  48.005150881,  49.773832478,
   52.970321478,  56.446247697,  59.347044003,  60.831778525,  65.112544048,
   67.079810529,  69.546401711,  72.067157674,  75.704690699,  77.144840069,
   79.337375020,  82.910380854,  84.735492981,  87.425274613,  88.809111208,
   92.491899271,  94.651344041,  95.870634228,  98.831194218, 101.317851006,
  103.725538040, 105.446623052, 107.168611184, 111.029535543, 111.874659177,
  114.320220915, 116.226680321, 118.790782866, 121.370125002, 122.946829294,
  124.256818554, 127.516683880, 129.578704200, 131.087688531, 133.497737203,
  134.756509753, 138.116042055, 139.736208952, 141.123707404, 143.111845808,
  146.000982487, 147.422765343, 150.053520421, 150.925257612, 153.024693811,
  156.112909294, 157.597591818, 158.849988171, 161.188964138, 163.030709687,
  165.537069188, 167.184439978, 169.094515416, 169.911976479, 173.411536520,
  174.754191523, 176.441434298, 178.377407776, 179.916484020, 182.207078484,
  184.874467848, 185.598783678, 187.228922584, 189.416158656, 192.026656361,
  193.079726604, 195.265396680, 196.876481841, 198.015309676, 201.264751944,
  202.493594514, 204.189671803, 205.394697202, 207.906258888, 209.576509717,
  211.690862595, 213.347919360, 214.547044783, 216.169538508, 219.067596349,
  220.714918839, 221.430705555, 224.007000255, 224.983324670, 227.421444280,
  229.337413306, 231.250188700, 231.987235253, 233.693404179, 236.524229666,
]);

// Bernoulli numbers B₂, B₄, …, B₂₆ as exact fractions [numerator, denominator].
const BERNOULLI = [
  [1, 6], [-1, 30], [1, 42], [-1, 30], [5, 66], [-691, 2730], [7, 6],
  [-3617, 510], [43867, 798], [-174611, 330], [854513, 138], [-236364091, 2730],
  [8553103, 6],
];

// ── ζ(s) by Euler–Maclaurin summation ──────────────────────────────────────────────────
//
// For s = σ + it ≠ 1 and any whole number N ≥ 1,
//
//   ζ(s) = Σ_{n<N} n^−s + N^(1−s)/(s − 1) + ½·N^−s + Σ_{j=1..M} T_j + R_M,
//   T_j  = B_2j/(2j)! · s(s+1)⋯(s+2j−2) · N^(1−s−2j),
//
// and the remainder is never larger than the first term left out, times a modest factor
// (H. M. Edwards, Riemann's Zeta Function, 1974, §6.4):
//
//   |R_M| ≤ |s + 2M + 1| / (σ + 2M + 1) · |T_(M+1)|        whenever σ > −(2M + 1).
//
// We keep M = 12 Bernoulli terms (B₂ … B₂₄) and take the smallest N for which that bound
// is below 10⁻¹² × max(1, (1 + |t|/2π)^(½−σ)), the second factor being roughly how large ζ
// grows left of the critical line. On the line that gives N = 24 at t = 50, N = 46 at
// t = 100 and N = 109 at the hundredth zero. (The classical rule of thumb N ≈ |t|/2π + 12
// is cheaper, but by the same bound it is good only to 2·10⁻⁷ at t = 100 and to 4·10⁻⁴ at
// t = 236.) The formula holds in the whole plane, so no reflection is needed for
// −4 ≤ σ ≤ 6, and N stays small near the real axis, where a long sum of the large terms
// n^−σ (σ < 0) would cancel badly.
//
// Accuracy, measured against mpmath 1.3.0 (30 digits) at 3,080 points with −4 ≤ σ ≤ 6
// and |t| ≤ 240, 1,403 of them in the critical strip: the error is at most
// 1.1·10⁻¹² × max(1, |ζ(s)|) wherever σ ≥ −1, and 7.2·10⁻¹² × max(1, |ζ(s)|) for σ < −1,
// where |ζ| reaches 10⁶ and rounding in the phases t·log n is what limits it.

const TERMS = 12;
const TOLERANCE = 1e-12;
const factorial = (n) => (n < 2 ? 1 : n * factorial(n - 1));
// B_2j/(2j)! for j = 1 … 13; the last is the first term left out, used only in the bound.
const EM_COEFFICIENTS = BERNOULLI.map(([p, q], k) => p / q / factorial(2 * k + 2));
const LOG_FIRST_OMITTED = Math.log(Math.abs(EM_COEFFICIENTS[TERMS]));
const LOG_TOLERANCE = Math.log(TOLERANCE);

// The smallest N for which the Euler–Maclaurin remainder bound meets the tolerance.
// |s(s+1)⋯(s+2M)| is bounded through Jensen's inequality: the mean of log|s+k|² over
// k = 0 … 2M is at most the log of the mean of |s+k|², which is t² + (σ+M)² + M(M+1)/3.
function summationLength(sigma, t) {
  const m = TERMS, reach = sigma + 2 * m + 1;
  const logProduct = (m + 0.5) * Math.log(t * t + (sigma + m) ** 2 + (m * (m + 1)) / 3);
  const logFactor = Math.log(Math.hypot(reach, t) / reach);
  const logSize = Math.max(0, 0.5 - sigma) * Math.log1p(Math.abs(t) / TWO_PI);
  const logN = (LOG_FIRST_OMITTED + logProduct + logFactor - LOG_TOLERANCE - logSize) / reach;
  return Math.max(2, Math.ceil(Math.exp(logN)));
}

// Tables for n = 1 … size − 1: log n, the least prime factor of n, and scratch space for n^−s.
let tableSize = 0;
let logOf = new Float64Array(0);
let leastPrimeFactor = new Uint32Array(0);
let powerRe = new Float64Array(0);
let powerIm = new Float64Array(0);

function ensureTables(n) {
  if (n < tableSize) return;
  const size = Math.max(n + 1, 2 * tableSize, 256);
  logOf = new Float64Array(size);
  leastPrimeFactor = new Uint32Array(size);
  for (let k = 2; k < size; k++) {
    logOf[k] = Math.log(k);
    if (leastPrimeFactor[k] === 0) {
      for (let multiple = k; multiple < size; multiple += k) {
        if (leastPrimeFactor[multiple] === 0) leastPrimeFactor[multiple] = k;
      }
    }
  }
  powerRe = new Float64Array(size);
  powerIm = new Float64Array(size);
  tableSize = size;
}

// ζ(σ + it), written into out = [re, im]. The grid below calls this without allocating.
function zetaInto(out, sigma, t) {
  if (sigma === 1 && t === 0) {
    out[0] = Infinity;
    out[1] = 0;
    return out;
  }
  const N = summationLength(sigma, t);
  ensureTables(N);

  // n^−s for n = 1 … N, assembled from the primes: a prime costs a logarithm, an
  // exponential and a cosine and sine, p^−s = p^−σ·(cos(t log p) − i·sin(t log p));
  // every other n is a product, (p·m)^−s = p^−s · m^−s.
  powerRe[1] = 1;
  powerIm[1] = 0;
  for (let n = 2; n <= N; n++) {
    const p = leastPrimeFactor[n];
    if (p === n) {
      const size = Math.exp(-sigma * logOf[n]);
      const angle = t * logOf[n];
      powerRe[n] = size * Math.cos(angle);
      powerIm[n] = -size * Math.sin(angle);
    } else {
      const m = (n / p) | 0;
      powerRe[n] = powerRe[p] * powerRe[m] - powerIm[p] * powerIm[m];
      powerIm[n] = powerRe[p] * powerIm[m] + powerIm[p] * powerRe[m];
    }
  }

  // Σ_{n<N} n^−s, smallest terms first.
  let re = 0;
  let im = 0;
  for (let n = N - 1; n >= 1; n--) {
    re += powerRe[n];
    im += powerIm[n];
  }

  // N^(1−s)/(s − 1) + ½·N^−s, with w = N^−s.
  const wRe = powerRe[N];
  const wIm = powerIm[N];
  const dRe = sigma - 1;
  const dIm = t;
  const dd = dRe * dRe + dIm * dIm;
  re += (N * (wRe * dRe + wIm * dIm)) / dd + 0.5 * wRe;
  im += (N * (wIm * dRe - wRe * dIm)) / dd + 0.5 * wIm;

  // Σ_j B_2j/(2j)! · u_j, where u_j = s(s+1)⋯(s+2j−2) · N^(1−s−2j):
  // u_1 = s·N^−s / N, and u_(j+1) = u_j · (s + 2j − 1)(s + 2j) / N².
  let uRe = (sigma * wRe - t * wIm) / N;
  let uIm = (sigma * wIm + t * wRe) / N;
  const inverseN2 = 1 / (N * N);
  for (let j = 1; j <= TERMS; j++) {
    const c = EM_COEFFICIENTS[j - 1];
    re += c * uRe;
    im += c * uIm;
    const a = sigma + 2 * j - 1;
    const b = sigma + 2 * j;
    const fRe = (a * b - t * t) * inverseN2;
    const fIm = t * (a + b) * inverseN2;
    const nextRe = uRe * fRe - uIm * fIm;
    uIm = uRe * fIm + uIm * fRe;
    uRe = nextRe;
  }

  out[0] = re;
  out[1] = im;
  return out;
}

// ζ(s) for s = re + i·im, as [re, im]. Designed for −4 ≤ re ≤ 6 and |im| ≤ 200, where it is
// good to 10⁻¹¹ × max(1, |ζ|) (see above); it still works further out, only more slowly.
// At the pole s = 1 it returns [Infinity, 0].
export function zeta(re, im = 0) {
  return zetaInto([0, 0], re, im);
}

// ── θ and Z ───────────────────────────────────────────────────────────────────────────
//
// θ(t) = Im log Γ(¼ + it/2) − (t/2)·log π, the phase that makes ζ real on the critical line.
// log Γ comes from Stirling's series after shifting the argument 8 to the right,
//
//   log Γ(z) = log Γ(z + 8) − Σ_{k<8} log(z + k),
//   log Γ(w) ≈ (w − ½) log w − w + ½ log 2π + Σ_{j=1..8} B_2j / (2j(2j−1)·w^(2j−1)),
//
// so the series is evaluated where |w| > 8 and is truncated with an error below 10⁻¹⁶;
// against mpmath, θ is good to 6·10⁻¹⁴ for |t| ≤ 240. This holds for every real t, small
// ones included (θ is odd). θ(100) = 87.9721652317872…

const STIRLING_COEFFICIENTS = BERNOULLI.slice(0, 8).map(([p, q], k) => p / q / ((2 * k + 2) * (2 * k + 1)));
const GAMMA_SHIFT = 8;

function imaginaryLogGamma(x, y) {
  let shift = 0;
  for (let k = 0; k < GAMMA_SHIFT; k++) shift += Math.atan2(y, x + k);
  const u = x + GAMMA_SHIFT;
  const r2 = u * u + y * y;
  const phase = Math.atan2(y, u);
  let value = (u - 0.5) * phase + y * 0.5 * Math.log(r2) - y;
  for (let j = 1; j <= STIRLING_COEFFICIENTS.length; j++) {
    value += STIRLING_COEFFICIENTS[j - 1] * Math.pow(r2, 0.5 - j) * Math.sin((1 - 2 * j) * phase);
  }
  return value - shift;
}

export function theta(t) {
  if (t < 0) return -theta(-t);
  return imaginaryLogGamma(0.25, t / 2) - (t / 2) * LOG_PI;
}

// Hardy's Z(t) = e^(iθ(t))·ζ(½ + it): real, with |Z(t)| = |ζ(½ + it)|, and it changes
// sign at every zero on the critical line.
const scratch = [0, 0];
export function hardyZ(t) {
  zetaInto(scratch, 0.5, t);
  const phase = theta(t);
  return Math.cos(phase) * scratch[0] - Math.sin(phase) * scratch[1];
}

// ── The primes and Chebyshev's ψ ──────────────────────────────────────────────────────

// The primes ≤ n, by the sieve of Eratosthenes.
export function primesUpTo(n) {
  const limit = Math.floor(n);
  if (!(limit >= 2)) return new Uint32Array(0);
  const composite = new Uint8Array(limit + 1);
  let count = 0;
  for (let p = 2; p <= limit; p++) {
    if (composite[p]) continue;
    count++;
    for (let multiple = p * p; multiple <= limit; multiple += p) composite[multiple] = 1;
  }
  const primes = new Uint32Array(count);
  for (let p = 2, k = 0; p <= limit; p++) if (!composite[p]) primes[k++] = p;
  return primes;
}

// The staircase of ψ up to xMax: ψ jumps by log p at every prime power p^k, and
// psi[i] is its value from x[i] (inclusive) until the next step.
export function psiSteps(xMax) {
  const limit = Math.floor(xMax);
  if (!(limit >= 2)) return { x: new Float64Array(0), psi: new Float64Array(0) };
  const jump = new Float64Array(limit + 1);
  for (const p of primesUpTo(limit)) {
    const logP = Math.log(p);
    for (let power = p; power <= limit; power *= p) jump[power] = logP;
  }
  let count = 0;
  for (let q = 2; q <= limit; q++) if (jump[q] > 0) count++;
  const x = new Float64Array(count);
  const psi = new Float64Array(count);
  let total = 0;
  for (let q = 2, k = 0; q <= limit; q++) {
    if (jump[q] > 0) {
      total += jump[q];
      x[k] = q;
      psi[k] = total;
      k++;
    }
  }
  return { x, psi };
}

// Chebyshev's ψ(x) = Σ_{p^k ≤ x} log p, exactly (right-continuous: at a prime power the
// jump is included). The staircase is sieved once and kept; meant for x ≤ 10⁶.
let staircase = { limit: 0, x: new Float64Array(0), psi: new Float64Array(0) };

export function psiExact(x) {
  if (!(x >= 2)) return 0;
  if (staircase.limit < x) {
    const limit = Math.max(Math.floor(x), 2 * staircase.limit, 1024);
    staircase = { limit, ...psiSteps(limit) };
  }
  const steps = staircase.x;
  let low = 0;
  let high = steps.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (steps[middle] <= x) low = middle + 1;
    else high = middle;
  }
  return low === 0 ? 0 : staircase.psi[low - 1];
}

// Riemann's explicit formula, truncated to the first n pairs of zeros ρ = ½ ± iγ:
//
//   ψ(x) = x − Σ_ρ x^ρ/ρ − log 2π − ½·log(1 − x⁻²)          (x > 1)
//
// x is the main term, each pair of zeros adds one wave, 2·Re(x^ρ/ρ) =
// 2√x·(½·cos(γ log x) + γ·sin(γ log x)) / (¼ + γ²), and the last term gathers the trivial
// zeros −2, −4, … . At prime powers the full sum converges to the midpoint of the jump.
// With n = 100 it stays within 1.5 of ψ on [20, 100] at least 0.3 away from a prime power.
// Returns NaN for x ≤ 1, where the formula does not apply.
export function psiFromZeros(x, n = ZEROS.length) {
  if (!(x > 1)) return NaN;
  const pairs = Math.max(0, Math.min(ZEROS.length, Math.floor(n)));
  const logX = Math.log(x);
  let waves = 0;
  for (let k = 0; k < pairs; k++) {
    const gamma = ZEROS[k];
    const angle = gamma * logX;
    waves += (0.5 * Math.cos(angle) + gamma * Math.sin(angle)) / (0.25 + gamma * gamma);
  }
  return x - 2 * Math.sqrt(x) * waves - LOG_2PI - 0.5 * Math.log(1 - 1 / (x * x));
}

// ── log|ζ| on a grid, without freezing the page ───────────────────────────────────────
//
// grid[row * cols + col] = log|ζ(σ + it)| at σ = reMin + col·(reMax − reMin)/(cols − 1)
// and t = imMin + row·(imMax − imMin)/(rows − 1): row 0 is the lowest t, so on a plate
// whose t axis points up, row 0 is drawn at the bottom. Values are clamped to [−32, 32]
// so the grid stays finite at the pole s = 1 and on the zeros themselves.
//
// The work runs on the main thread in slices of at most `sliceMs` (8 ms; the clock is read
// every 8 samples, a few tens of microseconds apart), yielding to the page in between
// (scheduler.yield where the browser has it, else setTimeout). The grid fills row by row
// from the bottom: progress() is the fraction done, and done resolves with the grid.
// cancel() stops it; done then resolves with what was computed so far. The frontispiece's
// 300 × 600 grid took about 50 ms of computing in all, in Chromium on the workstation Euler.

const LOG_ABS_LIMIT = 32;

const now = () => (globalThis.performance ? globalThis.performance.now() : Date.now());

function yieldToPage() {
  const scheduler = globalThis.scheduler;
  if (scheduler && typeof scheduler.yield === "function") return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function logAbsZetaGrid({
  reMin = -0.6, reMax = 1.6, imMin = 0, imMax = 50, cols = 300, rows = 600, sliceMs = 8,
} = {}) {
  if (!(Number.isInteger(cols) && cols > 0 && Number.isInteger(rows) && rows > 0)) {
    throw new RangeError("logAbsZetaGrid: cols and rows must be positive integers");
  }
  const grid = new Float32Array(cols * rows);
  const total = grid.length;
  const reStep = cols > 1 ? (reMax - reMin) / (cols - 1) : 0;
  const imStep = rows > 1 ? (imMax - imMin) / (rows - 1) : 0;
  const value = [0, 0];
  let next = 0;
  let cancelled = false;

  const done = (async () => {
    while (next < total && !cancelled) {
      const sliceEnd = now() + sliceMs;
      do {
        const row = (next / cols) | 0;
        const col = next - row * cols;
        zetaInto(value, reMin + col * reStep, imMin + row * imStep);
        const logAbs = Math.log(Math.hypot(value[0], value[1]));
        grid[next] = logAbs > LOG_ABS_LIMIT ? LOG_ABS_LIMIT : logAbs >= -LOG_ABS_LIMIT ? logAbs : -LOG_ABS_LIMIT;
        next++;
      } while (next < total && ((next & 7) !== 0 || now() < sliceEnd));
      if (next < total) await yieldToPage();
    }
    return grid;
  })();

  return {
    grid,
    done,
    progress: () => next / total,
    cancel() {
      cancelled = true;
    },
  };
}

// ── Contours ──────────────────────────────────────────────────────────────────────────
//
// Marching squares: every cell of four neighbouring samples that has corners on both sides
// of `level` gets one segment (two at a saddle, split the way the cell's mean value says),
// with its ends placed on the cell's edges by linear interpolation. Segments that share an
// edge are joined into paths. Each path is a Float32Array [x0, y0, x1, y1, …] in grid units
// (x = column, y = row, fractional); a closed path repeats its first point at the end.
// Samples above `level` are those with value > level.

let edgeOwners = new Int32Array(0); // two slots per grid edge: the segments that end on it

export function marchingSquares(grid, cols, rows, level) {
  const edgeCount = 2 * cols * rows;
  if (edgeOwners.length < 2 * edgeCount) edgeOwners = new Int32Array(2 * edgeCount).fill(-1);
  const ends = []; // segment k runs between edges ends[2k] and ends[2k + 1]

  const attach = (edge, k) => {
    if (edgeOwners[2 * edge] < 0) edgeOwners[2 * edge] = k;
    else edgeOwners[2 * edge + 1] = k;
  };
  const segment = (a, b) => {
    const k = ends.length >> 1;
    ends.push(a, b);
    attach(a, k);
    attach(b, k);
  };

  // Edge numbering: the edge running right from sample i is 2i, the one running up is 2i + 1.
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const i = row * cols + col;
      const v0 = grid[i];
      const v1 = grid[i + 1];
      const v2 = grid[i + cols + 1];
      const v3 = grid[i + cols];
      const corners = (v0 > level ? 1 : 0) | (v1 > level ? 2 : 0) | (v2 > level ? 4 : 0) | (v3 > level ? 8 : 0);
      if (corners === 0 || corners === 15) continue;
      const south = 2 * i;
      const north = 2 * (i + cols);
      const west = 2 * i + 1;
      const east = 2 * (i + 1) + 1;
      switch (corners) {
        case 1: case 14: segment(west, south); break;
        case 2: case 13: segment(south, east); break;
        case 3: case 12: segment(west, east); break;
        case 4: case 11: segment(east, north); break;
        case 6: case 9: segment(south, north); break;
        case 7: case 8: segment(west, north); break;
        default: {
          // A saddle (5 or 10): two opposite corners above, two below.
          const centreAbove = (v0 + v1 + v2 + v3) / 4 > level;
          if ((corners === 5) === centreAbove) {
            segment(south, east);
            segment(west, north);
          } else {
            segment(west, south);
            segment(east, north);
          }
        }
      }
    }
  }

  const segments = ends.length >> 1;
  const used = new Uint8Array(segments);
  const neighbour = (edge, k) => {
    const first = edgeOwners[2 * edge];
    return first === k ? edgeOwners[2 * edge + 1] : first;
  };
  // Follow the chain out of segment k through `edge`; returns the edges passed, in order.
  const walk = (edge, k) => {
    const passed = [];
    for (;;) {
      const next = neighbour(edge, k);
      if (next < 0 || used[next]) return passed;
      used[next] = 1;
      edge = ends[2 * next] === edge ? ends[2 * next + 1] : ends[2 * next];
      passed.push(edge);
      k = next;
    }
  };
  const crossing = (edge, out, at) => {
    const i = edge >> 1;
    const row = (i / cols) | 0;
    const col = i - row * cols;
    const j = edge & 1 ? i + cols : i + 1;
    const f = (level - grid[i]) / (grid[j] - grid[i]);
    out[at] = edge & 1 ? col : col + f;
    out[at + 1] = edge & 1 ? row + f : row;
  };

  const paths = [];
  for (let k = 0; k < segments; k++) {
    if (used[k]) continue;
    used[k] = 1;
    const forward = walk(ends[2 * k + 1], k);
    const backward = walk(ends[2 * k], k).reverse();
    const edges = [...backward, ends[2 * k], ends[2 * k + 1], ...forward];
    const path = new Float32Array(2 * edges.length);
    for (let e = 0; e < edges.length; e++) crossing(edges[e], path, 2 * e);
    paths.push(path);
  }

  for (const edge of ends) {
    edgeOwners[2 * edge] = -1;
    edgeOwners[2 * edge + 1] = -1;
  }
  return paths;
}
