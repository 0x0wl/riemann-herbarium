// eastern.js · every time the herbarium shows is US Eastern, written with its zone.
//
// Intl names the zone from the instant itself (America/New_York, short name), so a time in
// November reads EST and one in July EDT. The page writes times like this:
//
//   easternClock(t)                     "12:47 p.m. EST"      ({seconds: true} "12:47:16 p.m. EST",
//                                                              {zone: false} "12:47 p.m.")
//   easternDate(t)                      "23 Nov 2026"         ({long: true} "23 November 2026",
//                                                              {year: false} "23 Nov")
//   easternWhen(t)                      "23 Nov 2026, 12:47 p.m. EST" (the options of both)
//   easternRange(a, b)                  "5:12–5:32 a.m. EST"
//   easternZone(t)                      "EST"
//
// t is milliseconds or anything Date.parse reads; an unreadable time gives "". No DOM here:
// the Node tests import modules that use it.

const ZONE = "America/New_York";

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE, year: "numeric", month: "long", day: "numeric",
  hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZoneName: "short",
});

function parts(value) {
  const time = typeof value === "number" ? value : value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(time)) return null;
  const p = {};
  for (const { type, value: text } of formatter.formatToParts(time)) p[type] = text;
  p.period = /^a/i.test(p.dayPeriod) ? "a.m." : "p.m.";
  return p;
}

const clockOf = (p, seconds) => p.hour + ":" + p.minute + (seconds ? ":" + p.second : "");
const dateOf = (p, long, year) => p.day + " " + (long ? p.month : p.month.slice(0, 3)) + (year ? " " + p.year : "");

export function easternClock(value, { seconds = false, zone = true } = {}) {
  const p = parts(value);
  return p ? clockOf(p, seconds) + " " + p.period + (zone ? " " + p.timeZoneName : "") : "";
}

export function easternDate(value, { long = false, year = true } = {}) {
  const p = parts(value);
  return p ? dateOf(p, long, year) : "";
}

export function easternWhen(value, { long = false, year = true, seconds = false } = {}) {
  const p = parts(value);
  return p ? dateOf(p, long, year) + ", " + clockOf(p, seconds) + " " + p.period + " " + p.timeZoneName : "";
}

// Two clock times of one stretch, sharing what they share: "5:12–5:32 a.m. EST",
// "11:58 a.m.–12:03 p.m. EST".
export function easternRange(from, to, { seconds = false } = {}) {
  const a = parts(from), b = parts(to);
  if (!a || !b) return "";
  if (a.timeZoneName !== b.timeZoneName) return easternClock(from, { seconds }) + "–" + easternClock(to, { seconds });
  const head = clockOf(a, seconds) + (a.period === b.period ? "" : " " + a.period);
  return head + "–" + clockOf(b, seconds) + " " + b.period + " " + b.timeZoneName;
}

export function easternZone(value = Date.now()) {
  return parts(value)?.timeZoneName || "";
}
