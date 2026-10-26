/* Pure date logic for MMM-EventCountdown. Works in the browser and in Node (for tests).
 *
 * Holidays are worked out for any year (Thanksgiving = 4th Thursday of November, Easter by the
 * standard calendar formula, and so on), so the list never needs updating each year.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CountdownLogic = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const DAY = 24 * 60 * 60 * 1000;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (y, m, d) => y + "-" + pad(m) + "-" + pad(d);

  // "2026-12-04" -> UTC-midnight timestamp, so time zones and daylight saving never interfere.
  function ts(str) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str));
    if (!m) {
      throw new Error('"' + str + '" is not a date (use YYYY-MM-DD)');
    }
    const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (new Date(t).getUTCMonth() !== Number(m[2]) - 1) {
      throw new Error('"' + str + '" is not a real date');
    }
    return t;
  }

  function fromTs(t) {
    const d = new Date(t);
    return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  function diffDays(from, to) {
    return Math.round((ts(to) - ts(from)) / DAY);
  }

  // n-th given weekday of a month (weekday 0 = Sunday, n starts at 1)
  function nth(year, month, weekday, n) {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return ymd(year, month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }

  function lastWeekday(year, month, weekday) {
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastWd = new Date(Date.UTC(year, month - 1, lastDay)).getUTCDay();
    return ymd(year, month, lastDay - ((lastWd - weekday + 7) % 7));
  }

  // Western Easter (anonymous Gregorian algorithm)
  function easter(y) {
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return ymd(y, month, day);
  }

  const HOLIDAYS = {
    "new-years-day": { name: "New Year's Day", on: (y) => ymd(y, 1, 1) },
    "mlk-day": { name: "Martin Luther King Jr. Day", on: (y) => nth(y, 1, 1, 3) },
    "valentines-day": { name: "Valentine's Day", on: (y) => ymd(y, 2, 14) },
    "presidents-day": { name: "Presidents' Day", on: (y) => nth(y, 2, 1, 3) },
    easter: { name: "Easter", on: easter },
    "mothers-day": { name: "Mother's Day", on: (y) => nth(y, 5, 0, 2) },
    "memorial-day": { name: "Memorial Day", on: (y) => lastWeekday(y, 5, 1) },
    juneteenth: { name: "Juneteenth", on: (y) => ymd(y, 6, 19) },
    "fathers-day": { name: "Father's Day", on: (y) => nth(y, 6, 0, 3) },
    "independence-day": { name: "Fourth of July", on: (y) => ymd(y, 7, 4) },
    "labor-day": { name: "Labor Day", on: (y) => nth(y, 9, 1, 1) },
    halloween: { name: "Halloween", on: (y) => ymd(y, 10, 31) },
    thanksgiving: { name: "Thanksgiving", on: (y) => nth(y, 11, 4, 4) },
    "christmas-eve": { name: "Christmas Eve", on: (y) => ymd(y, 12, 24) },
    christmas: { name: "Christmas", on: (y) => ymd(y, 12, 25) },
    "new-years-eve": { name: "New Year's Eve", on: (y) => ymd(y, 12, 31) }
  };

  function dateText(start, end) {
    const a = new Date(ts(start));
    const am = MONTHS[a.getUTCMonth()];
    if (!end || end === start) {
      return WEEKDAYS[a.getUTCDay()] + ", " + am + " " + a.getUTCDate();
    }
    const b = new Date(ts(end));
    const bm = MONTHS[b.getUTCMonth()];
    return am + " " + a.getUTCDate() + " – " + (bm === am ? "" : bm + " ") + b.getUTCDate();
  }

  // Turns the data file into a sorted list of what is coming up, relative to `today` (YYYY-MM-DD).
  // Each item: { name, color, start, end, kind, status: "upcoming" | "today" | "ongoing",
  //              daysUntil, dayNumber, totalDays, lastDay, dateText }
  function build(data, today) {
    if (!data || typeof data !== "object") {
      throw new Error("countdowns file is empty or not an object");
    }
    if (data.holidays != null && !Array.isArray(data.holidays)) throw new Error("holidays must be an array");
    if (data.events != null && !Array.isArray(data.events)) throw new Error("events must be an array");
    ts(today);
    const items = [];
    const todayYear = Number(today.slice(0, 4));

    (data.holidays || []).forEach((key) => {
      const id = String(key).trim().toLowerCase();
      const h = Object.hasOwn(HOLIDAYS, id) ? HOLIDAYS[id] : null;
      if (!h) {
        throw new Error('unknown holiday "' + key + '" (see the README holiday list)');
      }
      let date = h.on(todayYear);
      if (date < today) {
        date = h.on(todayYear + 1);
      }
      items.push({ name: h.name, color: null, start: date, end: date, kind: "holiday" });
    });

    (data.events || []).forEach((e, i) => {
      if (!e || !e.name) {
        throw new Error("event #" + (i + 1) + " has no name");
      }
      const start = e.start || e.date;
      if (!start) {
        throw new Error('"' + e.name + '" needs a date (or start and end)');
      }
      const end = e.end || start;
      ts(start);
      if (ts(end) < ts(start)) {
        throw new Error('"' + e.name + '" ends before it starts');
      }
      if (end < today) {
        return; // already over
      }
      items.push({ name: String(e.name), color: e.color ? String(e.color) : null, start, end, kind: "event" });
    });

    const out = items.map((it) => {
      const daysUntil = Math.max(0, diffDays(today, it.start));
      const ranged = it.end !== it.start;
      let status = "upcoming";
      let dayNumber = null;
      let totalDays = null;
      let lastDay = false;
      if (today >= it.start && today <= it.end) {
        status = ranged ? "ongoing" : "today";
        if (ranged) {
          dayNumber = diffDays(it.start, today) + 1;
          totalDays = diffDays(it.start, it.end) + 1;
          lastDay = today === it.end && totalDays > 1;
        }
      }
      return Object.assign({}, it, { status, daysUntil, dayNumber, totalDays, lastDay, dateText: dateText(it.start, it.end) });
    });

    out.sort((a, b) => a.daysUntil - b.daysUntil || a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
    return out;
  }

  return { HOLIDAYS, easter, nth, lastWeekday, diffDays, build, ts, fromTs };
});
