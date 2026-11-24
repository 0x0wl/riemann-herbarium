// Decoder for capitulum.png, the per-module data plate pressed by `python -B -m acquire.capitulum`.
// Format (see acquire/capitulum.py): RGB PNG, row 0 a calibration row, rows 1.. one byte stream
// (3 bytes per pixel): "LARKCAP1", u32 BE meta length, u32 BE body length, u32 BE CRC-32 of
// meta + body, JSON meta, then the planes listed in meta.planes. No module names are stored.
import { capitulumSummary } from "./capitulum-summary.js";

export { capitulumSummary };

const MAGIC = "LARKCAP1";
let pending = null;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function plateError(message) {
  return new Error(`capitulum.png did not decode: ${message}`);
}

async function plateImage(url) {
  if (typeof createImageBitmap === "function") {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw plateError(`HTTP ${response.status}`);
    return createImageBitmap(await response.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  }
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

async function plateBytes(url) {
  const image = await plateImage(url);
  const { width, height } = image;
  const canvas = typeof OffscreenCanvas === "function"
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement("canvas"), { width, height });
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  image.close?.();
  const rgba = context.getImageData(0, 0, width, height).data;
  for (let x = 0; x < width; x++) {
    const p = 4 * x;
    if (rgba[p] !== (x & 255) || rgba[p + 1] !== 255 - (x & 255) || rgba[p + 2] !== ((37 * x + 11) & 255) || rgba[p + 3] !== 255) {
      throw plateError(`calibration row altered at x=${x} (the browser converted the colours)`);
    }
  }
  const bytes = new Uint8Array(3 * width * (height - 1));
  for (let p = 4 * width, q = 0; p < rgba.length; p += 4, q += 3) {
    if (rgba[p + 3] !== 255) throw plateError("alpha channel altered");
    bytes[q] = rgba[p];
    bytes[q + 1] = rgba[p + 1];
    bytes[q + 2] = rgba[p + 2];
  }
  return bytes;
}

function decode(bytes) {
  if (bytes.length < 20 || new TextDecoder().decode(bytes.subarray(0, 8)) !== MAGIC) throw plateError("missing LARKCAP1 header");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const metaLength = view.getUint32(8);
  const bodyLength = view.getUint32(12);
  const expected = view.getUint32(16);
  if (20 + metaLength + bodyLength > bytes.length) throw plateError("truncated byte stream");
  const payload = bytes.subarray(20, 20 + metaLength + bodyLength);
  const actual = crc32(payload);
  if (actual !== expected) throw plateError(`checksum mismatch (crc32 ${actual.toString(16)} ≠ ${expected.toString(16)})`);
  if (actual.toString(16).padStart(8, "0") !== capitulumSummary.crc32) {
    throw plateError(`plate crc32 ${actual.toString(16)} does not match capitulum-summary.js (${capitulumSummary.crc32}); stale cache?`);
  }
  const meta = JSON.parse(new TextDecoder().decode(payload.subarray(0, metaLength)));
  const body = payload.subarray(metaLength);
  const plane = (name) => {
    const entry = meta.planes.find((p) => p.name === name);
    if (!entry) throw plateError(`missing plane ${name}`);
    return body.subarray(entry.offset, entry.offset + entry.length);
  };
  const count = meta.count;
  const namespace = plane("namespace").slice();
  const depth = plane("depth").slice();
  const minuteDeltas = plane("minute");
  const hi = plane("seconds_hi");
  const lo = plane("seconds_lo");
  if (namespace.length !== count || depth.length !== count || hi.length !== count || lo.length !== count) {
    throw plateError("plane length differs from the module count");
  }
  const minute = new Uint16Array(count);
  let at = 0;
  let current = 0;
  for (let i = 0; i < count; i++) {
    let delta = 0;
    let shift = 0;
    let byte;
    do {
      if (at >= minuteDeltas.length) throw plateError("minute plane truncated");
      byte = minuteDeltas[at++];
      delta += (byte & 0x7f) * 2 ** shift;
      shift += 7;
    } while (byte & 0x80);
    current += delta;
    minute[i] = current;
  }
  const seconds = new Float32Array(count);
  for (let i = 0; i < count; i++) seconds[i] = ((hi[i] << 8) | lo[i]) * meta.seconds_quantum;
  const perMinute = new Uint32Array(meta.minutes + 1);
  for (let i = 0; i < count; i++) perMinute[minute[i]]++;
  const tally = new Uint32Array(meta.namespaces.length);
  for (let i = 0; i < count; i++) tally[namespace[i]]++;
  meta.namespaces.forEach((entry, i) => {
    if (tally[i] !== entry.count) throw plateError(`namespace ${entry.name} count ${tally[i]} ≠ ${entry.count}`);
  });
  return {
    count,
    namespaces: meta.namespaces.map(({ name, count }) => ({ name, count })),
    order: meta.order,
    namespace,
    depth,
    minute,
    seconds,
    perMinute,
    start: meta.start,
    end: meta.end,
    maxDepth: meta.max_depth,
    secondsQuantum: meta.seconds_quantum,
    source: { archive_sha256: meta.source.archive_sha256, generated: meta.source.generated },
  };
}

// Resolves to the decoded plate; rejects with a clear Error if the image is missing, colour-shifted or corrupt.
// The promise is shared: repeated calls fetch and decode once (a failed load may be retried).
export async function loadCapitulum() {
  if (!pending) {
    const url = new URL(`./${capitulumSummary.asset}?v=${capitulumSummary.crc32}`, import.meta.url).href;
    pending = plateBytes(url).then(decode);
    pending.catch(() => { pending = null; });
  }
  return pending;
}
