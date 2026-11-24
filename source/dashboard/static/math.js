// math.js · the herbarium's mathematics, typeset.
//
// Every element with class "math" holds TeX as its text, so the page reads sensibly before
// any script runs and to anyone reading the source: <span class="math">…</span> in the line,
// <div class="math display">…</div> on a line of its own. renderMath(root) typesets each such
// element under root (root included) that is not typeset yet, in slices of about 8 ms; call
// it again for live text written later. KaTeX loads on first use: katex.js is dist/katex.min.js
// of KaTeX 0.19.1 from npm (MIT, /fonts/LICENSE-KaTeX.txt), with katex.css and the woff2 faces
// in /fonts/. It writes HTML for the eye and MathML for assistive technology.
//
// A displayed formula wider than its column is set from its narrower form (data-narrow, TeX)
// when it has one, and is otherwise scaled down to fit, never below three quarters.
//
// mathText("… $\Re s>\crit$ …") makes the same markup from a string whose TeX is between
// dollar signs, for live text built with the DOM.

const MACROS = {
  // The real part, upright as the prose writes it ("Re s"), not the Fraktur ℜ.
  "\\Re": "\\operatorname{Re}",
  // The ½ of the critical line, inked gold where it names the line.
  "\\crit": "\\htmlClass{crit}{\\tfrac12}",
};

// The herbarium links katex.css in its head, so formulas never show unstyled; a page that
// does not (a figure mounted elsewhere) gets the link on first use.
function stylesheet() {
  if (document.querySelector('link[rel="stylesheet"][href$="katex.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = new URL("./katex.css", import.meta.url).href;
  document.head.append(link);
}

let loading = null;
const load = () => loading ??= import("./katex.js").then(() => {
  if (typeof globalThis.katex?.render !== "function") throw new Error("KaTeX did not load");
  stylesheet();
  return globalThis.katex;
});

let katex = null;
function draw(node, tex) {
  katex.render(tex, node, {
    displayMode: node.classList.contains("display"),
    output: "htmlAndMathml",
    throwOnError: false,
    macros: { ...MACROS },
    trust: ({ command }) => command === "\\htmlClass",
    strict: code => code === "htmlExtension" ? "ignore" : "warn",
  });
  node.dataset.form = tex === node.dataset.narrow ? "narrow" : "wide";
}

const typeset = node => node.dataset.tex != null && !!node.firstElementChild?.matches(".katex, .katex-display, .katex-error");

function render(node) {
  const tex = node.textContent.trim();
  draw(node, tex);
  node.dataset.tex = tex;
}

// Displayed formulas follow their column's width.
const widths = new WeakMap();
const displays = new Set();
const due = new Set();
let observer = null;
function fit(node, force = false) {
  const width = node.clientWidth;
  if (!node.isConnected || !width || (!force && widths.get(node) === width)) return;
  widths.set(node, width);
  node.style.removeProperty("--math-scale");
  if (node.dataset.narrow) {
    if (node.dataset.form !== "wide") draw(node, node.dataset.tex);
    if (node.scrollWidth > width + 1) draw(node, node.dataset.narrow);
  }
  const over = node.scrollWidth / width;
  if (over > 1.005) node.style.setProperty("--math-scale", Math.max(0.75, 1 / over - 0.005).toFixed(3));
}
// Refits run in the next frame, never inside the observer's own delivery: a refit changes
// the formula's height, and that must not feed back into the same round of observations.
function refit(nodes, force = false) {
  nodes.forEach(node => due.add(node));
  requestAnimationFrame(() => {
    const batch = [...due];
    due.clear();
    batch.forEach(node => fit(node, force));
  });
}
function watch(node) {
  if (!observer) {
    observer = new ResizeObserver(entries => refit(entries.map(entry => entry.target)));
    // Widths measured before KaTeX's faces arrive are a fallback font's; measure again.
    document.fonts?.addEventListener?.("loadingdone", () => refit([...displays].filter(node => node.isConnected), true));
  }
  displays.add(node);
  observer.observe(node);
  fit(node, true);
}

export async function renderMath(root = document) {
  const found = root.nodeType === Node.ELEMENT_NODE && root.matches(".math") ? [root] : [];
  const nodes = [...found, ...root.querySelectorAll(".math")].filter(node => !typeset(node));
  if (!nodes.length) return;
  katex = await load();
  let slice = performance.now();
  for (const node of nodes) {
    if (!node.isConnected || typeset(node)) continue;
    render(node);
    if (node.classList.contains("display")) watch(node);
    if (performance.now() - slice > 8) {
      await new Promise(resolve => setTimeout(resolve));
      slice = performance.now();
    }
  }
}

export function mathText(text) {
  const fragment = document.createDocumentFragment();
  String(text).split("$").forEach((piece, i) => {
    if (!(i % 2)) fragment.append(piece);
    else {
      const span = document.createElement("span");
      span.className = "math";
      span.textContent = piece;
      fragment.append(span);
    }
  });
  return fragment;
}
