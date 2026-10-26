/* MMM-EventCountdown
 *
 * A small card counting down to the next few events: major holidays (worked out automatically
 * every year) and your own dates, including trips with a start and end. Everything lives in
 * config/countdowns.json and is re-read every 10 minutes, so edits show up without a restart.
 */
Module.register("MMM-EventCountdown", {
  defaults: {
    dataFile: "countdowns.json", // looked up in the MagicMirror config folder
    title: "Countdown",
    maxShown: 3,
    refreshInterval: 10 * 60 * 1000,
    preview: false, // true = always show a sample card, to check how it looks
    timezone: null, // null follows the display browser; otherwise an IANA timezone
    showEmoji: true,
    debugDate: null // e.g. "2026-11-25": pretend it is that day
  },

  getScripts() {
    return [this.file("countdown-logic.js")];
  },

  getStyles() {
    return [this.file("MMM-EventCountdown.css")];
  },

  start() {
    this.countData = null;
    this.errorText = null;
    this.lastRaw = null;
    this.renderedDay = null;

    this.requestData();
    this.refreshTimer = setInterval(() => this.requestData(), this.config.refreshInterval);

    // Flip to the new day just after midnight without waiting for the next data refresh.
    this.dayTimer = setInterval(() => {
      if (this.renderedDay !== null) {
        try { if (this.renderedDay !== this.today()) this.updateDom(0); }
        catch (error) { this.updateDom(0); }
      }
    }, 30 * 1000);
  },

  suspend() {
    clearInterval(this.refreshTimer);
    clearInterval(this.dayTimer);
  },

  resume() { this.start(); },

  pad(n) {
    return String(n).padStart(2, "0");
  },

  today() {
    if (this.config.debugDate) {
      return this.config.debugDate;
    }
    const d = new Date();
    if (this.config.timezone) {
      const parts = new Intl.DateTimeFormat("en-US", {timeZone: this.config.timezone, year: "numeric", month: "2-digit", day: "2-digit"}).formatToParts(d);
      const get = type => parts.find(p => p.type === type).value;
      return `${get("year")}-${get("month")}-${get("day")}`;
    }
    return d.getFullYear() + "-" + this.pad(d.getMonth() + 1) + "-" + this.pad(d.getDate());
  },

  requestData() {
    if (this.config.preview) { this.updateDom(0); return; }
    this.sendSocketNotification("EVENTCOUNTDOWN_LOAD", { instanceId: this.identifier, dataFile: this.config.dataFile });
  },

  socketNotificationReceived(notification, payload) {
    if (!payload || payload.instanceId !== this.identifier) return;
    if (notification === "EVENTCOUNTDOWN_DATA") {
      const raw = JSON.stringify(payload.data);
      if (raw === this.lastRaw && !this.errorText) {
        return; // nothing changed, skip the redraw
      }
      this.lastRaw = raw;
      this.countData = payload.data;
      this.errorText = null;
      this.updateDom(0);
    } else if (notification === "EVENTCOUNTDOWN_ERROR") {
      this.errorText = payload.error;
      this.updateDom(0);
    }
  },

  el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) {
      node.className = cls;
    }
    if (text !== undefined && text !== null) {
      node.textContent = text;
    }
    return node;
  },

  // Big text and small unit for the left block of a row.
  whenParts(it) {
    if (it.status === "ongoing") {
      return it.lastDay ? { big: "Last day", unit: "", word: true } : { big: "Day " + it.dayNumber, unit: "of " + it.totalDays, word: true };
    }
    if (it.daysUntil === 0) {
      return { big: "Today!", unit: "", word: true };
    }
    if (it.daysUntil === 1) {
      return { big: "Tomorrow", unit: "", word: true };
    }
    return { big: String(it.daysUntil), unit: "days", word: false };
  },

  // Display-only icons for holidays and events.
  emojiFor(item) {
    const n = String(item.name || "").toLowerCase();
    if (n.includes("halloween")) return "🎃";
    if (n.includes("thanksgiving")) return "🦃";
    if (n.includes("christmas")) return "🎄";
    if (n.includes("new year")) return "🎆";
    if (n.includes("valentine")) return "❤️";
    if (n.includes("easter")) return "🐣";
    if (n.includes("mother")) return "💐";
    if (n.includes("father")) return "👔";
    if (n.includes("independence") || n.includes("fourth of july")) return "🇺🇸";
    if (n.includes("birthday")) return "🎂";
    if (n.includes("cruise")) return "🚢";
    if (n.includes("trip") || n.includes("vacation") || n.includes("flight")) return "✈️";
    if (n.includes("graduation")) return "🎓";
    return "📅";
  },

  getDom() {
    const wrapper = this.el("div", "countdown");
    let today;
    try { today = this.today(); }
    catch (error) { wrapper.appendChild(this.el("div", "cd-msg", "Countdown timezone: " + error.message)); return wrapper; }
    this.renderedDay = today;

    if (this.errorText) {
      wrapper.appendChild(this.el("div", "cd-msg", "Countdown: " + this.errorText));
      return wrapper;
    }

    let data = this.countData;
    if (this.config.preview) {
      const plus = (n) => CountdownLogic.fromTs(CountdownLogic.ts(today) + n * 86400000);
      data = { holidays: ["halloween", "thanksgiving"], events: [{ name: "Sample trip", start: plus(20), end: plus(30), color: "#4FC3F7" }] };
    }
    if (!data) {
      wrapper.appendChild(this.el("div", "cd-msg", "Loading countdown..."));
      return wrapper;
    }

    let items;
    try {
      items = CountdownLogic.build(data, today);
    } catch (e) {
      wrapper.appendChild(this.el("div", "cd-msg", "Countdown data problem: " + e.message));
      return wrapper;
    }

    const card = this.el("div", "cd-card");
    wrapper.appendChild(card);
    card.appendChild(this.el("div", "cd-title", this.config.title));

    if (!items.length) {
      card.appendChild(this.el("div", "cd-none", "Nothing coming up"));
      return wrapper;
    }

    items.slice(0, this.config.maxShown).forEach((it) => {
      const parts = this.whenParts(it);
      const row = this.el("div", "cd-row" + (it.status === "upcoming" ? "" : " cd-now"));

      const when = this.el("div", "cd-when");
      when.appendChild(this.el("div", "cd-big" + (parts.word ? " cd-word" : ""), parts.big));
      if (parts.unit) {
        when.appendChild(this.el("div", "cd-unit", parts.unit));
      }
      row.appendChild(when);

      const text = this.el("div", "cd-text");
      text.style.borderLeftColor = it.color || (it.kind === "holiday" ? "#ffb74d" : "#b388ff");
      const nameLine = this.el("div", "cd-name");
      if (this.config.showEmoji) nameLine.appendChild(this.el("span", "cd-emoji", this.emojiFor(it)));
      nameLine.appendChild(this.el("span", "cd-label", it.name));
      text.appendChild(nameLine);
      text.appendChild(this.el("div", "cd-date", it.dateText));
      row.appendChild(text);

      card.appendChild(row);
    });
    return wrapper;
  }
});
