const assert = require("assert");
const C = require("./core.js");

const csv = 'date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source,deadline\n' +
  '2026-10-01,"Acme, Inc",Tech,ML Engineer,,portal,applied,,8/10,"line1\nfollowed up 2026-10-12 ""ok""",,,https://x.y,2026-11-03\n' +
  '2026-09-01,Beta,Energy,Analyst,,online,no response,,,,,,,\n' +
  '2026-10-20,Gamma,Tech,Dev,,portal,drafted,,,,,,,2026-10-25\n' +
  '2026-08-01,Old,Tech,Dev,,portal,applied,,,legacy row\n';

const items = C.fromCSV(csv);
assert.strictEqual(items.length, 4);
assert.strictEqual(items[0].company, "Acme, Inc");
assert.strictEqual(items[0].notes, 'line1\nfollowed up 2026-10-12 "ok"');
assert.strictEqual(items[1].status, "no_response");
assert.strictEqual(items[3].deadline, "");
assert.strictEqual(C.followups(items[0]), 1);

const rt = C.fromCSV(C.toCSV(items));
assert.strictEqual(rt.length, 4);
assert.strictEqual(rt[0].notes, items[0].notes);
assert.strictEqual(rt[0].company, "Acme, Inc");
assert.ok(C.toCSV(items).split("\n")[0].endsWith(",deadline"));

assert.ok(C.toCSV([{ company: "=cmd()", status: "applied" }]).includes("'=cmd()"));

const now = new Date(Date.UTC(2026, 9, 31));
assert.strictEqual(C.deadlineInfo(items[0], now).level, "soon");
assert.strictEqual(C.deadlineInfo(items[0], now).days, 3);
assert.strictEqual(C.deadlineInfo(items[2], now).level, "passed");
assert.strictEqual(C.deadlineInfo(items[1], now), null);
assert.strictEqual(C.daysQuiet(items[2], now), null);
assert.strictEqual(C.daysQuiet(items[0], now), 19);

const s = C.stats(items);
assert.strictEqual(s.total, 3);
assert.strictEqual(s.by.Drafted, 1);
assert.strictEqual(s.rejectionRate, 100);
assert.strictEqual(C.parseCSV("a,b\r\n1,2\r\n").length, 2);
const b = C.parseBulk("1. Acme | ML Engineer | https://a.com/j/1\n- Beta - Data Scientist - https://b.com/2\nData Analyst at Gamma\nhttps://www.delta.com/careers/9\n| Company | Role |\n|---|---|\n| Eps | Dev |\n\n");
assert.strictEqual(b.length, 5);
assert.deepStrictEqual(b[0], { company: "Acme", role: "ML Engineer", source: "https://a.com/j/1" });
assert.deepStrictEqual(b[1], { company: "Beta", role: "Data Scientist", source: "https://b.com/2" });
assert.deepStrictEqual(b[2], { company: "Gamma", role: "Data Analyst", source: "" });
assert.strictEqual(b[3].company, "delta.com");
assert.deepStrictEqual(b[4], { company: "Eps", role: "Dev", source: "" });
console.log("core ok");
