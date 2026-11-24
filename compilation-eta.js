import {easternClock, easternWhen} from "./eastern.js";

const minute = 60_000;
// Times are US Eastern and labelled, like everywhere else on the desk: "23 Nov, 5:09 a.m. EST".
const when = time => easternWhen(time, {year: false});
const paceFormat = new Intl.NumberFormat(undefined, {maximumFractionDigits: 1});

function forecast(current, earlier) {
  let baseline;
  let next = current;
  for (const point of earlier) {
    if (point.time >= current.time) continue;
    const minutes = (current.time - point.time) / minute;
    if (minutes > 40 || !point.running || point.total !== current.total ||
        point.done > next.done || next.time - point.time > 22 * minute) break;
    if (minutes >= 20 && (!baseline || Math.abs(minutes - 30) < Math.abs(baseline.minutes - 30))) {
      baseline = {done: point.done, minutes};
    }
    next = point;
  }
  if (!baseline || current.done <= baseline.done || current.done >= current.total) return null;
  const rate = (current.done - baseline.done) / baseline.minutes;
  const remaining = (current.total - current.done) / rate;
  return {rate, remaining, finish: current.time + remaining * minute, window: Math.round(baseline.minutes)};
}

function remainingTime(minutes) {
  const n = Math.ceil(minutes);
  return n < 60 ? n + " min" : Math.floor(n / 60) + " h " + n % 60 + " min";
}


const id = key => document.getElementById(key);
const gib = bytes => Number.isFinite(bytes) ? (bytes / 2 ** 30).toFixed(1) + " GiB" : "—";

function renderHistory(points) {
  const history = [];
  for (const [i, point] of points.entries()) {
    if (!point.running) continue;
    const est = forecast(point, points.slice(i + 1));
    if (est) history.push({time: point.time, ...est});
    if (history.length === 8) break;
  }
  id("forecast-history").hidden = !history.length;
  id("forecast-history").querySelector("tbody").replaceChildren(...history.map(point => {
    const row = document.createElement("tr");
    for (const value of [when(point.time), when(point.finish), paceFormat.format(point.rate)]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  }));
  const first = history.at(-1), last = history[0];
  const span = last && first ? last.time - first.time : 0;
  id("forecast-trend").hidden = span <= 0;
  if (span <= 0) return;
  id("forecast-first").textContent = easternClock(first.time);
  id("forecast-last").textContent = easternClock(last.time);
  const shift = Math.round((last.finish - first.finish) / minute);
  id("forecast-shift").textContent = shift === 0 ? "Same projected finish" :
    remainingTime(Math.abs(shift)) + (shift < 0 ? " earlier" : " later") + " across these checks";
  const min = Math.min(...history.map(p => p.finish)), max = Math.max(...history.map(p => p.finish));
  const path = history.reverse().map(({time,finish}, i) => {
    const x = 2 + 496 * (time - first.time) / span;
    const y = max === min ? 27 : 50 - 46 * (finish - min) / (max - min);
    return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
  });
  id("forecast-line").setAttribute("d", path.join(" "));
}

const handoffText = {
  armed: "The build handoff was recorded. Verification uses the recorded host memory checks.",
  transition: "The build is sealed. The handoff is checking available memory.",
  ready: "The handoff recorded a successful memory check and requested the verifier.",
  returned: "The verifier returned from the build handoff.",
  retry: "The handoff is waiting for a successful memory check."
};

export function attachEta(getFeed) {
  let previousHistory;
  function render() {
    const feed = getFeed();
    if (!feed) return;
    const points = (feed.forecast?.points || []).slice().sort((a,b) => b.time - a.time);
    const key = feed.run_id + JSON.stringify(points);
    if (key !== previousHistory) {
      renderHistory(points);
      previousHistory = key;
    }
    const w = feed.worker || {};
    const time = Date.parse(feed.ts), heartbeat = Date.parse(w.timestamp);
    const now = Date.now(), total = feed.closure?.total;
    const done = Object.values(feed.completed || {}).reduce((a,b) => a+b, 0);
    const stale = !Number.isFinite(time) || now - time > 35_000 || !Number.isFinite(heartbeat) || now - heartbeat > 75_000;
    let message;
    const sealed = feed.replay?.build?.state === "passed" || (w.phase === "build" && w.state === "completed");
    if (sealed) message = "Compilation complete";
    else if (w.phase !== "build" || w.state !== "running") message = w.phase === "build" ? "Compilation " + w.state : "Waiting for compilation";
    else if (stale) message = "Awaiting fresh telemetry";
    else if (done === total && total > 0) message = "Awaiting build confirmation";
    else if (feed.completed_last_ten_min === 0) message = "Waiting for recent completions";
    const est = !message && total > done && forecast({time, done, total}, points);
    id("forecast-finish").textContent = est ? when(est.finish) : message || "Gathering a pace window";
    id("forecast-pace").textContent = est ? remainingTime(est.remaining) + " remaining · " +
      paceFormat.format(est.rate) + " unique modules/min across " + est.window + " min · " +
      (total-done).toLocaleString() + " modules left" : "";
    id("forecast-title").textContent = sealed ? "Compilation record" : "Compilation forecast";
    id("forecast-jump").textContent = est ? "Projected finish · " + when(est.finish) : id("forecast-title").textContent;
    const m = w.metrics || {};
    const live = w.phase === "build" && w.state === "running" && !stale;
    id("lean-workers").textContent = live && Number.isInteger(m.active_compilers) && Number.isInteger(m.compiler_slots)
      ? m.active_compilers + " / " + m.compiler_slots + " slots" : "—";
    id("lean-memory").textContent = (live ? gib(m.build_memory) : "—") + " · 48 GiB soft / 54 GiB hard";
    id("lean-swap").textContent = (live ? gib(m.build_swap) : "—") + " / 8 GiB";
    const handoff = feed.forecast?.handoff;
    const showHandoff = !!handoffText[handoff] && !(handoff === "armed" && ["failed","inconclusive"].includes(w.state));
    id("lean-handoff").hidden = !showHandoff;
    id("lean-handoff").textContent = showHandoff ? handoffText[handoff] : "";
  }
  render();
  setInterval(() => { if (!document.hidden) render(); }, 4000);
}
