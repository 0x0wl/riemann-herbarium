// desk.js · the herbarium's live instruments.
//
// Polls /feed/status.json every 4 s and keeps every live instrument on the page current:
// the specimen label and the pipeline stems on the frontispiece, the compiler record (VII),
// the press gauge (VIII), the kernel replay record and the determination slips (IX), the
// label of evidence (Appendix A) and the field notes (Appendix B). Verdicts come only from
// the replay receipts, through replay-view.js; the export only from replay.local_export.
// Public mode never asks /api/ or /local/ for anything. Every inserted string is escaped.
// Words come from the copy (copy.md §2, §5, §6); times are US Eastern and labelled (eastern.js).

import { archivedReceiptPath, controlSummary, receiptForInput, receiptLabel, replayForView, replayHeadline,
  replayStages, stoppedBeforeReplay } from "./replay-view.js";
import { showProofStructure, targetEvidence } from "./proof-structure.js";
import { exportReadout, showExportProgress } from "./export-view.js";
import { rosetteSVG } from "./rosette.js";
import { startStory } from "./story.js";
import { easternClock, easternDate, easternRange, easternWhen, easternZone } from "./eastern.js";

const byId = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const integer = new Intl.NumberFormat("en-US");
const fmt = n => integer.format(n || 0);
// A frozen copy (html[data-frozen], printed by deploy/build_pages.py) is the public page over a
// snapshot of the feed beside it: it reads the snapshot once, measures every age at the moment
// it was taken rather than by the reader's clock, and never asks /api/ or /local/ for anything.
const frozenAt = Date.parse(document.documentElement.dataset.frozen || "");
const frozen = Number.isFinite(frozenAt);
const clock = () => frozen ? frozenAt : Date.now();
const local = !frozen && (["127.0.0.1", "localhost", "[::1]"].includes(location.hostname) || location.hostname.endsWith(".ts.net"))
  && !new URLSearchParams(location.search).has("public");
document.documentElement.dataset.mode = local ? "local" : "public";
if (local) {
  document.title = "Riemann Hypothesis · the keeper’s bench · Lark";
  document.querySelector('meta[name="description"]')?.setAttribute("content", "The keeper’s bench of the Riemann Hypothesis herbarium: the same plates as the public page, with private instruments for check-ins, visitors, research, raw logs and the machine.");
}

// ── Pins: the same constants the receipts are checked against ─────────────────────────
const PIN = "a172c464fd4bcfc4f53e394dcba45d742b1409a6";
const MAIN_LEAN = "https://github.com/Deicyde/riemann-hypothesis/blob/" + PIN + "/src/Main.lean";
const ARCHIVE_SHA = "9631b4f020199e580ba86178cb56c6e9b09f690c2369a80dc4334aa93f49c7fc";
const PUBLISHED_SOLUTION_SHA = "5ea74b912147c5c93cc2b6d70cc727cf908df2f62ac6a20480a3fa02f6be244e";
const PUBLISHED_COMPRESSED_SHA = "61a8938ad5f5e57397c1c0e3b954916af546d9004ade01c3555744a681b05381";
const MIT_MAIN_OLEAN_SHA = "9146dfb4148e24d2252e04c50742f3e49dd126dfcc5006d10bf5f873ddf796ad";
const REFERENCE_ATTEMPT = "7f06f190234b4f298a916848c66ccb24";
const HEX64 = /^[a-f0-9]{64}$/;
// Receipt paths as the feed names them; a frozen copy's feed names them relative ("./feed/…").
const EVIDENCE_PATH = /^\.?\/feed\/evidence\/[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.json$/;

// The five exported theorems (Main.lean lines 4–12 at the pin), in the copy's words; TeX
// between dollar signs is typeset (math.js).
const targets = [
  { key: "riemannHypothesis", label: "Riemann hypothesis", term: "rhOfAll", line: 4,
    plain: "Every zero of the Riemann zeta function that is not a trivial zero ($-2, -4, -6, \\dots$) has real part $\\tfrac12$. The clause $s\\neq1$ is there because Mathlib gives $\\zeta$ a conventional value at its pole.",
    lean: "-- RiemannHypothesis, Mathlib’s definition:\n∀ (s : ℂ), riemannZeta s = 0 → (¬∃ n : ℕ, s = -2 * (n + 1)) → s ≠ 1 → s.re = 1 / 2" },
  { key: "riemannZeta_eq_zero_re", label: "Zeta zeros", term: "rhOfAll", line: 6,
    plain: "The same assertion, written out without Mathlib’s name for it.",
    lean: "∀ s : ℂ, riemannZeta s = 0 → (¬ ∃ n : ℕ, s = -2 * ((n : ℂ) + 1)) → s ≠ 1 → s.re = 1 / 2" },
  { key: "LFunction_ne_zero_of_half_lt_re", label: "L-function nonvanishing", term: "allChi", line: 8,
    plain: "For every modulus $N\\ge1$ and every Dirichlet character $\\chi\\bmod N$, primitive or not, $L(\\chi,s)$ has no zero with $\\Re s>\\tfrac12$. The only point excluded is the pole of the trivial character at $s=1$.",
    lean: "∀ (N : ℕ) [NeZero N] (χ : DirichletCharacter ℂ N) (s : ℂ), 1 / 2 < s.re → (χ ≠ 1 ∨ s ≠ 1) → DirichletCharacter.LFunction χ s ≠ 0" },
  { key: "LFunction_eq_zero_re", label: "L-function zeros", term: "claimAll.2.1", line: 10,
    plain: "Every zero of every Dirichlet L-function inside the open critical strip, $0<\\Re s<1$, lies on the line $\\Re s=\\tfrac12$.",
    lean: "∀ (N : ℕ) [NeZero N] (χ : DirichletCharacter ℂ N) (s : ℂ), 0 < s.re → s.re < 1 → DirichletCharacter.LFunction χ s = 0 → s.re = 1 / 2" },
  { key: "LFunction_eq_zero_re_of_isPrimitive", label: "Primitive L-function zeros", term: "critAll", line: 12,
    plain: "The same for primitive characters: the form in which the Generalized Riemann Hypothesis for Dirichlet L-functions is usually stated.",
    lean: "∀ (N : ℕ) [NeZero N] (χ : DirichletCharacter ℂ N), χ.IsPrimitive → ∀ s : ℂ, 0 < s.re → s.re < 1 → DirichletCharacter.LFunction χ s = 0 → s.re = 1 / 2" },
];
const gateNotes = {
  Statement: "The solution proves exactly the statement written in the challenge.",
  "Axiom allowlist": "The proof uses only propext, Quot.sound and Classical.choice.",
  Kernel: "con-leche accepted the proof term in its verified mode.",
};

// The five controls: one proof the kernel must accept, four it must refuse (copy §6.14).
const controls = [
  { key: "valid", row: "Valid proof", name: "Valid proof", sprouts: true, fixture: "theorem probe : True := True.intro",
    expect: "Must be accepted: exit 0, “theorem probe justified by the solution”.", known: "Accepted, as expected (exit 0).",
    shows: "The whole path can say yes, and the harness knows a real yes." },
  { key: "wrong_statement", row: "Wrong statement", name: "Changed statement", fixture: "theorem probe : 0 = 0 := rfl",
    expect: "Must be refused: exit 1, rejected, naming probe.", known: "Refused, as expected (exit 1).",
    shows: "Statements are compared, not names. A correct proof of a different theorem does not pass." },
  { key: "extra_axiom", row: "Extra axiom", name: "Extra axiom", fixture: "axiom injected : True, then theorem probe : True := injected",
    expect: "Must be refused: exit 1 or 2, naming “injected”.", known: "Refused, as expected (exit 2, declined).",
    shows: "An assumption smuggled in as an axiom is refused." },
  { key: "placeholder", row: "Placeholder", name: "Placeholder", fixture: "theorem probe : True := by sorry",
    expect: "Must be refused: exit 1 or 2, naming “sorry”.", known: "Refused, as expected (exit 2, declined).",
    shows: "An unfinished proof, which Lean compiles with only a warning, is refused." },
  { key: "ill_typed", row: "Ill-typed proof term", name: "Ill-typed proof", fixture: "the valid export with the proof overwritten by its own statement",
    expect: "Must be refused: exit 1, “type mismatch in theorem probe”.", known: "Refused, as expected (exit 1).",
    shows: "The kernel really checks proof terms from the bytes; a forged record cannot merely claim a theorem." },
];

// ── Formatting: one convention. Times are US Eastern and say so; numbers use commas. ─
const clockAt = ms => easternClock(ms, { seconds: true });   // "12:47:16 p.m. EST"
const minuteAt = ms => easternClock(ms);                     // "12:47 p.m. EST"
const whenAt = ms => easternWhen(ms);                         // "23 Nov 2026, 12:47 p.m. EST"
const shortWhen = ms => easternWhen(ms, { year: false });     // "23 Nov, 12:47 p.m. EST"
const longWhen = ms => easternWhen(ms, { long: true });       // "23 November 2026, 12:47 p.m. EST"
const dayOf = ms => easternDate(ms);                          // "23 Nov 2026"
const longDay = ms => easternDate(ms, { long: true });        // "23 November 2026"
// Live text may carry TeX between dollar signs; it is escaped first, then typeset by math.js.
const mathMarkup = text => esc(text).replace(/\$([^$]+)\$/g, '<span class="math">$1</span>');
const typesetMath = root => import("./math.js").then(({ renderMath }) => renderMath(root)).catch(error => console.error("desk: mathematics", error));
// Memory in binary units (GiB = 2³⁰ bytes); files and rates in decimal units (GB = 10⁹ bytes).
const gib = n => Number.isFinite(n) ? (n / 2 ** 30).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " GiB" : "—";
const gb = n => Number.isFinite(n) ? (n / 1e9).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " GB" : "—";
const mb = n => Number.isFinite(n) ? (n / 1e6).toLocaleString("en-US", { maximumFractionDigits: n >= 1e7 ? 1 : 2 }) + " MB" : "—";
const mbps = n => Number.isFinite(n) ? (n / 1e6).toLocaleString("en-US", { maximumFractionDigits: n >= 1e7 ? 1 : 2 }) + " MB/s" : "—";
const memory = n => {
  if (!Number.isFinite(n)) return "—";
  return n >= 2 ** 30 ? gib(n) : (n / 2 ** 20).toLocaleString("en-US", { maximumFractionDigits: 0 }) + " MiB";
};
// The kernel's phase clock keeps the short form the progress check reads ("~0m 40s").
const duration = s => {
  s = Math.max(0, Math.floor(s || 0));
  if (s >= 86400) return Math.floor(s / 86400) + "d " + Math.floor(s % 86400 / 3600) + "h";
  if (s >= 3600) return Math.floor(s / 3600) + "h " + Math.floor(s % 3600 / 60) + "m";
  return Math.floor(s / 60) + "m " + s % 60 + "s";
};
// Durations in prose: "20 min 30 s", "2 d 16 h 16 min".
const span = s => {
  s = Math.max(0, Math.round(s || 0));
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), r = s % 60;
  if (d) return d + " d " + h + " h " + m + " min";
  if (h) return h + " h " + m + " min";
  if (m) return m + " min" + (r ? " " + r + " s" : "");
  return r + " s";
};
const age = seconds => seconds < 60 ? Math.max(1, Math.round(seconds / (seconds < 35 ? 1 : 10)) * (seconds < 35 ? 1 : 10)) + " s" :
  seconds < 3600 ? Math.round(seconds / 60) + " min" : seconds < 86400 ? Math.round(seconds / 3600) + " h" : Math.round(seconds / 86400) + " d";
const digestText = hex => HEX64.test(hex || "") ? hex : "—";
const shortDigest = hex => HEX64.test(hex || "") ? hex.slice(0, 8) + "…" + hex.slice(-4) : "—";
const percentOf = (bytes, total) => Number.isFinite(bytes) && total > 0 ? (Math.floor(1000 * bytes / total) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "%" : "";

// One state vocabulary for every bud, chip and stamp (design §3.1).
const tone = state => ({
  passed: "passed", complete: "passed", completed: "passed", accepted: "passed", sealed: "passed", running: "running",
  queued: "queued", pending: "pending", "awaiting receipt": "pending", "not run": "pending", "outside scope": "pending",
  inconclusive: "inconclusive", blocked: "inconclusive", stopped: "inconclusive", unconfirmed: "inconclusive",
  unavailable: "inconclusive", failed: "failed", rejected: "failed",
})[String(state || "").toLowerCase()] || "pending";

// Buds and blooms: a closed bud for pending, a dashed one for queued, an opening bud for
// running, a bloom when a stage has passed, a pressed bud when it stopped, a cross if it failed.
function bud(state) {
  const s = tone(state);
  const petals = [0, 72, 144, 216, 288].map(a => '<ellipse cx="14" cy="8.4" rx="2.7" ry="4.7" transform="rotate(' + a + ' 14 14)"/>').join("");
  const shapes = {
    passed: '<g class="petals">' + petals + '</g><circle class="heart" cx="14" cy="14" r="2.4"/>',
    running: '<circle class="halo" cx="14" cy="14" r="11"/><path class="bud-body" d="M14 5.5c4 3.5 5 8.2 0 13.5c-5-5.3-4-10 0-13.5Z"/><path class="sepal" d="M9.4 15.8c1.8 1.2 3.2 1.8 4.6 1.8s2.8-.6 4.6-1.8"/>',
    queued: '<circle class="bud-body dashed" cx="14" cy="14" r="5.5"/>',
    inconclusive: '<path class="bud-body" d="M14 7.5c3 2.6 3.8 6 0 10c-3.8-4-3-7.4 0-10Z"/><path class="bar" d="M8.5 21h11"/>',
    failed: '<path class="bud-body" d="M9.5 9.5l9 9M18.5 9.5l-9 9"/>',
    pending: '<circle class="bud-body" cx="14" cy="14" r="4.6"/>',
  };
  return '<svg class="bud" viewBox="0 0 28 28" aria-hidden="true" focusable="false">' + shapes[s] + "</svg>";
}

// ── State ───────────────────────────────────────────────────────────────────────────
let data, localData, paused = false, pausedAt = 0, historyMode = false, records = [], olderChunk = 0, oldLog = 0, tick = 0, generation = 0;
let selectedInput = "local_export";
let manifest = null, snapshotMeta = null;
const expanded = new Set();
const selectedReceipt = () => receiptForInput(data?.replay, selectedInput);
const viewFeed = () => data ? Object.assign(data, { view: { input: selectedInput } }) : null;
const story = startStory({ mode: local ? "local" : "public", getFeed: viewFeed });

function guard(name, fn) {
  try { fn(); } catch (error) { console.error("desk: " + name, error); }
}
async function read(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw Error("HTTP " + response.status);
  return response.json();
}
function setText(id, text) {
  const node = byId(id);
  if (node && node.textContent !== text) node.textContent = text;
}

// ── Masthead: connection state ──────────────────────────────────────────────────────
function showLink() {
  const node = byId("link-state");
  if (!data) return;
  const seconds = (Date.now() - Date.parse(data.ts)) / 1000;
  const stale = !(seconds <= 35);
  const state = frozen ? "Frozen" : stale ? "Stale" : "Live";
  const detail = frozen ? whenAt(frozenAt) : stale ? age(seconds) : local ? "local" : "public";
  const full = state + " · " + detail;
  if (node.dataset.text !== full) {
    node.dataset.text = full;
    const extra = document.createElement("span");
    extra.className = "link-detail";
    extra.textContent = " · " + detail;
    node.replaceChildren(document.createTextNode(state), extra);
  }
  node.title = frozen ? "A frozen snapshot of local experimental work: its feed as it stood on " + longWhen(frozenAt) + ". Nothing here updates." :
    stale ? "The last reading is " + age(seconds) + " old. Values below are shown as last read." :
    "Feed read " + age(Math.max(1, seconds)) + " ago, at " + clockAt(Date.parse(data.ts)) + ". Live means under 35 seconds old.";
  node.dataset.state = frozen ? "frozen" : stale ? "stale" : "live";
}

// ── Frontispiece: the specimen label ────────────────────────────────────────────────
function kernelSampleText(receipt) {
  const sample = currentKernelSample(receipt, clock());
  return countedPhase(sample) ? fmt(sample.completed) + " of " + fmt(sample.total) + " declarations" : "";
}
function determination(receipt) {
  const headline = replayHeadline(receipt);
  const ended = Date.parse(receipt.ended), started = Date.parse(receipt.started);
  if (receipt.evidence_state || receipt.waiting_for_resources) return { text: headline, date: "", state: receipt.evidence_state ? "inconclusive" : "queued" };
  if (receipt.result === "passed") return { text: "Accepted", date: Number.isFinite(ended) ? longWhen(ended) : "", state: "passed" };
  if (receipt.result === "running") return { text: headline, date: Number.isFinite(started) ? "since " + minuteAt(started) : "", state: "running" };
  return { text: headline, date: "", state: tone(receipt.result) };
}
function ownDetermination(receipt, exportState) {
  if (!receipt) {
    const words = { running: "not yet examined · the export is still being written", queued: "not yet examined · the export is queued",
      passed: "not yet examined · sealed, awaiting the kernel", inconclusive: "not yet examined · the export stopped; nothing rejected",
      failed: "not yet examined · the export failed" };
    return { text: words[exportState] || "not yet examined", date: "", state: exportState === "running" ? "running" :
      exportState === "queued" ? "queued" : exportState === "inconclusive" ? "inconclusive" : exportState === "failed" ? "failed" : "pending" };
  }
  const ended = Date.parse(receipt.ended), date = Number.isFinite(ended) ? longWhen(ended) : "";
  if (receipt.evidence_state === "unconfirmed") return { text: "unconfirmed · held as inconclusive", date: "", state: "inconclusive" };
  if (receipt.evidence_state) return { text: "receipt unavailable", date: "", state: "inconclusive" };
  if (receipt.waiting_for_resources) return { text: "waiting for memory headroom", date: "", state: "queued" };
  if (receipt.result === "running") {
    if (["preflight", "controls"].includes(receipt.stage)) return { text: "checking the five controls", date: "", state: "running" };
    const counted = kernelSampleText(receipt);
    return { text: counted ? "reading · " + counted : "reading", date: "", state: "running" };
  }
  if (receipt.result === "passed") return { text: "Accepted", date, state: "passed" };
  if (receipt.result === "failed") return { text: "Rejected", date, state: "failed" };
  if (receipt.result === "inconclusive") return { text: "no verdict", date: date ? "· ended " + date + " · nothing rejected" : "· nothing rejected", state: "inconclusive" };
  return { text: replayHeadline(receipt), date: "", state: "pending" };
}
function showLabel() {
  const replay = data.replay || {};
  const run = data.run_id || "rh-20261120";
  setText("run-id", run);
  for (const node of document.querySelectorAll(".label-run")) node.textContent = run;
  const reference = receiptForInput(replay, "reference_export");
  const own = receiptForInput(replay, "local_export");
  const rows = [
    ["reference", reference ? determination(reference) : { text: "Awaiting receipt", date: "", state: "pending" }],
    ["local", ownDetermination(own, replay.local_export?.state)],
  ];
  for (const [name, det] of rows) {
    const link = byId(name + "-readout");
    if (link.textContent !== det.text) link.textContent = det.text;
    link.dataset.state = det.state;
    const date = byId(name + "-det-date");
    date.textContent = det.date;
    date.hidden = !det.date;
  }
  const rosette = byId("archive-rosette");
  const archive = HEX64.test(reference?.archive_sha256 || "") ? reference.archive_sha256 : ARCHIVE_SHA;
  const gold = reference?.result === "passed" && !reference.evidence_state && reference.archive_sha256 === archive;
  const key = archive + gold;
  if (rosette.dataset.key !== key) {
    rosette.dataset.key = key;
    rosette.replaceChildren(rosetteSVG(archive, { size: 76, gold, label: "SHA-256 " + archive }));
    setText("archive-digest", shortDigest(archive));
  }
}

// ── Frontispiece: the pipeline stems ────────────────────────────────────────────────
const stemTargets = { Source: "#proof-reading", Build: "#compiler", Export: "#export", Controls: "#replay",
  "Download / unpack": "#replay", Kernel: "#replay", Verdict: "#settled" };
const stemNotes = {
  local_export: {
    Source: "The 14-part source archive, joined and checked against its pinned SHA-256: 239,275,554 bytes, 175,190 members.",
    Build: "Lake compiles all 175,187 modules on Euler. Done when Lake exits 0.",
    Export: "Euler writes its own compiled proof out as an inert export, for a reader outside the tool that built it.",
    Controls: "Five miniature proofs the kernel must accept or refuse before it sees the real input.",
    Kernel: "con-leche re-checks every exported declaration against the independent challenge.",
    Verdict: "What the receipt says: accepted, rejected, or no verdict.",
  },
  reference_export: {
    Controls: "The same five controls, run before the published export is opened.",
    "Download / unpack": "The export published from MIT, fetched, pinned by size and SHA-256, and unpacked.",
    Kernel: "con-leche checks the published export against Euler’s own challenge.",
    Verdict: "What the receipt says: accepted, rejected, or no verdict.",
  },
};
function stemWord(stage, input) {
  const { name, state, detail } = stage;
  const replay = data.replay || {};
  const receipt = receiptForInput(replay, input);
  if (name === "Source") return detail;
  if (name === "Build") {
    if (state === "passed") return "complete";
    const worker = data.worker || {};
    if (worker.phase === "build" && worker.state === "running") {
      stage.state = "running";
      return "compiling · " + fmt(Object.values(data.completed || {}).reduce((a, b) => a + b, 0)) + " of 175,187";
    }
    if (worker.phase === "build" && ["failed", "inconclusive", "blocked"].includes(worker.state)) { stage.state = "inconclusive"; return "stopped"; }
    return "waiting";
  }
  if (name === "Export") {
    const progress = replay.local_export?.progress;
    if (state === "pending") return "not started";
    if (detail === "Writing") {
      if (progress?.phase === "sealing") return "sealing";
      const share = percentOf(progress?.bytes, progress?.reference_bytes);
      return share ? "writing · " + share : "writing";
    }
    return String(detail).toLowerCase();
  }
  if (name === "Controls") return state === "pending" ? "waiting" : String(detail).toLowerCase();
  if (name === "Download / unpack") return state === "pending" ? "waiting" : String(detail).toLowerCase();
  if (name === "Kernel") {
    if (state === "pending") return "waiting";
    if (state === "queued") return "waiting for headroom";
    if (state === "running") {
      const sample = currentKernelSample(receipt, clock());
      return countedPhase(sample) ? "reading · " + phasePercent(sample) : "reading";
    }
    if (state === "passed") return "complete";
    if (state === "failed") return "rejected";
    return "stopped";
  }
  if (name === "Verdict") {
    const ended = Date.parse(receipt?.ended);
    const day = Number.isFinite(ended) ? " · " + dayOf(ended) : "";
    return { Accepted: "accepted" + day, Rejected: "rejected" + day, Inconclusive: "no verdict", Unconfirmed: "unconfirmed",
      Unavailable: "receipt unavailable" }[detail] || "awaiting receipt";
  }
  return String(detail).toLowerCase();
}
function sourceStage() {
  const record = data.stages?.download;
  const parts = new Set((data.parts || []).filter(p => p.kind === "part_done").map(p => p.part)).size;
  const state = { stage_done: "passed", stage_fail: "inconclusive", stage_start: "running" }[record?.kind] || "pending";
  const detail = { passed: "14 / 14 parts verified", running: parts + " / 14 parts", inconclusive: "stopped", pending: "waiting" }[state];
  return { name: "Source", state, detail };
}
function renderStem(list, stages, input) {
  const nodes = stages.map(stage => {
    const copy = { ...stage };
    const word = stemWord(copy, input);
    return { name: copy.name, state: copy.state, word };
  });
  const key = JSON.stringify(nodes);
  if (list.dataset.key === key) return;
  list.dataset.key = key;
  list.innerHTML = nodes.map(({ name, state, word }) => {
    const shown = name === "Download / unpack" ? "Download" : name;
    return '<li data-state="' + esc(tone(state)) + '"><a href="' + esc(stemTargets[name] || "#replay") + '" data-input="' + esc(input) +
      '" title="' + esc(stemNotes[input][name] || shown) + '">' + bud(state) + '<span class="node-name">' + esc(shown) +
      '</span><span class="node-word">' + esc(word) + "</span></a></li>";
  }).join("");
}
function showPipeline() {
  renderStem(byId("stem-local"), [sourceStage(), ...replayStages(data.replay, "local_export")], "local_export");
  renderStem(byId("stem-reference"), replayStages(data.replay, "reference_export"), "reference_export");
}

// ── VIII · the live sentence of the press ───────────────────────────────────────────
function exportSentence() {
  const exp = data.replay?.local_export || {};
  const p = exp.progress;
  const sampled = Date.parse(p?.updated);
  const fresh = p && !p.stale && clock() - sampled <= 45000 && clock() - Date.parse(data.ts) <= 45000;
  const written = gb(p?.bytes), share = percentOf(p?.bytes, p?.reference_bytes);
  const at = Number.isFinite(sampled) ? minuteAt(sampled) : "";
  const date = Number.isFinite(sampled) ? longDay(sampled) : "";
  if (exp.state === "queued") return "A new attempt is queued for the verifier lock.";
  if (exp.state === "failed") return "It failed" + (at ? " at " + at + " on " + date : "") + "; the field notes record why.";
  if (exp.state === "inconclusive" || p?.phase === "stopped") return "It stopped" + (at ? " at " + at + " on " + date : "") + (Number.isFinite(p?.bytes) ? ", after " + written : "") + "; again, nothing was rejected.";
  if (exp.state === "passed" || p?.phase === "sealed") {
    const own = receiptForInput(data.replay, "local_export");
    return "It was sealed" + (at ? " at " + at + " on " + date : "") + (Number.isFinite(p?.bytes) ? ", at " + fmt(p.bytes) + " bytes." : ".") + (own ? "" : " No kernel has read it yet.");
  }
  if (!p) return "";
  if (p.phase === "preparing") return "It is preparing to write.";
  if (p.phase === "sealing") return "It has finished writing, at " + written + ", and Euler is checking its digest.";
  if (!fresh) return Number.isFinite(p.bytes) ? "The last reading, at " + at + ", showed " + written + " written." : "";
  const eta = byId("export-write-eta")?.textContent || "";
  const pace = Number.isFinite(p.rate_bps) && p.rate_bps > 0 ? (p.rate_bps >= 1e6 ? (p.rate_bps / 1e6).toFixed(1) + " MB/s" : Math.round(p.rate_bps / 1e3) + " kB/s") : "";
  const forecast = /\d:\d\d/.test(eta) ? " If that pace holds, writing should finish around " + eta.replace(/^~/, "") + "." : "";
  return "At " + at + " it had written " + written + (share ? ", " + share + " of the published size" : "") + (pace ? ", at about " + pace : "") + "." + forecast;
}
function showPress() {
  const exp = data.replay?.local_export || {};
  const p = exp.progress;
  setText("export-sentence", exportSentence());
  // A stopped writer is already the last recorded attempt; a live one is the next.
  const attempts = (exp.attempts || []).filter(a => a.ts).length;
  const current = p?.phase === "stopped" ? attempts : attempts + 1;
  setText("export-attempt", p && current > 0 ? "Attempt " + current : "");
  const phase = byId("export-phase");
  phase.dataset.state = { writing: "running", preparing: "running", sealing: "running", sealed: "passed", stopped: "inconclusive" }[p?.phase] || "pending";
  const word = { pending: "not started", queued: "queued for the verifier lock", running: "being written", passed: "sealed", inconclusive: "stopped · nothing rejected", failed: "failed" }[exp.state] || "not started";
  setText("attempt-three-state", word);
  const sampled = Date.parse(p?.updated);
  setText("attempt-three-live", p && Number.isFinite(p.bytes) ? (Number.isFinite(sampled) ? shortWhen(sampled) + " · " : "") + fmt(p.bytes) + " bytes" +
    (percentOf(p.bytes, p.reference_bytes) ? " · " + percentOf(p.bytes, p.reference_bytes) : "") +
    (Number.isFinite(p.rate_bps) && p.rate_bps > 0 ? " · " + (p.rate_bps >= 1e6 ? (p.rate_bps / 1e6).toFixed(1) + " MB/s" : Math.round(p.rate_bps / 1e3) + " kB/s") : "") : "—");
  setText("prov-own-export", (exp.state ? { pending: "Not started", queued: "Export queued", running: "Export in progress", passed: "Sealed", inconclusive: "Export stopped", failed: "Export failed" }[exp.state] || "Pending" : "Not started") +
    (p && Number.isFinite(p.bytes) ? " · " + fmt(p.bytes) + " bytes" : ""));
}

// ── IX · The second reader ──────────────────────────────────────────────────────────
const verdictWords = { passed: "Accepted", failed: "Rejected", inconclusive: "Inconclusive", running: "Running", pending: "Pending",
  completed: "Complete", complete: "Complete", blocked: "Paused", queued: "Waiting for verifier lock" };
const exportBadges = { pending: "Pending", queued: "Export queued", running: "Export in progress", passed: "Awaiting kernel",
  inconclusive: "Export stopped", failed: "Export failed" };
function operationLine(receipt, input, exportState, progressPhase) {
  const own = input === "local_export";
  if (!receipt) {
    if (own) {
      if (exportState === "running") return progressPhase === "sealing" ? "The export is written; Euler is checking its digest." :
        progressPhase === "writing" ? "Euler is writing its own export. No kernel has read it yet." : "Preparing the export of Euler’s compiled Main module.";
      return { pending: "Euler’s own export has not started.", queued: "Euler’s own export is queued for the verifier lock.",
        passed: "The export is sealed and waiting for the kernel.",
        inconclusive: "The export stopped before it was sealed. Nothing was rejected; the kernel waits for a sealed export.",
        failed: "The export failed. The kernel waits for a sealed export." }[exportState] || "No kernel receipt for Euler’s own export yet.";
    }
    return "No kernel receipt for the published export yet.";
  }
  const headline = replayHeadline(receipt);
  return {
    "Receipt unavailable": "The receipt could not be read or did not pass its checks, so no verdict is shown.",
    Unconfirmed: "The receipt reports a pass the desk could not confirm. It is held as inconclusive until it is.",
    "Waiting for headroom": "Waiting for memory headroom before the kernel starts.",
    "Controls stopped": "The attempt stopped during its controls. The real input was neither opened nor rejected.",
    "Preparation stopped": "The attempt stopped before the kernel started. The real input was neither checked nor rejected.",
    Preflight: "Preparing the pinned inputs.",
    Downloading: "Downloading the published export.",
    Decompressing: "Unpacking the published export.",
    "Checking controls": "Running the five controls.",
    Replaying: own ? "con-leche is reading Euler’s own export." : "con-leche is reading the published export.",
    Running: "The attempt is running.",
    Accepted: own ? "con-leche accepted Euler’s own export against the independent challenge and named all five theorems." :
      "con-leche accepted the published export against Euler’s own challenge and named all five theorems.",
    Rejected: "con-leche rejected this input. The receipt says where.",
    Inconclusive: "The attempt ended without a verdict. Nothing was rejected.",
    "Awaiting replay": "The receipt has no result yet.",
  }[headline] || "The receipt has no result yet.";
}
function showReplay() {
  const r = selectedReceipt(), snapshot = data.replay || {}, worker = data.worker || {};
  const own = selectedInput === "local_export";
  for (const button of document.querySelectorAll(".replay-paths button")) button.setAttribute("aria-pressed", String(button.dataset.input === selectedInput));
  const track = byId("replay-track");
  const sample = currentKernelSample(r, clock());
  const markers = replayStages(snapshot, selectedInput).map(marker => marker.name === "Kernel" && marker.detail === "Replaying" && countedPhase(sample) ?
    { ...marker, detail: (sample.phase === "check_solution" ? "Solution" : "Challenge") + " · " + phasePercent(sample) } : marker);
  const key = JSON.stringify(markers);
  if (track.dataset.key !== key) {
    track.dataset.key = key;
    track.innerHTML = markers.map(({ name, state, detail }) => '<li data-state="' + esc(tone(state)) + '">' + bud(state) +
      '<span class="track-name">' + esc(name) + '</span><strong class="track-detail">' + esc(detail) + "</strong></li>").join("");
  }
  const status = r?.result || "pending";
  const exportState = snapshot.local_export?.state || null;
  const preparingLocal = own && !r;
  const verdict = byId("replay-verdict");
  const word = r?.waiting_for_resources ? "Waiting for headroom" : r?.evidence_state === "unavailable" ? "Receipt unavailable" :
    r?.evidence_state === "unconfirmed" ? "Unconfirmed" : preparingLocal ? exportBadges[exportState] || "Pending" : verdictWords[status] || "Pending";
  setText("replay-verdict", word);
  verdict.dataset.state = r?.waiting_for_resources ? "queued" : r?.evidence_state ? "inconclusive" :
    preparingLocal ? (exportState === "passed" ? "pending" : tone(exportState)) : tone(status);
  setText("replay-kernel", r?.kernel === "con-leche" || !r ? "con-leche --compare" : r.kernel);
  setText("replay-input", own ? "Workstation export" : "Published reference export");
  const built = snapshot.build?.state === "passed" || ["completed", "complete"].includes(snapshot.build?.state) ||
    (worker.state === "completed" && worker.phase === "build");
  const modules = snapshot.build?.modules || data.closure?.total;
  setText("replay-build", built ? (modules ? fmt(modules) + " modules compiled · Lake exit 0" : "Compiled · Lake exit 0") : "Awaiting the build receipt");
  setText("replay-export-label", own ? "Workstation export" : "Published export");
  const progress = snapshot.local_export?.progress;
  const sealedAt = Date.parse(progress?.updated || snapshot.local_export?.timestamp);
  setText("replay-export", !own ? "61.57 GB · SHA-256 " + shortDigest(PUBLISHED_SOLUTION_SHA) :
    exportState === "running" ? (Number.isFinite(progress?.bytes) && progress.phase !== "preparing" ? gb(progress.bytes) + " written" : "preparing") :
    exportState === "passed" ? "sealed" + (Number.isFinite(sealedAt) ? " " + shortWhen(sealedAt) : "") :
    { queued: "queued for the verifier lock", inconclusive: "stopped · nothing rejected", failed: "failed" }[exportState] || "not started");
  setText("operation", operationLine(r, selectedInput, exportState, progress?.phase));
  byId("export-elsewhere").hidden = own || !progress;

  const transferring = status === "running" && ["download", "decompress"].includes(r?.stage) &&
    Number.isFinite(r.bytes) && r.bytes >= 0 && Number.isFinite(r.expected_bytes) && r.expected_bytes > 0;
  byId("replay-transfer").hidden = !transferring;
  if (transferring) {
    byId("input-progress").max = r.expected_bytes;
    byId("input-progress").value = r.bytes;
    setText("transfer-stage", r.stage === "download" ? "Compressed input" : "Decompressed input");
    setText("transfer-size", gb(r.bytes) + " of " + gb(r.expected_bytes));
  }
  const checker = [];
  if (Number.isFinite(r?.memory?.ram_peak)) checker.push("Peak memory " + gib(r.memory.ram_peak));
  if (Number.isFinite(r?.memory?.swap_peak)) checker.push("Peak swap " + gib(r.memory.swap_peak));
  if (Number.isFinite(r?.checker_seconds)) checker.push("Kernel time " + span(r.checker_seconds));
  byId("checker-resources").hidden = checker.length === 0;
  setText("checker-resources", checker.join(" · "));
  showControls(r);
  const source = byId("replay-source");
  const label = receiptLabel(r);
  source.replaceChildren(own ? "Exported on Euler from its own sealed Main.olean." : "Fetched from math.mit.edu/~drew/grh/ and pinned by size and SHA-256.");
  if (label) {
    const line = document.createElement("span");
    line.className = "receipt-label";
    line.textContent = label;
    source.append(" ", line);
  }
  source.hidden = false;
  // A receipt link exists only for a receipt the feed names by a known path.
  const receipt = byId("replay-receipt");
  const evidence = r?.evidence;
  const valid = typeof evidence === "string" && (evidence === archivedReceiptPath || EVIDENCE_PATH.test(evidence));
  receipt.hidden = !valid;
  if (valid) {
    receipt.href = evidence;
    setText("replay-receipt", evidence === archivedReceiptPath ? "Archived control receipt" : "Kernel receipt");
  } else {
    receipt.removeAttribute("href");
  }
  const attempts = snapshot.local_export?.attempts?.filter(attempt => attempt.ts);
  const observation = byId("export-observation");
  observation.hidden = !attempts?.length || !own;
  if (!observation.hidden) {
    const last = attempts.at(-1), notes = [];
    if (Number.isFinite(last.group_peak_bytes)) notes.push("exporter peak " + gib(last.group_peak_bytes));
    if (Number.isFinite(last.host_available_bytes)) notes.push(gib(last.host_available_bytes) + " available on the host");
    if (Number.isFinite(last.oom_kills)) notes.push(fmt(last.oom_kills) + " out-of-memory kills");
    setText("export-observation", "Last stopped attempt" + (notes.length ? " · " + notes.join(" · ") : ""));
  }
  showSentences();
}
function showSentences() {
  const replay = data.replay || {};
  const own = receiptForInput(replay, "local_export");
  const exportState = replay.local_export?.state;
  const ended = Date.parse(own?.ended);
  const day = Number.isFinite(ended) ? longDay(ended) : "";
  let sentence, settled;
  if (!own) {
    sentence = "The same examination of Euler’s own export is the experiment still in progress; its slips stay blank until a receipt arrives.";
    settled = exportState === "passed" ? "Not yet: an examination of Euler’s own export, which is sealed and waiting for the kernel." :
      exportState === "inconclusive" || exportState === "failed" ? "Not yet: an examination of Euler’s own export, whose last attempt stopped before it was sealed." :
      "Not yet: an examination of Euler’s own export, which is still being written.";
  } else if (own.evidence_state) {
    sentence = "A receipt for Euler’s own export could not be confirmed; until it is, its slips stay blank.";
    settled = "Not yet: the last attempt on Euler’s own export ended without a verdict.";
  } else if (own.result === "running" || own.waiting_for_resources) {
    sentence = "con-leche is now reading Euler’s own export; its slips stay blank until the receipt arrives.";
    settled = "Not yet: con-leche is reading Euler’s own export now.";
  } else if (own.result === "passed") {
    sentence = "On " + (Number.isFinite(ended) ? easternDate(ended, { long: true, year: false }) + ", at " + minuteAt(ended) : "a later day") + ", con-leche accepted Euler’s own export too, and named all five theorems.";
    settled = "And, since " + (day || "then") + ", con-leche’s acceptance of Euler’s own export, compiled and pressed here.";
  } else if (own.result === "failed") {
    sentence = "On " + (day || "a later day") + ", con-leche rejected Euler’s own export. The receipt is linked below.";
    settled = "On " + (day || "a later day") + ", con-leche rejected Euler’s own export; the receipt is linked from the label.";
  } else if (own.result === "inconclusive") {
    sentence = "Its attempt on Euler’s own export ended without a verdict" + (day ? " on " + day : "") + "; nothing was rejected.";
    settled = "Not yet: the last attempt on Euler’s own export ended without a verdict.";
  } else {
    sentence = "The same examination of Euler’s own export is the experiment still in progress; its slips stay blank until a receipt arrives.";
    settled = "Not yet: an examination of Euler’s own export, which is still being written.";
  }
  setText("local-sentence", sentence);
  setText("local-settled", settled);
  setText("label-sentence", own?.result === "passed" && !own.evidence_state ? "The first two are inked." :
    "The first is inked. The second is inked for the published export and pencilled, for now, for Euler’s own.");
}

// Five seed trays: what each control must do, and what the selected receipt observed.
function tray(sprouts, outcome) {
  const soil = '<path class="soil" d="M4 30h48"/><path class="soil-hatch" d="M8 34l3-3M16 34l3-3M24 34l3-3M32 34l3-3M40 34l3-3"/>';
  let plant;
  if (outcome === "pending") plant = '<ellipse class="seed dotted" cx="28" cy="27" rx="4" ry="2.6"/>';
  else if (sprouts && outcome === "matched") plant = '<ellipse class="seed" cx="28" cy="28" rx="3.6" ry="2.2"/><path class="shoot" d="M28 27V13"/><path class="leaf" d="M28 17c-6-1-9-5-9-8c4 0 8 3 9 8Z"/><path class="leaf" d="M28 15c5-1 8-4 8-7c-4 0-7 3-8 7Z"/>';
  else if (!sprouts && outcome === "matched") plant = '<ellipse class="seed" cx="28" cy="27" rx="4" ry="2.6"/><path class="closed" d="M24.6 27h6.8"/>';
  else plant = '<ellipse class="seed odd" cx="28" cy="27" rx="4" ry="2.6"/><path class="shoot odd" d="M28 25c0-4 2-6 5-8"/>';
  return '<svg class="tray-art" viewBox="0 0 56 38" aria-hidden="true" focusable="false">' + soil + plant + "</svg>";
}
function showControls(r) {
  const box = byId("replay-controls");
  const summary = controlSummary(r);
  const key = JSON.stringify([selectedInput, r?.attempt_id, summary]);
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  const rows = new Map((summary?.rows || []).map(([label, outcome]) => [label, outcome]));
  const knownAttempt = r?.attempt_id === REFERENCE_ATTEMPT && r.input === "reference_export";
  const items = controls.map(control => {
    const observed = rows.get(control.row);
    const outcome = !observed || observed === "Unrecorded" ? "pending" : observed === "Matched" ? "matched" : "unexpected";
    const state = outcome === "matched" ? "passed" : outcome === "unexpected" ? "inconclusive" : "pending";
    const exit = /exit (\d+)/.exec(observed || "")?.[1];
    const seen = outcome === "pending" ? "Not yet run." : outcome === "matched" ? (knownAttempt ? control.known : "As expected.") :
      "Not as expected" + (exit ? " (exit " + exit + ")" : "") + ".";
    return '<li class="tray slip" data-state="' + state + '">' + tray(Boolean(control.sprouts), outcome) +
      '<span class="tray-name">' + esc(control.name) + "</span>" + (control.fixture.startsWith("the ") ? '<span class="tray-fixture is-prose">' + esc(control.fixture) + "</span>" :
        '<code class="tray-fixture">' + esc(control.fixture) + "</code>") +
      '<span class="tray-expect">' + esc(control.expect) + '</span><span class="tray-seen">' + esc(seen) + "</span>" +
      '<span class="tray-shows">' + esc(control.shows) + "</span></li>";
  }).join("");
  const head = summary ? summary.text : "No controls have been run for " + (selectedInput === "local_export" ? "Euler’s own export" : "the published export") + " yet.";
  box.innerHTML = '<p class="trays-head">' + esc(head) + '</p><ol class="trays">' + items + "</ol>";
  box.dataset.state = summary?.state || "pending";
}

// The determination slips: one per exported theorem, for the selected input.
function showTheorems() {
  const box = byId("theorems");
  const replay = selectedReceipt();
  const states = targets.map(t => targetEvidence(replay, t.key));
  const passed = states.filter(s => s.state === "Passed").length;
  setText("verdict-count", passed + " of " + targets.length + " accepted on this input");
  const ended = Date.parse(replay?.ended);
  const evidence = replay?.evidence;
  const receiptPath = typeof evidence === "string" && (evidence === archivedReceiptPath || EVIDENCE_PATH.test(evidence)) ? evidence : "";
  const key = JSON.stringify([selectedInput, states, replay?.ended, receiptPath]);
  if (box.dataset.key === key) return;
  const previous = new Map([...box.querySelectorAll(".theorem")].map(el => [el.dataset.key, el.dataset.state]));
  box.dataset.key = key;
  const opened = new Set([...box.querySelectorAll("details[open]")].map(e => e.dataset.key));
  const focusKey = document.activeElement?.closest("#theorems details")?.dataset.key;
  const names = Object.keys(data.theorem_text || {});
  const day = Number.isFinite(ended) ? dayOf(ended) : "";
  box.innerHTML = targets.filter(t => !names.length || names.includes(t.key)).map(t => {
    const evidence = states[targets.indexOf(t)];
    const state = tone(evidence.state);
    const gates = evidence.gates.map(([gate, gateState]) => '<li class="stamp small ' + esc(tone(gateState) === "failed" ? "rejected" : tone(gateState)) +
      '" title="' + esc(gateNotes[gate] || gate) + '">' + esc(gate) + " · " + esc(gateState) + "</li>").join("");
    let stamp;
    if (evidence.state === "Passed") stamp = '<span class="stamp passed">Accepted</span><span class="det-line">det. con-leche · ' + esc(day) + "</span>";
    else if (evidence.state === "Rejected") stamp = '<span class="stamp rejected">Rejected</span><span class="det-line">det. con-leche · ' + esc(day) + "</span>";
    else if (["Inconclusive", "Unconfirmed", "Unavailable"].includes(evidence.state)) stamp = '<span class="pencil">no determination' + (day ? " · " + esc(day) : "") + "</span>";
    else stamp = '<span class="pencil">awaiting determination</span>';
    const landing = previous.has(t.key) && previous.get(t.key) !== state && ["passed", "failed"].includes(state) ? " landing" : "";
    if (landing) stamp = stamp.replace('class="stamp ', 'class="stamp landing ');
    return '<details class="theorem slip" data-key="' + esc(t.key) + '" data-state="' + esc(state) + '"' + (opened.has(t.key) ? " open" : "") + ">" +
      '<summary><span class="slip-label">' + esc(t.label) + '</span><span class="slip-sep" aria-hidden="true"> · </span><span class="slip-state" data-state="' + esc(state) + '">' + esc(evidence.state) + "</span></summary>" +
      '<dl class="slip-fields">' +
      "<dt>Theorem</dt><dd><code>" + esc(t.key) + "</code></dd>" +
      "<dt>In words</dt><dd>" + mathMarkup(t.plain) + "</dd>" +
      '<dt>In Lean</dt><dd><pre class="lean"><code>' + esc(t.lean) + "</code></pre></dd>" +
      "<dt>Proof term</dt><dd><code>" + esc(t.term) + "</code></dd>" +
      '<dt>Main.lean</dt><dd><a href="' + esc(MAIN_LEAN + "#L" + t.line) + '">line ' + t.line + "</a></dd>" +
      "<dt>Input</dt><dd>" + (selectedInput === "local_export" ? "Euler’s own export" : "The published export") + "</dd>" +
      "<dt>Determined by</dt><dd>con-leche 5dc36dc1, <code>--verified --compare</code></dd>" +
      '<dt>Gates</dt><dd><ul class="gates">' + gates + "</ul></dd>" +
      '<dt>Stamp</dt><dd class="slip-stamp">' + stamp + "</dd>" +
      (receiptPath ? '<dt>Receipt</dt><dd><a href="' + esc(receiptPath) + '">' + (receiptPath === archivedReceiptPath ? "Archived control receipt" : "Kernel receipt") + "</a></dd>" : "") +
      "</dl></details>";
  }).join("");
  if (focusKey) [...box.querySelectorAll("details")].find(el => el.dataset.key === focusKey)?.querySelector("summary")?.focus({ preventScroll: true });
  typesetMath(box);
}

// Kernel progress: a native <progress> and a capitulum of declarations filling.
const kernelPhaseLabels = {
  read_challenge: "Reading the challenge", read_solution: "Reading the solution",
  check_solution: "Checking solution declarations", prepare_challenge: "Preparing the challenge check",
  check_challenge: "Checking challenge declarations", finalize: "Finalizing the comparison",
};
function currentKernelSample(receipt, now) {
  const sample = receipt?.progress;
  const elapsed = now - Date.parse(sample?.updated);
  if (!sample || !Object.hasOwn(kernelPhaseLabels, sample.phase) || !(elapsed >= -5000 && elapsed <= 90000)) return null;
  return sample;
}
function countedPhase(sample) {
  return (sample?.phase === "check_solution" || sample?.phase === "check_challenge") &&
    Number.isSafeInteger(sample.completed) && Number.isSafeInteger(sample.total) &&
    sample.total > 0 && sample.completed >= 0 && sample.completed <= sample.total;
}
const phasePercent = sample => Math.floor(1000 * sample.completed / sample.total) / 10 + "%";
function showKernelProgress(receipt, now) {
  const panel = byId("kernel-progress");
  const accepted = receipt?.result === "passed" && receipt.stage === "complete" && receipt.checker_clean_exit === true &&
    receipt.checker_exit_code === 0 && Number.isSafeInteger(receipt.solution_declarations) && receipt.solution_declarations > 0 &&
    Number.isSafeInteger(receipt.challenge_declarations) && receipt.challenge_declarations > 0 && !receipt.evidence_state;
  const running = receipt?.main_replay_started && receipt.stage === "replay" && receipt.result === "running" &&
    !receipt.waiting_for_resources && !receipt.evidence_state;
  panel.hidden = !accepted && !running;
  if (panel.hidden) return;
  const bar = byId("kernel-bar");
  const caption = byId("kernel-caption");
  if (accepted) {
    setText("kernel-phase", "Kernel comparison complete");
    setText("kernel-percent", "100%");
    bar.max = receipt.solution_declarations;
    bar.value = receipt.solution_declarations;
    bar.setAttribute("aria-label", "Solution declarations checked");
    setText("kernel-count", fmt(receipt.solution_declarations) + " solution declarations · " + fmt(receipt.challenge_declarations) + " challenge declarations");
    const ended = Date.parse(receipt.ended);
    setText("kernel-eta", Number.isFinite(ended) ? "Finished " + shortWhen(ended) : "Complete");
    byId("kernel-pace").hidden = true;
    caption.innerHTML = '<span class="tag" data-tag="receipt">receipt</span> All ' + esc(fmt(receipt.solution_declarations)) + " solution declarations and " +
      esc(fmt(receipt.challenge_declarations)) + " challenge declarations checked.";
    drawKernelHead(1, "passed");
    return;
  }
  const sample = currentKernelSample(receipt, now);
  const counted = countedPhase(sample);
  const kind = sample?.phase === "check_challenge" ? "challenge" : "solution";
  setText("kernel-phase", kernelPhaseLabels[sample?.phase] || "Kernel progress");
  setText("kernel-percent", counted ? phasePercent(sample) : "");
  if (counted) {
    bar.max = sample.total;
    bar.value = sample.completed;
  } else {
    bar.removeAttribute("value");
  }
  bar.setAttribute("aria-label", kind === "challenge" ? "Challenge declarations checked" : "Solution declarations checked");
  setText("kernel-count", counted ? fmt(sample.completed) + " / " + fmt(sample.total) + " declarations" :
    sample?.phase === "finalize" ? "Awaiting the checker’s exit record" : "Awaiting a declaration checkpoint");
  const finish = Date.parse(sample?.updated) + 1000 * sample?.eta_seconds;
  const projected = counted && sample.completed < sample.total && Number.isFinite(sample.rate_per_second) &&
    sample.rate_per_second > 0 && Number.isFinite(finish) && finish > now && finish <= 8.64e15;
  setText("kernel-eta", projected ? "Phase ETA " + clockAt(finish) + " · ~" + duration(Math.ceil((finish - now) / 1000)) : "Phase ETA unavailable");
  const pace = byId("kernel-pace");
  pace.hidden = !projected;
  if (projected) setText("kernel-pace", sample.rate_per_second.toLocaleString("en-US", { maximumFractionDigits: 1 }) + " declarations/s");
  caption.innerHTML = '<span class="tag" data-tag="measured">measured</span> ' + (counted ? esc(fmt(sample.completed)) + " of " + esc(fmt(sample.total)) + " " + kind +
    " declarations checked" : "The kernel’s own count appears here at its next checkpoint") +
    ", drawn as florets filling in the order the kernel reaches them. The count is the kernel’s own; the head is a packing layout.";
  drawKernelHead(counted ? sample.completed / sample.total : 0, "running");
}
// 377 florets on a Vogel spiral stand for the declarations, filled in order as they pass.
const HEAD_FLORETS = 377;
function drawKernelHead(fraction, state) {
  const head = byId("kernel-head");
  const filled = Math.round(Math.max(0, Math.min(1, fraction)) * HEAD_FLORETS);
  const key = filled + state;
  if (head.dataset.key === key) return;
  head.dataset.key = key;
  head.dataset.state = state;
  const golden = Math.PI * (3 - Math.sqrt(5));
  let dots = "", open = "";
  for (let i = 0; i < HEAD_FLORETS; i++) {
    const r = 2.45 * Math.sqrt(i + 0.5), a = i * golden;
    const c = '<circle cx="' + (50 + r * Math.cos(a)).toFixed(2) + '" cy="' + (50 + r * Math.sin(a)).toFixed(2) + '" r="1.2"/>';
    if (i < filled) dots += c; else open += c;
  }
  head.innerHTML = '<circle class="head-rim" cx="50" cy="50" r="49"/><g class="florets-open">' + open + '</g><g class="florets-filled">' + dots + "</g>";
}

// ── The one-second tick ─────────────────────────────────────────────────────────────
// ── Now pressing: Euler's own export, then its kernel replay ─────────────────────────
// The headline instrument follows the whole life of the workstation input from
// replay.local_export and the local receipt only. Forecasts are the press gauge's own
// (exportReadout), so the two never disagree. Nothing here says "verified" before the
// local receipt passes.
const REFERENCE_BYTES = 61570595788;
const nowPhases = { read_challenge: "reading the challenge", read_solution: "reading Euler’s solution", check_solution: "checking solution declarations",
  prepare_challenge: "preparing the challenge check", check_challenge: "checking challenge declarations", finalize: "finalizing the comparison" };
function inAbout(at, now) {
  const minutes = (at - now) / 60000;
  if (!(minutes > 0)) return "";
  return minutes < 90 ? "in about " + Math.max(5, Math.round(minutes / 5) * 5) + " min" : "in about " + Math.round(minutes / 60) + " h";
}
const withAbout = (text, at, now) => text ? text + (inAbout(at, now) ? " · " + inAbout(at, now) : "") : "—";
function showNow() {
  const now = clock();
  const replay = data.replay || {};
  const exp = replay.local_export || {};
  const own = receiptForInput(replay, "local_export");
  const r = exportReadout();
  const v = { state: "pending", phase: "Not started · Euler’s own export has not begun.", size: "—", of: "of 61.57 GB", percent: "", ratio: NaN,
    labels: ["Recent pace", "Writing should finish", "Kernel could start"], facts: ["—", "—", "—"], from: NaN, to: now, stamp: "", scale: true };
  const bytes = Number.isFinite(r?.bytes) ? r.bytes : Number.isFinite(exp.bytes) ? exp.bytes : NaN;
  const pressed = () => {
    if (!Number.isFinite(bytes)) return;
    v.size = gb(bytes);
    v.percent = percentOf(bytes, REFERENCE_BYTES);
    v.ratio = bytes < REFERENCE_BYTES ? bytes / REFERENCE_BYTES : NaN;
  };
  const verdict = (word, cls) => {
    const ended = Date.parse(own.ended);
    v.stamp = '<span class="stamp ' + cls + '">' + esc(word) + '</span><span class="det-line">det. con-leche' + (Number.isFinite(ended) ? " · " + esc(dayOf(ended)) : "") + "</span>";
    v.labels = ["Kernel time", "Finished", "Declarations"];
    v.facts = [Number.isFinite(own.checker_seconds) ? span(own.checker_seconds) : "—", Number.isFinite(ended) ? shortWhen(ended) : "—",
      Number.isFinite(own.solution_declarations) ? fmt(own.solution_declarations) + " solution · " + fmt(own.challenge_declarations) + " challenge" : "—"];
    v.from = Date.parse(own.started);
    v.to = Number.isFinite(ended) ? ended : now;
    v.scale = false;
  };
  if (own) {
    if (own.evidence_state) {
      v.state = "inconclusive";
      v.phase = own.evidence_state === "unconfirmed" ? "Held back · the receipt reports a pass the desk could not confirm, so no verdict is shown." :
        "Held back · the receipt for Euler’s own export could not be read, so no verdict is shown.";
    } else if (own.result === "passed") {
      v.state = "passed";
      v.phase = "Accepted · con-leche accepted Euler’s own export against the independent challenge and named all five theorems.";
      v.size = Number.isFinite(own.solution_declarations) ? fmt(own.solution_declarations) : "—";
      v.of = "solution declarations checked";
      v.percent = "100%";
      v.ratio = 1;
      verdict("Accepted", "passed");
    } else if (own.result === "failed") {
      v.state = "failed";
      v.phase = "Rejected · con-leche rejected Euler’s own export. The receipt says where.";
      verdict("Rejected", "rejected");
    } else if (own.result === "inconclusive") {
      v.state = "inconclusive";
      v.phase = "No verdict · the replay of Euler’s own export ended without one; nothing was rejected.";
      verdict("No verdict", "inconclusive");
      v.stamp = "";
    } else if (own.waiting_for_resources) {
      v.state = "queued";
      v.phase = "Waiting for memory headroom · the kernel starts when the workstation has room.";
      pressed();
    } else if (["preflight", "controls"].includes(own.stage)) {
      v.state = "running";
      v.phase = "Checking the five controls before the kernel reads Euler’s own export.";
      v.from = Date.parse(own.started);
      pressed();
    } else {
      const sample = currentKernelSample(own, now);
      const counted = countedPhase(sample);
      const finish = Date.parse(sample?.updated) + 1000 * sample?.eta_seconds;
      const projected = counted && sample.completed < sample.total && Number.isFinite(finish) && finish > now && finish <= 8.64e15;
      v.state = "running";
      v.phase = "Reading · con-leche is " + (nowPhases[sample?.phase] || (own.main_replay_started ? "reading Euler’s own export" : "preparing the replay")) + ". No verdict yet.";
      v.size = counted ? fmt(sample.completed) : "—";
      v.of = counted ? "of " + fmt(sample.total) + " " + (sample.phase === "check_challenge" ? "challenge" : "solution") + " declarations" : "declarations, at the kernel’s next checkpoint";
      v.percent = counted ? phasePercent(sample) : "";
      v.ratio = counted ? sample.completed / sample.total : NaN;
      v.labels = ["Kernel pace", "Phase should finish", "Kernel started"];
      v.facts = [projected && sample.rate_per_second > 0 ? sample.rate_per_second.toLocaleString("en-US", { maximumFractionDigits: 1 }) + " declarations/s" : "—",
        projected ? withAbout("~" + minuteAt(finish), finish, now) : "—", Number.isFinite(Date.parse(own.started)) ? shortWhen(Date.parse(own.started)) : "—"];
      v.from = Date.parse(own.started);
      v.scale = false;
    }
  } else if (r) {
    pressed();
    v.from = r.started;
    if (exp.state === "failed") {
      v.state = "failed";
      v.phase = "The export failed · the field notes record why.";
      v.to = r.sampled;
    } else if (r.phase === "stopped" || exp.state === "inconclusive") {
      v.state = "inconclusive";
      v.phase = "Stopped · nothing rejected. The attempt stopped before it was sealed" + (Number.isFinite(r.sampled) ? ", at " + minuteAt(r.sampled) : "") + ".";
      v.to = r.sampled;
    } else if (r.sealed) {
      v.state = "pending";
      v.phase = "Sealed · Euler’s own export is written and checked; it awaits the kernel.";
      v.facts = ["—", "Written", withAbout(r.kernelStart, r.kernelAt, now)];
      v.to = r.sampled;
    } else if (r.phase === "sealing") {
      v.state = "running";
      v.phase = "Written · Euler is checking the export’s digest.";
      v.facts = ["—", "Written", withAbout(r.kernelStart, r.kernelAt, now)];
    } else if (r.phase === "preparing") {
      v.state = "running";
      v.phase = "Preparing · Euler is getting ready to write its own export.";
    } else {
      v.state = "running";
      v.phase = r.fresh ? "Writing · Euler is writing its own export. No kernel has read it yet." : "Writing · waiting for a fresh reading from the writer.";
      v.facts = [r.pace ? r.pace + (r.window ? " " + r.window : "") : r.fresh ? "measuring…" : "—", withAbout(r.writeFinish, r.writeAt, now), withAbout(r.kernelStart, r.kernelAt, now)];
    }
  } else if (exp.state === "queued") {
    v.state = "queued";
    v.phase = "Queued · Euler’s own export waits for the verifier lock.";
  } else if (exp.state === "running") {
    v.state = "running";
    v.phase = "Preparing · Euler is getting ready to write its own export.";
  } else if (exp.state === "inconclusive") {
    v.state = "inconclusive";
    v.phase = "Stopped · nothing rejected; the last attempt stopped before it was sealed.";
    pressed();
  } else if (exp.state === "failed") {
    v.state = "failed";
    v.phase = "The export failed · the field notes record why.";
  } else if (exp.state === "passed") {
    v.phase = "Sealed · Euler’s own export awaits the kernel.";
  }
  const panel = byId("now-pressing");
  panel.dataset.state = v.state;
  setText("now-phase", v.phase);
  setText("now-size", v.size);
  setText("now-of", v.of);
  setText("now-percent", v.percent);
  const bar = byId("now-bar");
  if (Number.isFinite(v.ratio)) {
    bar.max = 1000;
    bar.value = Math.round(1000 * Math.max(0, Math.min(1, v.ratio)));
  } else {
    bar.removeAttribute("value");
  }
  bar.setAttribute("aria-label", v.scale ? "Euler’s own export: bytes written against the published size" : "Euler’s own export: declarations checked by the kernel");
  ["now-pace-label", "now-first-label", "now-second-label"].forEach((id, i) => setText(id, v.labels[i]));
  ["now-pace", "now-first", "now-second"].forEach((id, i) => setText(id, v.facts[i] || "—"));
  setText("now-elapsed", Number.isFinite(v.from) && v.to >= v.from ? span((v.to - v.from) / 1000) + " since " + minuteAt(v.from) : "—");
  byId("now-scale").hidden = !v.scale;
  const stampBox = byId("now-stamp");
  if (stampBox.dataset.key !== v.stamp) {
    stampBox.dataset.key = v.stamp;
    stampBox.innerHTML = v.stamp;
  }
  stampBox.hidden = !v.stamp;
}

function stamp() {
  if (!data) return;
  showLink();
  const receipt = selectedReceipt(), start = Date.parse(receipt?.started);
  showExportProgress(data.replay?.local_export, selectedInput, receiptForInput(data.replay, "local_export"), data.ts, clock());
  guard("now", showNow);
  const summary = byId("export-summary"), note = byId("export-summary-note");
  note.hidden = !summary.hidden;
  if (summary.hidden) {
    note.textContent = { queued: "queued for the verifier lock", running: "preparing Euler’s own export", passed: "sealed",
      inconclusive: "stopped · nothing rejected", failed: "export failed · see the field notes" }[data.replay?.local_export?.state] ||
      "not yet: Euler’s own export has not started";
  }
  showKernelProgress(receipt, clock());
  const end = receipt?.ended ? Date.parse(receipt.ended) : receipt?.result === "running" ? clock() : NaN;
  setText("elapsed", Number.isFinite(start) && Number.isFinite(end) ? "Attempt duration " + span((end - start) / 1000) : "");
  const read = Date.parse(data.ts);
  setText("stamp", Number.isFinite(read) ? "Feed updated " + shortWhen(read) : "");
  setText("printed-from", "Printed from run " + (data.run_id || "rh-20261120") + " · source " + PIN.slice(0, 8) + (Number.isFinite(read) ? " · feed read " + whenAt(read) : ""));
}

// ── VII · Sixty-four hours on one desk ──────────────────────────────────────────────
let archiveEvidence = { run: null, parts: null, loading: false };
let archiveViewKey;
function showArchive() {
  if (!data) return;
  const byPart = new Map((data.parts || []).map(part => [part.part, part]));
  const matched = [...byPart.values()].filter(part => part.kind === "part_done").length;
  setText("archive-count", archiveEvidence.loading ? "Reading the archive record…" : fmt(matched) + " / 14 parts verified");
  const hashes = archiveEvidence.run === data.run_id ? archiveEvidence.parts : null;
  const key = JSON.stringify([data.parts, hashes, archiveEvidence.loading]);
  if (key === archiveViewKey) return;
  archiveViewKey = key;
  byId("downloads").replaceChildren(...Array.from({ length: 14 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0"), part = byPart.get(i + 1) || {};
    const digest = hashes?.["lean.tar.gz.part" + n];
    const row = document.createElement("div");
    row.className = "part";
    row.dataset.state = part.kind === "part_done" ? "passed" : "pending";
    const flower = document.createElement("span");
    flower.className = "part-rosette";
    if (HEX64.test(digest || "")) flower.append(rosetteSVG(digest, { size: 30, decorative: true }));
    const name = document.createElement("span");
    name.className = "part-name";
    name.textContent = "Part " + n;
    const size = document.createElement("span");
    size.className = "part-state";
    size.textContent = Number.isFinite(part.total || part.bytes) ? mb(part.total || part.bytes) : part.kind === "part_done" ? "verified" : "pending";
    const label = document.createElement("span");
    label.className = "part-label";
    label.textContent = "SHA-256";
    const code = document.createElement("code");
    code.textContent = HEX64.test(digest || "") ? digest : archiveEvidence.loading ? "Reading the archive record…" : "Digest unavailable";
    row.append(flower, name, size, label, code);
    return row;
  }));
}
async function readArchive() {
  if (!data || !byId("source-acquisition").open) return;
  const run = data.run_id;
  if (archiveEvidence.run === run && (archiveEvidence.loading || archiveEvidence.parts)) return;
  archiveEvidence = { run, parts: null, loading: true };
  showArchive();
  try {
    const provenance = await read("./feed/evidence/source-provenance.json");
    if (archiveEvidence.run === run) archiveEvidence.parts = provenance.parts || null;
  } catch { /* the rows say "Digest unavailable" */ } finally {
    if (archiveEvidence.run === run) archiveEvidence.loading = false;
    showArchive();
  }
}
byId("source-acquisition").addEventListener("toggle", readArchive);

function showBuild() {
  const completed = data.completed || {}, closure = data.closure || {}, worker = data.worker || {};
  const count = Object.values(completed).reduce((a, b) => a + b, 0), total = closure.total || 0;
  const build = data.replay?.build;
  const built = build?.state === "passed" || (worker.phase === "build" && worker.state === "completed");
  const overallKey = count + "/" + total + built;
  const overall = byId("overall");
  if (overall.dataset.key !== overallKey) {
    overall.dataset.key = overallKey;
    overall.innerHTML = '<span class="overall-count">' + (built && total && count >= total ? "All " + fmt(total) + " modules compiled" :
      fmt(count) + " / " + (total ? fmt(total) : "—") + " modules compiled") + "</span>" +
      '<progress aria-label="Modules compiled" value="' + Math.min(count, total || 1) + '" max="' + Math.max(1, total) + '"></progress>';
    overall.dataset.state = built ? "passed" : count ? "running" : "pending";
  }
  if (built) {
    setText("forecast-finish", "Compilation complete");
    setText("forecast-title", "Compilation record");
    setText("forecast-jump", "Compilation record");
  }
  // The jump link only says something new while a finish is projected.
  byId("forecast-jump").hidden = built;
  setText("transfer", built ? "No modules have compiled in the last ten minutes; the build is complete." :
    count ? fmt(data.completed_last_ten_min) + " unique modules completed in the last 10 minutes" : "");
  const metrics = worker.metrics || {};
  const finalJobs = built && Number.isSafeInteger(metrics.lake_done) && Number.isSafeInteger(metrics.lake_total) &&
    metrics.lake_done >= 0 && metrics.lake_total > 0 && metrics.lake_done <= metrics.lake_total;
  const lake = finalJobs ? { done: metrics.lake_done, total: metrics.lake_total } : data.lake;
  setText("lake", lake ? "Lake jobs " + fmt(lake.done) + " / " + fmt(lake.total) : "Lake jobs pending");
  const active = data.active || [];
  const activeKey = JSON.stringify([active, built]);
  if (byId("active").dataset.key !== activeKey || active.length) {
    byId("active").dataset.key = activeKey;
    byId("active").innerHTML = active.length ? active.map(m => '<div class="active-row"><code>' + esc(m.name) + "</code> <small>" +
      esc(span((clock() - Date.parse(m.ts)) / 1000)) + "</small></div>").join("") :
      '<p class="quiet">' + (built ? "Nothing is compiling. The build finished at 5:09:04 a.m. EST on 23 November 2026." : "Waiting for compiler activity.") + "</p>";
  }
  const libraries = Object.entries(closure.libraries || {}).sort((a, b) => b[1] - a[1]);
  const top = Math.log10(Math.max(1, ...libraries.map(([, n]) => n)) + 1);
  const libKey = JSON.stringify([libraries, completed]);
  const libs = byId("libs");
  if (libs.dataset.key !== libKey) {
    libs.dataset.key = libKey;
    libs.innerHTML = libraries.map(([name, n]) => {
      const done = completed[name] || 0;
      const width = (100 * Math.log10(n + 1) / top).toFixed(2);
      const share = n ? (100 * done / n).toFixed(1) : "0";
      return '<div class="library" data-state="' + (done >= n ? "passed" : done ? "running" : "pending") + '"><code class="library-name">' + esc(name) +
        '</code><span class="library-bar" aria-hidden="true"><span class="library-stem" data-width="' + width + '"><span class="library-done" data-share="' + share +
        '"></span></span></span><span class="library-count">' + fmt(done) + " / " + fmt(n) + "</span></div>";
    }).join("");
    for (const stem of libs.querySelectorAll("[data-width]")) stem.style.width = stem.dataset.width + "%";
    for (const done of libs.querySelectorAll("[data-share]")) done.style.width = done.dataset.share + "%";
  }
  showArchive();
}

// The growth chart: cumulative completions against hours, from the per-module data plate.
const DAWN = Date.parse("2026-11-23T12:09:00Z"); // civil dawn at the workstation on 23 November 2026, computed (±2 min)
const RESTARTS = ["2026-11-20T17:52:35Z", "2026-11-20T17:57:04Z", "2026-11-20T21:52:58Z"].map(Date.parse);
let growthModel = null, growthWidth = 0;
async function loadGrowth() {
  const figure = byId("growth");
  const stage = byId("growth-stage");
  try {
    const { loadCapitulum } = await import("./capitulum-data.js");
    const plate = await loadCapitulum();
    const per = plate.perMinute;
    const cumulative = new Float64Array(per.length);
    let sum = 0;
    for (let i = 0; i < per.length; i++) { sum += per[i]; cumulative[i] = sum; }
    growthModel = { start: Date.parse(plate.start), end: Date.parse(plate.end), cumulative, total: sum };
    stage.replaceChildren();
    stage.classList.add("is-drawn");
    figure.dataset.figureState = "mounted";
    drawGrowth();
    new ResizeObserver(() => drawGrowth()).observe(stage);
  } catch (error) {
    figure.dataset.figureState = "fallback";
    figure.dataset.figureError = String(error?.message || error).slice(0, 200);
  }
}
function drawGrowth() {
  const stage = byId("growth-stage");
  const model = growthModel;
  if (!model) return;
  const width = Math.max(260, Math.floor(stage.clientWidth));
  if (width === growthWidth) return;
  growthWidth = width;
  const narrow = width < 600;
  const height = narrow ? 300 : 380;
  const m = { l: narrow ? 46 : 74, r: narrow ? 14 : 28, t: 30, b: 56 };
  const lastMinute = (DAWN - model.start) / 60000 + 25;
  const x = minute => m.l + (minute / lastMinute) * (width - m.l - m.r);
  const y = n => height - m.b - (n / model.total) * (height - m.t - m.b);
  const minuteOf = ms => (ms - model.start) / 60000;
  const base = y(0);
  const parts = [];
  const text = (tx, ty, s, cls = "", anchor = "start") => '<text x="' + tx.toFixed(1) + '" y="' + ty.toFixed(1) + '" class="' + cls + '" text-anchor="' + anchor + '">' + esc(s) + "</text>";
  // The ground, and the measured height of the plant at every hour.
  parts.push('<path class="g-ground" d="M' + m.l + " " + base + "H" + (width - m.r) + '"/>');
  let stakes = "";
  for (let h = 1; h * 60 < model.cumulative.length; h++) stakes += "M" + x(h * 60).toFixed(1) + " " + base.toFixed(1) + "V" + y(model.cumulative[h * 60]).toFixed(1);
  parts.push('<path class="g-stakes" d="' + stakes + '"/>');
  // Hours since the first module.
  for (let h = 0; h <= 64; h += narrow ? 24 : 12) {
    parts.push('<path class="g-tick" d="M' + x(h * 60).toFixed(1) + " " + base + "v5" + '"/>');
    parts.push(text(x(h * 60), base + 18, h + " h", "g-label", h ? "middle" : "start"));
  }
  // Annotations keep apart: the axis name bottom left, dawn bottom right, Main at its point.
  parts.push(text(m.l, base + 40, "hours since the first module", "g-label g-axis", "start"));
  // Dawn at the workstation on the fourth day.
  const dawn = x(minuteOf(DAWN));
  parts.push('<path class="g-dawn" d="M' + dawn.toFixed(1) + " " + (m.t + 4) + "V" + base.toFixed(1) + '"/>');
  parts.push(text(dawn, base + 40, narrow ? "dawn" : "dawn, 23 November", "g-label g-dawn-label", "end"));
  // The curve itself, and the full height it reached.
  let curve = "";
  for (let i = 0; i < model.cumulative.length; i += 2) curve += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(model.cumulative[i]).toFixed(1);
  curve += "L" + x(model.cumulative.length - 1).toFixed(1) + " " + y(model.total).toFixed(1);
  parts.push('<path class="g-curve" d="' + curve + '"/>');
  parts.push('<path class="g-top" d="M' + m.l + " " + y(model.total).toFixed(1) + "H" + x(model.cumulative.length - 1).toFixed(1) + '"/>');
  for (const n of [50000, 100000, 150000]) {
    parts.push('<path class="g-tick" d="M' + (m.l - 5) + " " + y(n).toFixed(1) + "h5" + '"/>');
    parts.push(text(m.l - 9, y(n) + 4, narrow ? n / 1000 + "k" : fmt(n), "g-label", "end"));
  }
  parts.push(text(m.l - 9, y(model.total) + 4, narrow ? "175k" : fmt(model.total), "g-label g-gold", "end"));
  parts.push(text(m.l, m.t - 12, "modules completed", "g-label g-axis"));
  // The three false starts, as scars near the base.
  for (const at of RESTARTS) {
    const px = x(Math.max(0, minuteOf(at))), py = y(model.cumulative[Math.max(0, Math.round(minuteOf(at)))] || 0);
    parts.push('<path class="g-scar" d="M' + (px - 3).toFixed(1) + " " + (py - 3).toFixed(1) + "l6 6M" + (px + 3).toFixed(1) + " " + (py - 3).toFixed(1) + 'l-6 6"/>');
  }
  const scar = x(minuteOf(RESTARTS[2]));
  parts.push(text(scar + 8, y(model.cumulative[Math.round(minuteOf(RESTARTS[2]))] || 0) + 4, "three false starts", "g-label g-scar-label"));
  // Main.
  const mx = x(minuteOf(model.end)), my = y(model.total);
  parts.push('<circle class="g-main" cx="' + mx.toFixed(1) + '" cy="' + my.toFixed(1) + '" r="4.2"/>');
  parts.push(text(mx + 6, my - 12, "Main, " + easternClock(model.end, { seconds: true, zone: !narrow }), "g-label g-main-label", "end"));
  stage.innerHTML = '<svg class="growth-chart" viewBox="0 0 ' + width + " " + height + '" width="' + width + '" height="' + height +
    '" role="img" aria-label="' + esc(stage.dataset.alt || "") + '">' + parts.join("") + "</svg>";
}

// ── Appendix A · the label of evidence ──────────────────────────────────────────────
let manifestKey;
async function evidenceLink() {
  try {
    manifest = await read("./feed/evidence/manifest.json");
    byId("evidence-manifest").hidden = manifest.run_id !== "rh-20261120";
  } catch {
    manifest = null;
    byId("evidence-manifest").hidden = true;
  }
  guard("manifest", showManifest);
}
function showManifest() {
  const list = byId("manifest-records");
  const key = JSON.stringify([manifest?.run_id, manifest?.records || null, manifest?.updated]);
  if (key === manifestKey) return;
  manifestKey = key;
  const state = byId("manifest-state");
  if (!manifest) {
    state.textContent = "The manifest could not be read. The page will try again.";
    list.replaceChildren();
    return;
  }
  const run = manifest.run_id;
  if (run !== (data?.run_id || "rh-20261120")) {
    state.textContent = "This manifest belongs to another run (" + run + "); its records are not shown.";
    list.replaceChildren();
    return;
  }
  const updated = Date.parse(manifest.updated);
  const replayWord = { passed: "accepted", failed: "rejected", inconclusive: "inconclusive", running: "running" }[manifest.replay_results?.reference_export] || "pending";
  state.textContent = "Manifest for run " + run + (Number.isFinite(updated) ? " · updated " + whenAt(updated) : "") +
    " · result scope: workstation build · published-input replay: " + replayWord;
  const records = Object.entries(manifest.records || {}).sort(([a], [b]) => a.localeCompare(b));
  if (!records.some(([name]) => name === "local-replay.json")) records.push(["local-replay.json", null]);
  list.replaceChildren(...records.map(([name, record]) => {
    const row = document.createElement("tr");
    const head = document.createElement("th");
    head.scope = "row";
    const code = document.createElement("code");
    code.textContent = name;
    head.append(code);
    const digest = document.createElement("td");
    digest.className = "record-digest";
    const flower = document.createElement("td");
    flower.className = "record-rosette";
    const open = document.createElement("td");
    if (record && HEX64.test(record.sha256 || "")) {
      const hex = document.createElement("code");
      hex.textContent = record.sha256;
      digest.append(hex);
      flower.append(rosetteSVG(record.sha256, { size: 40, decorative: true }));
    } else {
      digest.textContent = "not yet published";
      digest.classList.add("quiet");
    }
    if (record && EVIDENCE_PATH.test(record.url || "")) {
      const link = document.createElement("a");
      link.href = record.url;
      link.textContent = "JSON";
      link.setAttribute("aria-label", "Open " + name);
      open.append(link);
    }
    row.append(head, digest, flower, open);
    return row;
  }));
}
function pair(label, observed, expected, observedLabel, expectedLabel, gold) {
  const row = document.createElement("div");
  row.className = "digest-pair";
  const same = HEX64.test(observed || "") && observed === expected;
  row.dataset.state = !HEX64.test(observed || "") ? "pending" : same ? "passed" : "failed";
  const head = document.createElement("p");
  head.className = "pair-label";
  head.textContent = label;
  const flowers = document.createElement("div");
  flowers.className = "pair-flowers";
  for (const [digest, caption] of [[observed, observedLabel], [expected, expectedLabel]]) {
    const cell = document.createElement("figure");
    cell.append(rosetteSVG(HEX64.test(digest || "") ? digest : "", { size: 58, decorative: true, gold: same && gold }));
    const note = document.createElement("figcaption");
    note.append(caption, document.createElement("br"), shortDigest(digest));
    cell.append(note);
    flowers.append(cell);
  }
  const verdict = document.createElement("p");
  verdict.className = "pair-verdict";
  verdict.textContent = !HEX64.test(observed || "") ? "Awaiting the receipt" : same ? "Identical digests, identical rosettes" : "The digests differ";
  row.append(head, flowers, verdict);
  return row;
}
let provenanceKey;
function showProvenance() {
  const reference = receiptForInput(data.replay, "reference_export") || {};
  const build = data.replay?.build || {};
  const accepted = reference.result === "passed" && !reference.evidence_state;
  const key = JSON.stringify([reference.attempt_id, reference.solution_sha256, reference.archive_sha256, reference.kernel_sha256, build.main_sha256, accepted, data.run_id]);
  if (key === provenanceKey) return;
  provenanceKey = key;
  setText("prov-run", data.run_id || "rh-20261120");
  const fields = {
    "prov-kernel-commit": reference.kernel_commit, "prov-kernel-binary": reference.kernel_sha256,
    "prov-challenge": reference.challenge_sha256, "prov-build-record": reference.build_record_sha256,
    "prov-solution": reference.solution_sha256, "prov-archive": reference.archive_sha256, "prov-main-olean": build.main_sha256,
  };
  for (const [id, value] of Object.entries(fields)) if (value && /^[a-f0-9]{40,64}$/.test(value)) setText(id, value);
  byId("digest-pairs").replaceChildren(
    pair("Published export, unpacked · 61,570,595,788 bytes", reference.solution_sha256, PUBLISHED_SOLUTION_SHA, "Euler’s receipt", "MIT’s published file", accepted),
    pair("Main.olean", build.main_sha256, MIT_MAIN_OLEAN_SHA, "Built on Euler", "Published from MIT", build.state === "passed"),
    pair("Source archive", reference.archive_sha256, ARCHIVE_SHA, "Euler’s receipt", "Pinned archive", accepted),
  );
  const compressed = byId("prov-compressed");
  if (!compressed.firstChild) compressed.append(rosetteSVG(PUBLISHED_COMPRESSED_SHA, { size: 26, decorative: true }));
}

// ── Appendix B · field notes ────────────────────────────────────────────────────────
function vital(title, value, note, values, min, max) {
  const w = 300, h = 52;
  const clamp = v => Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
  const points = values.map((v, i) => (w * i / Math.max(1, values.length - 1)).toFixed(1) + "," + (h - 4 - (h - 10) * clamp(v)).toFixed(1));
  const area = points.length ? "0," + h + " " + points.join(" ") + " " + w + "," + h : "";
  let ticks = "";
  for (let i = 0; i < values.length; i += 6) ticks += "M" + (w * i / Math.max(1, values.length - 1)).toFixed(1) + " " + h + "v-4";
  return '<div class="chart"><span>' + esc(title) + "</span><b>" + esc(value) + "</b><small>" + esc(note) + '</small><svg viewBox="0 0 ' + w + " " + h +
    '" preserveAspectRatio="none" aria-hidden="true" focusable="false"><polygon class="vital-area" points="' + area + '"/><path class="vital-ticks" d="' + ticks +
    '"/><polyline class="vital-trace" points="' + points.join(" ") + '" vector-effect="non-scaling-stroke"/></svg></div>';
}
function showHost() {
  const h = data.host || {}, history = (data.history || []).filter(v => Number.isFinite(v.ts));
  const charts = byId("charts");
  if (!history.length) {
    charts.innerHTML = '<p class="quiet">No host samples yet.</p>';
    return;
  }
  const disk = history.map(v => (v.read || 0) + (v.write || 0)), net = history.map(v => (v.receive || 0) + (v.send || 0));
  const first = history[0].ts * 1000, last = history.at(-1).ts * 1000;
  setText("sample-range", easternRange(first, last) + " · " + history.length + " samples, 10 seconds apart");
  charts.innerHTML = vital("Processor", (h.cpu ?? 0) + "%", "of all cores", history.map(v => v.cpu), 0, 100) +
    vital("Memory", gib(h.memory), "of " + gib(h.memory_total), history.map(v => v.memory), 0, h.memory_total) +
    vital("Storage I/O", "read " + mbps(h.read), "write " + mbps(h.write), disk, 0, Math.max(...disk, 1)) +
    vital("Network I/O", "receive " + mbps(h.receive), "transmit " + mbps(h.send), net, 0, Math.max(...net, 1));
  const metrics = data.worker?.metrics || {};
  byId("guest").hidden = !local;
  setText("guest", local ? "Linux environment · " + memory(metrics.guest_disk_free) + " free of " + memory(metrics.guest_disk_total) +
    " · compilers " + fmt(metrics.active_compilers) + " of " + fmt(metrics.compiler_slots) : "");
}

// Consecutive repeats fold into one row: "Writing Main proof export ×140 · last 2:03:47 p.m. EST".
const kindWords = { module_start: "module", module_done: "module", module_fail: "module stopped", stage_start: "stage", stage_done: "stage",
  stage_fail: "stage stopped", part_start: "download", part_progress: "download", part_done: "download", lake_jobs: "lake", progress: "progress",
  result: "result", warning: "warning", error: "error", info: "note", test: "test", check: "check", retry: "retry" };
function collapse(events) {
  const groups = [];
  for (const e of events) {
    const last = groups.at(-1);
    if (last && last.kind === e.kind && last.stage === e.stage && (last.message || "") === (e.message || "")) last.entries.push(e);
    else groups.push({ kind: e.kind, stage: e.stage, message: e.message, entries: [e] });
  }
  return groups;
}
function eventRow(e, extra = "") {
  const at = Date.parse(e.ts);
  const size = e.kind === "progress" && Number.isFinite(e.bytes) ? '<span class="ev-bytes"> · ' + esc(gb(e.bytes)) + "</span>" : "";
  return '<div class="event" data-kind="' + esc(e.kind) + '"><time datetime="' + esc(e.ts) + '" title="' + esc(Number.isFinite(at) ? easternWhen(at, { seconds: true }) : e.ts) + '">' +
    (Number.isFinite(at) ? esc(easternClock(at, { seconds: true, zone: false })) : "—") + '</time><span class="kind">' + esc(kindWords[e.kind] || String(e.kind || "").replaceAll("_", " ")) +
    '</span><span class="message">' + esc(e.message || e.module || e.stage) + size + extra + "</span></div>";
}
function renderRows() {
  if (!data) return;
  const query = byId("find").value.toLowerCase().trim(), kind = byId("type").value;
  const chosen = records.filter(e => (!kind || String(e.kind).includes(kind) || (kind === "error" && String(e.kind).includes("fail"))) &&
    (!query || JSON.stringify(e).toLowerCase().includes(query)));
  const groups = collapse(chosen.slice(0, 1500)).slice(0, 400);
  // The rows give the clock alone; the column head names the zone of the newest row shown.
  setText("rows-zone", easternZone(Date.parse(chosen[0]?.ts) || clock()));
  byId("rows").innerHTML = groups.map(group => {
    const newest = group.entries[0], oldest = group.entries.at(-1);
    if (group.entries.length === 1) return eventRow(newest);
    const id = String(oldest.seq ?? oldest.ts);
    const open = expanded.has(id);
    const last = Date.parse(newest.ts);
    const tail = '<span class="repeat"> ×' + fmt(group.entries.length) + (Number.isFinite(last) ? " · last " + esc(clockAt(last)) : "") +
      '</span> <button class="unfold" type="button" data-group="' + esc(id) + '" aria-expanded="' + open + '">' + (open ? "Fold" : "Show all " + fmt(group.entries.length)) + "</button>";
    return '<div class="event-group' + (open ? " is-open" : "") + '">' + eventRow({ ...oldest, bytes: newest.bytes }, tail) +
      (open ? '<div class="event-run">' + group.entries.map(e => eventRow(e)).join("") + "</div>" : "") + "</div>";
  }).join("") || '<p class="quiet">No entries match this selection.</p>';
  setText("search-state", paused ? "Paused at " + clockAt(pausedAt) : query || kind ? fmt(chosen.length) + " matching · " + fmt(data.sequence) + " recorded" :
    fmt(records.length) + " shown · " + fmt(data.sequence) + " recorded");
  byId("latest").hidden = !historyMode;
}
byId("rows").addEventListener("click", event => {
  const button = event.target.closest?.("button.unfold");
  if (!button) return;
  const id = button.dataset.group;
  if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
  renderRows();
  byId("rows").querySelector('button.unfold[data-group="' + CSS.escape(id) + '"]')?.focus();
});
// A frozen copy keeps event chunks first_chunk…last_chunk (feed/snapshot.json): "Load earlier
// notes" starts below the notes the page opens with and rests once the first chunk is read.
const ledgerStart = () => frozen ? snapshotMeta?.events?.earlier_from ?? 0 : data?.last_chunk || 0;
const ledgerFloor = () => frozen ? snapshotMeta?.events?.first_chunk ?? Infinity : 1;
function restOlder() {
  const button = byId("older"), rested = frozen && olderChunk < ledgerFloor();
  button.disabled = rested;
  if (frozen) button.textContent = rested ? "No earlier notes in this copy" : "Load earlier notes";
}
function live() {
  historyMode = false;
  generation++;
  records = data?.events || [];
  olderChunk = ledgerStart();
  if (frozen) restOlder();
  renderRows();
}
async function older(reset) {
  if (!data) return;
  const run = ++generation, q = byId("find").value.trim();
  historyMode = true;
  byId("older").disabled = true;
  setText("search-state", "Searching…");
  try {
    if (local) {
      const before = reset ? 0 : (records.at(-1)?.seq || 0);
      const page = await read("./api/events?q=" + encodeURIComponent(q) + "&before=" + before);
      if (run !== generation) return;
      records = reset ? page : records.concat(page);
    } else {
      if (reset) { records = data.events || []; olderChunk = ledgerStart(); }
      const all = new Map(records.map(e => [e.seq, e]));
      for (let i = 0; i < 6 && olderChunk >= ledgerFloor(); i++) {
        const response = await fetch("./feed/events/" + String(olderChunk).padStart(12, "0") + ".jsonl?rev=2");
        if (!response.ok) throw Error(String(response.status));
        const lines = (await response.text()).trim().split("\n").filter(Boolean).map(s => JSON.parse(s));
        if (run !== generation) return;
        for (const e of lines) if (!q || JSON.stringify(e).toLowerCase().includes(q.toLowerCase())) all.set(e.seq, e);
        olderChunk--;
      }
      records = [...all.values()].sort((a, b) => b.seq - a.seq);
    }
    renderRows();
  } catch (error) {
    setText("search-state", "The notes could not be read (" + String(error.message).replace(/^HTTP /, "") + "). The page will try again.");
  } finally {
    if (run === generation) restOlder();
  }
}
byId("older").addEventListener("click", () => older(false));
byId("latest").addEventListener("click", () => { byId("find").value = ""; byId("type").value = ""; live(); });
byId("type").addEventListener("change", renderRows);
let searchTimer;
byId("find").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => byId("find").value ? older(true) : live(), 270);
});
byId("pause").addEventListener("click", () => {
  paused = !paused;
  pausedAt = Date.now();
  byId("pause").textContent = paused ? "Resume updates" : "Pause updates";
  byId("pause").setAttribute("aria-pressed", String(paused));
  if (!paused) live(); else renderRows();
});

// ── Local mode: the keeper's bench ──────────────────────────────────────────────────
async function rawLog(previous) {
  try {
    const r = await read("./api/log?name=" + encodeURIComponent(byId("log-file").value) + "&q=" + encodeURIComponent(byId("log-q").value) + (previous ? "&before=" + oldLog : ""));
    byId("raw-text").textContent = r.text || "No matching lines in this block.";
    oldLog = r.before;
    byId("older-log").hidden = !oldLog;
  } catch (error) {
    byId("raw-text").textContent = error.message === "HTTP 404" ? "Unknown log." : "The log could not be read (" + String(error.message).replace(/^HTTP /, "") + ").";
  }
}
async function readLocal() {
  const info = byId("local-info");
  try {
    localData = await read("./api/local");
  } catch (error) {
    byId("machine").hidden = false;
    info.innerHTML = '<p class="quiet">The workstation did not answer (' + esc(String(error.message).replace(/^HTTP /, "")) + ").</p>";
    return;
  }
  byId("raw").hidden = byId("machine").hidden = false;
  const select = byId("log-file"), previous = select.value;
  const logs = localData.logs || [];
  if (select.dataset.key !== JSON.stringify(logs)) {
    select.dataset.key = JSON.stringify(logs);
    select.replaceChildren(...logs.map(name => {
      const option = document.createElement("option");
      option.textContent = name;
      return option;
    }));
    if (logs.includes(previous)) select.value = previous;
  }
  const cores = (localData.cores || []).map((v, i) => '<span class="core">CPU ' + (i + 1) + " · " + esc(v) + "%</span>").join("");
  const processes = (localData.processes || []).map(p => "<span>" + esc(p.name) + " (" + fmt(p.pid) + ") · " + esc(memory(p.rss)) + " resident · " + fmt(p.cpu) + "% CPU</span>").join("");
  info.innerHTML = '<h4>Logical processors</h4><div class="local-grid">' + cores + '</div><h4>Largest resident processes</h4><div class="local-grid">' + processes + "</div>" +
    '<p class="quiet">Host swap ' + esc(memory(data?.host?.swap)) + " / " + esc(memory(data?.host?.swap_total)) + " · Publisher · " +
    esc(localData.publisher?.message || localData.publisher?.state || "waiting for its first receipt") + "</p>";
  if (localData.worker?.processes?.length) {
    info.insertAdjacentHTML("beforeend", "<h4>Linux compiler processes</h4>" + localData.worker.processes.map(p => '<div class="active-row">' +
      esc(p.module) + " (" + fmt(p.pid) + ") · " + esc(memory(p.rss)) + " resident · " + fmt(p.cpu) + "% CPU</div>").join(""));
  }
}
function workspaceMenu() {
  const menu = document.createElement("details");
  menu.className = "workspace-menu";
  menu.innerHTML = '<summary>Keeper’s bench</summary><nav aria-label="Keeper’s bench"><a href="./check-ins">Check-ins</a><a href="./visitors">Visitors</a><a href="./research">Research</a></nav>';
  const before = byId("motion-switch");
  before.parentNode.insertBefore(menu, before);
  const summary = menu.querySelector("summary");
  menu.addEventListener("keydown", event => {
    if (event.key === "Escape" && menu.open) {
      menu.open = false;
      summary.focus();
    }
  });
  document.addEventListener("click", event => { if (menu.open && !menu.contains(event.target)) menu.open = false; });
}

// ── The refresh ─────────────────────────────────────────────────────────────────────
async function refresh() {
  try {
    const incoming = await read("./feed/status.json");
    if (frozen) snapshotMeta ??= await read("./feed/snapshot.json").catch(() => ({}));
    incoming.replay = await replayForView(incoming.run_id, incoming.replay, local);
    data = incoming;
  } catch (error) {
    if (!data) setText("operation", "Waiting for the run feed · " + error.message);
    else byId("link-state").title = "The feed did not answer (" + error.message + "). Showing the last reading, from " + clockAt(Date.parse(data.ts)) + ".";
    guard("stamp", stamp);
    return;
  }
  if (byId("source-acquisition").open && archiveEvidence.run !== data.run_id) readArchive();
  guard("stamp", stamp);
  guard("label", showLabel);
  guard("pipeline", showPipeline);
  guard("replay", showReplay);
  guard("theorems", showTheorems);
  guard("press", showPress);
  guard("build", showBuild);
  guard("provenance", showProvenance);
  guard("manifest", showManifest);
  guard("host", showHost);
  guard("structure", () => showProofStructure(byId("proof-structure"), data, selectedInput));
  if (!historyMode && !paused) { records = data.events || []; olderChunk = ledgerStart(); if (frozen) restOlder(); guard("ledger", renderRows); }
  story.update(viewFeed());
  if (local && ++tick % 3 === 1) readLocal();
}

function select(input) {
  if (!["local_export", "reference_export"].includes(input)) return;
  const changed = input !== selectedInput;
  selectedInput = input;
  if (!data) return;
  guard("replay", showReplay);
  guard("theorems", showTheorems);
  guard("stamp", stamp);
  guard("structure", () => showProofStructure(byId("proof-structure"), data, selectedInput));
  if (changed) story.update(viewFeed());
}
document.addEventListener("click", event => {
  const control = event.target.closest?.("[data-input]");
  if (control && !control.closest("[data-figure]")) select(control.dataset.input);
});
byId("read-log").addEventListener("click", () => rawLog(false));
byId("older-log").addEventListener("click", () => rawLog(true));

if (local) {
  workspaceMenu();
  byId("vitals").open = true;
  import("./local/check-ins.js").then(module => module.attachOverview?.(byId("checkin-overview"))).catch(() => {});
}
showProofStructure(byId("proof-structure"), {});
// The press scale keeps its end label ("61.57 GB") clear: a tick label within about two
// and a half of its own widths of the end label gives way (its tick mark stays).
function fitPressScale() {
  for (const scale of document.querySelectorAll(".press-scale")) {
    const end = scale.querySelector(".press-end");
    if (!end) continue;
    const edge = end.getBoundingClientRect().left;
    for (const label of scale.querySelectorAll("span:not(.press-end):not(:first-child)")) {
      label.classList.remove("is-muted");
      const box = label.getBoundingClientRect();
      if (box.width && box.right + 2.5 * box.width > edge) label.classList.add("is-muted");
    }
  }
}
const scaleWatcher = new ResizeObserver(fitPressScale);
document.querySelectorAll(".press-scale").forEach(scale => scaleWatcher.observe(scale));
const growth = byId("growth");
growth.querySelector(".figure-stage").dataset.alt = growth.querySelector(".figure-stage").textContent.trim();
if ("IntersectionObserver" in window) {
  const watcher = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      watcher.disconnect();
      loadGrowth();
    }
  }, { rootMargin: "100% 0px 100% 0px" });
  watcher.observe(growth);
} else {
  loadGrowth();
}
// A frozen copy says so where the live page says "now", and keeps still.
if (frozen) {
  byId("pause").hidden = true;
  const title = byId("now-title");
  title.replaceChildren(...title.querySelectorAll(".now-dot"), "Pressing, as of " + whenAt(frozenAt));
  const living = document.createElement("a");
  living.href = "http://localhost:8765/";
  living.textContent = "localhost:8765";
  byId("now-note").replaceChildren("A snapshot of local experimental work: the press as it stood when this copy was frozen, with its forecasts as they read then. " +
    "Nothing here updates; the dashboard it was printed from ran locally at ", living, ".");
  const feedLink = document.querySelector('footer a[href$="feed/status.json"]');
  if (feedLink) feedLink.textContent = "Snapshot feed (JSON)";
}
refresh();
evidenceLink();
if (!frozen) {
  setInterval(() => { if (!document.hidden) refresh(); }, 4000);
  setInterval(() => { if (!document.hidden) evidenceLink(); }, 60000);
  setInterval(() => { if (!document.hidden && data) guard("stamp", stamp); }, 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
}
import("./compilation-eta.js").then(module => module.attachEta(() => data)).catch(error => console.error("desk: compilation record", error));
