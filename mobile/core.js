(function (root) {
  var HEADER = ["date","company","sector","role","role_type","channel","status","contact_person","fit_rating","notes","cv_file","cover_letter_file","source","deadline"];
  var STATUSES = ["drafted","applied","interview","offer","hired","rejected","no_response","offer_declined","withdrawn"];
  var FINAL = ["hired","rejected","no_response","offer_declined","withdrawn"];
  var LEGACY = {"no response":"no_response","offer declined":"offer_declined"};
  var BUCKET = {drafted:"Drafted",applied:"Active",interview:"Interview",offer:"Offer",hired:"Hired"};

  function parseCSV(text) {
    var rows = [], row = [], f = "", q = false, i = 0, c;
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    while (i < text.length) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(f); f = ""; rows.push(row); row = [];
      } else f += c;
      i++;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    return rows.filter(function (r) { return !(r.length === 1 && r[0] === ""); });
  }

  function normStatus(s) {
    s = (s || "").trim().toLowerCase();
    return LEGACY[s] || s;
  }

  function fromCSV(text) {
    var rows = parseCSV(text);
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    var out = [];
    for (var r = 1; r < rows.length; r++) {
      var o = {};
      HEADER.forEach(function (k) {
        var idx = head.indexOf(k);
        o[k] = idx >= 0 && rows[r][idx] != null ? rows[r][idx] : "";
      });
      o.status = normStatus(o.status);
      o.id = "r" + r + "_" + Math.random().toString(36).slice(2, 7);
      out.push(o);
    }
    return out;
  }

  function esc(v) {
    v = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function toCSV(items) {
    var lines = [HEADER.join(",")];
    items.forEach(function (it) {
      lines.push(HEADER.map(function (k) { return esc(it[k]); }).join(","));
    });
    return lines.join("\n") + "\n";
  }

  function isFinal(s) { return FINAL.indexOf(normStatus(s)) >= 0; }

  function parseDate(s) {
    if (!s) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s).trim());
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d) ? null : d;
  }

  function dayDiff(a, b) { return Math.round((a - b) / 86400000); }

  function todayUTC() {
    var n = new Date();
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  }

  function deadlineInfo(it, now) {
    var d = parseDate(it.deadline);
    if (!d || isFinal(it.status)) return null;
    var left = dayDiff(d, now || todayUTC());
    if (left < 0) return { days: left, level: "passed" };
    if (left <= 7) return { days: left, level: "soon" };
    return { days: left, level: "ok" };
  }

  function followups(it) {
    return ((it.notes || "").match(/followed up \d{4}-\d{2}-\d{2}/g) || []).length;
  }

  function daysQuiet(it, now) {
    if (isFinal(it.status) || it.status === "drafted") return null;
    var dates = [parseDate(it.date)];
    var m = (it.notes || "").match(/\d{4}-\d{2}-\d{2}/g) || [];
    m.forEach(function (x) { dates.push(parseDate(x)); });
    dates = dates.filter(Boolean);
    if (!dates.length) return null;
    var latest = new Date(Math.max.apply(null, dates));
    return Math.max(0, dayDiff(now || todayUTC(), latest));
  }

  function stats(items) {
    var sent = items.filter(function (i) { return i.status !== "drafted"; });
    var by = { Drafted: items.length - sent.length, Active: 0, Interview: 0, Offer: 0, Hired: 0, Closed: 0 };
    sent.forEach(function (i) {
      var b = BUCKET[i.status];
      if (b && b !== "Drafted") by[b]++; else by.Closed++;
    });
    var reached = sent.filter(function (i) { return ["interview","offer","hired","offer_declined"].indexOf(i.status) >= 0; }).length;
    var rej = sent.filter(function (i) { return i.status === "rejected" || i.status === "no_response"; }).length;
    var resolved = sent.filter(function (i) { return isFinal(i.status); }).length;
    return {
      total: sent.length,
      by: by,
      interviewRate: sent.length ? Math.round(reached / sent.length * 100) : 0,
      rejectionRate: resolved ? Math.round(rej / resolved * 100) : 0
    };
  }

  var api = { HEADER: HEADER, STATUSES: STATUSES, FINAL: FINAL, parseCSV: parseCSV, fromCSV: fromCSV, toCSV: toCSV, normStatus: normStatus, isFinal: isFinal, parseDate: parseDate, deadlineInfo: deadlineInfo, followups: followups, daysQuiet: daysQuiet, stats: stats };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Core = api;
})(typeof self !== "undefined" ? self : this);
