# Riemann Hypothesis · a herbarium record (frozen copy)

A herbarium record of a Lean proof of the Riemann Hypothesis, grown from source and re-examined by an independent kernel. This repository is a frozen, self-contained snapshot of local experimental work: a dashboard served on a single workstation at `http://localhost:8765`, printed as its feed stood at **24 November 2026, 1:05:31 a.m. EST (06:05:31 UTC)**, `2026-11-24T06:05:31Z`.

- **Read the copy:** https://0x0wl.github.io/riemann-herbarium/
- **Where it came from:** a local dashboard (`http://localhost:8765`) that is not publicly reachable. It went on updating; this copy does not.

## What this is

The dashboard is one long page of plates about one specimen: the Lean 4 formalization of the Riemann Hypothesis by Levent Alpöge and Claude, pinned at [Deicyde/riemann-hypothesis @ a172c464](https://github.com/Deicyde/riemann-hypothesis/tree/a172c464fd4bcfc4f53e394dcba45d742b1409a6). The workstation Euler compiled all of its modules from source and pressed the compiled proof into an export; an independent kernel, con-leche, re-examines exports of the proof against a challenge Euler compiled for itself. The page reads every number from that run's receipts, or computes it in your browser from the mathematics, and says which.

At the moment of this snapshot:

- The published export of the proof (61,570,595,788 bytes, from MIT): **accepted** by con-leche against the challenge Euler compiled itself, with all five controls behaving as expected and all fifteen theorem gates (statement, axiom allowlist, kernel) passed for the five exported theorems. The receipt ended 23 November 2026, 12:47:16 p.m. EST (17:47:16 UTC).
- Euler's own export of the proof was being written: 36.01 GB of 61.57 GB at 1:05 a.m. EST (06:05 UTC). No kernel had examined it, so nothing in this copy says it has been kernel-checked.

Kernel acceptance establishes that the proof terms typecheck against the independently compiled statements using only the axioms `propext`, `Quot.sound` and `Classical.choice`. It does not establish that the Lean statement says what the Riemann Hypothesis says, which is a human reading, and the kernel's own soundness is assumed.

## What is here

| Path | What |
|---|---|
| `index.html` and the files beside it | The site as the local dashboard serves it, with its root-absolute URLs made relative so the copy works under any path. `index.html` carries `data-frozen="2026-11-24T06:05:31Z"`: the page then reads `feed/` once, measures every age at the snapshot, and says *Frozen* where the live page says *Live*. |
| `feed/status.json` | The public status feed at the snapshot. |
| `feed/evidence/` | The evidence manifest and the 14 records it lists, each byte-identical to the published copy (its SHA-256 matches the manifest). |
| `feed/events/` | Event chunks 24339–24502: 164 field notes, from 24 November 2026, 12:23 a.m. EST (05:23 UTC) to 1:05 a.m. EST (06:05 UTC). *Load earlier notes* stops at the oldest. |
| `feed/snapshot.json` | When, and from where, the snapshot was taken, and which chunks it holds. |
| `source/` | The site's source, for reference: `dashboard/static/` (without its private `local/` pages), the two generators of its data plates (`acquire/library_map.py`, `acquire/capitulum.py`) and two tests (`dashboard/test_zeta.mjs`, `dashboard/test_proof_structure.mjs`). |

Two feed files differ from the feed as served: in `feed/status.json` and `feed/evidence/manifest.json`, URL strings that began `/feed/` begin `./feed/`, so that they resolve here. `feed/snapshot.json` keeps the SHA-256 of both as served. In `source/acquire/`, the workstation's data directory is written `<data root>` (1 place).

### Check it yourself

```sh
sha256sum feed/evidence/reference-replay.json
grep -o '"reference-replay.json":{[^}]*}' feed/evidence/manifest.json
node source/dashboard/test_zeta.mjs              # the page's ζ, against known values (Node 22 or later)
node source/dashboard/test_proof_structure.mjs   # the library import counts behind chapter VI
```

## Licences and credits

- **Site code and text**: written by the project, as local experimental work. The parts below keep their own licences.
- **KaTeX** (`katex.css`, `katex.js` and its 20 fonts, `fonts/KaTeX_*.woff2`): © Khan Academy and other contributors, under the [MIT licence](https://github.com/KaTeX/KaTeX/blob/main/LICENSE), fonts included ([katex-fonts](https://github.com/KaTeX/katex-fonts/blob/master/LICENSE)); the licence text is `fonts/LICENSE-KaTeX.txt`.
- **Fonts**: Cormorant Garamond, EB Garamond, JuliaMono, under the SIL Open Font License 1.1; the licence texts travel with the fonts: `fonts/OFL-Cormorant.txt`, `fonts/OFL-EBGaramond.txt`, `fonts/OFL-JuliaMono.txt`.
- **Lean source excerpts** are quoted from [Deicyde/riemann-hypothesis](https://github.com/Deicyde/riemann-hypothesis/tree/a172c464fd4bcfc4f53e394dcba45d742b1409a6) at commit `a172c464`, the formalization by Levent Alpöge and Claude; they remain the work of its authors.
- **Data**: `feed/` is a snapshot of the local dashboard's feed (`http://localhost:8765`) at 2026-11-24T06:05:31Z, run `rh-20261120`.

## Printing a new copy

The copy was printed by `deploy/build_pages.py` in the local working tree (not included here): `python -B deploy/build_pages.py --out <dir>`. It reads only the dashboard's feed and the project's own files, and checks the copy before writing it: no root-absolute URL is left, every file the pages name exists, the archived receipt still hashes to its pinned digest, and every evidence record matches the manifest.
