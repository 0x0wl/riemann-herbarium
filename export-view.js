// export-view.js · the press gauge (chapter VIII) and the label's "Pressed" line.
//
// showExportProgress(localExport, selectedInput, localReceipt, feedTime, now) reads only
// replay.local_export: the gauge shows for the Workstation input while the writer reports
// a known phase; forecasts appear only for a fresh sample (≤ 45 s, feed ≤ 45 s, not stale)
// of a writer that is still below the reference size, and the kernel start only when the
// writer finish is known or the export is sealing or sealed.
//
// Files are measured in decimal units (GB = 10⁹ bytes), with the binary size (GiB = 2³⁰
// bytes) as a tooltip. Times are US Eastern and say so ("12:48 p.m. EST").

import {easternClock, easternDate} from "./eastern.js";

const id = key => document.getElementById(key);
const integers = new Intl.NumberFormat("en-US");
const MINUTE = 60_000, HOUR = 60 * MINUTE;
const phaseNames = {preparing:"Preparing", writing:"Writing", sealing:"Sealing", sealed:"Sealed", stopped:"Stopped"};

const twoPlaces = {minimumFractionDigits: 2, maximumFractionDigits: 2};
const gb = bytes => (bytes / 1e9).toLocaleString("en-US", twoPlaces) + " GB";
const gib = bytes => (bytes / 2 ** 30).toLocaleString("en-US", twoPlaces) + " GiB";
const pace = bps => bps >= 1e6 ? (bps / 1e6).toLocaleString("en-US", {maximumFractionDigits: 1}) + " MB/s" :
  Math.max(1, Math.round(bps / 1e3)) + " kB/s";
const hm = time => easternClock(time);

// A finish hours away moves with every change in the writer's pace, so it is never shown
// to the minute: it is rounded by its distance from now (to the hour beyond 12 h, to 30 min
// from 3 to 12 h, to 15 min nearer), and a value on the page changes only when a new one
// has held for ten minutes of samples or moves by two rounding steps.
const shown = new Map();
// The instant each forecast shows (after rounding and hysteresis), for exportReadout().
const shownAt = {};
function step(ahead) {
  return ahead > 12 * HOUR ? HOUR : ahead > 3 * HOUR ? 30 * MINUTE : 15 * MINUTE;
}
function forecastTime(sampled, seconds, now, key) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const end = sampled + 1000 * seconds;
  if (!(end > now && end <= 8.64e15)) return "";
  const ahead = end - now;
  const unit = step(ahead);
  let value = Math.round(end / unit) * unit;
  if (value <= now) value = Math.ceil(end / unit) * unit;
  let state = shown.get(key);
  if (!state || state.unit !== unit || state.value <= now || Math.abs(value - state.value) >= 2 * unit) {
    state = {value, unit, candidate: null, since: 0};
    shown.set(key, state);
  } else if (value === state.value) {
    state.candidate = null;
  } else if (state.candidate !== value) {
    state.candidate = value;
    state.since = now;
  } else if (now - state.since >= 10 * MINUTE) {
    state.value = value;
    state.candidate = null;
  }
  const time = state.value;
  shownAt[key] = time;
  const otherDay = easternDate(time) !== easternDate(now);
  if (ahead > 12 * HOUR || otherDay) return "~" + easternDate(time, {year: false}) + ", " + hm(time);
  return "~" + hm(time) + (ahead < HOUR ? ", within the hour" : "");
}

// The latest reading as the page shows it, so the "Now pressing" instrument repeats the
// same rounded forecasts instead of computing its own. Null until a writer reports.
let latest = null;
export function exportReadout() {
  return latest;
}

export function showExportProgress(localExport, selectedInput, localReceipt, feedTime, now) {
  const p = localExport?.progress;
  const present = p && Object.hasOwn(phaseNames, p.phase);
  const panel = id("export-progress");
  panel.hidden = !present || selectedInput !== "local_export";
  const summary = id("export-summary");
  const hasBytes = Number.isSafeInteger(p?.bytes) && p.bytes >= 0;
  summary.hidden = !present;
  latest = null;
  if (!present) return;

  const hasBasis = Number.isSafeInteger(p.reference_bytes) && p.reference_bytes > 0;
  const sealed = p.phase === "sealed" && localExport.state === "passed";
  const active = localExport.state === "running";
  const sampled = Date.parse(p.updated);
  const started = Date.parse(p.started);
  const age = now - sampled;
  const feedAge = now - Date.parse(feedTime);
  const liveFeed = feedAge >= -5000 && feedAge <= 45000;
  const fresh = !p.stale && liveFeed && age >= -5000 && age <= 45000;
  const comparable = hasBytes && hasBasis && p.bytes < p.reference_bytes;
  const measuring = fresh && active && p.phase === "writing" && Number.isFinite(p.rate_bps) && p.rate_bps > 0;
  const writing = measuring && comparable;
  const writeFinish = writing ? forecastTime(sampled, p.write_eta_seconds, now, "write") : "";
  const postWrite = (active && p.phase === "sealing") || sealed;
  const kernelStart = (writeFinish || (liveFeed && !p.stale && postWrite && !localReceipt?.waiting_for_resources && !localReceipt?.main_replay_started))
    ? forecastTime(sampled, p.replay_eta_seconds, now, "kernel") : "";
  const percent = hasBytes && hasBasis ? Math.floor(1000 * p.bytes / p.reference_bytes) / 10 : NaN;
  const percentText = Number.isFinite(percent) ? percent.toLocaleString("en-US", {maximumFractionDigits: 1}) + "%" : "";
  const sampledText = Number.isFinite(sampled) ? hm(sampled) : "";
  latest = {
    phase: p.phase, phaseName: phaseNames[p.phase], state: localExport.state, sealed, active, fresh, measuring, comparable,
    bytes: hasBytes ? p.bytes : NaN, referenceBytes: hasBasis ? p.reference_bytes : NaN, percent, percentText,
    pace: measuring ? pace(p.rate_bps) : "", window: measuring && p.window_seconds > 0 ? "over the last " +
      (p.window_seconds < 60 ? Math.round(p.window_seconds) + " s" : Math.round(p.window_seconds / 60) + " min") : "",
    writeFinish, writeAt: writeFinish ? shownAt.write : NaN, kernelStart, kernelAt: kernelStart ? shownAt.kernel : NaN,
    started, sampled,
  };

  // The label's "Pressed" line keeps the words "written" and "sealed".
  let line = "";
  if (localExport.state === "failed") line = "export failed" + (sampledText ? " at " + sampledText : "") + " · see the field notes";
  else if (p.phase === "stopped" || localExport.state === "inconclusive") line = "stopped" + (sampledText ? " at " + sampledText : "") + (hasBytes ? " · " + gb(p.bytes) + " written" : "") + " · nothing rejected";
  else if (sealed) line = (hasBytes ? gb(p.bytes) + " " : "") + "sealed" + (Number.isFinite(sampled) ? " · " + hm(sampled) + ", " + easternDate(sampled) : "");
  else if (p.phase === "sealing") line = "written · checking its digest";
  else if (p.phase === "preparing" || !hasBytes) line = "preparing Euler’s own export";
  else if (fresh) line = gb(p.bytes) + " written" + (hasBasis ? " of " + gb(p.reference_bytes) : "") + (percentText ? " · " + percentText : "") +
    (Number.isFinite(started) ? " · since " + hm(started) : "");
  else line = gb(p.bytes) + " written" + (sampledText ? " · last reading " + sampledText : "");
  id("export-summary-size").textContent = line;
  id("export-summary-start").textContent = kernelStart ? "· kernel could start " + kernelStart : "";
  if (panel.hidden) return;

  id("export-phase").textContent = phaseNames[p.phase];
  const sizeNode = id("export-size");
  sizeNode.textContent = hasBytes ? gb(p.bytes) : "—";
  sizeNode.title = hasBytes ? gib(p.bytes) : "";
  id("export-bytes").textContent = hasBytes ? integers.format(p.bytes) + (sealed ? " bytes sealed" : " bytes written") : "Awaiting a writer sample";
  const bar = id("export-bar");
  const percentNode = id("export-percent");
  percentNode.textContent = "";
  if (percentText && !sealed) percentNode.textContent = percentText + " of the published size";
  // Reaching the reference size says nothing about whether the local file has sealed.
  if (sealed && hasBytes && p.bytes > 0) {
    bar.max = p.bytes;
    bar.value = p.bytes;
    percentNode.textContent = "100% sealed";
  } else if (comparable) {
    bar.max = p.reference_bytes;
    bar.value = p.bytes;
  } else {
    bar.removeAttribute("value");
  }
  id("export-basis").hidden = !hasBasis;
  if (hasBasis) id("export-reference-size").textContent = " · " + gb(p.reference_bytes) + " (" + integers.format(p.reference_bytes) + " bytes)";
  const time = id("export-sampled");
  time.hidden = !Number.isFinite(sampled);
  if (!time.hidden) {
    time.dateTime = p.updated;
    time.textContent = ((active && !fresh) || p.phase === "stopped" ? "Last reading " : sealed ? "Sealed " : "Sampled ") + hm(sampled);
  }
  id("export-pace").textContent = measuring ? pace(p.rate_bps) : "—";
  id("export-window").textContent = measuring && p.window_seconds > 0 ? "over the last " +
    (p.window_seconds < 60 ? Math.round(p.window_seconds) + " s" : Math.round(p.window_seconds / 60) + " min") : "";
  id("export-write-eta").textContent = sealed || p.phase === "sealing" ? "Written" : writeFinish || "—";
  id("export-replay-eta").textContent = localReceipt?.main_replay_started ? "Started" : kernelStart || "—";
  const minutes = Math.max(1, Math.round(p.prep_seconds / 60));
  const allowance = Number.isFinite(minutes) ? "about " + minutes + " min" : "some time";
  let note = "";
  if (sealed && kernelStart) {
    note = "Allows " + allowance + " after sealing for input checks and memory admission.";
  } else if (writeFinish) {
    note = "If the recent pace holds; it has changed a great deal during this export, so treat the time as a rough guide." +
      (kernelStart ? " The kernel start assumes a file of the published size and allows " + allowance +
        " after writing for two hash passes, the five controls and memory admission." : "");
  } else if (p.phase === "writing" && !fresh) {
    note = "Waiting for a fresh writer sample.";
  } else if (p.phase === "writing" && hasBasis && hasBytes && !comparable) {
    note = "The writer has passed the published size. Waiting for Euler’s final byte count.";
  } else if (p.phase === "writing" && !measuring) {
    note = "Collecting recent writes to measure the pace.";
  } else if (p.phase === "sealing") {
    note = "The writer has finished. Checking the export’s digest.";
  }
  id("export-forecast-note").hidden = !note;
  id("export-forecast-note").textContent = note;
}
