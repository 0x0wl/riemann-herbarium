import {easternWhen} from "./eastern.js";

const archivedPath = "./reference-controls-20261123T161552Z.html";
const archivedHash = "f78df247d341a9e6a94ef240554226940c89e9377be0d993e06afeaac51ef046";
const referencePath = "./feed/evidence/reference-replay.json";
const controlLabels = {
  valid: "Valid proof", wrong_statement: "Wrong statement", extra_axiom: "Extra axiom",
  placeholder: "Placeholder", ill_typed: "Ill-typed proof term"
};
const sources = {archive: "Archived workstation receipt", public: "Published receipt", checkpoint: "Workstation check-in",
                 feed: "Workstation receipt"};

export function receiptForInput(replay, input) {
  if (!replay || !["reference_export", "local_export"].includes(input)) return null;
  if (replay.input === input) return replay;
  if (input === "local_export" && replay.local_replay?.input === input) return replay.local_replay;
  return null;
}

export function replayHeadline(receipt) {
  if (!receipt) return "Awaiting receipt";
  if (receipt.evidence_state === "unavailable") return "Receipt unavailable";
  if (receipt.evidence_state === "unconfirmed") return "Unconfirmed";
  if (receipt.waiting_for_resources === true) return "Waiting for headroom";
  if (stoppedBeforeReplay(receipt)) return receipt.stage === "controls" ? "Controls stopped" : "Preparation stopped";
  if (receipt.result === "running") {
    const steps = {preflight:"Preflight", download:"Downloading", decompress:"Decompressing",
                   controls:"Checking controls", replay:"Replaying"};
    return steps[receipt.stage] || "Running";
  }
  return {passed:"Accepted", failed:"Rejected", inconclusive:"Inconclusive"}[receipt.result] || "Awaiting replay";
}

// Each marker describes its own evidence. A later kernel can reuse a cached input.
export function replayStages(snapshot, input) {
  const receipt = receiptForInput(snapshot, input);
  const stages = [];
  const add = (name, state="pending", detail="Pending") => stages.push({name, state, detail});
  if (input === "local_export") {
    if (snapshot?.build?.state === "passed") add("Build", "passed", "Attested");
    else add("Build");
    const status = snapshot?.local_export?.state;
    const writing = Number.isFinite(snapshot?.local_export?.bytes);
    const exports = {queued:["queued","Queued"], running:["running",writing ? "Writing" : "Preparing"], passed:["passed","Sealed"],
                     inconclusive:["inconclusive","Stopped"], failed:["failed","Failed"]};
    add("Export", ...(exports[status] || []));
  }
  const controls = controlSummary(receipt);
  if (controls) {
    const matched = controls.rows.filter(([,value]) => value === "Matched").length;
    add("Controls", controls.state, matched+" / "+controls.rows.length+" matched");
  } else if (receipt?.stage === "controls" && receipt.result === "running") add("Controls", "running", "Checking");
  else add("Controls");
  if (input === "reference_export") {
    if (receipt?.stage === "download" || receipt?.stage === "decompress") {
      const label = receipt.stage === "download" ? "Downloading" : "Unpacking";
      add("Download / unpack", receipt.result, receipt.result === "running" ? label : "Stopped");
    } else if (receipt?.solution_sha256 === "5ea74b912147c5c93cc2b6d70cc727cf908df2f62ac6a20480a3fa02f6be244e") {
      add("Download / unpack", "passed", "Input matched");
    } else add("Download / unpack");
  }
  if (receipt?.waiting_for_resources) add("Kernel", "queued", "Waiting for headroom");
  else if (Number.isFinite(receipt?.checker_exit_code)) {
    add("Kernel", receipt.checker_clean_exit === true ? "passed" : "inconclusive", "Exit "+receipt.checker_exit_code);
  } else if (receipt?.main_replay_started && receipt.result === "running") add("Kernel", "running", "Replaying");
  else if (receipt?.stage === "replay" && receipt.result === "running") add("Kernel", "running", "Preparing");
  else if (receipt?.stage === "replay" && receipt.result === "inconclusive") add("Kernel","inconclusive","Stopped");
  else add("Kernel");
  if (receipt?.evidence_state) add("Verdict", "inconclusive", receipt.evidence_state === "unavailable" ? "Unavailable" : "Unconfirmed");
  else if (receipt?.result === "passed") add("Verdict", "passed", "Accepted");
  else if (receipt?.result === "failed") add("Verdict", "failed", "Rejected");
  else if (receipt?.result === "inconclusive") add("Verdict", "inconclusive", "Inconclusive");
  else add("Verdict");
  return stages;
}

export function controlSummary(receipt) {
  const controls = receipt?.controls;
  if (!controls || !Object.keys(controls).length) return null;
  const rows = Object.entries(controlLabels).map(([key, label]) => {
    let result = controls[key] === true ? "Matched" : controls[key] === false ? "Unexpected response" : "Unrecorded";
    const mismatch = receipt.control_mismatch;
    if (controls[key] === false && mismatch?.control === key && Number.isInteger(mismatch.exit_code)) {
      result += " (exit " + mismatch.exit_code + ")";
    }
    return [label, result];
  });
  const matched = Object.keys(controlLabels).filter(k => controls[k] === true).length;
  const state = matched === rows.length ? "passed" : Object.keys(controlLabels).some(k => controls[k] === false) ? "inconclusive" : "running";
  return {rows, state, text: matched + " of " + rows.length + " controls matched their expected responses."};
}

export function stoppedBeforeReplay(r) {
  return r?.result === "inconclusive" && ["controls", "preflight", "download", "decompress"].includes(r.stage);
}

export function receiptLabel(r) {
  const source = sources[r?.display_source || "feed"];
  const stamp = r?.ended || r?.updated || r?.started;
  if (!source || !stamp || !Number.isFinite(Date.parse(stamp))) return "";
  const minutes = Math.max(0, Math.floor((Date.now()-Date.parse(stamp))/60000));
  const age = minutes < 1 ? "just now" : minutes < 60 ? minutes+" min ago" : minutes < 1440 ? Math.floor(minutes/60)+" h ago" : Math.floor(minutes/1440)+" d ago";
  return source + " · " + easternWhen(stamp, {seconds:true}) + " · " + age;
}

const epoch = r => Date.parse(r?.updated || r?.ended || r?.started) || 0;

export function selectReplay(run, live, candidates) {
  if (!run) return live;
  if (live?.run_id && live.run_id !== run) live=undefined;
  if (live?.evidence_state) return live;
  const scoped = candidates.filter(r => r?.run_id === run);
  if (live?.attempt_id || live?.started || live?.updated) {
    if (!live.run_id || live.run_id === run) scoped.push({...live, run_id:run, display_source:"feed"});
  }
  if (!scoped.length) return live;
  scoped.sort((a,b) => {
    if (a.attempt_id && a.attempt_id === b.attempt_id) {
      // A later poll of the same terminal check-in adds no details to the receipt.
      if (a.result === b.result && a.stage === b.stage && (a.display_source === "checkpoint" || b.display_source === "checkpoint")) {
        return Number(b.display_source === "checkpoint") - Number(a.display_source === "checkpoint");
      }
    }
    const distinct = a.attempt_id && b.attempt_id && a.attempt_id !== b.attempt_id;
    const started = distinct && Date.parse(a.started) && Date.parse(b.started) ? Date.parse(a.started) - Date.parse(b.started) : 0;
    if (started) return started;
    const age = epoch(a) - epoch(b);
    if (age) return age;
    if (distinct && (a.result === "running" || b.result === "running")) return Number(a.result==="running")-Number(b.result==="running");
    const priority = {checkpoint:0, archive:1, public:2, feed:3};
    return priority[a.display_source] - priority[b.display_source];
  });
  const best = scoped.at(-1);
  return {...best, build:live?.build, local_export:live?.local_export, local_replay:live?.local_replay,
          gates:live?.gates || {statement:"Statement",axioms:"Axiom allowlist","con-leche":"Kernel replay"}};
}

async function getText(path) {
  const response = await fetch(path, {cache:"no-store"});
  if (!response.ok) throw Error("Archive unavailable");
  return response.text();
}

async function verified(text, expected) {
  if (!/^[a-f0-9]{64}$/.test(expected || "")) return null;
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const hash = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,"0")).join("");
  return hash === expected ? JSON.parse(text) : null;
}

let archive;
async function archivedReceipt() {
  if (archive) return archive;
  const html = await getText(archivedPath);
  const source = new DOMParser().parseFromString(html,"text/html").getElementById("archived-receipt");
  if (!source) return null;
  const row = await verified(source.textContent, archivedHash);
  if (row) archive = {...row, display_source:"archive", evidence:archivedPath};
  return archive;
}

async function publicReceipt(run) {
  const manifest = JSON.parse(await getText("./feed/evidence/manifest.json"));
  const record = manifest.records?.["reference-replay.json"];
  if (manifest.run_id !== run || record?.url !== referencePath) return null;
  const obj = await verified(await getText(referencePath), record.sha256);
  return obj?.run_id === run ? {...obj, display_source:"public", evidence:referencePath} : null;
}

async function localCheckpoint(run) {
  const row = JSON.parse(await getText("./api/maintenance?limit=1")).latest;
  if (!row || row.run_id !== run || row.evidence_file !== "reference-replay.json" || !row.attempt_id
      || !row.phase?.startsWith("reference_")) return null;
  const changed = Number.isFinite(row.last_change) && row.last_change > 0 ? new Date(row.last_change * 1000).toISOString() : row.ts;
  return {run_id:run, kernel:"con-leche", input:"reference_export", stage:row.phase.slice(10),
          result:["running","inconclusive"].includes(row.verdict) ? row.verdict : "pending",
          updated:changed, attempt_id:row.attempt_id, display_source:"checkpoint"};
}

let cache;
export async function replayForView(run, live, local) {
  if (run && live?.run_id && live.run_id !== run) live=undefined;
  if (!run || live?.evidence_state) return live;
  const archived = await archivedReceipt().catch(() => null);
  if (live?.attempt_id && epoch(live) >= epoch(archived)) return live;
  if (cache?.run !== run || cache.local !== local || Date.now() - cache.time > 15000) {
    cache = {run, local, time:Date.now(), value:Promise.all([
      publicReceipt(run).catch(() => null), local ? localCheckpoint(run).catch(() => null) : null
    ])};
  }
  const [published, checkpoint] = await cache.value;
  if (published?.evidence_state) return {...live, ...published};
  return selectReplay(run, live, [archived, published, checkpoint]);
}

export const archivedReceiptPath = archivedPath;
