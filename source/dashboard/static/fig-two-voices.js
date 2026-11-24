// fig-two-voices.js · Chapter II: two voices, one curve.
//
// G(y), the proof's own prime statistic, exactly as Formalism.Gz defines it,
//
//   G(y) = Σ_{n≤y} Λ(n)·(y/n − 1) − y·log y + (1 + γ)·y,
//
// drawn twice: in white from the primes, ramp by ramp, and in gold from the first n pairs of
// zeros ρ = ½ ± iγₖ through the explicit formula
//
//   G(y) = log 2π − Σ_ρ y^ρ/(ρ(ρ − 1)) − Σ_{k≥1} y^(−2k)/(2k(2k + 1)),
//
// where each pair contributes 2√y·cos(γₖ log y)/(¼ + γₖ²), because ρ(ρ − 1) = −(¼ + γₖ²).
// Below, (G(y) − log 2π)/√y between high- and low-water marks at ±(2 + γ − log 4π), the band
// the Riemann Hypothesis sets for the zeros' part. The reader picks how many zeros to use,
// the range of y, and may listen to the zeros as quiet partials.
//
// The primes come from zeta.js's primesUpTo: up to 10⁴ at once, and up to 2·10⁶ (for the
// widest range and the numbers) in slices of at most 8 ms, so the page never waits.

import { ZEROS, primesUpTo } from "./zeta.js";
import {
  stage, surface, inks, numbers, drawnBy, whenFonts, watchPage, sliced, label, mono, crisp, hatch, element,
  fixed, signed, grouped, superscript,
} from "./fig-common.js";

const NAME = "two-voices";
const ALT = "Two traces over a horizontal axis of y. A white trace, built from small ramps at the primes, wanders a little above and below a level line near 1.84. A gold trace, built from waves, one pair per zero, follows it; as more zeros are added it settles onto the white trace. Below, the same difference divided by the square root of y stays well inside two horizontal marks at plus and minus 0.0462.";

const EULER_GAMMA = 0.5772156649015329;
const LOG_2PI = Math.log(2 * Math.PI);
const BAND = 2 + EULER_GAMMA - Math.log(4 * Math.PI); // 0.0461914179…
const PAIRS = Math.min(100, ZEROS.length);
const WEIGHT = Array.from(ZEROS.subarray(0, PAIRS), (g) => 2 / (0.25 + g * g)); // per pair, in G/√y
const RANGES = {
  small: { label: "2 to 100", from: 2, to: 100, log: false, samples: 1100 },
  mid: { label: "10 to 10,000 (log scale)", from: 10, to: 1e4, log: true, samples: 1500 },
  wide: { label: "10 to 1,000,000 (log scale)", from: 10, to: 1e6, log: true, samples: 1700 },
};
const NUMBER_ROWS = [10, 100, 1000, 1e4, 1e5, 1e6, 2e6];
const SEARCH_LIMIT = 2e6;

// ── G from the primes ──────────────────────────────────────────────────────────────────
// The prime powers q ≤ N in order, with prefix sums ψ = Σ Λ(q) and A = Σ Λ(q)/q (A summed
// with Kahan's compensation: at y = 2·10⁶, y·A is about 3·10⁷ and G is wanted to 10⁻⁵).
// Then G(y) = y·A(y) − ψ(y) − y·log y + (1 + γ)·y, with A and ψ taken over q ≤ y.

function* primePowers(N) {
  const base = primesUpTo(Math.floor(Math.sqrt(N)));
  const composite = new Uint8Array(N + 1);
  let work = 0;
  for (const p of base) {
    for (let m = p * p; m <= N; m += p) {
      composite[m] = 1;
      if (++work === 200000) {
        work = 0;
        yield;
      }
    }
  }
  const powers = [];
  for (const p of base) for (let q = p * p; q <= N; q *= p) powers.push([q, Math.log(p)]);
  powers.sort((a, b) => a[0] - b[0]);
  const capacity = Math.ceil(1.3 * N / Math.log(N)) + powers.length + 16;
  const q = new Float64Array(capacity);
  const psi = new Float64Array(capacity);
  const A = new Float64Array(capacity);
  let count = 0, sumPsi = 0, sumA = 0, carry = 0, next = 0;
  const add = (n, logP) => {
    sumPsi += logP;
    const term = logP / n - carry;
    const total = sumA + term;
    carry = total - sumA - term;
    sumA = total;
    q[count] = n;
    psi[count] = sumPsi;
    A[count] = sumA;
    count++;
  };
  for (let n = 2; n <= N; n++) {
    if (!composite[n]) add(n, Math.log(n));
    else if (next < powers.length && powers[next][0] === n) add(n, powers[next++][1]);
    if ((n & 0x3ffff) === 0) yield;
  }
  return { N, q, psi, A, count };
}

function drain(steps) {
  for (;;) {
    const r = steps.next();
    if (r.done) return r.value;
  }
}

function below(table, y) {
  let low = 0, high = table.count;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (table.q[middle] <= y) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}

function gPrimes(table, y) {
  const i = below(table, y);
  const a = i >= 0 ? table.A[i] : 0, s = i >= 0 ? table.psi[i] : 0;
  return y * a - s - y * Math.log(y) + (1 + EULER_GAMMA) * y;
}

// Σ_{k≥1} y^(−2k)/(2k(2k + 1)): the trivial zeros −2, −4, … (y ≥ 2).
function trivial(y) {
  const x2 = 1 / (y * y);
  let power = x2, sum = 0;
  for (let k = 1; k < 40; k++) {
    const term = power / (2 * k * (2 * k + 1));
    sum += term;
    if (term < 1e-18) break;
    power *= x2;
  }
  return sum;
}

// The zeros' part of (G(y) − log 2π)/√y, summed over the first n pairs.
function zeroWave(y, n) {
  const L = Math.log(y);
  let sum = 0;
  for (let k = 0; k < n; k++) sum += WEIGHT[k] * Math.cos(ZEROS[k] * L);
  return sum;
}

const gZeros = (y, n) => LOG_2PI + Math.sqrt(y) * zeroWave(y, n) - trivial(y);

// ── Samples of one range ───────────────────────────────────────────────────────────────
// For every sample y: the primes' G (when the table reaches that far), the trivial term,
// and the zeros' partial sums for every n at once (n = 0 … 100), so the slider is instant.

function sampleRange(range, table) {
  const ys = [];
  for (let i = 0; i < range.samples; i++) {
    const f = i / (range.samples - 1);
    ys.push(range.log ? range.from * (range.to / range.from) ** f : range.from + f * (range.to - range.from));
  }
  if (!range.log) {
    // The primes' curve bends at every prime power: put a sample exactly on each bend.
    for (let i = 0; i < table.count && table.q[i] <= range.to; i++) if (table.q[i] > range.from) ys.push(table.q[i]);
    ys.sort((a, b) => a - b);
  }
  const m = ys.length;
  const y = Float64Array.from(ys);
  const triv = new Float64Array(m);
  const cumulative = new Float32Array(m * (PAIRS + 1));
  for (let i = 0; i < m; i++) {
    triv[i] = trivial(y[i]);
    const L = Math.log(y[i]);
    let sum = 0;
    const row = i * (PAIRS + 1);
    for (let k = 0; k < PAIRS; k++) {
      sum += WEIGHT[k] * Math.cos(ZEROS[k] * L);
      cumulative[row + k + 1] = sum;
    }
  }
  const samples = { range, y, triv, cumulative, primes: null, limits: null };
  samples.limits = limitsFor(samples);
  return samples;
}

// Fixed vertical limits for the upper panel, wide enough for every n (and for the primes'
// curve once it is there), so that moving the slider never clips a curve.
function limitsFor(samples) {
  const { y, primes, cumulative, triv } = samples;
  let spread = 0;
  for (let i = 0; i < y.length; i++) {
    const root = Math.sqrt(y[i]);
    if (primes) spread = Math.max(spread, Math.abs(primes[i] - LOG_2PI));
    const row = i * (PAIRS + 1);
    for (let n = 0; n <= PAIRS; n++) spread = Math.max(spread, Math.abs(root * cumulative[row + n] - triv[i]));
  }
  return [LOG_2PI - spread * 1.08, LOG_2PI + spread * 1.08];
}

function attachPrimes(samples, table) {
  if (!table || table.N < samples.range.to) return false;
  samples.primes = Float64Array.from(samples.y, (v) => gPrimes(table, v));
  samples.limits = limitsFor(samples);
  return true;
}

// ── Sound ──────────────────────────────────────────────────────────────────────────────
// The first n zeros as partials: pitch 10 Hz per unit of height (γ₁ → 141 Hz), loudness in
// proportion to 1/|ρ| as in Riemann's formula for the primes, the whole kept quiet.

function createVoices() {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return null;
  const context = new AudioContextClass();
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);
  const voices = [];
  let size = 0;
  const level = 0.05;
  return {
    set(n) {
      const now = context.currentTime;
      while (voices.length < n) {
        const k = voices.length;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = ZEROS[k] * 10;
        gain.gain.value = 0;
        oscillator.connect(gain).connect(master);
        oscillator.start();
        voices.push({ oscillator, gain });
      }
      size = n;
      let total = 0;
      for (let k = 0; k < n; k++) total += 1 / Math.hypot(0.5, ZEROS[k]);
      voices.forEach(({ gain }, k) => {
        const target = k < size && total ? 1 / Math.hypot(0.5, ZEROS[k]) / total : 0;
        gain.gain.setTargetAtTime(target, now, 0.06);
      });
      master.gain.setTargetAtTime(n ? level : 0, now, 0.12);
    },
    stop() {
      const now = context.currentTime;
      master.gain.setTargetAtTime(0, now, 0.05);
      setTimeout(() => {
        for (const { oscillator } of voices) {
          try {
            oscillator.stop();
          } catch {
            /* already stopped */
          }
        }
        context.close?.();
      }, 300);
    },
  };
}

export function mount(el, ctx = {}) {
  const st = stage(el, NAME, ALT);
  const uid = Math.random().toString(36).slice(2, 8);

  // Controls first, then the plate, then the legend.
  const controls = element("div", "fig-controls");
  const sliderLabel = element("label", "fig-control");
  const slider = element("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = String(PAIRS);
  slider.step = "1";
  slider.value = String(Math.min(PAIRS, Number(el.dataset.zeros) || 10));
  const sliderOut = element("output", "fig-value");
  sliderLabel.append(element("span", "fig-control-name", "Zeros used"), slider, sliderOut);

  const rangeLabel = element("label", "fig-control");
  const select = element("select");
  for (const [key, range] of Object.entries(RANGES)) {
    const option = element("option", null, range.label);
    option.value = key;
    select.append(option);
  }
  select.value = RANGES[el.dataset.range] ? el.dataset.range : "small";
  rangeLabel.append(element("span", "fig-control-name", "Range of y"), select);

  const listen = element("button", "toggle button fig-listen", "Listen");
  listen.type = "button";
  listen.setAttribute("aria-pressed", "false");
  const listenNote = element("p", "fig-note fig-listen-note");
  listenNote.id = `fig-listen-note-${uid}`;
  listen.setAttribute("aria-describedby", listenNote.id);
  const listenGroup = element("div", "fig-control fig-listen-group");
  listenGroup.append(listen, listenNote);
  if (!(globalThis.AudioContext || globalThis.webkitAudioContext)) listenGroup.hidden = true;
  controls.append(sliderLabel, rangeLabel, listenGroup);

  const wrap = element("div", "fig-frame");
  const legend = element("ul", "fig-legend");
  for (const [kind, text] of [["primes", "from the primes"], ["zeros", "from the zeros"], ["band", "the band under RH"]]) {
    const item = element("li", `fig-key fig-key-${kind}`);
    item.append(element("span", "fig-swatch"), text);
    legend.append(item);
  }
  const status = element("p", "fig-note fig-status");
  status.setAttribute("aria-live", "polite");
  el.append(controls, wrap, legend, status);

  let ink = inks(el);
  let geo = null;
  let alive = true;
  let voices = null;
  let pairs = Number(slider.value);
  let table = drain(primePowers(1e4));
  let big = null;
  const sampled = {};

  const surf = surface(wrap, {
    label: st.alt,
    height: (w) => (w >= 560 ? Math.min(540, Math.max(360, w * 0.5)) : Math.min(560, Math.max(430, w * 1.2))),
    onResize: () => {
      layout();
      render();
    },
  });

  function current() {
    const key = select.value;
    if (!sampled[key]) sampled[key] = sampleRange(RANGES[key], big || table);
    const samples = sampled[key];
    if (!samples.primes) attachPrimes(samples, big || table);
    return samples;
  }

  function layout() {
    const { width, height } = surf.size;
    const narrow = width < 560;
    const m = narrow ? { l: 58, r: 16, t: 12, b: 28 } : { l: 60, r: 96, t: 14, b: 30 };
    const gap = 26;
    const usable = height - m.t - m.b - gap;
    const top = { x0: m.l, x1: width - m.r, y0: m.t, y1: m.t + Math.round(usable * 0.56) };
    const bottom = { x0: m.l, x1: width - m.r, y0: top.y1 + gap, y1: height - m.b };
    geo = { narrow, top, bottom };
  }

  const xOf = (range, box) => {
    if (range.log) {
      const a = Math.log(range.from), b = Math.log(range.to);
      return (y) => box.x0 + ((Math.log(y) - a) / (b - a)) * (box.x1 - box.x0);
    }
    return (y) => box.x0 + ((y - range.from) / (range.to - range.from)) * (box.x1 - box.x0);
  };

  function curve(g, X, Y, count, valueAt) {
    g.beginPath();
    for (let i = 0; i < count; i++) {
      const x = X(i), y = Y(valueAt(i));
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
  }

  function xTicks(range) {
    if (!range.log) return [2, 20, 40, 60, 80, 100].map((v) => [v, String(v)]);
    const ticks = [];
    for (let e = Math.round(Math.log10(range.from)); 10 ** e <= range.to * 1.0001; e++) ticks.push([10 ** e, e === 1 ? "10" : "10" + superscript(e)]);
    return ticks;
  }

  function render() {
    if (!geo || !alive) return;
    ink = inks(el);
    const g = surf.begin();
    const samples = current();
    const { range, y, triv, cumulative } = samples;
    const count = y.length;
    const { top, bottom, narrow } = geo;
    const { dpr } = surf.size;
    const X = xOf(range, top);
    const xs = Float64Array.from(y, X);
    const font = mono(11);
    const faint = ink.print3;
    const row = (i) => i * (PAIRS + 1) + pairs;

    // ── upper panel: G(y)
    const limits = samples.limits || [LOG_2PI - 0.3, LOG_2PI + 0.3];
    const Yt = (v) => top.y1 - ((v - limits[0]) / (limits[1] - limits[0])) * (top.y1 - top.y0);
    g.save();
    g.beginPath();
    g.rect(top.x0, top.y0 - 2, top.x1 - top.x0, top.y1 - top.y0 + 4);
    g.clip();
    g.strokeStyle = faint;
    g.lineWidth = 0.75;
    g.setLineDash([2, 4]);
    g.beginPath();
    g.moveTo(top.x0, crisp(Yt(LOG_2PI), dpr));
    g.lineTo(top.x1, crisp(Yt(LOG_2PI), dpr));
    g.stroke();
    g.setLineDash([]);
    g.lineJoin = "round";
    if (samples.primes) {
      g.strokeStyle = ink.print;
      g.lineWidth = 1.1;
      curve(g, (i) => xs[i], Yt, count, (i) => samples.primes[i]);
    }
    g.strokeStyle = ink.gold;
    g.lineWidth = 1.1;
    curve(g, (i) => xs[i], Yt, count, (i) => LOG_2PI + Math.sqrt(y[i]) * cumulative[row(i)] - triv[i]);
    g.restore();

    // ── lower panel: (G(y) − log 2π)/√y, with the band
    const lim = 0.066;
    const Yb = (v) => bottom.y1 - ((v + lim) / (2 * lim)) * (bottom.y1 - bottom.y0);
    const hi = Yb(BAND), lo = Yb(-BAND);
    g.save();
    g.beginPath();
    g.rect(bottom.x0, bottom.y0, bottom.x1 - bottom.x0, hi - bottom.y0);
    g.rect(bottom.x0, lo, bottom.x1 - bottom.x0, bottom.y1 - lo);
    g.clip();
    g.strokeStyle = faint;
    g.globalAlpha = 0.45;
    hatch(g, bottom.x0, bottom.y0, bottom.x1, bottom.y1, { angle: Math.PI / 4, spacing: 4.5, width: 0.75 });
    g.restore();
    g.save();
    g.strokeStyle = ink.print2;
    g.lineWidth = 1;
    g.beginPath();
    for (const v of [hi, lo]) {
      g.moveTo(bottom.x0, crisp(v, dpr));
      g.lineTo(bottom.x1, crisp(v, dpr));
    }
    g.stroke();
    // tide marks at the left end of each water line
    g.fillStyle = ink.print2;
    for (const [v, up] of [[hi, false], [lo, true]]) {
      g.beginPath();
      g.moveTo(bottom.x0 + 4, v + (up ? 7 : -7));
      g.lineTo(bottom.x0 + 10, v + (up ? 7 : -7));
      g.lineTo(bottom.x0 + 7, v + (up ? 2 : -2));
      g.closePath();
      g.fill();
    }
    g.strokeStyle = faint;
    g.lineWidth = 0.75;
    g.setLineDash([2, 4]);
    g.beginPath();
    g.moveTo(bottom.x0, crisp(Yb(0), dpr));
    g.lineTo(bottom.x1, crisp(Yb(0), dpr));
    g.stroke();
    g.setLineDash([]);
    g.beginPath();
    g.rect(bottom.x0, bottom.y0, bottom.x1 - bottom.x0, bottom.y1 - bottom.y0);
    g.clip();
    g.lineJoin = "round";
    if (samples.primes) {
      g.strokeStyle = ink.print;
      g.lineWidth = 1.1;
      curve(g, (i) => xs[i], Yb, count, (i) => (samples.primes[i] - LOG_2PI + triv[i]) / Math.sqrt(y[i]));
    }
    g.strokeStyle = ink.gold;
    g.lineWidth = 1.1;
    curve(g, (i) => xs[i], Yb, count, (i) => cumulative[row(i)]);
    g.restore();

    // ── axes, ticks and words
    g.save();
    g.strokeStyle = faint;
    g.lineWidth = 1;
    g.beginPath();
    for (const box of [top, bottom]) {
      const bx = crisp(box.x0, dpr);
      g.moveTo(bx, box.y0);
      g.lineTo(bx, box.y1);
    }
    const by = crisp(bottom.y1, dpr);
    g.moveTo(bottom.x0, by);
    g.lineTo(bottom.x1, by);
    const ticks = xTicks(range);
    for (const [v] of ticks) {
      const x = crisp(X(v), dpr);
      g.moveTo(x, by);
      g.lineTo(x, by + 4);
      g.moveTo(x, crisp(top.y1, dpr));
      g.lineTo(x, crisp(top.y1, dpr) - 3);
    }
    if (!range.log) {
      // every prime power below 100 switches on a ramp: a short mark under the upper panel
      for (let i = 0; i < table.count && table.q[i] <= range.to; i++) {
        const x = crisp(X(table.q[i]), dpr);
        g.moveTo(x, top.y1 + 2);
        g.lineTo(x, top.y1 + 6);
      }
    }
    g.stroke();
    g.restore();
    for (const [v, text] of ticks) label(g, text, X(v), by + 16, { font, color: faint, align: "center" });
    label(g, "y", bottom.x1 + 12, by + 16, { font, color: faint, alpha: narrow ? 0 : 1 });

    const leftLabel = (text, yy, color = faint) => label(g, text, top.x0 - 7, yy + 4, { font, color, align: "right" });
    const step = niceStep((limits[1] - limits[0]) / 4);
    for (let v = Math.ceil(limits[0] / step) * step; v <= limits[1]; v += step) {
      if (Yt(v) < top.y0 + 6 || Yt(v) > top.y1 - 4) continue;
      leftLabel(trimmed(v, step), Yt(v));
    }
    leftLabel("+" + BAND.toFixed(4), hi);
    leftLabel("0", Yb(0));
    leftLabel("−" + BAND.toFixed(4), lo);

    const rightX = narrow ? top.x1 - 4 : top.x1 + 8;
    const align = narrow ? "right" : "left";
    label(g, "G(y)", top.x0 + 8, top.y0 + 10, { font, color: ink.print2 });
    label(g, "log 2π", rightX, Yt(LOG_2PI) + (narrow ? -6 : 4), { font, color: faint, align });
    label(g, "(G(y) − log 2π)/√y", bottom.x0 + 16, bottom.y0 + 10, { font, color: ink.print2 });
    label(g, "high water", rightX, hi + (narrow ? -6 : 4), { font, color: faint, align });
    label(g, "low water", rightX, lo + (narrow ? 14 : 4), { font, color: faint, align });
  }

  function niceStep(raw) {
    const power = 10 ** Math.floor(Math.log10(raw));
    for (const m of [1, 2, 5, 10]) if (raw <= m * power) return m * power;
    return 10 * power;
  }
  const trimmed = (v, step) => fixed(Math.abs(v) < step / 1e6 ? 0 : v, Math.max(0, -Math.floor(Math.log10(step))));

  function sync() {
    pairs = Number(slider.value);
    sliderOut.value = sliderOut.textContent = `${pairs} pairs`;
    slider.setAttribute("aria-valuetext", `${pairs} pairs of zeros`);
    listenNote.textContent = `Plays the first ${pairs} zeros as quiet partials, each pitched by its height. Off until you press it. The pitches are a mapping we chose (drawn by rule); ζ makes no sound.`;
    voices?.set(pairs);
  }

  function setListening(on) {
    if (on && !voices) {
      voices = createVoices();
      if (!voices) return;
      voices.set(pairs);
    } else if (!on && voices) {
      voices.stop();
      voices = null;
    }
    listen.setAttribute("aria-pressed", String(!!voices));
    listen.textContent = voices ? "Stop listening" : "Listen";
  }

  slider.addEventListener("input", () => {
    sync();
    render();
  });
  select.addEventListener("change", () => {
    const samples = current();
    status.textContent = samples.primes ? "" : "Sieving the primes up to a million…";
    render();
  });
  listen.addEventListener("click", () => setListening(!voices));
  const unwatchPage = watchPage((visible) => {
    if (!visible) setListening(false);
  });
  const unfonts = whenFonts(() => render());

  drawnBy(el, st.figure, "fig-two-voices.js · primesUpTo(), ZEROS");
  sync();
  surf.measure();
  layout();
  render();
  st.paint("first");
  st.paint("ready");

  // The long sieve, in slices, for the widest range and the numbers.
  sliced(primePowers(SEARCH_LIMIT), { cancelled: () => !alive }).then(async (result) => {
    if (!result || !alive) return;
    big = result;
    for (const samples of Object.values(sampled)) if (!samples.primes) attachPrimes(samples, big);
    if (status.textContent) status.textContent = "";
    render();
    await fillNumbers();
  });

  async function fillNumbers() {
    // The extremes of the normalised curve on every whole number 10 ≤ y ≤ 2·10⁶.
    const extremes = await sliced((function* () {
      let low = Infinity, lowAt = 0, high = -Infinity, highAt = 0, i = -1;
      for (let y = 10; y <= SEARCH_LIMIT; y++) {
        while (i + 1 < big.count && big.q[i + 1] <= y) i++;
        const G = y * big.A[i] - big.psi[i] - y * Math.log(y) + (1 + EULER_GAMMA) * y;
        const v = (G - LOG_2PI) / Math.sqrt(y);
        if (v < low) {
          low = v;
          lowAt = y;
        }
        if (v > high) {
          high = v;
          highAt = y;
        }
        if ((y & 0xffff) === 0) yield;
      }
      return { low, lowAt, high, highAt };
    })(), { cancelled: () => !alive });
    if (!extremes || !alive) return;
    let agreement = 0;
    for (const y of [100.5, 1000.5, 10000.5, 100000.5, 1000000.5]) {
      agreement = Math.max(agreement, Math.abs(gPrimes(big, y) - gZeros(y, PAIRS)) / Math.sqrt(y));
    }
    let partial = 0;
    for (let k = 0; k < PAIRS; k++) partial += WEIGHT[k];
    numbers(el, [
      {
        caption: "G(y), computed in your browser: from the primes (sieved to 2,000,000) and from the first 100 pairs of zeros. The research run (mpmath) found the same values to four decimals.",
        head: ["y", "G(y) from the primes", "G(y) from 100 zero pairs", "(G(y) − log 2π)/√y"],
        numeric: [0, 1, 2, 3],
        rows: NUMBER_ROWS.map((y) => {
          const G = gPrimes(big, y);
          return [grouped(y), fixed(G, 4), fixed(gZeros(y, PAIRS), 4), signed((G - LOG_2PI) / Math.sqrt(y), 4)];
        }),
      },
      {
        caption: "Constants and checks",
        head: ["Quantity", "Value"],
        rows: [
          ["log 2π", LOG_2PI.toFixed(10)],
          ["γ (Euler’s constant)", EULER_GAMMA.toFixed(10)],
          ["Band under RH, 2 + γ − log 4π", BAND.toFixed(10)],
          ["The same sum, Σ 2/(¼ + γₖ²), over the first 100 pairs", `${partial.toFixed(10)} (the zeros above γ₁₀₀ make up the rest)`],
          ["Normalised G on every whole number 10 ≤ y ≤ 2,000,000", `from ${fixed(extremes.low, 5)} (at y = ${grouped(extremes.lowAt)}) to ${signed(extremes.high, 5)} (at y = ${grouped(extremes.highAt)})`],
          ["Primes against 100 zero pairs at y = 100.5, 1,000.5, …, 1,000,000.5", `within ${agreement.toFixed(5)}·√y`],
          ["Plotted below", "the zeros’ part, (G(y) − log 2π + Σ y^(−2k)/(2k(2k + 1)))/√y: the trivial zeros’ small term is added back, so the band applies exactly; for y ≥ 10 it moves the curve by less than 0.0006"],
        ],
      },
    ]);
  }

  return {
    update() {},
    destroy() {
      alive = false;
      setListening(false);
      unwatchPage();
      unfonts();
      surf.destroy();
      st.restore();
    },
  };
}
