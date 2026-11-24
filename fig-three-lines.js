// fig-three-lines.js · Chapter X: what is settled, and what is not.
//
// The specimen label with three lines, kept apart on purpose:
//   Collected  — compiled on Euler: inked, and gold once the build receipt says passed;
//   Determined — by the kernel: inked for the published input once its receipt is accepted;
//                for Euler's own export it stays in pencil, with its current state, until
//                local-replay.json passes (then inked, gold);
//   Studied    — understood by people: always pencil, and blank.
// Every word about a verdict comes from the replay receipts in the feed, through
// replay-view.js (receiptForInput, replayHeadline, replayStages, selectReplay); nothing is
// inferred any other way. The label is HTML on a paper slip, so it reads as text.

import { receiptForInput, replayHeadline, replayStages, selectReplay } from "./replay-view.js";
import { stage, element, numbers, drawnBy, grouped } from "./fig-common.js";
import { easternDate, easternWhen } from "./eastern.js";

const NAME = "three-lines";
const ALT = "A paper label with three ruled lines. “Collected” is inked in gold. “Determined” is inked for the published input and pencilled for Euler’s own export. “Studied” is a pencil line with nothing written on it.";

// Euler's own export before a local receipt exists (copy §2.1 "Det. 2", no local receipt),
// by the state replayStages gives its Export marker.
const EXPORT_WORDS = {
  running: "not yet examined · the export is still being written",
  queued: "not yet examined · the export is queued",
  passed: "not yet examined · sealed, awaiting the kernel",
  inconclusive: "not yet examined · the export stopped; nothing rejected",
  failed: "not yet examined · the export failed",
  pending: "not yet examined · the export has not started",
};

function receiptView(feed, input) {
  const receipt = receiptForInput(feed?.replay, input);
  return receipt ? selectReplay(feed?.run_id, receipt, []) : null;
}

const marker = (feed, name) => replayStages(feed?.replay, "local_export").find((s) => s.name === name);

// The words for one determination and how they are inked ("gold" | "red" | "pencil"), from
// replayHeadline alone; the receipt adds only dates and counts.
function determination(view, input, feed) {
  if (!view) {
    if (input === "local_export") {
      const exported = marker(feed, "Export");
      return { text: EXPORT_WORDS[exported?.state] || EXPORT_WORDS.pending, ink: "pencil", headline: replayHeadline(null) };
    }
    return { text: "awaiting receipt", ink: "pencil", headline: replayHeadline(null) };
  }
  const headline = replayHeadline(view);
  const ended = easternWhen(view.ended || view.updated);
  switch (headline) {
    case "Accepted": return { text: `accepted ${ended}`, ink: "gold", headline };
    case "Rejected": return { text: `rejected ${ended}`, ink: "red", headline };
    case "Inconclusive":
    case "Controls stopped":
    case "Preparation stopped": return { text: `no verdict · ended ${ended} · nothing rejected`, ink: "pencil", headline };
    case "Unconfirmed": return { text: "unconfirmed · held as inconclusive", ink: "pencil", headline };
    case "Receipt unavailable": return { text: "receipt unavailable", ink: "pencil", headline };
    case "Waiting for headroom": return { text: "waiting for memory headroom", ink: "pencil", headline };
    case "Preflight":
    case "Checking controls": return { text: "checking the five controls", ink: "pencil", headline };
    case "Replaying": {
      const p = view.progress;
      const counted = Number.isFinite(p?.completed) && Number.isFinite(p?.total) && p.total > 0;
      return { text: counted ? `reading · ${grouped(p.completed)} of ${grouped(p.total)} declarations` : "reading", ink: "pencil", headline };
    }
    default: return { text: headline.toLowerCase(), ink: "pencil", headline };
  }
}

export function mount(el, ctx = {}) {
  const st = stage(el, NAME, ALT);
  const slip = element("div", "fig-label slip");
  slip.setAttribute("role", "group");
  slip.setAttribute("aria-label", "Specimen label: three lines");
  const head = element("p", "fig-label-head");
  head.append(element("span", "small-caps", "Herbarium Lark"), " · Accession ", element("span", "fig-label-run", "rh-20261120"));
  const list = element("ol", "fig-label-lines");

  const line = (key) => {
    const item = element("li", "fig-label-line");
    item.append(element("span", "fig-label-key", key));
    const body = element("span", "fig-label-body");
    item.append(body);
    list.append(item);
    return { item, body };
  };
  const collected = line("Collected");
  const determined = line("Determined");
  const studied = line("Studied");
  // How each line is inked is part of what it says; screen readers hear it too.
  const inkNote = () => element("span", "sr-only");
  const det1 = element("span", "fig-label-text");
  const det2 = element("span", "fig-label-text");
  const det1Note = inkNote(), det2Note = inkNote(), collectedNote = inkNote();
  const det1Row = element("span", "fig-label-row");
  const det2Row = element("span", "fig-label-row");
  det1Row.append(det1, det1Note);
  det2Row.append(det2, det2Note);
  determined.body.append(det1Row, det2Row);
  const collectedText = element("span", "fig-label-text");
  collected.body.append(collectedText, collectedNote);
  const blank = element("span", "fig-label-blank");
  blank.setAttribute("aria-hidden", "true");
  studied.body.append(blank, element("span", "sr-only", "Studied by people: blank. No one has claimed a full human reading of the argument."));
  studied.item.dataset.ink = "pencil";
  const stamp = element("p", "fig-label-det mono");
  slip.append(head, list, stamp);
  el.append(slip);

  let feed = null;

  const INK_WORDS = { gold: " (inked in gold)", red: " (inked in red)", pencil: " (in pencil)" };
  function paint() {
    const replay = feed?.replay;
    if (feed?.run_id) slip.querySelector(".fig-label-run").textContent = feed.run_id;

    // Collected: the build marker of replayStages; the build record adds the date and count.
    const build = replay?.build;
    const built = marker(feed, "Build")?.state === "passed";
    const when = built ? easternWhen(build?.timestamp, { long: true, seconds: true }) : "";
    if (built) {
      collectedText.textContent = `compiled on Euler · ${grouped(build?.modules || 175187)} modules · Lake exit 0${when ? ` · ${when}` : ""}`;
      collected.item.dataset.ink = "gold";
    } else {
      collectedText.textContent = "compiling on Euler · not yet complete";
      collected.item.dataset.ink = "pencil";
    }

    // Determined: the published input, then Euler's own export.
    const publishedView = receiptView(feed, "reference_export");
    const ownView = receiptView(feed, "local_export");
    const published = determination(publishedView, "reference_export", feed);
    const own = determination(ownView, "local_export", feed);
    det1.textContent = `con-leche · published input · ${published.text}`;
    det1Row.dataset.ink = published.ink;
    det2.textContent = `con-leche · Euler’s own export · ${own.text}`;
    det2Row.dataset.ink = own.ink;
    determined.item.dataset.ink = published.ink === "pencil" && own.ink === "pencil" ? "pencil" : "ink";
    collectedNote.textContent = INK_WORDS[collected.item.dataset.ink];
    det1Note.textContent = INK_WORDS[published.ink];
    det2Note.textContent = INK_WORDS[own.ink];

    const ended = publishedView?.ended;
    stamp.textContent = published.ink === "gold" && ended ? `det. con-leche · ${easternDate(ended)}` : "";
    stamp.hidden = !stamp.textContent;

    numbers(el, {
      caption: "Where each line comes from",
      head: ["Line", "State", "From"],
      rows: [
        ["Collected", built ? `passed${when ? ` · ${when}` : ""}` : "pending", "replay.build"],
        ["Determined · published input", `${published.headline}${ended ? ` · ${easternWhen(ended)}` : ""}`, "reference receipt"],
        ["Determined · Euler’s own export", own.text, ownView ? "local receipt" : "replay.local_export"],
        ["Studied", "blank", "—"],
      ],
    });
  }

  drawnBy(el, st.figure, "fig-three-lines.js · receiptForInput(), replayHeadline(), replayStages()");
  feed = ctx.getFeed?.() || null;
  paint();
  st.paint("first");
  st.paint("ready");

  return {
    update(next) {
      feed = next || feed;
      paint();
    },
    destroy() {
      st.restore();
    },
  };
}
