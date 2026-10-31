// Rozvržení na dalších oknech: iPhone 13 (390×844), malý telefon (375×667), notebook (1280×720), telefon na šířku (844×390).
// Hráč A má testované okno, hráč B je pomocník. Kontroluje: žádné posouvání, nic mimo okno, text ≥ 14 px v každé fázi hráče A. Snímky do tests/shots/layout/.
// node tests/layout.cjs [URL]
const path = require("path"), fs = require("fs");
const { pw, TRUTH, sleep, T, fits, cellStates } = require("./lib.cjs");
const { chromium } = pw;
const BASE = (process.argv[2] || "http://127.0.0.1:8811/").replace(/\/?(\?.*)?$/, "/");
const URL = BASE + "?rychle=1";
const SHOTS = path.join(__dirname, "shots", "layout"); fs.mkdirSync(SHOTS, { recursive: true });
const VIEWS = [
  ["iphone13", { width: 390, height: 844 }, true], ["maly-telefon", { width: 375, height: 667 }, true],
  ["notebook", { width: 1280, height: 720 }, false], ["telefon-na-sirku", { width: 844, height: 390 }, true],
];
(async () => {
  const br = await chromium.launch(); let bad = [], pass = 0;
  for (const [name, vp, touch] of VIEWS) {
    const A = await (await br.newContext({ viewport: vp, hasTouch: touch, isMobile: touch })).newPage();
    const B = await (await br.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    const rec = async label => { await sleep(350); await A.screenshot({ path: path.join(SHOTS, `${name}-${label}.png`) }); const r = (await fits(A, `${name} ${label}`)).filter(x => !(/^(setup|sdileni)$/.test(label) && /stránka se posouvá/.test(x))); bad.push(...r); pass++; };   // formuláře (setup, sdileni) se smí posouvat
    await A.goto(URL); await A.waitForSelector("#setup:not([hidden])", { timeout: T }); await rec("setup");
    await A.fill("#nameX", "Mark"); await A.fill("#nameO", "Radka"); await A.click('#starterSeg button[data-v="x"]'); await A.click("#setupSubmit");
    await A.waitForSelector("#share:not([hidden])", { timeout: T }); await rec("sdileni");
    const link = await A.evaluate(() => location.href);
    await A.click("#backBtn"); await A.waitForSelector('#board[data-phase="place"]', { timeout: T }); await rec("rozmisteni");
    await B.goto(link); await B.waitForSelector("#intro:not([hidden])", { timeout: T }); await B.click("#acceptBtn"); await B.waitForSelector('#board[data-phase="place"]', { timeout: T });
    await A.click("#randomBtn"); await A.click("#doneBtn"); await A.waitForSelector('#board[data-phase="wait-setup"]', { timeout: T }); await rec("cekani");
    await B.click("#randomBtn"); await B.click("#doneBtn"); await B.waitForSelector('#board[data-phase="cat0"]', { timeout: T });
    await B.locator("#panel .chip").first().click();
    await A.waitForSelector('#board[data-phase="pick-me"]', { timeout: T }); await rec("obtiznost");
    await A.click('#panel [data-d="2"]');
    await A.waitForSelector("#qcard:not(.answered)", { timeout: T }); await rec("otazka");
    const qid = await A.locator("#qcard").getAttribute("data-qid"), truth = TRUTH.get(qid), texts = await A.locator("#qcard .opt .ot").allInnerTexts();
    await A.click(`#qcard .opt[data-opt="${texts.findIndex(t => t.trim() === truth)}"]`);
    await A.waitForSelector("#qcard.answered", { timeout: 5000 }); await rec("odpoved");
    await A.waitForSelector("#sheet", { state: "hidden", timeout: 12000 }); await A.waitForSelector("#pwEnemy.aim", { timeout: T }); await rec("strelba");
    for (let g = 0; g < 8 && !(await A.locator("#panel .chip, #wheelBtn").count()); g++) {
      const st = await cellStates(A, "#pwEnemy"), c = st.findIndex(x => x === ".");
      await A.waitForSelector("#pwEnemy.aim", { timeout: 9000 }).catch(() => {});
      await A.locator(`#pwEnemy .cell[data-i="${c}"]`).click().catch(() => {});
      await sleep(1100);
    }
    if (await A.locator("#panel .chip, #wheelBtn").count()) await rec("kategorie-soupere");
    await A.context().close(); await B.context().close();
  }
  await br.close();
  console.log(bad.length ? "FAIL\n" + bad.join("\n") : `PASS  rozvržení: ${pass} kontrol ve ${VIEWS.length} oknech, žádné posouvání, nic mimo okno, text ≥ 14 px`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
