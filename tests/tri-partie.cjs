// Pestrost partií (v2): tři partie za sebou (odveta) ve dvou prohlížečích; partie se musí znatelně lišit.
// node tests/tri-partie.cjs [URL]   (server: node tools/serve.cjs). Mark = Chromium desktop, Radka = WebKit iPhone 13. Mark vyhrává všechny tři.
// Kontroluje: semínko, bójky (různé), nabídky kategorií, první hráč, žádná opakovaná otázka, postup titulu a vzhledu plavce, povýšení na obrazovce výhry.
const path = require("path"), fs = require("fs");
const { pw, L, sleep, T, drive, fits } = require("./lib.cjs");
const { chromium, webkit, devices } = pw;
const BASE = (process.argv[2] || "http://127.0.0.1:8806/").replace(/\/?(\?.*)?$/, "/");
const URL = BASE + "?rychle=1";
const SHOTS = process.env.SHOTS || path.join(__dirname, "shots", "tri");
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const text = (p, sel) => p.locator(sel).first().innerText();
const shot = (p, name) => p.screenshot({ path: path.join(SHOTS, name + ".png") });
const API = "https://mantledb.sh/v2/";
const getDoc = async (id, d) => { const r = await fetch(`${API}kvizove-lode-${id}/${d}`, { cache: "no-store" }); return r.ok ? r.json() : null; };
const errs = [];

(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const A = await (await bA.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const B = await (await bB.newContext({ ...devices["iPhone 13"] })).newPage();
  for (const [n, p] of [["Mark", A], ["Radka", B]]) { p.on("pageerror", e => errs.push(n + ": " + e.message)); p.on("console", m => { if (m.type() === "error" && !/404/.test(m.text())) errs.push(n + " konzole: " + m.text()); }); }

  await A.goto(URL); await A.waitForSelector("#setup:not([hidden])", { timeout: T });
  await A.fill("#nameX", "Mark"); await A.fill("#nameO", "Radka");
  await A.click('#starterSeg button[data-v="x"]'); await A.click('#genderSeg button[data-v="m"]');
  await A.click("#setupSubmit"); await A.waitForSelector("#share:not([hidden])", { timeout: T });
  const link = await A.evaluate(() => location.href), id = (link.match(/#r\.([0-9a-z]+)$/) || [])[1];
  await A.click("#backBtn"); await A.waitForSelector("#game:not([hidden])", { timeout: T });
  await B.goto(link); await B.waitForSelector("#intro:not([hidden])", { timeout: T });
  await B.click('#introGenderSeg button[data-v="f"]'); await B.click("#acceptBtn");
  await B.waitForSelector("#game:not([hidden])", { timeout: T });

  const games = [];
  const ttl = async (p, seat) => (await p.locator(`#people .who-${seat} .ttl`).first().innerText()).trim();
  for (let n = 1; n <= 3; n++) {
    const g = { n, offeredCat0: null, offered: [] };
    await A.waitForSelector('#board[data-phase="place"]', { timeout: T }); await B.waitForSelector('#board[data-phase="place"]', { timeout: T });
    const room = await getDoc(id, "hra");
    g.seed = room.g.seed; g.starter = room.g.s;
    g.buoys = { x: L.buoys(room.g.seed, "x"), o: L.buoys(room.g.seed, "o") };
    g.titleStartMark = await ttl(A, "x"); g.titleStartRadka = await ttl(B, "o");
    for (const p of [A, B]) { await p.click("#randomBtn"); await p.click("#doneBtn"); }
    const chooser = room.g.s === "x" ? B : A;           // nezačínající vybírá první kategorii
    await chooser.waitForSelector('#board[data-phase="cat0"]', { timeout: T });
    g.offeredCat0 = await chooser.locator("#panel .chip").evaluateAll(b => b.map(x => x.dataset.cat));
    await chooser.locator("#panel .chip").first().click();
    // bójky jsou vidět v obou bazénech
    await sleep(300);
    g.buoysShown = [await A.locator("#pwEnemy .buoy").count(), await A.locator("#pwMine .buoy").count()];
    await shot(A, `p${n}-start-desktop`); await shot(B, `p${n}-start-mobil`);
    const cfgA = { name: "Mark", diff: [3, 2, 3], right: () => true, aim: "perfect", radar: 1, cats: ["sport", "veda", "zemepis"], timeout: 500000 };
    const cfgB = { name: "Radka", diff: [1, 2], right: i => i % 3 === 0, aim: "random", radar: 0, cats: ["jidlo", "historie", "priroda"], timeout: 500000 };
    const t0 = Date.now();
    const [sA, sB] = await Promise.all([drive(A, B, cfgA), drive(B, A, cfgB)]);
    await Promise.all([A.waitForSelector("#endBox", { timeout: T }), B.waitForSelector("#endBox", { timeout: T })]);
    await sleep(1500);
    g.secs = Math.round((Date.now() - t0) / 1000); g.offeredMark = sA.offered || []; g.offeredRadka = sB.offered || [];
    g.wheels = (sA.wheel || 0) + (sB.wheel || 0);
    g.promo = await A.locator("#promo").count() ? (await text(A, "#promo")).trim() : "";
    g.titleEndMark = await ttl(A, "x");
    const dx = await getDoc(id, "x"), dox = await getDoc(id, "o");
    g.questions = [...(dx.T || []), ...(dox.T || [])].map(t => t.q);
    g.winner = (await text(A, "#endTitle")).includes("Vyhráváš") ? "Mark" : "Radka";
    await shot(A, `p${n}-konec-desktop`); await shot(B, `p${n}-konec-mobil`);
    await Promise.all([A, B].map(p => p.waitForFunction(() => document.getElementById("sealBox")?.dataset.v === "ok", null, { timeout: T }))).then(() => check(`partie ${n}: ověření poctivosti OK (bójky, rozcvička a finále se replayují)`, true), () => check(`partie ${n}: ověření poctivosti OK`, false));
    games.push(g);
    console.log(`  partie ${n}: ${g.secs} s, začínal ${g.starter}, vyhrál ${g.winner}, titul Marka ${g.titleStartMark} -> ${g.titleEndMark}, kol štěstí ${g.wheels}, tahů s nabídkou ${g.offeredMark.length + g.offeredRadka.length}`);
    if (n < 3) { await B.click("#rematchBtn"); }
  }

  check("všechny tři partie dohrány a vyhrál je Mark", games.every(g => g.winner === "Mark"));
  check("každá partie má jiné semínko", new Set(games.map(g => g.seed)).size === 3, games.map(g => g.seed).join(","));
  const bj = g => JSON.stringify(g.buoys);
  check("bójky se v partiích liší (jiná pole pro x i o)", new Set(games.map(bj)).size === 3 && new Set(games.map(g => JSON.stringify(g.buoys.x))).size === 3);
  check("v každém bazénu jsou 3 viditelné bójky (různé druhy)", games.every(g => g.buoysShown[0] === 3 && g.buoysShown[1] === 3));
  check("první hráč se v sérii mění (poražený začíná)", new Set(games.map(g => g.starter)).size >= 2, games.map(g => g.starter).join(","));
  const off = g => JSON.stringify([g.offeredCat0, g.offeredMark, g.offeredRadka]);
  check("nabídky kategorií (první i další tahy) se v partiích liší", new Set(games.map(off)).size === 3 && games.every(g => g.offeredCat0.length === 3 && g.offeredMark.every(o => o.length === 3)));
  const seen = new Set(); let dup = [];
  for (const g of games) for (const q of g.questions) { if (seen.has(q)) dup.push(q); }
  for (const g of games) g.questions.forEach(q => seen.add(q));
  check("žádná otázka se v sérii neopakuje", dup.length === 0 && seen.size > 20, `${seen.size} různých otázek, opakování: ${dup.join(",") || "žádné"}`);
  check("titul Marka postoupí: Plavčík → Vodník po 1. výhře", games[0].titleStartMark === "Plavčík" && games[0].titleEndMark === "Vodník" && /postoupil na Vodníka/.test(games[0].promo), `${games[0].titleStartMark} → ${games[0].titleEndMark}; ${games[0].promo}`);
  check("po 3. výhře Kapitán nafukovačky a hláška o povýšení", games[2].titleEndMark === "Kapitán nafukovačky" && /postoupil na Kapitána nafukovačky/.test(games[2].promo), `${games[2].titleEndMark}; ${games[2].promo}`);
  check("vzhled plavce se mění s titulem (pruhy, kachna)", await A.evaluate(() => !!document.querySelector('#people .who-x .rank-2')) && await A.evaluate(() => !!document.querySelector('#people .who-x .rank-2 ellipse')));
  check("Radka (ženský tvar) se jmenuje Plavčice", games[0].titleStartRadka === "Plavčice", games[0].titleStartRadka);
  check("žádné chyby JavaScriptu ani konzole", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  await bA.close(); await bB.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); if (errs.length) console.error(errs.join("\n")); process.exit(2); });
