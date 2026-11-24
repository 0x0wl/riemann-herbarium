/*
  rosette.js · hashes you can see

  A digest becomes a flower head. Each hex digit is one floret, set on Vogel's
  golden-angle spiral: floret k sits at angle k × 137.507…° (the golden angle,
  π(3 − √5)) and at radius proportional to √(k + ½), so the florets pack as
  evenly as the seeds of a sunflower. A floret's area grows with its digit
  (0 is a speck, f a full seed); a ring closes the head at the rim.
  A SHA-256 digest has 64 hex digits, so its head has 64 florets.

  Nothing here is random. The same digest always draws the same head, element
  for element and number for number (coordinates are rounded to 0.01), so two
  rosettes side by side can be compared by eye: matching files show matching
  flowers.

    rosetteSVG(hexDigest, {size = 64, label, gold = false, decorative = false})
        → an <svg class="rosette"> drawn in currentColor, viewBox -50 -50 100 100,
          width and height = size (CSS px). Its <title> carries the label and
          the full digest (the accessible name, and a tooltip on hover).
          gold: the rim ring is gold. Gold means checked: use it only for a
          digest named by an accepted receipt.
          decorative: aria-hidden, for a rosette that sits beside its digest.
          Accepts 1–128 hex digits, upper or lower case, with or without a
          "sha256:" style prefix. Anything else draws an empty dashed ring
          ("no digest"), so a missing value is visible, not hidden.
    rosetteFlorets(hexDigest) → {digits, florets: [{x, y, r, digit}]}
          the same head for canvas painters, in a unit head (floret centres
          lie within radius 1; r is in the same units).
    rosettePath(hexDigest, {radius = 38}) → the florets as one SVG path "d"
          string centred on 0,0, florets' centres within `radius`.

  Classes for styling (ink.css § Rosettes): svg.rosette, .rosette.gold,
  .rosette-ring, .rosette-florets.
*/

const SVG_NS = "http://www.w3.org/2000/svg";
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const HEAD_RADIUS = 38;
const RING_RADIUS = 46.5;
const GOLD = "#e0b862";

function digitsOf(hexDigest) {
  const text = String(hexDigest ?? "")
    .trim()
    .toLowerCase()
    .replace(/^(?:sha-?(?:1|224|256|384|512)|md5|blake2[bs]?|blake3)\s*[:=]\s*/, "");
  return /^[0-9a-f]{1,128}$/.test(text) ? text : "";
}

const round = (value) => Math.round(value * 100) / 100;

/** The head in unit space: florets' centres within radius 1. */
export function rosetteFlorets(hexDigest) {
  const digits = digitsOf(hexDigest);
  const count = digits.length;
  const florets = [];
  if (!count) return { digits, florets };
  const step = 1 / Math.sqrt(Math.max(count - 0.5, 0.5));
  const largest = 0.71 * step;
  for (let k = 0; k < count; k += 1) {
    const digit = parseInt(digits[k], 16);
    const angle = k * GOLDEN_ANGLE - Math.PI / 2;
    const distance = step * Math.sqrt(k + 0.5);
    florets.push({
      x: distance * Math.cos(angle),
      y: distance * Math.sin(angle),
      r: largest * Math.sqrt((digit + 1) / 16),
      digit,
    });
  }
  return { digits, florets };
}

/** The florets as one path of circles, centred on 0,0. */
export function rosettePath(hexDigest, { radius = HEAD_RADIUS } = {}) {
  const { florets } = rosetteFlorets(hexDigest);
  let d = "";
  for (const floret of florets) {
    const r = round(floret.r * radius);
    const x = round(floret.x * radius - r);
    const y = round(floret.y * radius);
    d += `M${x} ${y}a${r} ${r} 0 1 0 ${round(2 * r)} 0a${r} ${r} 0 1 0 ${round(-2 * r)} 0`;
  }
  return d;
}

/** An SVG rosette for a digest. Identical digests give identical elements. */
export function rosetteSVG(hexDigest, { size = 64, label, gold = false, decorative = false } = {}) {
  const digits = digitsOf(hexDigest);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", gold ? "rosette gold" : "rosette");
  svg.setAttribute("viewBox", "-50 -50 100 100");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  if (decorative) svg.setAttribute("aria-hidden", "true");
  else svg.setAttribute("role", "img");
  if (digits) svg.setAttribute("data-digest", digits);

  const title = document.createElementNS(SVG_NS, "title");
  const name = label ? String(label) : "";
  title.textContent = digits
    ? (name ? `${name}: ${digits}` : `Digest ${digits}`)
    : (name ? `${name}: no digest` : "No digest");
  svg.append(title);

  const ring = document.createElementNS(SVG_NS, "circle");
  ring.setAttribute("class", "rosette-ring");
  ring.setAttribute("r", String(RING_RADIUS));
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", gold ? GOLD : "currentColor");
  if (!gold) ring.setAttribute("stroke-opacity", ".55");
  ring.setAttribute("stroke-width", "1");
  ring.setAttribute("vector-effect", "non-scaling-stroke");
  if (!digits) ring.setAttribute("stroke-dasharray", "2 3");
  svg.append(ring);

  if (digits) {
    const florets = document.createElementNS(SVG_NS, "path");
    florets.setAttribute("class", "rosette-florets");
    florets.setAttribute("fill", "currentColor");
    florets.setAttribute("d", rosettePath(digits));
    svg.append(florets);
  }
  return svg;
}
