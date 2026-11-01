// Sólo trénink proti botovi: celá partie v Chromiu desktop 1440×900 a ve WebKitu iPhone 13, bez jediného požadavku na mantledb.sh.
// node tests/solo.cjs [URL]   (výchozí http://127.0.0.1:8806/; server: node tools/serve.cjs). Screenshoty do tests/shots/solo-*.png.
// Hra 1: adresa #solo, rozmístění, celá partie, konec s „Znovu“ a „Vyzvat soupeře“, „Znovu“ spustí novou partii.
// Hra 2: úvodní obrazovka, tlačítko „Zkusit sám“, celá partie, „Vyzvat soupeře“ vede na normální výzvu.
const path = require("path"), fs = require("fs");
const { pw, sleep, T, phaseOf, drive, fits } = require("./lib.cjs");
const { chromium, webkit, devices } = pw;
const BASE = (process.argv[2] || "http://127.0.0.1:8806/").replace(/\/?(\?.*)?(#.*)?$/, "/");
const SHOTS = process.env.SHOTS || path.join(__dirname, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
function check(name, ok, extra = "") {
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`);
}
const errs = [];

// rozmístění (Náhodně + Hotovo), případná první kategorie hráče botovi, pak hra až do konce
async function playGame(p, label, tag, layout) {
  await p.waitForSelector('#board[data-phase="place"]', { timeout: T });
  await p.click("#randomBtn"); await p.click("#doneBtn");
  for (let i = 0; i < 300; i++) {
    const ph = await phaseOf(p);
    if (ph === "cat0") { await p.locator("#panel .chip").first().click(); break; }
    if (!["place", "wait-setup", ""].includes(ph)) break;
    await sleep(100);
  }
  const cfg = { name: label, diff: [2, 3, 1], right: i => i % 3 !== 2, aim: "random", radar: 1, cats: ["sport", "veda", "zemepis"], timeout: 420000 };
  const st = await drive(p, null, { ...cfg, on: { question: async (q, s) => { (s.qids = s.qids || []).push(await q.locator("#qcard").getAttribute("data-qid")); }, shot: async (q, kind, s) => { if (s.shots === 4) { await q.screenshot({ path: path.join(SHOTS, `solo-${tag}-${label}-hra.png`) }); const bad = await fits(q, `${tag} ${label} střelba`); if (bad.length) bad.push("diagnostika: " + await q.evaluate(() => JSON.stringify([document.querySelector(".buoy-legend") && getComputedStyle(document.querySelector(".buoy-legend")).display, innerWidth, innerHeight, document.documentElement.scrollHeight, document.body.className]))); layout.push(...bad); } } } });
  await p.waitForSelector("#endBox", { timeout: T });
  await sleep(800);
  return st;
}

async function run(tag, launcher, ctxOpts) {
  const browser = await launcher.launch(), ctx = await browser.newContext(ctxOpts), p = await ctx.newPage();
  const mantle = [], layout = [];
  p.on("request", r => { if (/mantledb\.sh/.test(r.url())) mantle.push(r.url()); });
  p.on("pageerror", e => errs.push(`${tag}: ${e.message}`));
  p.on("console", m => { if (m.type() === "error") errs.push(`${tag} konzole: ${m.text()}`); });
  const txt = sel => p.locator(sel).first().innerText();
  const lsKeys = () => p.evaluate(() => Object.keys(localStorage));

  // ---------- hra 1: přímo adresou #solo
  await p.goto(BASE + "?rychle=1#solo");
  await p.waitForSelector("#game:not([hidden])", { timeout: T });
  check(`${tag}: #solo rovnou otevře hru (ne úvodní obrazovku)`, await p.locator("#setup").isHidden() && (await p.locator("#status").count()) === 1);
  check(`${tag}: štítek „Trénink“ je vidět`, (await txt("#soloTag")).trim() === "Trénink" && await p.locator("#soloTag").isVisible());
  check(`${tag}: soupeř je bot, bez titulu a bez série`, (await txt("#people .who-o .nm")).includes("Robo") && await p.locator("#people .ttl").first().isHidden() && !(await txt("#score")).includes(":"));
  check(`${tag}: tlačítko odkazu na hru je skryté`, await p.locator("#copyTopBtn").isHidden());
  await sleep(300);
  await p.screenshot({ path: path.join(SHOTS, `solo-${tag}-rozmisteni.png`) });
  layout.push(...await fits(p, `${tag} rozmístění`));
  const s1 = await playGame(p, "hra1", tag, layout);
  check(`${tag}: hra 1 dohraná (${s1.shots} ran, ${s1.asked} otázek)`, s1.seen.has("end") && s1.shots > 0 && s1.asked > 0);
  check(`${tag}: bot hrál svoje tahy (bylo vidět, jak odpovídá a střílí)`, s1.seen.has("answer-opp") && s1.seen.has("shoot-opp"), [...s1.seen].join(","));
  check(`${tag}: konec má „Znovu“ a „Vyzvat soupeře“`, await p.locator("#soloAgainBtn").isVisible() && (await txt("#soloAgainBtn")).trim() === "Znovu" && await p.locator("#soloChallengeBtn").isVisible() && (await txt("#soloChallengeBtn")).trim() === "Vyzvat soupeře");
  check(`${tag}: konec bez série, sázky, pečeti a postupu na titul`, (await p.locator("#endScore, #endStake, #sealBox, #promo").count()) === 0);
  check(`${tag}: štítek „Trénink“ zůstává i na konci`, await p.locator("#soloTag").isVisible());
  await p.screenshot({ path: path.join(SHOTS, `solo-${tag}-konec.png`) });
  layout.push(...await fits(p, `${tag} konec`));
  const keys1 = await lsKeys();
  check(`${tag}: do localStorage se nezapsala místnost, série ani flotila`, !keys1.some(k => /^kl-(r-|rooms|fleet-)/.test(k)), keys1.join(","));

  // „Znovu“ = nová partie s novým semínkem a flotilou
  await p.click("#soloAgainBtn");
  await p.waitForSelector('#board[data-phase="place"]', { timeout: T });
  check(`${tag}: „Znovu“ spustí novou partii (rozmísťování, štítek Trénink)`, await p.locator("#soloTag").isVisible() && (await p.locator("#endBox").count()) === 0 && p.url().endsWith("#solo"));
  check(`${tag}: po „Znovu“ je bazén prázdný (žádné stopy předchozí partie)`, await p.evaluate(() => [...document.querySelectorAll("#pwEnemy .cell")].every(c => c.dataset.st === ".")));

  // ---------- hra 2: úvodní obrazovka a tlačítko „Zkusit sám“
  await p.goto(BASE + "?rychle=1");
  await p.waitForSelector("#setup:not([hidden])", { timeout: T });
  const sb = p.locator("#soloBtn");
  check(`${tag}: na úvodní obrazovce je „Zkusit sám“ vedle „Založit hru“ jako sekundární`, await sb.isVisible() && (await sb.innerText()).trim() === "Zkusit sám" && await sb.evaluate(b => b.classList.contains("ghost") && parseFloat(getComputedStyle(b).fontSize) >= 14));
  await p.fill("#nameX", "Tester");
  await sleep(300);
  await p.screenshot({ path: path.join(SHOTS, `solo-${tag}-setup.png`) });
  await sb.click();
  await p.waitForSelector("#game:not([hidden])", { timeout: T });
  check(`${tag}: tlačítko nastaví adresu #solo a použije jméno z formuláře`, p.url().endsWith("#solo") && (await txt("#people .who-x .nm")).trim() === "Tester");
  const s2 = await playGame(p, "hra2", tag, layout);
  check(`${tag}: hra 2 (přes tlačítko) dohraná (${s2.shots} ran)`, s2.seen.has("end") && s2.shots > 0);
  const rep = (s2.qids || []).filter(q => (s1.qids || []).includes(q));
  check(`${tag}: otázky hry 2 se neopakují z hry 1 (jiná partie, ${(s1.qids || []).length} + ${(s2.qids || []).length} otázek)`, rep.length === 0 && (s2.qids || []).length > 0, rep.join(","));
  await p.click("#soloChallengeBtn");
  await p.waitForSelector("#setup:not([hidden])", { timeout: T });
  check(`${tag}: „Vyzvat soupeře“ vede na normální výzvu, štítek zmizí`, await p.locator("#game").isHidden() && await p.locator("#soloTag").isHidden() && !p.url().includes("#solo") && await p.locator("#setupSubmit").isVisible());
  await sleep(500);
  const keys2 = await lsKeys();
  check(`${tag}: ani po druhé partii nevznikl záznam v localStorage`, !keys2.some(k => /^kl-(r-|rooms|fleet-)/.test(k)), keys2.join(","));

  check(`${tag}: ŽÁDNÝ síťový požadavek na mantledb.sh za celou dobu`, mantle.length === 0, mantle.slice(0, 3).join(" "));
  check(`${tag}: rozvržení (nic nepřesahuje, text ≥ 14 px, bez posouvání)`, layout.length === 0, layout.slice(0, 5).join(" | "));
  await browser.close();
}

(async () => {
  const only = process.env.ONLY || "";                          // ONLY=iphone nebo ONLY=desktop pro rychlé ladění
  if (only !== "iphone") await run("desktop", chromium, { viewport: { width: 1440, height: 900 } });
  if (only !== "desktop") await run("iphone", webkit, { ...devices["iPhone 13"] });
  check("žádné chyby JS ani konzole", errs.length === 0, errs.slice(0, 4).join(" | "));
  console.log(`\n${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("Error:", e.message); process.exit(2); });
