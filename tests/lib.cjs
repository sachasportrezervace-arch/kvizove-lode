// Sdílené pomůcky pro testy ve více prohlížečích (duel.cjs, layout.cjs): ovladač hráče, kontroly rozvržení.
const fs = require("fs"), path = require("path");
const L = require("../engine.js");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const pw = require(PW);

const ROOT = path.join(__dirname, "..");
const QS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "otazky.json"), "utf8"));
const QBY = new Map(QS.map(q => [q.id, q]));
// správné odpovědi jen pro testy (ze zdrojových souborů; hra je nikdy nenačítá)
const TRUTH = new Map();
for (const f of fs.readdirSync(path.join(ROOT, "data", "zdroj"))) if (f.endsWith(".json")) for (const q of JSON.parse(fs.readFileSync(path.join(ROOT, "data", "zdroj", f), "utf8"))) TRUTH.set(q.id, q.spravne.trim());

const sleep = ms => new Promise(r => setTimeout(r, ms));
const T = 20000;

const phaseOf = p => p.evaluate(() => { const b = document.getElementById("board"); return b && !document.getElementById("game").hidden ? b.dataset.phase : ""; });
const fleetOf = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("kl-fleet-")) o[k] = JSON.parse(localStorage.getItem(k)); } return o; })
  .then(o => { const ks = Object.keys(o).sort(); const last = ks[ks.length - 1]; return last ? L.fleetFrom(o[last].f) : null; });
const cellStates = (p, pool) => p.evaluate(sel => [...document.querySelectorAll(sel + " .cell")].map(c => c.dataset.st), pool);

// diagnostika zaseknuté partie: stav obou stránek a poslední tahy z dokumentů x/o na mantledb
async function diagnose(p, other) {
  const page = async (q, name) => q.evaluate(() => {
    const t = s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, " ").trim() : null; };
    const cells = [...document.querySelectorAll("#pwEnemy .cell")].map(c => c.dataset.st).join("");
    return { url: location.href, phase: document.getElementById("board")?.dataset.phase, panel: t("#panel"), status: t("#status"), aim: !!document.querySelector("#pwEnemy.aim"), enemy: cells };
  }).then(r => `${name}: ${JSON.stringify(r)}`);
  const out = [await page(p, "tato stránka")];
  if (other) out.push(await page(other, "druhá stránka"));       // v sólu žádná druhá stránka není
  const m = /#r\.([A-Za-z0-9_-]+)/.exec(p.url());
  if (m) for (const d of ["x", "o"]) {
    try {
      const r = await fetch(`https://mantledb.sh/v2/kvizove-lode-${m[1]}/${d}`), j = await r.json();
      const doc = typeof j === "string" ? JSON.parse(j) : (j.data !== undefined ? (typeof j.data === "string" ? JSON.parse(j.data) : j.data) : j);
      const tail = a => Array.isArray(a) ? JSON.stringify(a.slice(-6)) : JSON.stringify(a);
      out.push(`dok ${d}: T=${tail(doc.T)} R=${tail(doc.R)} S=${tail(doc.S)} D=${tail(doc.D)} klíče=${Object.keys(doc)}`);
    } catch (e) { out.push(`dok ${d}: nelze načíst (${e.message})`); }
  }
  return out.join("\n");
}

// ovladač jednoho hráče: hraje, dokud neskončí partie; cfg řídí chování
//  diff: pole obtížností (cyklicky), right: funkce (nth) → má odpovědět správně?, aim: "perfect" (zná flotilu soupeře z jeho localStorage) | "random",
//  radar: kolikrát použít radar za partii, log: pole zpráv, on: háčky {question(page), shot(page, kind)}
async function drive(p, other, cfg) {
  const st = { turns: 0, asked: 0, shots: 0, radars: 0, seen: new Set(), hits: 0, cats: 0 };
  const enemyFleet = async () => cfg.aim === "perfect" ? await fleetOf(other) : null;
  const t0 = Date.now();
  for (;;) {
    if (Date.now() - t0 > (cfg.timeout || 240000)) throw new Error(`timeout partie (${cfg.name}), fáze ${await phaseOf(p)}\n` + await diagnose(p, other).catch(e => "diagnostika selhala: " + e.message));
    const ph = await phaseOf(p);
    if (ph) st.seen.add(ph);
    if (ph === "end") return st;
    if (ph === "pick-me") {
      const want = cfg.diff[st.turns % cfg.diff.length]; st.turns++;
      const en = await p.locator("#panel [data-d]:not([disabled])").evaluateAll(b => b.map(x => +x.dataset.d));   // v2: rozcvička a finále omezují volbu
      if (!en.length) { await sleep(150); continue; }
      const d = en.includes(want) ? want : (en.filter(x => x <= want).pop() || en[0]);
      await p.locator(`#panel [data-d="${d}"]`).click();
      await sleep(250);
    } else if (ph === "answer-me" && await p.locator("#qcard:not(.answered)").count()) {
      const qid = await p.locator("#qcard").getAttribute("data-qid"), q = QBY.get(qid), truth = TRUTH.get(qid);
      const right = cfg.right(st.asked++);
      if (cfg.on && cfg.on.question) await cfg.on.question(p, st);
      const texts = await p.locator("#qcard .opt .ot").allInnerTexts();
      const want = right ? truth : texts.find(t => t.trim() !== truth);
      const j = texts.findIndex(t => t.trim() === want);
      if (j < 0) throw new Error(`nenašel jsem možnost „${want}“ v ${texts}`);
      await p.locator(`#qcard .opt[data-opt="${j}"]`).click();
      await p.waitForSelector("#qcard.answered", { timeout: 5000 }).catch(() => {});
      if (cfg.on && cfg.on.answered) await cfg.on.answered(p, st, right);
      await p.waitForSelector("#sheet", { state: "hidden", timeout: 12000 }).catch(() => {});
    } else if (ph === "shoot-me") {
      const interactive = await p.locator("#pwEnemy.aim").count();
      const done = await p.locator("#panel .chip, #wheelBtn").count();
      if (done) {
        const offered = await p.locator("#panel .chip").evaluateAll(b => b.map(x => x.dataset.cat));
        if (!offered.length) { st.wheel = (st.wheel || 0) + 1; await p.locator("#wheelBtn").click(); await sleep(1800); continue; }
        const pref = cfg.cats[st.cats++ % cfg.cats.length], cat = offered.includes(pref) ? pref : offered[st.cats % offered.length];
        st.offered = (st.offered || []).concat([offered]);
        await p.locator(`#panel [data-cat="${cat}"]`).click();
        await sleep(300);
      } else if (interactive && cfg.radar > st.radars && await p.locator("#radarBtn").count()) {
        st.radars++;
        await p.locator("#radarBtn").click();
        const states = await cellStates(p, "#pwEnemy"), free = states.map((s, i) => s === "." ? i : -1).filter(i => i >= 0);
        const c = free[Math.floor(free.length / 2)];
        await p.locator(`#pwEnemy .cell[data-i="${c}"]`).click();
        await p.waitForSelector(`#pwEnemy [data-radar="${c}"]`, { timeout: 8000 }).catch(() => {});
        if (cfg.on && cfg.on.radar) await cfg.on.radar(p, st);
      } else if (interactive) {
        const states = await cellStates(p, "#pwEnemy");
        let free = states.map((s, i) => s === "." ? i : -1).filter(i => i >= 0), target;
        const f = await enemyFleet();
        if (f) { const occ = L.occupancy(f); const hit = free.filter(i => occ[i] >= 0); const miss = free.filter(i => occ[i] < 0); target = (cfg.missFirst && st.shots < cfg.missFirst) ? miss[0] : (hit.length ? hit[0] : free[0]); }
        else target = free[Math.floor(Math.random() * free.length)];
        const kind = f && L.occupancy(f)[target] >= 0 ? "hit" : "miss";
        await p.locator(`#pwEnemy .cell[data-i="${target}"]`).click();
        const moved = await p.waitForFunction(i => document.querySelector(`#pwEnemy .cell[data-i="${i}"]`).dataset.st !== ".", target, { timeout: 6000 }).then(() => true, () => false);
        if (moved) { st.shots++; if (cfg.on && cfg.on.shot) await cfg.on.shot(p, kind, st); }
      }
    }
    await sleep(120);
  }
}

// text/rozměry: nic nepřesahuje viewport, žádné posouvání stránky, texty ≥ 14 px
async function fits(p, label) {
  return p.evaluate(label => {
    const vw = innerWidth, vh = innerHeight, bad = [];
    const de = document.documentElement;
    if (de.scrollHeight > vh + 1) bad.push(`stránka se posouvá: ${de.scrollHeight} > ${vh}`);
    if (de.scrollWidth > vw + 1) bad.push(`stránka je širší: ${de.scrollWidth} > ${vw}`);
    const visible = e => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !e.closest("[hidden]"); };
    const check = (sel, name) => document.querySelectorAll(sel).forEach(e => { if (!visible(e)) return; const r = e.getBoundingClientRect(); if (r.bottom > vh + 1 || r.right > vw + 1 || r.left < -1 || r.top < -1) bad.push(`${name} mimo okno: ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)} (${vw}×${vh})`); });
    check("#pwEnemy, #pwMine, #pwX, #pwO", "bazén"); check("#panel", "panel"); check("#qcard", "karta otázky"); check("#panel .btn, #panel .chip, #panel .diff", "ovladač");
    const small = [];
    document.querySelectorAll("#game *, .top *, #setup *, #share *, #intro *").forEach(e => {
      if (e.closest("svg") || e.closest("[hidden]") || !visible(e)) return;
      const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (!own) return;
      const fs = parseFloat(getComputedStyle(e).fontSize);
      if (fs < 13.99) small.push(`${e.tagName}.${e.className} ${fs}px „${e.textContent.trim().slice(0, 20)}“`);
    });
    if (small.length) bad.push("malé písmo: " + [...new Set(small)].slice(0, 4).join(" | "));
    return bad.map(b => `${label}: ${b}`);
  }, label);
}

module.exports = { pw, QS, QBY, TRUTH, L, sleep, T, phaseOf, fleetOf, cellStates, drive, fits };
