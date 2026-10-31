(function () {
  var KEY = "ajs.tracker.v1";
  var LABEL = { drafted: "Drafted", applied: "Applied", interview: "Interview", offer: "Offer", hired: "Hired", rejected: "Rejected", no_response: "No response", offer_declined: "Offer declined", withdrawn: "Withdrawn" };
  var FILTERS = ["open", "all", "drafted", "applied", "interview", "offer", "closed"];
  var S = { tab: "pipeline", filter: "open", q: "", items: load() };
  var $ = function (id) { return document.getElementById(id); };
  var view = $("view");

  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S.items)); } catch (e) { toast("Storage full or blocked"); } }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function toast(m) { var t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, 2200); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function uid() { return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function visible() {
    var q = S.q.trim().toLowerCase();
    return S.items.filter(function (i) {
      var fin = Core.isFinal(i.status);
      var ok = S.filter === "all" || (S.filter === "open" && !fin) || (S.filter === "closed" && fin) || S.filter === i.status;
      if (!ok) return false;
      return !q || [i.company, i.role, i.sector, i.contact_person].join(" ").toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) {
      var da = Core.deadlineInfo(a), db = Core.deadlineInfo(b);
      if (da && db) return da.days - db.days;
      if (da) return -1; if (db) return 1;
      return (b.date || "").localeCompare(a.date || "");
    });
  }

  function dlBadge(it) {
    var d = Core.deadlineInfo(it);
    if (!d) return null;
    var t = d.level === "passed" ? "Deadline passed " + Math.abs(d.days) + "d ago" : d.days === 0 ? "Due today" : "Due in " + d.days + "d";
    return el("span", { class: "badge" + (d.level === "ok" ? " mute" : " warn"), text: t });
  }

  function card(it) {
    var q = Core.daysQuiet(it);
    var b = el("button", { class: "card", onclick: function () { openSheet(it.id); } }, [
      el("div", { class: "row" }, [
        el("div", {}, [el("div", { class: "co", text: it.company || "Untitled" }), el("div", { class: "role", text: it.role || "" })]),
        it.fit_rating ? el("span", { class: "badge mute", text: it.fit_rating }) : null
      ]),
      el("div", { class: "meta" }, [
        el("span", { class: "badge", text: LABEL[it.status] || it.status || "Unknown" }),
        dlBadge(it),
        q != null && q >= 10 ? el("span", { class: "badge warn", text: q + "d quiet" }) : null,
        it.sector ? el("span", { class: "badge mute", text: it.sector }) : null
      ])
    ]);
    return b;
  }

  function empty(title, sub, btn) {
    return el("div", { class: "empty" }, [el("b", { text: title }), el("div", { text: sub }), btn ? el("button", { class: "btn primary block", onclick: btn.fn, text: btn.t }) : null]);
  }

  function renderPipeline() {
    var chips = el("div", { class: "chips", role: "tablist" }, FILTERS.map(function (f) {
      return el("button", { class: "chip" + (S.filter === f ? " on" : ""), text: f[0].toUpperCase() + f.slice(1), onclick: function () { S.filter = f; render(); } });
    }));
    view.appendChild(chips);
    var list = visible();
    if (!S.items.length) { view.appendChild(empty("No applications yet", "Import job_search_tracker.csv from your laptop, or add one.", { t: "Import CSV", fn: function () { $("file").click(); } })); return; }
    if (!list.length) { view.appendChild(empty("Nothing here", "Try another filter or search.")); return; }
    list.forEach(function (i) { view.appendChild(card(i)); });
  }

  function renderDeadlines() {
    var withD = S.items.map(function (i) { return { i: i, d: Core.deadlineInfo(i) }; }).filter(function (x) { return x.d; }).sort(function (a, b) { return a.d.days - b.d.days; });
    var quiet = S.items.filter(function (i) { var q = Core.daysQuiet(i); return q != null && q >= 10 && Core.followups(i) < 2; });
    var drafted = S.items.filter(function (i) { return i.status === "drafted" && !Core.deadlineInfo(i); });
    if (!withD.length && !quiet.length) { view.appendChild(empty("All clear", "No open deadlines and nothing needs a follow-up.")); return; }
    if (withD.length) { view.appendChild(el("h3", { text: "Deadlines" })); withD.forEach(function (x) { view.appendChild(card(x.i)); }); }
    if (quiet.length) { view.appendChild(el("h3", { text: "Quiet 10+ days, follow up" })); quiet.forEach(function (i) { view.appendChild(card(i)); }); }
    if (drafted.length) { view.appendChild(el("h3", { text: "Drafted, not sent" })); drafted.forEach(function (i) { view.appendChild(card(i)); }); }
  }

  function bar(label, n, max) {
    return el("div", { class: "bar" }, [el("label", { text: label }), el("div", { class: "track" }, [el("div", { class: "fill", style: "width:" + (max ? Math.round(n / max * 100) : 0) + "%" })]), el("em", { text: String(n) })]);
  }

  function renderStats() {
    var st = Core.stats(S.items);
    if (!st.total && !st.by.Drafted) { view.appendChild(empty("No data", "Stats appear once you add applications.")); return; }
    view.appendChild(el("div", { class: "kpis" }, [
      el("div", { class: "kpi" }, [el("b", { text: String(st.total) }), el("span", { text: "Submitted" })]),
      el("div", { class: "kpi" }, [el("b", { text: st.interviewRate + "%" }), el("span", { text: "Reached interview" })]),
      el("div", { class: "kpi" }, [el("b", { text: String(st.by.Interview + st.by.Offer) }), el("span", { text: "In play" })]),
      el("div", { class: "kpi" }, [el("b", { text: st.rejectionRate + "%" }), el("span", { text: "Rejection rate" })])
    ]));
    view.appendChild(el("h3", { text: "By status" }));
    var max = Math.max.apply(null, Object.keys(st.by).map(function (k) { return st.by[k]; }).concat([1]));
    Object.keys(st.by).forEach(function (k) { view.appendChild(bar(k, st.by[k], max)); });
    var sec = {};
    S.items.filter(function (i) { return i.status !== "drafted"; }).forEach(function (i) { var k = i.sector || "Other"; sec[k] = (sec[k] || 0) + 1; });
    var keys = Object.keys(sec).sort(function (a, b) { return sec[b] - sec[a]; }).slice(0, 8);
    if (keys.length) { view.appendChild(el("h3", { text: "By sector" })); keys.forEach(function (k) { view.appendChild(bar(k, sec[k], sec[keys[0]])); }); }
    view.appendChild(el("p", { class: "note", text: "Drafted rows are excluded from rates." }));
  }

  function renderData() {
    view.appendChild(el("h3", { text: "Tracker file" }));
    view.appendChild(el("p", { class: "note", text: "Data stays on this device. Move it with job_search_tracker.csv, same 14 columns as the desktop workflow." }));
    view.appendChild(el("button", { class: "btn primary block", text: "Import CSV", onclick: function () { $("file").click(); } }));
    view.appendChild(el("button", { class: "btn block", text: "Export CSV", onclick: exportCSV }));
    view.appendChild(el("button", { class: "btn block", text: "Share CSV", onclick: shareCSV }));
    view.appendChild(el("h3", { text: "Danger" }));
    view.appendChild(el("button", { class: "btn danger block", text: "Clear all data", onclick: function () { if (confirm("Delete all " + S.items.length + " applications from this device?")) { S.items = []; save(); render(); toast("Cleared"); } } }));
    view.appendChild(el("p", { class: "note", text: S.items.length + " applications stored locally." }));
  }

  function csvFile() { return new File([Core.toCSV(S.items)], "job_search_tracker.csv", { type: "text/csv" }); }
  function exportCSV() {
    var f = csvFile(), a = el("a", { href: URL.createObjectURL(f), download: f.name });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function shareCSV() {
    var f = csvFile();
    if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: "Job search tracker" }).catch(function () {});
    else exportCSV();
  }

  $("file").addEventListener("change", function (e) {
    var f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var items = Core.fromCSV(String(r.result));
      if (!items.length) { toast("No rows found"); return; }
      if (S.items.length && !confirm("Replace " + S.items.length + " stored rows with " + items.length + " imported rows?")) return;
      S.items = items; save(); S.tab = "pipeline"; render(); toast("Imported " + items.length + " rows");
    };
    r.onerror = function () { toast("Could not read file"); };
    r.readAsText(f);
  });

  function field(label, input) { return el("label", { class: "field" }, [el("span", { text: label }), input]); }

  function openSheet(id) {
    var it = id ? S.items.filter(function (x) { return x.id === id; })[0] : null;
    var d = it ? Object.assign({}, it) : { id: uid(), date: today(), status: "drafted" };
    var sheet = $("sheet"); sheet.textContent = "";
    var inp = {};
    function t(k, type, ph) { inp[k] = el("input", { type: type || "text", value: d[k] || "", placeholder: ph || "", autocomplete: "off" }); return inp[k]; }
    inp.status = el("select", {}, Core.STATUSES.map(function (s) { var o = el("option", { value: s, text: LABEL[s] }); if (s === d.status) o.selected = true; return o; }));
    inp.notes = el("textarea", { text: d.notes || "" }); inp.notes.value = d.notes || "";
    inp.status.value = d.status;
    var kids = [
      el("div", { class: "grab" }),
      el("h2", { id: "sheetTitle", text: it ? (d.company || "Application") : "New application" }),
      it && d.role ? el("div", { class: "role", text: d.role }) : null,
      field("Company", t("company")), field("Role", t("role")),
      field("Status", inp.status),
      el("div", { class: "grid2" }, [field("Applied", t("date", "date")), field("Deadline", t("deadline", "date"))]),
      el("div", { class: "grid2" }, [field("Sector", t("sector")), field("Fit", t("fit_rating", "text", "e.g. 8/10"))]),
      el("div", { class: "grid2" }, [field("Channel", t("channel")), field("Contact", t("contact_person"))]),
      field("Posting URL", t("source", "url", "https://")),
      field("Notes", inp.notes)
    ];
    kids.forEach(function (k) { if (k) sheet.appendChild(k); });
    if (d.source && /^https?:\/\//i.test(d.source)) sheet.appendChild(el("a", { class: "btn block", href: d.source, target: "_blank", rel: "noopener noreferrer", text: "Open posting" }));
    function collect() {
      ["company", "role", "date", "deadline", "sector", "fit_rating", "channel", "contact_person", "source"].forEach(function (k) { d[k] = inp[k].value.trim(); });
      d.status = inp.status.value; d.notes = inp.notes.value;
      d.role_type = d.role_type || ""; d.cv_file = d.cv_file || ""; d.cover_letter_file = d.cover_letter_file || "";
    }
    function commit(msg) {
      if (!d.company) { toast("Company is required"); return false; }
      var i = S.items.findIndex(function (x) { return x.id === d.id; });
      if (i >= 0) S.items[i] = d; else S.items.unshift(d);
      save(); closeSheet(); render(); toast(msg); return true;
    }
    sheet.appendChild(el("button", { class: "btn primary block", text: "Save", onclick: function () { collect(); commit("Saved"); } }));
    if (it) {
      sheet.appendChild(el("button", { class: "btn block", text: "Log follow-up sent today (" + Core.followups(d) + " so far)", onclick: function () {
        collect(); d.notes = (d.notes ? d.notes + "\n" : "") + "followed up " + today(); commit("Follow-up logged");
      } }));
      sheet.appendChild(el("button", { class: "btn danger block", text: "Delete", onclick: function () {
        if (!confirm("Delete " + (d.company || "this application") + "?")) return;
        S.items = S.items.filter(function (x) { return x.id !== d.id; }); save(); closeSheet(); render(); toast("Deleted");
      } }));
    }
    sheet.hidden = false; $("scrim").hidden = false; document.body.style.overflow = "hidden";
    sheet.scrollTop = 0;
    if (!it) inp.company.focus();
  }
  function closeSheet() { $("sheet").hidden = true; $("scrim").hidden = true; document.body.style.overflow = ""; }
  $("scrim").addEventListener("click", closeSheet);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });
  $("fab").addEventListener("click", function () { openSheet(null); });

  $("tabs").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-tab]"); if (!b) return;
    S.tab = b.dataset.tab; render(); window.scrollTo(0, 0);
  });
  $("searchToggle").addEventListener("click", function () {
    var bar = $("searchbar"); bar.hidden = !bar.hidden;
    if (!bar.hidden) $("q").focus(); else { S.q = ""; $("q").value = ""; render(); }
  });
  $("q").addEventListener("input", function (e) { S.q = e.target.value; if (S.tab !== "pipeline") S.tab = "pipeline"; render(); });

  function render() {
    var names = { pipeline: "Pipeline", deadlines: "Deadlines", stats: "Stats", data: "Data" };
    $("title").textContent = names[S.tab];
    Array.prototype.forEach.call(document.querySelectorAll("#tabs button"), function (b) { b.classList.toggle("on", b.dataset.tab === S.tab); });
    $("fab").hidden = S.tab === "data" || S.tab === "stats";
    $("searchToggle").hidden = S.tab !== "pipeline";
    view.textContent = "";
    ({ pipeline: renderPipeline, deadlines: renderDeadlines, stats: renderStats, data: renderData })[S.tab]();
  }

  render();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(function () {});
})();
