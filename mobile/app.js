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
    if (!S.items.length) { view.appendChild(empty("No applications yet", "Import job_search_tracker.csv from your laptop, or add one.", { t: "Import CSV", fn: function () { $("file").click(); } })); view.appendChild(el("button", { class: "btn block", text: "Bulk add from a list", onclick: openBulk })); return; }
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
    view.appendChild(el("h3", { text: "Add jobs" }));
    view.appendChild(el("button", { class: "btn primary block", text: "Bulk add from a list", onclick: openBulk }));
    view.appendChild(el("h3", { text: "My documents" }));
    var dbox = el("div", {}); view.appendChild(dbox); renderDocs(dbox);
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
  function copyText(txt, msg) {
    function fallback() {
      var ta = el("textarea", { style: "position:fixed;top:0;left:0;opacity:0" }); ta.value = txt; document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
      ta.remove(); toast(ok ? msg : "Copy failed");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast(msg); }, fallback); else fallback();
  }
  function applyCmd(i) { return i.source ? "/apply " + i.source : ""; }

  function renderQueue() {
    var q = S.items.filter(function (i) { return i.status === "drafted"; });
    view.appendChild(el("p", { class: "note", text: "Paste each command into Claude Code on your laptop. It tailors your CV and cover letter, and you review before sending." }));
    if (!q.length) { view.appendChild(empty("Queue is empty", "Jobs you add land here as Drafted.", { t: "Bulk add from a list", fn: openBulk })); return; }
    var ready = q.filter(function (i) { return applyCmd(i); });
    if (ready.length) view.appendChild(el("button", { class: "btn primary block", style: "margin-bottom:12px", text: "Copy all " + ready.length + " commands", onclick: function () { copyText(ready.map(applyCmd).join("\n"), "Copied " + ready.length + " commands"); } }));
    q.forEach(function (i) {
      var c = applyCmd(i);
      view.appendChild(el("div", { class: "card" }, [
        el("div", { class: "co", text: i.company }), el("div", { class: "role", text: i.role || "" }),
        c ? el("div", { class: "cmd", text: c }) : el("div", { class: "cmd", text: "No posting link. Open the job and add its link." }),
        el("div", { class: "btns" }, [
          c ? el("button", { class: "btn primary", text: "Copy", onclick: function () { copyText(c, "Copied"); } }) : el("button", { class: "btn primary", text: "Add link", onclick: function () { openSheet(i.id); } }),
          el("button", { class: "btn", text: "Applied", onclick: function () { i.status = "applied"; i.date = today(); save(); render(); toast("Marked applied"); } }),
          el("button", { class: "btn", text: "Edit", onclick: function () { openSheet(i.id); } })
        ])
      ]));
    });
  }

  function openBulk() {
    var sheet = $("sheet"); sheet.textContent = "";
    var ta = el("textarea", { id: "bulk", class: "bulk", placeholder: "Acme | ML Engineer | https://acme.com/jobs/1\nBeta - Data Scientist - https://beta.com/jobs/2\nhttps://gamma.com/careers/3" });
    var cnt = el("p", { class: "note" });
    function upd() { cnt.textContent = Core.parseBulk(ta.value).length + " jobs found"; }
    ta.addEventListener("input", upd); upd();
    [el("div", { class: "grab" }), el("h2", { id: "sheetTitle", text: "Bulk add" }),
      el("p", { class: "note", text: "One job per line: Company | Role | Link. A link alone works. Lists from Claude or ChatGPT work. Added as Drafted." }),
      field("Job list", ta), cnt,
      el("button", { class: "btn primary block", text: "Add to queue", onclick: function () {
        var rows = Core.parseBulk(ta.value), seen = {}, added = 0;
        S.items.forEach(function (i) { seen[(i.company + "|" + i.role + "|" + i.source).toLowerCase()] = 1; });
        rows.forEach(function (r) {
          var k = (r.company + "|" + r.role + "|" + r.source).toLowerCase();
          if (seen[k]) return; seen[k] = 1; added++;
          S.items.unshift({ id: uid(), date: today(), company: r.company, sector: "", role: r.role, role_type: "", channel: "", status: "drafted", contact_person: "", fit_rating: "", notes: "", cv_file: "", cover_letter_file: "", source: r.source, deadline: "" });
        });
        if (!added) { toast("Nothing new to add"); return; }
        save(); closeSheet(); S.tab = "queue"; render(); toast("Added " + added + (rows.length - added ? ", skipped " + (rows.length - added) + " duplicates" : ""));
      } }),
      el("button", { class: "btn block", text: "Cancel", onclick: closeSheet })].forEach(function (k) { sheet.appendChild(k); });
    sheet.hidden = false; $("scrim").hidden = false; document.body.style.overflow = "hidden"; sheet.scrollTop = 0; ta.focus();
  }

  function idb(cb) {
    try {
      var r = indexedDB.open("ajs", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("docs", { keyPath: "id" }); };
      r.onsuccess = function () { cb(null, r.result); };
      r.onerror = function () { cb(r.error || true); };
    } catch (e) { cb(e); }
  }
  function docsAll(cb) {
    idb(function (err, db) {
      if (err) return cb([]);
      var q = db.transaction("docs").objectStore("docs").getAll();
      q.onsuccess = function () { cb(q.result || []); }; q.onerror = function () { cb([]); };
    });
  }
  function docWrite(fn, cb) {
    idb(function (err, db) {
      if (err) return cb(err);
      var tx = db.transaction("docs", "readwrite"); fn(tx.objectStore("docs"));
      tx.oncomplete = function () { cb(); }; tx.onerror = function () { cb(tx.error || true); }; tx.onabort = tx.onerror;
    });
  }
  function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function pickDoc(kind, box) {
    var inp = el("input", { type: "file", accept: ".pdf,.doc,.docx,.pages,.png,.jpg,.jpeg,.zip,.txt,.md", style: "display:none" });
    inp.addEventListener("change", function () {
      var f = inp.files[0]; inp.remove();
      if (!f) return;
      if (f.size > 25 * 1048576) { toast("File over 25 MB"); return; }
      docWrite(function (s) { s.put({ id: uid(), name: f.name, kind: kind, size: f.size, type: f.type, added: today(), blob: f }); }, function (err) {
        if (err) toast("Could not store file"); else { toast("Saved " + f.name); renderDocs(box); }
      });
    });
    document.body.appendChild(inp); inp.click();
  }
  function renderDocs(box) {
    docsAll(function (list) {
      if (!box.isConnected) return;
      box.textContent = "";
      box.appendChild(el("p", { class: "note", text: "Stored on this phone only, never uploaded. Claude Code reads the originals from documents/ on your laptop." }));
      box.appendChild(el("div", { class: "btns" }, [
        el("button", { class: "btn primary", text: "Add CV", onclick: function () { pickDoc("CV", box); } }),
        el("button", { class: "btn primary", text: "Add portfolio", onclick: function () { pickDoc("Portfolio", box); } })
      ]));
      list.sort(function (a, b) { return (b.added || "").localeCompare(a.added || ""); }).forEach(function (d) {
        box.appendChild(el("div", { class: "card" }, [
          el("div", { class: "row" }, [el("div", { class: "co", text: d.name }), el("span", { class: "badge", text: d.kind })]),
          el("div", { class: "role", text: fmtSize(d.size) + " · " + d.added }),
          el("div", { class: "btns" }, [
            el("button", { class: "btn", text: "Open", onclick: function () {
              var a = el("a", { href: URL.createObjectURL(d.blob), target: "_blank", rel: "noopener" }); document.body.appendChild(a); a.click(); a.remove();
            } }),
            el("button", { class: "btn danger", text: "Remove", onclick: function () {
              ask("Remove " + d.name + " from this phone?", "Remove", function () { docWrite(function (s) { s.delete(d.id); }, function () { renderDocs(box); }); });
            } })
          ])
        ]));
      });
    });
  }

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
    if (!it) sheet.appendChild(el("button", { class: "btn block", text: "Paste a list instead", onclick: openBulk }));
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
    var names = { pipeline: "Pipeline", deadlines: "Deadlines", queue: "Apply queue", stats: "Stats", data: "Data" };
    $("title").textContent = names[S.tab];
    Array.prototype.forEach.call(document.querySelectorAll("#tabs button"), function (b) { b.classList.toggle("on", b.dataset.tab === S.tab); });
    $("fab").hidden = S.tab === "data" || S.tab === "stats";
    $("searchToggle").hidden = S.tab !== "pipeline";
    view.textContent = "";
    ({ pipeline: renderPipeline, deadlines: renderDeadlines, queue: renderQueue, stats: renderStats, data: renderData })[S.tab]();
  }

  render();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(function () {});
})();
