/*
  seed.js · reproducible chance for Lark's drawings

  Everything generative on Lark's pages grows from a named seed, so the same
  name grows the same plant in every browser, on every visit, and anyone can
  say which seed drew a picture.

    hashString(s)   a 32-bit unsigned hash of a string: FNV-1a over the
                    string's UTF-16 code units, finished with murmur3's
                    fmix32 avalanche so that near-identical names still land
                    far apart.
    rng(seed)       a mulberry32 generator whose state is hashString(seed).
                    Call it for floats in [0, 1). It carries a few helpers:
                      .int(n)          integer in [0, n), n > 0
                      .range(lo, hi)   float in [lo, hi)
                      .pick(list)      one element of a non-empty list
                      .normal()        standard normal deviate (Box–Muller)
                      .fork(label)     an independent generator for a sub-part,
                                       seeded with "<seed>/<label>"
                      .seed            the seed string itself
    mulberry32(n)   the bare generator for a 32-bit integer state.

  Determinism: identical seeds give identical sequences. hashString, rng()
  and .int/.range/.pick use only 32-bit integer arithmetic (Math.imul, >>>)
  and one exact division, so they agree bit for bit across engines.
  .normal() also uses Math.log and Math.cos, which engines may round
  differently in the last place; use it for drawing, not for identifiers.
*/

/** 32-bit unsigned hash of `input` (coerced to a string). */
export function hashString(input) {
  const text = String(input);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** Tommy Ettinger's mulberry32: a fast 32-bit generator with a 2^32 period. */
export function mulberry32(state) {
  let a = state >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded generator: rng("lark")() is the same number everywhere, always. */
export function rng(seed = "") {
  const name = String(seed);
  const next = mulberry32(hashString(name));
  next.seed = name;
  next.int = (n) => Math.floor(next() * n);
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.normal = () => {
    let u = next();
    while (u === 0) u = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  next.fork = (label) => rng(`${name}/${label}`);
  return next;
}
