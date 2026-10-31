// Napojení na Hernu (protokol 1, ../HERNA-PROTOKOL.md): hra v iframe, dva prohlížeče. Mark = Chromium desktop 1440×900, Radka = WebKit iPhone 13.
// node tests/herna.cjs [URL]   (výchozí http://127.0.0.1:8806/; server: node tools/serve.cjs). Screenshoty do tests/shots/herna-*.png.
// Rodič (stránka s iframe a 48px lištou jako Herna) se podstrčí přes route na stejném originu jako hra, takže localStorage v iframe funguje jako v Herně.
// Scénář 1: zakládá Mark (seat 0), partie 1 + odveta (partie 2). Scénář 2: zakládá Radka (seat 1), mapování sedadel obráceně.
const path = require("path"), fs = require("fs");
const { pw, sleep, T, phaseOf, drive, fits } = require("./lib.cjs");
const { chromium, webkit, devices } = pw;
const BASE = (process.argv[2] || "http://127.0.0.1:8806/").replace(/\/?(\?.*)?(#.*)?$/, "/");
const SHOTS = process.env.SHOTS || path.join(__dirname, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { if (ok) pass++; else fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const errs = [];
const randId = n => [...Array(n)].map(() => Math.floor(Math.random() * 36).toString(36)).join("");

// rodič: lišta 48 px + iframe přes zbytek obrazovky; sbírá zprávy podle protokolu (jen z vlastního iframe a jen objekty s herna: 1)
const RODIC = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;height:100%}#bar{height:48px;background:#1c2a39}#f{position:fixed;left:0;right:0;top:48px;bottom:0;width:100%;height:calc(100% - 48px);border:0}</style>
<div id="bar"></div><iframe id="f" allow="fullscreen"></iframe>
<script>window.__m=[];const f=document.getElementById("f");addEventListener("message",e=>{if(e.source===f.contentWindow&&e.data&&e.data.herna===1)window.__m.push(e.data)});const u=new URLSearchParams(location.search).get("u");if(u)f.src=u;</script>`;

// pozorovatel: zda se někdy ukázala úvodní obrazovka, výzva nebo sdílení (v Herně nesmí)
const WATCH = () => {
  window.__saw = [];
  const go = () => ["setup", "intro", "share"].forEach(id => { const e = document.getElementById(id); if (!e) return; const chk = () => { if (!e.hidden) window.__saw.push(id); }; new MutationObserver(chk).observe(e, { attributes: true, attributeFilter: ["hidden"] }); chk(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
};

async function newPlayer(launcher, ctxOpts, name) {
  const browser = await launcher.launch(), ctx = await browser.newContext(ctxOpts);
  await ctx.addInitScript(WATCH);
  await ctx.route("**/__herna-rodic.html*", r => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: RODIC }));
  const page = await ctx.newPage();
  page.on("pageerror", e => errs.push(`${name}: ${e.message}`));
  page.on("console", m => { if (m.type() === "error" && !/404/.test(m.text())) errs.push(`${name} konzole: ${m.text()}`); });
  return { browser, ctx, page, name, frame: null };
}
const hernaUrl = (r, seat, zaklada, names = "Mark,Radka") => `${BASE}?rychle=1#herna=1&m=test000000&r=${r}&seat=${seat}&names=${encodeURIComponent(names.split(",")[0])},${encodeURIComponent(names.split(",")[1])}&zaklada=${zaklada}`;
async function openInHerna(pl, url) {
  await pl.page.goto(`${BASE}__herna-rodic.html?u=${encodeURIComponent(url)}`);
  await pl.page.waitForSelector("#f");
  for (let i = 0; i < 100 && !(pl.frame = pl.page.frames().find(f => f !== pl.page.mainFrame())); i++) await sleep(50);
}
const msgs = pl => pl.page.evaluate(() => window.__m);
const saw = pl => pl.frame.evaluate(() => window.__saw);
const sameStav = (m, f) => m.filter(x => x.typ === "stav").map(x => x.faze).join(">").replace(/(\w+)(>\1)+/g, "$1") === f;

// rozmístění (Náhodně + Hotovo) u obou, nezačínající vybere první kategorii
async function startGame(A, B, tag) {
  for (const pl of [A, B]) { await pl.frame.waitForSelector('#board[data-phase="place"]', { timeout: T }); await pl.frame.click("#randomBtn"); await pl.frame.click("#doneBtn"); }
  for (let i = 0; i < 300; i++) {
    for (const pl of [A, B]) if (await phaseOf(pl.frame) === "cat0") { await pl.frame.locator("#panel .chip").first().click(); return; }
    await sleep(100);
  }
  throw new Error(`${tag}: nikdo nevybral první kategorii`);
}
async function playGame(A, B, perfect, label) {
  const cfg = (pl, win) => ({ name: pl.name, diff: win ? [3, 2, 3] : [1, 2], right: win ? () => true : i => i % 3 === 0, aim: win ? "perfect" : "random", radar: win ? 1 : 0, cats: ["sport", "veda", "zemepis"], timeout: 500000 });
  await Promise.all([drive(A.frame, B.frame, cfg(A, perfect === A)), drive(B.frame, A.frame, cfg(B, perfect === B))]);
  await Promise.all([A, B].map(pl => pl.frame.waitForSelector("#endBox", { timeout: T })));
  await sleep(1200);
  console.log(`  ${label}: dohráno`);
}

async function scenario(label, founderIsA, rematch, layout) {
  const r = randId(12);
  const A = await newPlayer(chromium, { viewport: { width: 1440, height: 900 } }, "Mark"), B = await newPlayer(webkit, { ...devices["iPhone 13"] }, "Radka");
  const [F, O] = founderIsA ? [A, B] : [B, A];                      // zakladatel a pozvaný
  const seatOf = pl => pl === A ? 0 : 1, names = ["Mark", "Radka"];
  try {
    // pozvaný otevře dřív, než dokument vznikne
    await openInHerna(O, hernaUrl(r, seatOf(O), 0));
    await O.frame.waitForSelector("#info:not([hidden])", { timeout: T });
    check(`${label}: pozvaný (zaklada=0) čeká: „Čeká se, až hra naskočí“, bez výzvy`, (await O.frame.locator("#infoTitle").innerText()).includes("Čeká se, až hra naskočí") && await O.frame.locator("#intro").isHidden());
    await sleep(600);
    let mO = await msgs(O);
    check(`${label}: rodič dostal pripraveno a stav ceka`, mO.some(x => x.typ === "pripraveno") && mO.some(x => x.typ === "stav" && x.faze === "ceka"), JSON.stringify(mO));
    await openInHerna(F, hernaUrl(r, seatOf(F), 1));
    await Promise.all([F, O].map(pl => pl.frame.waitForSelector("#game:not([hidden])", { timeout: T })));
    await Promise.all([F, O].map(pl => pl.frame.waitForSelector('#board[data-phase="place"]', { timeout: T })));
    const x = names[seatOf(F)], o = names[seatOf(O)];             // x = zakladatel, o = pozvaný
    for (const pl of [F, O]) {
      check(`${label}: ${pl.name} sedí bez výzvy, setupu i sdílení`, (await saw(pl)).length === 0, (await saw(pl)).join(","));
      check(`${label}: ${pl.name} hraje za své jméno (sedadlo ${seatOf(pl)} = ${names[seatOf(pl)]})`, (await pl.frame.locator("#pwMine .pcap").innerText()).includes("Tvůj") && (await pl.frame.evaluate(() => document.querySelector("#people .who-" + document.getElementById("board").dataset.me + " .nm").textContent.trim())) === names[seatOf(pl)]);
      check(`${label}: ${pl.name} má skryté sdílení odkazu, „nová hra“, „Zkusit sám“ a odkaz v logu`, await pl.frame.locator("#copyTopBtn").isHidden() && await pl.frame.locator("#newGameBtn").isHidden() && await pl.frame.locator("#soloBtn").isHidden() && (await pl.frame.locator("#logo[href]").count()) === 0);
    }
    check(`${label}: x = ${x}, o = ${o} v obou prohlížečích`, (await F.frame.locator("#people .who-x .nm").innerText()).trim() === x && (await O.frame.locator("#people .who-o .nm").innerText()).trim() === o && (await O.frame.locator("#people .who-x .nm").innerText()).trim() === x);
    await sleep(300);
    await F.page.screenshot({ path: path.join(SHOTS, `herna-${label}-rozmisteni-${F.name}.png`) });
    await O.page.screenshot({ path: path.join(SHOTS, `herna-${label}-rozmisteni-${O.name}.png`) });
    for (const pl of [A, B]) layout.push(...await fits(pl.frame, `${label} ${pl.name} rozmístění v iframe`));

    // obnovení stránky zakladatele uprostřed rozmístění: sedne si zpět bez výzvy
    if (!rematch) {
      await F.page.evaluate(() => document.getElementById("f").contentWindow.location.reload());
      await F.frame.waitForSelector('#board[data-phase="place"]', { timeout: T });
      check(`${label}: po obnovení zakladatel sedí na svém místě (bez výzvy, bez dalšího setupu)`, (await saw(F)).length === 0 && (await F.frame.evaluate(() => document.getElementById("board").dataset.me)) === "x");
    }

    // ---------- partie 1
    await startGame(A, B, label);
    const winner1 = A;                                            // Mark (sedadlo 0) vyhraje partii 1
    await playGame(A, B, winner1, `${label} partie 1`);
    const id1 = `${r}:1`;
    for (const pl of [A, B]) {
      const m = await msgs(pl), v = m.filter(x => x.typ === "vysledek");
      check(`${label}: ${pl.name} poslal Herně jeden výsledek ${id1}, vítěz = sedadlo 0 (Mark)`, v.length === 1 && v[0].partie === id1 && v[0].vitez === 0, JSON.stringify(v));
      check(`${label}: ${pl.name} hlásil stavy ceka/hraje > hraje > konec`, m.filter(x => x.typ === "stav").map(x => x.faze).slice(-2).join(">") === "hraje>konec" && m.some(x => x.typ === "stav" && x.faze === "ceka"), m.filter(x => x.typ === "stav").map(x => x.faze).join(">"));
      check(`${label}: ${pl.name} má na konci „Jiná hra“ a „Odveta“ a bez tlačítka odkazu`, await pl.frame.locator("#jinaHraBtn").isVisible() && await pl.frame.locator("#rematchBtn").isVisible() && (await pl.frame.locator("[data-act=copylink]").count()) === 0);
    }
    await sleep(300);
    await F.page.screenshot({ path: path.join(SHOTS, `herna-${label}-konec-${F.name}.png`) });
    await O.page.screenshot({ path: path.join(SHOTS, `herna-${label}-konec-${O.name}.png`) });
    for (const pl of [A, B]) layout.push(...await fits(pl.frame, `${label} ${pl.name} konec v iframe`));

    // ---------- odveta = další partie, výsledek s novým číslem
    if (rematch) {
      await B.frame.click("#rematchBtn");
      await Promise.all([A, B].map(pl => pl.frame.waitForSelector('#board[data-phase="place"]', { timeout: T })));
      check(`${label}: po odvetě oba znovu hrají bez výzvy`, (await saw(A)).length === 0 && (await saw(B)).length === 0);
      await startGame(A, B, label);
      await playGame(A, B, B, `${label} partie 2 (odveta)`);   // Radka (sedadlo 1) vyhraje odvetu
      const id2 = `${r}:2`;
      for (const pl of [A, B]) {
        const v = (await msgs(pl)).filter(x => x.typ === "vysledek");
        check(`${label}: ${pl.name} poslal i výsledek odvety ${id2}, vítěz = sedadlo 1 (Radka); celkem 2 různé partie`, v.length === 2 && v[1].partie === id2 && v[1].vitez === 1 && v[0].partie !== v[1].partie, JSON.stringify(v));
      }
    }
    // „Jiná hra“ pošle zprávu
    await A.frame.click("#jinaHraBtn");
    await sleep(300);
    check(`${label}: „Jiná hra“ pošle rodiči jina-hra`, (await msgs(A)).filter(x => x.typ === "jina-hra").length === 1);
  } finally {
    await A.browser.close(); await B.browser.close();
  }
}

(async () => {
  const layout = [];
  const only = process.env.SCEN || "";
  // ---------- meta řádek v index.html
  const html = await (await fetch(BASE)).text();
  check('index.html má <meta name="herna-protokol" content="1">', /<meta\s+name="herna-protokol"\s+content="1"\s*>/.test(html));

  if (only !== "2") await scenario("zakládá Mark", true, true, layout);
  if (only !== "1") await scenario("zakládá Radka", false, false, layout);
  check(`rozvržení v iframe s 48px lištou (nic nepřesahuje, text ≥ 14 px, bez posouvání)`, layout.length === 0, layout.slice(0, 4).join(" | "));

  // ---------- bez #herna se hra chová jako dřív: úvodní obrazovka, „Zkusit sám“, žádné zprávy rodiči
  const N = await newPlayer(chromium, { viewport: { width: 1440, height: 900 } }, "normal");
  try {
    await openInHerna(N, `${BASE}?rychle=1`);
    await N.frame.waitForSelector("#setup:not([hidden])", { timeout: T });
    check("bez #herna: úvodní obrazovka a „Zkusit sám“ jako dřív", await N.frame.locator("#soloBtn").isVisible() && (await N.frame.locator("#logo[href]").count()) === 1);
    await sleep(500);
    check("bez #herna: rodič nedostane žádnou zprávu", (await msgs(N)).length === 0, JSON.stringify(await msgs(N)));
    // špatné parametry (seat=7) = běžná hra
    await N.page.goto(`${BASE}__herna-rodic.html?u=${encodeURIComponent(BASE + "?rychle=1#herna=1&r=" + randId(12) + "&seat=7&names=A,B&zaklada=1")}`);
    await N.page.waitForSelector("#f"); await sleep(1200);
    N.frame = N.page.frames().find(f => f !== N.page.mainFrame());
    check("neplatné parametry Herny (seat=7): běžná úvodní obrazovka, žádné zprávy", await N.frame.locator("#setup").isVisible() && (await msgs(N)).length === 0);
    // samostatně otevřené okno (bez rodiče) s platným #herna nehlásí chybu a hraje
    const solo = await N.ctx.newPage();
    solo.on("pageerror", e => errs.push("sám: " + e.message));
    await solo.goto(hernaUrl(randId(12), 0, 1));
    await solo.waitForSelector('#board[data-phase="place"]', { timeout: T });
    check("samostatné okno s #herna (bez rodiče): zakladatel hned rozmisťuje, čeká na soupeře", (await solo.locator("#status").innerText()).length > 0 && await solo.locator("#setup").isHidden());
  } finally { await N.browser.close(); }

  check("žádné chyby JS ani konzole", errs.length === 0, errs.slice(0, 4).join(" | "));
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("Error:", e.message); process.exit(2); });
