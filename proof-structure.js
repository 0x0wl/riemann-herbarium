import {receiptForInput} from "./replay-view.js";
import {libraryImports} from "./library-imports.js";
import {createCapitulum, names as nameColours} from "./capitulum.js";
import {easternDate} from "./eastern.js";

// Chapter VI, the anatomy of the specimen (#proof-structure). Four views:
//   capitulum  every module as one floret of a single flower head (capitulum.js; drawn by rule)
//   imports    what Main.lean imports, two levels down (transcribed from the source at the pin)
//   libraries  one top-level name and the names it imports and is imported by, with per-pair counts
//   targets    the four proof terms and the five theorems that use them, coloured by con-leche's receipt
// desk.js calls showProofStructure(root, data, input) on every feed refresh (every 4 s). The drawings are
// built when a view or selection changes; a refresh only updates states and the inspector text.

// The two cuts are transcribed from the imports and theorem bodies at this pin.
// Coordinates affect presentation only. Each edge records a source relationship.
const pin = "a172c464fd4bcfc4f53e394dcba45d742b1409a6";
const sourceRoot = "https://github.com/Deicyde/riemann-hypothesis/blob/" + pin + "/src/";
const mathlibRoot = "https://github.com/leanprover-community/mathlib4/blob/0df444a360eaa60ab8c11dca51a86af692955474/Mathlib.lean";
const run = "rh-20261120";
const svgNS = "http://www.w3.org/2000/svg";
const count = new Intl.NumberFormat("en-US");

// Main at the top like a flower head; what it imports beneath it, Mathlib at the bottom as bedrock.
const imports = [
  {id:"Main", label:"Main.lean", x:50, y:14, kind:"root", path:"Main.lean"},
  {id:"Statements", label:"Statements", x:26, y:47, kind:"module", path:"Statements.lean"},
  {id:"MainTheoremsAll", label:"MainTheoremsAll", x:74, y:47, kind:"module", path:"Supplements/Kernels/MainTheoremsAll.lean"},
  {id:"Mathlib", label:"Mathlib", x:14, y:80, kind:"dependency", url:mathlibRoot},
  {id:"MainTheoremsCritical", label:"MainTheoremsCritical", x:50, y:80, kind:"module", path:"Supplements/Kernels/MainTheoremsCritical.lean"},
  {id:"CorGKOf", label:"CorGKOf", x:86, y:80, kind:"module", path:"Development/AutomorphicArithmetic/AutomorphicVarieties/SmallClassNumbers/CorGKOf.lean"}
];
const importEdges = [["Mathlib","Statements"],["MainTheoremsCritical","MainTheoremsAll"],["CorGKOf","MainTheoremsAll"],
                     ["Statements","Main"],["MainTheoremsAll","Main"]];

const terms = [
  {id:"rhOfAll", y:14, line:4}, {id:"allChi", y:46, line:8},
  {id:"claimAll.2.1", y:66, line:10}, {id:"critAll", y:86, line:12}
].map(term => ({...term, label:term.id, x:22, kind:"term"}));
const targets = [
  {id:"riemannHypothesis", label:"Riemann hypothesis", term:"rhOfAll", y:8, line:4},
  {id:"riemannZeta_eq_zero_re", label:"Zeta zeros", term:"rhOfAll", y:27.5, line:6},
  {id:"LFunction_ne_zero_of_half_lt_re", label:"L-function nonvanishing", term:"allChi", y:47, line:8},
  {id:"LFunction_eq_zero_re", label:"L-function zeros", term:"claimAll.2.1", y:66.5, line:10},
  {id:"LFunction_eq_zero_re_of_isPrimitive", label:"Primitive L-function zeros", term:"critAll", y:86, line:12}
].map(target => ({...target, x:75, kind:"theorem"}));
const cuts = {
  imports: {nodes:imports, edges:importEdges, first:"Main", vertical:true},
  targets: {nodes:[...terms, ...targets], edges:targets.map(target => [target.term, target.id]), first:"riemannHypothesis"}
};

const gateNames = [["statement","Statement"], ["axioms","Axiom allowlist"], ["con-leche","Kernel"]];
const resultLabels = {passed:"Passed", failed:"Rejected", inconclusive:"Inconclusive", running:"Running", pending:"Pending"};

export function targetEvidence(replay, id) {
  let label = !replay?.stage ? "Awaiting receipt" : null;
  if (replay?.main_replay_started === false || ["preflight","download","decompress","controls"].includes(replay?.stage)) label = "Not run";
  if (replay?.targets && !replay.targets.includes(id)) label = "Outside scope";
  if (replay?.evidence_state === "unavailable") label = "Unavailable";
  if (replay?.evidence_state === "unconfirmed") label = "Unconfirmed";
  const gates = gateNames.map(([key, name]) => [name, label || resultLabels[replay.theorems?.[id]?.[key]?.result] || "Pending"]);
  const values = gates.map(([,value]) => value);
  let state = label || "Pending";
  if (!label) {
    if (values.includes("Rejected")) state = "Rejected";
    else if (values.includes("Inconclusive")) state = "Inconclusive";
    else if (values.every(value => value === "Passed") && replay.result === "passed") state = "Passed";
    else if (replay.stage === "replay" && replay.result === "running") state = "Running";
  }
  return {gates, state};
}

// Evidence words → the shared state vocabulary of ink.css chips (design §3.1).
const chipStates = {Passed:"passed", Running:"running", Rejected:"failed", Inconclusive:"inconclusive",
  Unconfirmed:"inconclusive", Unavailable:"inconclusive", Pending:"pending", "Not run":"pending",
  "Awaiting receipt":"pending", "Outside scope":"pending"};

function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function svg(tag, attrs) {
  const node = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function anchor(label, url) {
  const link = el("a", "", label);
  link.href = url;
  return link;
}

function chip(state, text) {
  const node = el("span", "chip", text);
  node.dataset.state = chipStates[state] || "pending";
  return node;
}

// Provenance tags (design §3.6; words and tooltips from the copy; marks from ink.css, where "drawn by rule"
// is data-tag="rule").
const tagTitles = {
  "receipt": "Read from a verifier receipt or evidence file in the feed.",
  "measured": "A live measurement of the host or a process.",
  "computed": "Computed in your browser from the mathematics.",
  "drawn by rule": "A layout or visual convention, not data.",
  "source": "Read from the pinned Lean source at commit a172c464."
};

function tag(word) {
  const node = el("span", "tag", word);
  node.dataset.tag = word === "drawn by rule" ? "rule" : word;
  node.title = tagTitles[word];
  return node;
}

// Static copy with <code> spans (constant strings only), as DOM nodes.
function words(text) {
  const fragment = document.createDocumentFragment();
  for (const part of text.split(/(<code>.*?<\/code>)/)) {
    const code = part.match(/^<code>(.*)<\/code>$/);
    if (part) fragment.append(code ? el("code", "", code[1]) : document.createTextNode(part));
  }
  return fragment;
}

const hueOf = new Map(nameColours.map(({name, css}) => [name, css]));

function swatch(name) {
  const dot = el("span", "structure-swatch");
  dot.setAttribute("aria-hidden", "true");
  if (hueOf.has(name)) dot.style.setProperty("--swatch", hueOf.get(name));
  return dot;
}

// Engraved silhouettes tell the kinds apart: Main is a flower head, submitted modules are buds, Mathlib is
// bedrock, proof terms are leaves and the five exported theorems are flowers. Colour is kept for state.
function seed(kind) {
  const icon = svg("svg", {viewBox:"0 0 40 32", "aria-hidden":"true", class:"structure-seed"});
  if (kind === "root") {
    icon.append(svg("circle", {cx:20, cy:16, r:12.5}));
    for (let k = 0; k < 21; k++) {
      const radius = 2.25 * Math.sqrt(k + .5), turn = k * Math.PI * (3 - Math.sqrt(5));
      icon.append(svg("circle", {cx:(20 + radius * Math.sin(turn)).toFixed(2), cy:(16 - radius * Math.cos(turn)).toFixed(2),
                                 r:1.05, class:"seed-dot"}));
    }
  } else if (kind === "dependency") {
    icon.append(svg("path", {d:"M7 21 Q6 12 15 10 Q24 7 31 12 Q36 17 31 22 Q22 26 13 25 Q8 24 7 21 Z"}),
                svg("path", {d:"M12 22 17 14 M17 23 23 12 M22 23 28 14", class:"seed-hatch"}));
  } else if (kind === "theorem") {
    for (let i = 0; i < 5; i++) {
      const angle = -90 + 72 * i, rad = angle * Math.PI / 180;
      icon.append(svg("ellipse", {cx:(20 + 6.4 * Math.cos(rad)).toFixed(2), cy:(16 + 6.4 * Math.sin(rad)).toFixed(2),
                                  rx:5.4, ry:3.1, transform:`rotate(${angle} ${(20 + 6.4 * Math.cos(rad)).toFixed(2)} ${(16 + 6.4 * Math.sin(rad)).toFixed(2)})`,
                                  class:"petal"}));
    }
    icon.append(svg("circle", {cx:20, cy:16, r:2.3, class:"seed-dot"}));
  } else if (kind === "term") {
    icon.append(svg("path", {d:"M6 17 Q19 2 34 15 Q20 30 6 17 Z"}), svg("path", {d:"M6 17 Q20 14 33 15 M14 16 18 11 M21 15 25 11 M15 17 19 22 M22 16 26 20", class:"seed-hatch"}));
  } else {
    icon.append(svg("path", {d:"M20 4 Q29 13 27 21 Q25 28 20 28 Q15 28 13 21 Q11 13 20 4 Z"}), svg("path", {d:"M20 9 20 27", class:"seed-hatch"}));
  }
  return icon;
}

function fact(list, name, value) {
  const row = el("div");
  const dd = el("dd");
  if (value instanceof Node) dd.append(value); else dd.textContent = value;
  row.append(el("dt", "", name), dd);
  list.append(row);
}

function moduleSource(node) {
  return node.url || sourceRoot + (node.path || "Main.lean#L" + node.line);
}

function pathLabel(node) {
  if (node.kind === "dependency") return "Mathlib.lean";
  if (node.path) return node.path;
  return "Main.lean · line " + node.line;
}

function relatedNames(cut, id, direction) {
  const index = direction === "supplies" ? 0 : 1;
  return cut.edges.filter(pair => pair[index] === id).map(pair => pair[1 - index]);
}

function inspector(cut, node, data) {
  const panel = el("div", "structure-inspector");
  panel.dataset.structureInspector = "";
  const titles = {dependency:"Upstream library", module:"Submitted module", root:"Compilation target",
                  term:"Proof term", theorem:"Replay target"};
  const name = el("h3", "", node.kind === "theorem" ? node.id : node.label);
  panel.append(el("div", "structure-kicker", titles[node.kind]), name);
  if (pathLabel(node) !== name.textContent) panel.append(el("code", "structure-path", pathLabel(node)));
  const facts = el("dl", "structure-facts");
  const replay = data.viewReplay;
  if (cut === cuts.imports) {
    const dependencies = relatedNames(cut, node.id, "imports");
    const users = relatedNames(cut, node.id, "supplies");
    if (dependencies.length) fact(facts, "Imports", dependencies.join(" · "));
    if (users.length) fact(facts, "Used by", users.join(" · "));
    if (node.kind === "root") {
      const total = data.closure?.total, completed = data.completed;
      const n = completed && Object.values(completed).reduce((sum,v) => sum + v, 0);
      const haveCounts = Number.isSafeInteger(n) && Number.isSafeInteger(total) && total > 0 && n >= 0 && n <= total;
      fact(facts, "Modules built", haveCounts ? count.format(n) + " / " + count.format(total) : "Awaiting inventory");
    } else if (node.kind === "dependency") {
      fact(facts, "Mathlib pin", "0df444a");
    } else {
      const family = node.path.split(/[/.]/)[0], completed = data.completed?.[family], total = data.closure?.libraries?.[family];
      fact(facts, family + " build", Number.isSafeInteger(completed) && Number.isSafeInteger(total) && total > 0
        ? count.format(completed) + " / " + count.format(total) : "Awaiting inventory");
    }
  } else if (node.kind === "term") {
    fact(facts, "Used by", relatedNames(cut, node.id, "supplies").join(" · "));
  } else {
    fact(facts, "Proof term", node.term);
    const inputs = {reference_export:"Published export", local_export:"Workstation export"};
    fact(facts, "Replay input", inputs[replay?.input] || "Awaiting receipt");
    const evidence = targetEvidence(replay, node.id);
    for (const [key, value] of evidence.gates) fact(facts, key, chip(value, value));
    fact(facts, "Determination", chip(evidence.state, evidence.state));
  }
  panel.append(facts);
  const links = el("div","structure-links");
  links.append(anchor("Pinned source", moduleSource(node)),
               cut === cuts.imports ? anchor("Compiler activity", "#compiler") : anchor("Kernel record", "#replay"));
  panel.append(links);
  return panel;
}

function breakName(value) {
  const label = el("span", "structure-label");
  for (const word of value.split(/(?<=[a-z])(?=[A-Z])/)) {
    if (label.childNodes.length) label.append(el("wbr"));
    label.append(word);
  }
  return label;
}

function drawMap(view) {
  const cut = cuts[view];
  const drawing = el("div", "structure-drawing");
  drawing.dataset.view = view;
  const lines = svg("svg", {viewBox:"0 0 1000 1000", preserveAspectRatio:"none", "aria-hidden":"true", class:"structure-lines"});
  const points = new Map(cut.nodes.map(n => [n.id, n]));
  for (const [from, to] of cut.edges) {
    const a = points.get(from), b = points.get(to);
    const x = a.x*10, y = a.y*10, endX = b.x*10, endY = b.y*10;
    const d = cut.vertical
      ? `M ${x} ${y} C ${x} ${y - (y - endY) * .5}, ${endX} ${endY + (y - endY) * .5}, ${endX} ${endY}`
      : `M ${x} ${y} C ${x + (endX - x) * .46} ${y}, ${endX - (endX - x) * .46} ${endY}, ${endX} ${endY}`;
    const path = svg("path", {d});
    path.dataset.from = from;
    path.dataset.to = to;
    lines.append(path);
  }
  drawing.append(lines);
  for (const node of cut.nodes) {
    const button = el("button", "structure-node");
    button.type = "button";
    button.dataset.node = node.id;
    button.dataset.kind = node.kind;
    button.style.left = node.x + "%";
    button.style.top = node.y + "%";
    button.title = node.path || node.id;
    button.setAttribute("aria-label", node.kind === "theorem" ? node.id : node.label);
    button.append(seed(node.kind), breakName(node.label));
    drawing.append(button);
  }
  return drawing;
}

export function libraryNeighbourhood(selected) {
  const imports = [], consumers = [];
  let internal = 0;
  for (const [from, to, pairs] of libraryImports.edges) {
    if (from === selected && to === selected) internal = pairs;
    else if (from === selected) imports.push([to, pairs]);
    else if (to === selected) consumers.push([from, pairs]);
  }
  const strongestFirst = (a,b) => b[1] - a[1] || a[0].localeCompare(b[0]);
  return {imports:imports.sort(strongestFirst), consumers:consumers.sort(strongestFirst), internal};
}

function libraryDrawing(selected, neighbours) {
  const box = el("div", "structure-library");
  box.dataset.view = "libraries";
  box.dataset.library = selected;
  const picker = el("label", "structure-picker");
  const select = el("select");
  for (const name of Object.keys(libraryImports.libraries).sort()) {
    const option = el("option", "", name);
    option.selected = name === selected;
    select.append(option);
  }
  picker.append(el("span", "", "Top-level name"), select);
  const columns = el("div", "structure-lib-columns");
  columns.setAttribute("aria-hidden", "true");
  columns.append(el("span", "", "It imports"), el("span", "", "Imported by"));
  const drawing = el("div", "structure-drawing library-drawing");
  const rows = Math.max(2, neighbours.imports.length, neighbours.consumers.length);
  drawing.style.setProperty("--rows", rows);
  const lines = svg("svg", {viewBox:"0 0 1000 1000", preserveAspectRatio:"none", "aria-hidden":"true", class:"structure-lines"});
  drawing.append(lines);
  const strongest = Math.max(1, ...neighbours.imports.map(([,n]) => n), ...neighbours.consumers.map(([,n]) => n));
  for (const [side, nodes] of [["left",neighbours.imports],["right",neighbours.consumers]]) {
    const left = side === "left";
    if (!nodes.length) {
      const empty = el("span", "library-empty", "None");
      empty.style.left = (left ? 19 : 81) + "%";
      drawing.append(empty);
    }
    nodes.forEach(([name, n], index) => {
      const y = 100*(index+.5)/nodes.length;
      const x = left ? 19 : 81;
      const step = left ? 1 : -1;
      // Line weight follows the number of direct imports, on a logarithmic scale (1 → hairline).
      const weight = .7 + 2.6 * Math.log10(n + 1) / Math.log10(strongest + 1);
      const path = svg("path", {d:`M ${x*10} ${y*10} C ${x*10+170*step} ${y*10}, ${500-130*step} 500, 500 500`});
      path.style.strokeWidth = weight.toFixed(2) + "px";
      lines.append(path);
      const button = el("button", "structure-library-node");
      button.type = "button";
      button.dataset.libraryChoice = name;
      button.style.left = x + "%";
      button.style.top = y + "%";
      button.setAttribute("aria-label", (left ? selected + " imports " + name : name + " imports " + selected)
                          + ", " + count.format(n) + " direct imports. Inspect " + name);
      const head = el("span", "structure-library-name");
      head.append(swatch(name), breakName(name));
      button.append(head, el("small", "", count.format(n)));
      drawing.append(button);
    });
  }
  const center = el("div", "structure-library-center");
  const centerName = el("span", "structure-library-name");
  centerName.append(swatch(selected), breakName(selected));
  center.append(seed("root"), centerName, el("small", "", count.format(neighbours.internal) + " within"));
  drawing.append(center);
  box.append(picker, columns, drawing);
  return box;
}

function libraryInspector(selected, neighbours, data) {
  const panel = el("div","structure-inspector");
  panel.dataset.structureInspector = "";
  panel.append(el("div","structure-kicker","Top-level name"), el("h3","",selected));
  const list = el("dl","structure-facts");
  const total = libraryImports.libraries[selected];
  const built = data.closure?.libraries?.[selected] === total ? data.completed?.[selected] : null;
  fact(list, "Modules", count.format(total));
  fact(list, "Compiled", Number.isSafeInteger(built) && built >= 0 && built <= total ? count.format(built) : "Awaiting inventory");
  fact(list, "Imports inside itself", count.format(neighbours.internal));
  fact(list, "Imports of other names", count.format(neighbours.imports.reduce((sum, [,n]) => sum + n, 0)));
  fact(list, "Imported by other names", count.format(neighbours.consumers.reduce((sum, [,n]) => sum + n, 0)));
  const links = el("div","structure-links");
  const singleton = selected === "Main" || selected === "Statements";
  links.append(anchor("Pinned source", singleton ? sourceRoot + selected + ".lean" : sourceRoot.replace("/blob/", "/tree/") + selected));
  if (data.replay?.build?.state === "passed" || (data.worker?.state === "completed" && data.worker.phase === "build")) {
    links.append(anchor("Build receipt", "./feed/evidence/build-attestation.json"));
  }
  links.append(anchor("Source inventory", "./feed/evidence/source-provenance.json"));
  panel.append(list, links);
  return panel;
}

/* Captions (copy §VI): provenance tags first, then the sentence. */
const captions = {
  capitulum: [["drawn by rule", "source"],
    "All 175,187 modules, one floret each, packed into a single head and coloured by top-level name. The spiral is " +
    "a packing layout: each floret turns from the last by the golden angle, about 137.5°, which spreads many equal " +
    "things evenly. It has no mathematical connection to ζ, to the primes or to this proof. Switch to import distance " +
    "to see 44 rings, widest at ten steps from <code>Main</code>, or to compile time to watch 64 hours of growth."],
  imports: [["source"],
    "<code>Main.lean</code> imports two modules, <code>Statements</code> and " +
    "<code>Supplements.Kernels.MainTheoremsAll</code>. One level down: Mathlib beneath <code>Statements</code>; " +
    "<code>MainTheoremsCritical</code> and <code>CorGKOf</code> beneath <code>MainTheoremsAll</code>."],
  libraries: [["source"],
    "Direct imports between top-level names, counted from the pinned archive: imports on the left, importers on the " +
    "right, each count a number of module pairs. Mathlib imports are not counted."],
  targets: [["receipt"],
    "The five exported theorems and the four proof terms behind them, coloured by the selected input’s receipt."]
};

function caption(view) {
  const [tags, text] = captions[view];
  const node = el("figcaption", "structure-caption");
  const marks = el("span", "structure-tags");
  for (const word of tags) marks.append(tag(word));
  node.append(marks, " ", words(text));
  return node;
}

/* Read the numbers: the plate's figures as plain tables. Lines, theorem lines and compile-time sums were
   recomputed from the pinned archive and Euler's per-module measurements (math-story §3.2); module and
   import counts are computed here from library-imports.js. */
const nameFacts = {
  Development: ["12,232,663", "562,329", "187.08 h"], Formalism: ["3,200,748", "162,118", "25.81 h"],
  GroundTheory: ["1,119,138", "54,211", "12.89 h"], ReciprocityTheory: ["563,016", "27,722", "4.93 h"],
  CompanionTheory: ["194,218", "9,419", "2.44 h"], PositivityTheory: ["55,130", "2,702", "0.66 h"],
  Lemmata: ["9,232", "245", "0.15 h"], BuildAid: ["20", "0", "0.00 h"], Supplements: ["22", "4", "0.15 h"],
  Main: ["12", "5", "136.7 s"], Statements: ["16", "0 (4 def)", "< 0.01 h"]
};
const nameTotals = ["17,374,215", "818,755", "234.15 h"];

function share(n, total) {
  const percent = 100 * n / total;
  return (percent >= 10 ? percent.toFixed(1) : percent >= 1 ? percent.toFixed(2) : percent.toPrecision(2)) + "%";
}

function table(captionText, head, rows, numeric, foot) {
  const node = el("table", "structure-table");
  node.append(el("caption", "", captionText));
  const thead = el("thead"), headRow = el("tr");
  head.forEach((text, i) => {
    const cell = el("th", numeric[i] ? "num" : "");
    cell.append(words(text));
    cell.scope = "col";
    headRow.append(cell);
  });
  thead.append(headRow);
  const body = el("tbody");
  const row = (values, parent, className) => {
    const tr = el("tr", className);
    values.forEach((value, i) => {
      const cell = el(i === 0 ? "th" : "td", numeric[i] ? "num" : "", value);
      if (i === 0) cell.scope = "row";
      tr.append(cell);
    });
    parent.append(tr);
  };
  for (const values of rows) row(values, body);
  node.append(thead, body);
  if (foot) {
    const tfoot = el("tfoot");
    row(foot, tfoot, "is-total");
    node.append(tfoot);
  }
  const scroll = el("div", "structure-table-scroll");
  scroll.append(node);
  return scroll;
}

function readTheNumbers() {
  const box = el("details", "numbers structure-numbers");
  box.append(el("summary", "", "Read the numbers"));
  const total = libraryImports.module_count, sums = [0, 0, 0];
  const nameRows = Object.entries(libraryImports.libraries).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, modules]) => {
      const {imports: out, consumers, internal} = libraryNeighbourhood(name);
      const outward = out.reduce((sum, [, n]) => sum + n, 0), inward = consumers.reduce((sum, [, n]) => sum + n, 0);
      sums[0] += internal; sums[1] += outward; sums[2] += inward;
      const [lines, theorems, compile] = nameFacts[name] || ["—", "—", "—"];
      return [name, count.format(modules), lines, theorems, count.format(internal), count.format(outward),
        count.format(inward), compile];
    });
  let within = 0, median = null;
  const depthRows = libraryImports.depth_layers.map(layer => {
    within += layer.total;
    if (median === null && within >= total / 2) median = layer.depth;
    return [String(layer.depth), count.format(layer.total), count.format(within) + " (" + share(within, total) + ")"];
  });
  const pairRows = libraryImports.edges.filter(([from, to]) => from !== to)
    .sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
    .map(([from, to, n]) => [from, to, count.format(n)]);
  box.append(
    table("The numbers behind this figure",
      ["Name", "Modules", "Lines", "<code>theorem</code>/<code>lemma</code> lines", "Imports inside itself",
        "Imports of other names", "Imported by other names", "Euler compile time (sum)"],
      nameRows, [false, true, true, true, true, true, true, true],
      ["Total", count.format(total), nameTotals[0], nameTotals[1], count.format(sums[0]), count.format(sums[1]),
        count.format(sums[2]), nameTotals[2]]),
    table(`Modules by import distance from Main (the capitulum’s rings; median ${median})`,
      ["Distance", "Modules", "Within this distance"], depthRows, [true, true, true]),
    table("Direct imports between top-level names, in module pairs (importer first)",
      ["Importer", "Imported", "Imports"], pairRows, [false, false, true]));
  box.append(el("p", "structure-numbers-note",
    "Module and import counts are computed in this page from library-imports.js, generated from the pinned " +
    "source archive (SHA-256 " + libraryImports.archive_sha256.slice(0, 12) + "…); an import counts once per pair " +
    "of submitted modules, Mathlib excluded. Lines and theorem lines were recounted from the same archive; compile " +
    "times are sums of Euler’s per-module measurements."));
  return box;
}

// The day of a receipt, as the desk dates everything: in US Eastern time ("23 November 2026").
const longDate = iso => easternDate(iso, {long:true});

// Main's ring in the capitulum carries the determination of its five theorems for the selected input:
// gold only when con-leche accepted all five (design §3.1: gold is kept for kernel-checked).
function kernelState(data, input) {
  if (!data.run_id) return {state:"pending", label:"Main’s ring stays in pencil until the feed is read."};
  const replay = data.viewReplay;
  const states = targets.map(target => targetEvidence(replay, target.id).state);
  const which = {reference_export:"the published input", local_export:"Euler’s own export"}[replay?.input || input]
    || "the selected input";
  if (states.every(value => value === "Passed")) {
    const date = longDate(replay?.ended);
    return {state:"passed", label:`Main is ringed in gold: con-leche accepted its five theorems from ${which}` +
      (date ? ` on ${date}.` : ".")};
  }
  if (states.includes("Rejected")) {
    return {state:"failed", label:`Main is ringed in vermilion: con-leche rejected a theorem from ${which}.`};
  }
  if (states.includes("Running")) {
    return {state:"running", label:`Main’s ring is live: con-leche is replaying ${which}.`};
  }
  const doubtful = states.find(value => ["Inconclusive", "Unconfirmed", "Unavailable"].includes(value));
  if (doubtful) {
    return {state:"inconclusive", label:`Main’s ring is heather: the determination for ${which} is ${doubtful.toLowerCase()}.`};
  }
  return {state:"pending", label:`Main’s ring stays in pencil: no determination yet for ${which} (${states[0].toLowerCase()}).`};
}

const instances = new WeakMap();
const views = [["capitulum","Capitulum"],["imports","Imports"],["libraries","Top-level names"],["targets","Replay targets"]];

function initialize(root) {
  const modes = el("div","structure-modes");
  modes.setAttribute("role","group");
  modes.setAttribute("aria-label","Proof structure view");
  for (const [value, label] of views) {
    const button = el("button", "toggle", label);
    button.type = "button";
    button.dataset.mode = value;
    modes.append(button);
  }
  const plate = el("div", "structure-plate");
  const figure = el("figure", "figure structure-figure");
  const stage = el("div", "structure-stage");
  figure.append(stage);
  const details = el("div", "structure-detail");
  plate.append(figure, details);
  root.classList.add("structure-panel");
  root.replaceChildren(modes, plate, readTheNumbers());
  const capitulum = createCapitulum();
  const state = {view:"capitulum", selected:{imports:"Main",libraries:"Development",targets:"riemannHypothesis"},
                 data:{}, input:undefined, signature:"", shown:""};
  function showCaption(view) {
    figure.querySelector(".structure-caption")?.remove();
    figure.append(caption(view));
  }
  function showInspector(selected, next) {
    const signature = selected + next.textContent;
    if (signature !== state.signature) {
      state.signature = signature;
      // Retain the active source link when its counters change on a polling tick.
      const focused = details.contains(document.activeElement) ? document.activeElement.textContent : null;
      details.replaceChildren(next);
      if (focused) [...next.querySelectorAll("a")].find(a => a.textContent === focused)?.focus({preventScroll:true});
    }
  }
  function update() {
    const cut = cuts[state.view], selected = state.selected[state.view];
    for (const button of modes.children) button.setAttribute("aria-pressed", String(button.dataset.mode === state.view));
    root.dataset.view = state.view;
    if (state.view === "capitulum") {
      if (state.shown !== "capitulum") {
        const hadFocus = plate.contains(document.activeElement);
        stage.replaceChildren(capitulum.figure);
        showCaption("capitulum");
        // The capitulum speaks for itself (keyboard moves are announced inside it); hover must not chatter.
        details.setAttribute("aria-live", "off");
        details.replaceChildren(capitulum.panel);
        state.shown = "capitulum";
        state.signature = "";
        capitulum.setActive(true);
        if (hadFocus) modes.querySelector('[data-mode="capitulum"]').focus({preventScroll:true});
      }
      capitulum.update({kernel:kernelState(state.data, state.input)});
      return;
    }
    if (state.shown === "capitulum") capitulum.setActive(false);
    details.setAttribute("aria-live", "polite");
    let drawing = stage.firstElementChild;
    if (state.view === "libraries") {
      const neighbours = libraryNeighbourhood(selected);
      if (drawing?.dataset.view !== state.view || drawing.dataset.library !== selected) {
        const hadFocus = drawing?.contains(document.activeElement);
        drawing = libraryDrawing(selected, neighbours);
        stage.replaceChildren(drawing);
        showCaption("libraries");
        state.shown = "libraries";
        if (hadFocus) drawing.querySelector("select").focus({preventScroll:true});
      }
      showInspector(selected, libraryInspector(selected, neighbours, state.data));
      return;
    }
    if (drawing?.dataset.view !== state.view) {
      drawing = drawMap(state.view);
      stage.replaceChildren(drawing);
      showCaption(state.view);
      state.shown = state.view;
      state.signature = "";
    }
    const neighbours = new Set([...relatedNames(cut, selected, "imports"), ...relatedNames(cut, selected, "supplies")]);
    for (const button of drawing.querySelectorAll("[data-node]")) {
      const id = button.dataset.node;
      button.setAttribute("aria-pressed", String(id === selected));
      button.classList.toggle("is-neighbour", neighbours.has(id));
      if (targets.some(t => t.id === id)) {
        const outcome = targetEvidence(state.data.viewReplay, id).state;
        if (button.dataset.outcome !== outcome) {
          button.dataset.outcome = outcome;
          button.dataset.state = chipStates[outcome] || "pending";
          button.title = id + " · " + outcome;
          button.setAttribute("aria-label", id + ", " + outcome);
        }
      }
    }
    for (const line of drawing.querySelectorAll("[data-from]")) {
      line.classList.toggle("is-related", line.dataset.from === selected || line.dataset.to === selected);
    }
    showInspector(selected, inspector(cut, cut.nodes.find(n => n.id === selected), state.data));
  }
  modes.addEventListener("click", event => {
    const button = event.target.closest("button[data-mode]");
    if (!button) return;
    state.view = button.dataset.mode;
    update();
  });
  plate.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || !stage.contains(button)) return;
    if (button.dataset.node) state.selected[state.view] = button.dataset.node;
    else if (button.dataset.libraryChoice) state.selected.libraries = button.dataset.libraryChoice;
    else return;
    update();
  });
  plate.addEventListener("change", event => {
    if (event.target.matches(".structure-picker select")) {
      state.selected.libraries = event.target.value;
      update();
    }
  });
  const render = (data, input) => {
    const scoped = input ? receiptForInput(data?.replay, input) || {input} : data?.replay;
    state.data = data?.run_id === run ? {...data, viewReplay:scoped} : {};
    state.input = input;
    update();
  };
  instances.set(root, render);
  return render;
}

export function showProofStructure(root, data, input) {
  if (root) (instances.get(root) || initialize(root))(data, input);
}
