"""Press the per-module data plate behind the proof desk's capitulum.

    python -B -m acquire.capitulum [--output-dir DIR]

Writes two static assets into DIR (default: dashboard/static):

``capitulum.png``
    A lossless RGB data plate (8-bit truecolor, no gamma/colour chunks, no alpha).
    The image is a byte container, not a picture:

    * Row 0 is a calibration row: pixel x holds (x & 255, 255 - (x & 255), (37x + 11) & 255).
      Every channel visits every byte value, so any colour conversion or premultiplication
      applied by the browser shows up as a mismatch.
    * Rows 1.. hold one byte stream, three bytes per pixel (R, G, B), row-major, zero-padded:

          "LARKCAP1"            8-byte magic
          u32 BE  meta length   UTF-8 JSON metadata
          u32 BE  body length
          u32 BE  CRC-32 (IEEE, as zlib.crc32) of meta + body
          meta                  JSON: count, order, namespaces, start, end, planes, source, ...
          body                  the planes listed in meta.planes, back to back

    Planes (one value per module, every module of Main's closure, no names):

    * ``namespace``  u8: index into meta.namespaces (the 11 libraries, sorted as in library-imports.js)
    * ``depth``      u8: shortest import distance from Main (acquire.library_map.import_depths)
    * ``minute``     LEB128 varints: delta of whole minutes since the first completion
                     (prefix-sum to recover the minute; deltas are small and mostly 0)
    * ``seconds_hi``, ``seconds_lo``  u8 planes of a u16: compile seconds in deciseconds,
                     round(seconds * 10) capped at 65535 (the ledger records milliseconds;
                     the maximum is 460.9 s, so the cap is never reached in this build)

    Modules are in compile-completion order: ledger timestamp (whole seconds), ties broken by
    module name. Splitting fields into planes keeps each one homogeneous for deflate.

``capitulum-summary.js``
    A tiny ES module with the counts, start/end, max depth and the plate's CRC, so pages can
    draw before the plate arrives and can fetch it cache-busted (``capitulum.png?v=<crc>``).

Inputs: the pinned tarball (via acquire.library_map) and the ``modules`` table of
<data root>/status/ledger.sqlite3, opened read-only.
"""

import argparse
from collections import Counter
import datetime
import json
from pathlib import Path
import sqlite3
import statistics
import struct
import zlib

from . import library_map
from .prepare import ARCHIVE_HASH, INPUT, ROOT


LEDGER = ROOT / "status/ledger.sqlite3"
STATIC = Path(__file__).resolve().parents[1] / "dashboard/static"
MAGIC = b"LARKCAP1"
WIDTH = 1024
FORMAT = 1


def utc(text):
    return datetime.datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=datetime.timezone.utc)


def iso(moment):
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def ledger_rows():
    connection = sqlite3.connect(f"file:{LEDGER.as_posix()}?mode=ro", uri=True, timeout=10)
    try:
        return connection.execute("SELECT name, library, ts, seconds FROM modules WHERE state = 'done'").fetchall()
    finally:
        connection.close()


def varint(value):
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return out


def collect():
    names = library_map.closure_names()
    depth = library_map.import_depths(library_map.scan_archive(names))
    rows = ledger_rows()
    if len(rows) != library_map.MODULES or {row[0] for row in rows} != names:
        raise ValueError("Ledger completions differ from the Main import closure")
    if any(library != library_map.namespace(name) for name, library, _, _ in rows):
        raise ValueError("Ledger library differs from the module namespace")
    rows.sort(key=lambda row: (row[2], row[0]))
    counts = Counter(row[1] for row in rows)
    attested = json.loads((INPUT / "verified.json").read_bytes())
    if attested["archive_sha256"] != ARCHIVE_HASH or dict(counts) != attested["closure"]["libraries"]:
        raise ValueError("Library counts differ from the pinned source inventory")
    namespaces = sorted(counts)
    index = {name: number for number, name in enumerate(namespaces)}
    start, end = utc(rows[0][2]), utc(rows[-1][2])
    minutes = [int((utc(ts) - start).total_seconds()) // 60 for _, _, ts, _ in rows]
    return dict(
        namespaces=namespaces, counts=counts, start=start, end=end,
        namespace=bytes(index[library] for _, library, _, _ in rows),
        depth=bytes(depth[name] for name, _, _, _ in rows),
        minutes=minutes,
        deciseconds=[min(65535, round(seconds * 10)) for _, _, _, seconds in rows],
        seconds=[seconds for _, _, _, seconds in rows],
    )


def png(stream):
    """Pack a byte stream into an RGB PNG under a calibration row."""
    rows = 1 + -(-len(stream) // (3 * WIDTH))
    calibration = bytes(value for x in range(WIDTH) for value in (x & 255, 255 - (x & 255), (37 * x + 11) & 255))
    stride = 3 * WIDTH
    padded = calibration + stream + bytes(stride * rows - stride - len(stream))
    raw = b"".join(b"\0" + padded[row * stride:(row + 1) * stride] for row in range(rows))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH, rows, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def press(data, generated):
    count = len(data["namespace"])
    minute_deltas = bytearray()
    previous = 0
    for minute in data["minutes"]:
        minute_deltas += varint(minute - previous)
        previous = minute
    planes = [("namespace", "u8", data["namespace"]), ("depth", "u8", data["depth"]),
              ("minute", "leb128-delta", bytes(minute_deltas)),
              ("seconds_hi", "u8", bytes(value >> 8 for value in data["deciseconds"])),
              ("seconds_lo", "u8", bytes(value & 255 for value in data["deciseconds"]))]
    body = b"".join(plane for _, _, plane in planes)
    layout, offset = [], 0
    for name, encoding, plane in planes:
        layout.append(dict(name=name, encoding=encoding, offset=offset, length=len(plane)))
        offset += len(plane)
    meta = dict(
        format=FORMAT, count=count, order="compile",
        order_note="ledger completion timestamp (whole seconds), ties broken by module name",
        namespaces=[dict(name=name, count=data["counts"][name]) for name in data["namespaces"]],
        start=iso(data["start"]), end=iso(data["end"]), minutes=data["minutes"][-1],
        max_depth=max(data["depth"]), seconds_quantum=0.1, planes=layout,
        source=dict(archive_sha256=ARCHIVE_HASH, ledger="modules table, state done", generated=generated))
    meta_bytes = json.dumps(meta, separators=(",", ":")).encode()
    crc = zlib.crc32(meta_bytes + body)
    stream = MAGIC + struct.pack(">III", len(meta_bytes), len(body), crc) + meta_bytes + body
    return meta, crc, png(stream)


def summary_module(meta, crc, size, median):
    summary = dict(
        asset="capitulum.png", bytes=size, crc32=f"{crc:08x}", format=meta["format"], count=meta["count"],
        order=meta["order"], namespaces=meta["namespaces"], start=meta["start"], end=meta["end"],
        minutes=meta["minutes"], maxDepth=meta["max_depth"], medianSeconds=median, source=meta["source"])
    return ("// Generated by python -m acquire.capitulum; describes capitulum.png (decode with capitulum-data.js).\n"
            + "export const capitulumSummary = " + json.dumps(summary, indent=2) + ";\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--output-dir", type=Path, default=STATIC, help=f"static asset directory (default {STATIC})")
    output = parser.parse_args().output_dir
    data = collect()
    generated = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    meta, crc, plate = press(data, generated)
    median = round(statistics.median(data["seconds"]), 3)
    (output / "capitulum.png").write_bytes(plate)
    (output / "capitulum-summary.js").write_text(summary_module(meta, crc, len(plate), median),
                                                 encoding="utf-8", newline="\n")
    print(f"{meta['count']:,} modules in compile order, {meta['start']} .. {meta['end']} "
          f"({meta['minutes']:,} minutes), max depth {meta['max_depth']}, median compile {median} s")
    print(f"capitulum.png {len(plate):,} bytes, crc32 {crc:08x}; "
          + ", ".join(f"{row['name']} {row['count']:,}" for row in meta["namespaces"]))


if __name__ == "__main__":
    main()
