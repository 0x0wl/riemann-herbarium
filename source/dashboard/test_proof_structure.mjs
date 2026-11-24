import assert from "node:assert/strict";
import {libraryNeighbourhood, targetEvidence} from "./static/proof-structure.js";
import {libraryImports} from "./static/library-imports.js";

const id = "riemannHypothesis";
const passed = {result:"passed"};
const replay = {stage:"complete", result:"passed", targets:[id],
  theorems:{[id]:{statement:passed, axioms:passed, "con-leche":passed}}};
assert.equal(targetEvidence(replay, id).state, "Passed");
assert.equal(targetEvidence(undefined, id).state, "Awaiting receipt");
assert.equal(targetEvidence(replay, "absent").state, "Outside scope");

// Accepted fixtures and even successful-looking theorem rows cannot turn a
// controls-only receipt or a resource-admission wait into a theorem verdict.
for (const preflight of [
  {...replay, stage:"controls", result:"inconclusive"},
  {...replay, stage:"replay", result:"running", main_replay_started:false, waiting_for_resources:true}
]) {
  const evidence = targetEvidence(preflight, id);
  assert.equal(evidence.state, "Not run");
  assert.ok(evidence.gates.every(([, label]) => label === "Not run"));
}
assert.equal(targetEvidence({...replay, evidence_state:"unavailable"}, id).state, "Unavailable");
assert.equal(targetEvidence({...replay, evidence_state:"unconfirmed"}, id).state, "Unconfirmed");
assert.equal(targetEvidence({...replay, result:"running", stage:"replay"}, id).state, "Running");
assert.equal(targetEvidence({...replay, result:"inconclusive", theorems:{}}, id).state, "Pending");
assert.equal(targetEvidence({...replay, theorems:{[id]:{statement:passed, axioms:{result:"failed"}}}}, id).state, "Rejected");

// Aggregation can introduce cycles even though Lean module imports form a DAG.
// The two directions stay distinct and internal edges appear exactly once.
const development = libraryNeighbourhood("Development");
assert.equal(development.internal, 577034);
assert.equal(new Map(development.imports).get("Formalism"), 41857);
assert.equal(new Map(development.consumers).get("Formalism"), 236);
assert.deepEqual(libraryNeighbourhood("Main"), {imports:[["Statements",1],["Supplements",1]], consumers:[], internal:0});
assert.deepEqual(libraryNeighbourhood("Statements"), {imports:[], consumers:[["Main",1]], internal:0});
let importedPairs = 0;
for (const name of Object.keys(libraryImports.libraries)) {
  const {imports, consumers, internal} = libraryNeighbourhood(name);
  assert.ok(![...imports, ...consumers].some(([neighbour]) => neighbour === name));
  importedPairs += internal + imports.reduce((acc, [,n]) => acc+n, 0);
}
assert.equal(importedPairs, 753261);
