/*
  motion.js · one shared answer to "may things move?"

  Lark's pages move slowly: an exposure develops, a vine climbs the critical
  line, a live dot breathes. A reader can stop all of it with one switch, and
  every moving thing on the page listens to the same state, kept here.

    motion.paused      true while nothing should move: the reader paused
                       motion (or the system asks for reduced motion and the
                       reader has not chosen otherwise), or the tab is hidden.
    motion.preference  "paused" | "moving": the reader's or the system's
                       choice, ignoring tab visibility.
    motion.chosen      "paused" | "moving" | null: an explicit choice, kept in
                       localStorage["lark.motion"]. Once made, it overrides
                       prefers-reduced-motion, on every later visit.
    motion.reduced     prefers-reduced-motion: reduce matches right now.
    motion.hidden      the document is hidden.

  <html data-motion="…"> mirrors the effective paused state for CSS.

    motion.onChange(fn, {immediate = false}) → unsubscribe()
                       fn(paused, detail) runs whenever motion.paused flips;
                       with immediate, also once now.
    motion.set(paused, {persist = true}), motion.toggle()
                       change the preference; persist records it as the
                       reader's choice.
    motion.bind(button) wire a switch. Done on import for #motion-switch and
                       any [data-motion-switch]. aria-pressed follows the
                       preference; the accessible name, title, and label
                       read "Pause motion" or "Resume motion".
    motion.loop(draw, {fps = 30}) → {stop(), elapsed}
                       call draw(elapsed, dt) at most fps times a second while
                       motion is not paused. elapsed counts moving time only
                       (seconds), so a paused drawing resumes where it stopped.

  Every flip of motion.paused also dispatches a window event
    "larkmotion"  {detail: {paused, preference, hidden, reason}}
  with reason "switch" | "api" | "system" | "storage" | "visibility".

  Safe to import anywhere: no switch on the page is fine, storage that throws
  (private windows) is fine, and outside a browser the module stays inert.
*/

const STORAGE_KEY = "lark.motion";
const doc = globalThis.document;
const query = typeof globalThis.matchMedia === "function"
  ? globalThis.matchMedia("(prefers-reduced-motion: reduce)")
  : null;

const listeners = new Set();
const switches = new Set();

function readChoice() {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return value === "paused" || value === "moving" ? value : null;
  } catch {
    return null;
  }
}

function writeChoice(value) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, value);
  } catch {
    // Storage is unavailable (a private window, a blocked origin): the choice
    // still holds for this page.
  }
}

let chosen = readChoice();
let preferPaused = chosen ? chosen === "paused" : Boolean(query?.matches);
let hidden = Boolean(doc?.hidden);
let paused = preferPaused || hidden;

function detail(reason) {
  return { paused, preference: preferPaused ? "paused" : "moving", hidden, reason };
}

function report(error) {
  if (typeof globalThis.reportError === "function") globalThis.reportError(error);
  else console.error(error);
}

function labelSwitch(button) {
  const text = preferPaused ? "Resume motion" : "Pause motion";
  button.setAttribute("aria-pressed", String(preferPaused));
  button.setAttribute("aria-label", text);
  button.title = text;
  const labels = button.querySelectorAll("[data-motion-label]");
  if (!labels.length && !button.childElementCount) {
    if (button.textContent !== text) button.textContent = text;
  }
  for (const label of labels) {
    if (label.textContent !== text) label.textContent = text;
  }
}

function reflect() {
  if (doc) doc.documentElement.dataset.motion = paused ? "paused" : "moving";
  for (const button of switches) labelSwitch(button);
}

function settle(reason) {
  const previous = paused;
  paused = preferPaused || hidden;
  reflect();
  if (paused === previous) return;
  const info = detail(reason);
  for (const listener of [...listeners]) {
    try {
      listener(paused, info);
    } catch (error) {
      report(error);
    }
  }
  if (typeof globalThis.dispatchEvent === "function" && typeof CustomEvent === "function") {
    globalThis.dispatchEvent(new CustomEvent("larkmotion", { detail: info }));
  }
}

function choose(value, reason, persist = true) {
  preferPaused = Boolean(value);
  if (persist) {
    chosen = preferPaused ? "paused" : "moving";
    writeChoice(chosen);
  }
  settle(reason);
  return paused;
}

function onChange(listener, { immediate = false } = {}) {
  listeners.add(listener);
  if (immediate) {
    try {
      listener(paused, detail("api"));
    } catch (error) {
      report(error);
    }
  }
  return () => listeners.delete(listener);
}

function bind(button) {
  if (!button || switches.has(button)) return button;
  switches.add(button);
  button.addEventListener("click", () => choose(!preferPaused, "switch"));
  labelSwitch(button);
  return button;
}

function loop(draw, { fps = 30 } = {}) {
  const interval = 1000 / Math.min(Math.max(Number(fps) || 30, 1), 30);
  const raf = globalThis.requestAnimationFrame;
  const cancel = globalThis.cancelAnimationFrame;
  let frame = 0;
  let last = 0;
  let elapsed = 0;
  let running = false;
  let stopped = false;

  function tick(now) {
    frame = raf(tick);
    if (!last) {
      last = now;
      return;
    }
    const delta = now - last;
    if (delta < interval - 1) return;
    last = now;
    const dt = Math.min(delta, 250) / 1000;
    elapsed += dt;
    try {
      draw(elapsed, dt);
    } catch (error) {
      stop();
      report(error);
    }
  }

  function sync(isPaused) {
    if (stopped || typeof raf !== "function") return;
    if (isPaused) {
      if (running) cancel(frame);
      running = false;
      last = 0;
    } else if (!running) {
      running = true;
      last = 0;
      frame = raf(tick);
    }
  }

  const off = onChange(sync);
  function stop() {
    stopped = true;
    off();
    if (running) cancel(frame);
    running = false;
  }
  sync(paused);
  return {
    stop,
    get elapsed() {
      return elapsed;
    },
  };
}

export const motion = Object.freeze({
  get paused() {
    return paused;
  },
  get preference() {
    return preferPaused ? "paused" : "moving";
  },
  get chosen() {
    return chosen;
  },
  get reduced() {
    return Boolean(query?.matches);
  },
  get hidden() {
    return hidden;
  },
  onChange,
  set: (value, { persist = true } = {}) => choose(value, "api", persist),
  toggle: () => choose(!preferPaused, "api"),
  bind,
  loop,
});

if (query) {
  const follow = () => {
    if (chosen) return;
    preferPaused = query.matches;
    settle("system");
  };
  if (typeof query.addEventListener === "function") query.addEventListener("change", follow);
  else query.addListener?.(follow);
}

if (doc) {
  reflect();
  doc.addEventListener("visibilitychange", () => {
    hidden = doc.hidden;
    settle("visibility");
  });
  globalThis.addEventListener?.("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    chosen = readChoice();
    preferPaused = chosen ? chosen === "paused" : Boolean(query?.matches);
    settle("storage");
  });
  const wire = () => {
    for (const button of doc.querySelectorAll("#motion-switch, [data-motion-switch]")) bind(button);
  };
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", wire, { once: true });
  else wire();
}
