// Celá partie ve 2 nezávislých prohlížečích + přihlížející: Mark = Chromium desktop 1440×900, Radka = WebKit iPhone 13 na výšku.
// node tests/duel.cjs [URL]   (výchozí http://127.0.0.1:8806/; server: node tools/serve.cjs). Screenshoty do tests/shots/.
const path = require("path"), fs = require("fs");
const { pw, QBY, TRUTH, L, sleep, T, phaseOf, fleetOf, cellStates, drive, fits } = require("./lib.cjs");
const { chromium, webkit, devices } = pw;
const URL = process.argv[2] || "http://127.0.0.1:8806/";
const SHOTS = process.env.SHOTS || path.join(__dirname, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
const log = [];
function check(name, ok, extra = "") {
  if (ok) pass++; else fail++;
  const line = `${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`;
  log.push(line); console.log(line);
}
const text = (p, sel) => p.locator(sel).first().innerText();
const shot = async (p, name) => { await p.screenshot({ path: path.join(SHOTS, name + ".png") }); };
const API = "https://mantledb.sh/v2/";
const getDoc = async (id, d) => { const r = await fetch(`${API}kvizove-lode-${id}/${d}`, { cache: "no-store" }); return r.ok ? r.json() : null; };

const errs = [];
(async () => {
  const bA = await chromium.launch(), bB = await webkit.launch();
  const ctxA = await bA.newContext({ viewport: { width: 1440, height: 900 } });
  const ctxB = await bB.newContext({ ...devices["iPhone 13"] });
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  for (const [n, p] of [["Mark", A], ["Radka", B]]) { p.on("pageerror", e => errs.push(n + ": " + e.message)); p.on("console", m => { if (m.type() === "error" && !/404/.test(m.text())) errs.push(n + " konzole: " + m.text()); }); }   // 404 = čtení dokumentu mantledb, který ještě neexistuje
  const layout = [];

  // ---------- 1) založení výzvy (Mark)
  await A.goto(URL);
  await A.waitForSelector("#setup:not([hidden])", { timeout: T });
  await sleep(500);
  await shot(A, "01-setup-desktop");
  check("setup: fonty Dynapuff a Onest jsou načtené (čeština)", await A.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 20px "DynaPuff"', "ěščřžýáíéůú") && document.fonts.check('400 16px "Onest"', "ěščřžýáíéůú"); }));
  await A.fill("#nameX", "Mark"); await A.fill("#nameO", "Radka");
  await A.selectOption("#stakeSel", "1");
  await A.fill("#setupNote", "Dnes tě utopím.");
  await A.click('#starterSeg button[data-v="x"]');
  await A.click("#setupSubmit");
  await A.waitForSelector("#share:not([hidden])", { timeout: T });
  const link = await A.evaluate(() => location.href), id = (link.match(/#r\.([0-9a-z]+)$/) || [])[1];
  const msg = await A.inputValue("#msg");
  check("výzva: odkaz #r.<id>, vzkaz se jménem, sázkou a poznámkou", /#r\.[0-9a-z]{12}$/.test(link) && msg.includes("Mark tě vyzývá") && msg.includes("platí kafe") && msg.includes("Dnes tě utopím") && msg.includes(link), link);
  await shot(A, "02-sdileni-desktop");
  await A.click("#backBtn");
  await A.waitForSelector("#game:not([hidden])", { timeout: T });
  check("Mark po založení rovnou rozmisťuje (title)", (await A.title()).startsWith("Rozmísti flotilu"));

  // ---------- 2) Radka otevře odkaz a přijme
  await B.goto(link);
  await B.waitForSelector("#intro:not([hidden])", { timeout: T });
  await sleep(400);
  await shot(B, "03-vyzva-mobil");
  check("výzva u soupeře: jméno, sázka, vzkaz", (await text(B, "#introTitle")).includes("Mark tě vyzývá") && (await text(B, "#introStake")).includes("platí kafe") && (await text(B, "#introNote")).includes("Dnes tě utopím"));
  await B.click("#acceptBtn");
  await B.waitForSelector("#game:not([hidden])", { timeout: T });

  // ---------- 3) rozmístění: tažení, otočení, kolize, Náhodně, Hotovo
  await A.waitForSelector("#pwMine .toy", { timeout: T });
  await sleep(300);
  await shot(A, "04-rozmisteni-desktop");
  await shot(B, "05-rozmisteni-mobil");
  layout.push(...await fits(B, "mobil rozmístění"));
  const labelOf = (p, k) => p.locator(`#pwMine .toy[data-ship="${k}"]`).getAttribute("aria-label");
  const box = async (p, sel) => (await p.locator(sel).first().boundingBox());
  // otočení klepnutím na kachnu (index 3)
  const before = await labelOf(A, 3);
  const dk = await box(A, '#pwMine .toy[data-ship="3"]');
  await A.mouse.click(dk.x + 12, dk.y + dk.height / 2);
  const after = await labelOf(A, 3);
  check("rozmístění: klepnutí otočí hračku", before.includes(before.includes("svisle") ? "svisle" : "vodorovně") && after !== before, `${before.split(".")[0]} → ${after.split(".")[0]}`);
  // přetažení kachny na krokodýla = kolize
  const croc = await box(A, '#pwMine .toy[data-ship="0"]'), duck = await box(A, '#pwMine .toy[data-ship="3"]');
  await A.mouse.move(duck.x + duck.width / 2, duck.y + duck.height / 2);
  await A.mouse.down();
  await A.mouse.move(croc.x + croc.width / 2, croc.y + croc.height / 2, { steps: 8 });
  await A.mouse.up();
  await sleep(200);
  const bad = await A.locator("#pwMine .toy.bad").count();
  check("rozmístění: kolize se zvýrazní a Hotovo je vypnuté", bad >= 1 && await A.locator("#doneBtn").isDisabled(), `kolizí: ${bad}`);
  await shot(A, "04b-kolize-desktop");
  await A.click("#randomBtn");
  await sleep(150);
  check("rozmístění: Náhodně vrátí platnou flotilu a povolí Hotovo", await A.locator("#pwMine .toy.bad").count() === 0 && await A.locator("#doneBtn").isEnabled());
  // klávesnice: šipky a mezerník
  await A.locator('#pwMine .toy[data-ship="3"]').focus();
  const k0 = await labelOf(A, 3);
  await A.keyboard.press("Space");
  const k1 = await labelOf(A, 3);
  check("rozmístění: z klávesnice jde otáčet (mezerník)", k0 !== k1);
  await A.click("#randomBtn");
  await A.click("#doneBtn");
  check("Mark (začíná) po Hotovo čeká na Radku", await A.waitForSelector('#board[data-phase="wait-setup"]', { timeout: T }).then(() => true, () => false));
  await B.click("#randomBtn"); await B.click("#doneBtn");
  await B.waitForSelector('#board[data-phase="cat0"]', { timeout: T });
  check("Radka (nezačíná) po Hotovo vybírá první kategorii Markovi", (await text(B, "#panel .pt")).includes("Co dostane Mark?") && await B.locator("#panel .chip").count() === 3, "v2: nabídka 3 kategorií");
  await shot(B, "06-kategorie-mobil");
  layout.push(...await fits(B, "mobil první kategorie"));
  const catKey = await B.locator("#panel .chip").first().getAttribute("data-cat"), catLabel = (await B.locator("#panel .chip").first().innerText()).trim();
  await B.click(`#panel [data-cat="${catKey}"]`);
  await A.waitForSelector('#board[data-phase="pick-me"]', { timeout: T });
  check("Mark je na tahu, title „Jsi na tahu“, kategorie od Radky z nabídky", (await A.title()).startsWith("Jsi na tahu") && (await text(A, "#panel .catline")).includes(catLabel), catLabel);
  check("rozcvička: v prvním tahu je těžká otázka vypnutá", await A.locator('#panel [data-d="3"]').isDisabled() && await A.locator('#panel [data-d="2"]').isEnabled());
  await shot(A, "07-obtiznost-desktop");
  check("Radka vidí, že Mark volí obtížnost (kategorii zná)", await B.waitForSelector('#board[data-phase="pick-opp"]', { timeout: T }).then(() => true, () => false) && (await text(B, "#panel .catline")).includes(catLabel));
  layout.push(...await fits(B, "mobil soupeř volí obtížnost"));
  await shot(B, "07b-obtiznost-soupere-mobil");

  // ---------- 4) první tah Marka (scénář pro snímky): těžká, správně, 4 rány: vedle, zásah, potopení kachny
  await A.click('#panel [data-d="2"]');
  await B.waitForSelector('#board[data-phase="answer-opp"]', { timeout: T });
  await sleep(500);
  const bodyB = await B.evaluate(() => document.body.innerText);
  const qA = await A.locator("#qcard").getAttribute("data-qid"), qtextA = await text(A, "#qtext");
  check("Radka při Markově otázce vidí kategorii, obtížnost a časovač, ale ne text otázky", bodyB.includes(catLabel) && /střední/i.test(bodyB) && await B.locator("#obar").count() === 1 && !bodyB.includes(qtextA), qtextA.slice(0, 40));
  layout.push(...await fits(B, "mobil soupeř odpovídá"));
  await shot(B, "08-soupere-otazka-mobil");
  await shot(A, "08-otazka-desktop");
  // karta otázky u Marka: bez posouvání, kategorie jako pruh
  check("karta otázky: pruh kategorie, časovač, 4 možnosti", await A.locator("#qcard .qcat").count() === 1 && await A.locator("#qcard .qtime .bar").count() === 1 && await A.locator("#qcard .opt").count() === 4);
  const truth = TRUTH.get(qA), texts = await A.locator("#qcard .opt .ot").allInnerTexts();
  // synchronizovaný stav: žádná čitelná správná odpověď ani flotila, i když otázka běží
  const synced = async () => { const docs = [await getDoc(id, "hra"), await getDoc(id, "x"), await getDoc(id, "o")]; return JSON.stringify(docs); };
  let s1 = await synced();
  const fleetX = L.fleetKey(await fleetOf(A)), fleetO = L.fleetKey(await fleetOf(B));
  check("synchronizovaný stav (hra, x, o) neobsahuje čitelnou správnou odpověď", !s1.includes(`"${truth}"`) && !s1.includes(truth) || truth.length < 4, truth);
  check("synchronizovaný stav neobsahuje flotilu žádného hráče ani odhalení (rev) za hry", !s1.includes(fleetX) && !s1.includes(fleetO) && /"rev":null/.test(s1) && !/"salt"/.test(s1));
  check("synchronizovaný stav obsahuje jen závazek flotily (hash)", /"fh":"[0-9a-f]{64}"/.test(s1));
  const j = texts.findIndex(t => t.trim() === truth);
  await A.click(`#qcard .opt[data-opt="${j}"]`);
  await A.waitForSelector("#qcard.answered", { timeout: 3000 });
  await sleep(250);
  await shot(A, "09-odpoved-spravne-desktop");
  check("po odpovědi se ukáže správná možnost a fakt", await A.locator("#qcard .opt.right").count() === 1 && (await text(A, "#qfact")).length > 10, (await text(A, "#qfact")).slice(0, 50));
  // střelba: radar, pak vedle, zásah, potopení kachny
  await A.waitForSelector("#sheet", { state: "hidden", timeout: 12000 });
  await A.waitForSelector("#pwEnemy.aim", { timeout: T });
  check("po správné odpovědi do 7 s: 3 rány a radar", await A.locator("#balloons .cnt").innerText() === "3 / 3" && await A.locator("#radarBtn").count() === 1);
  await shot(A, "10-strelba-desktop");
  layout.push(...await fits(A, "desktop střelba"));
  const fB = await fleetOf(B), occB = L.occupancy(fB);
  const duckCells = L.shipCells(fB[3], 2), crocCell = L.shipCells(fB[0], 4)[0];
  const watch = async (p, sel, name) => { await p.waitForSelector(sel, { timeout: 15000 }); await shot(p, name); };
  const click = async i => { await A.locator(`#pwEnemy .cell[data-i="${i}"]`).click(); await A.waitForFunction(k => document.querySelector(`#pwEnemy .cell[data-i="${k}"]`).dataset.st !== ".", i, { timeout: 8000 }); await A.waitForSelector("#pwEnemy.aim", { timeout: 8000 }); await sleep(900); };
  // radar do prázdného rohu
  const seedG = (await getDoc(id, "hra")).g.seed, buB = L.buoys(seedG, "o");
  check("v2: hra má semínko a v obou bazénech jsou 3 viditelné bójky", !!seedG && await A.locator("#pwEnemy .buoy").count() === 3 && await B.locator("#pwMine .buoy").count() === 3 && await A.locator("#pwMine .buoy").count() === 3);
  const free = occB.map((k, i) => k < 0 && !(i in buB) ? i : -1).filter(i => i >= 0);
  const corner = [0, 7, 56, 63].find(c => L.radarCount(fB, c) === 0 && !(c in buB)) ?? [0, 7, 56, 63].find(c => !(c in buB));
  await A.click("#radarBtn");
  const wRadarA = watch(A, '#pwEnemy [data-radar]', "11-radar-desktop");
  await A.locator(`#pwEnemy .cell[data-i="${corner}"]`).click();
  await wRadarA;
  await A.waitForSelector(`#pwEnemy [data-radar="${corner}"] text`, { timeout: 8000 });
  check("radar ukáže číslo (počet políček hraček v oblasti 3 × 3)", (await A.locator(`#pwEnemy [data-radar="${corner}"] text`).last().textContent()) === String(L.radarCount(fB, corner)), `střed ${corner}, očekáváno ${L.radarCount(fB, corner)}, ukázáno ${await A.locator(`#pwEnemy [data-radar="${corner}"] text`).allTextContents()}, flotila ${L.fleetKey(fB)}`);
  await sleep(400);
  const missCell = free.find(i => !L.around(i).some(j => occB[j] >= 0) && i !== corner && L.radarArea(corner).indexOf(i) < 0);
  const wMissA = watch(A, "#pwEnemy .fx circle", "12-vedle-desktop");
  await A.locator(`#pwEnemy .cell[data-i="${missCell}"]`).click();
  await wMissA;
  await A.waitForFunction(k => document.querySelector(`#pwEnemy .cell[data-i="${k}"]`).dataset.st === "m", missCell, { timeout: 8000 });
  await A.waitForSelector("#pwEnemy.aim", { timeout: 8000 }); await sleep(900);
  const wHitA = watch(A, "#pwEnemy .fx text", "13-zasah-desktop"), wHitB = watch(B, "#pwMine .fx text", "13-zasah-mobil");
  await A.locator(`#pwEnemy .cell[data-i="${duckCells[0]}"]`).click();
  await Promise.all([wHitA, wHitB]);
  check("zásah: PSSST! je vidět u střelce i u obránce", true);
  await A.waitForFunction(k => document.querySelector(`#pwEnemy .cell[data-i="${k}"]`).dataset.st === "h", duckCells[0], { timeout: 8000 });
  await A.waitForSelector("#pwEnemy.aim", { timeout: 8000 }); await sleep(900);
  const wSinkA = watch(A, "#pwEnemy .fx > g.sinking", "14-potopeni-desktop"), wSinkB = watch(B, "#pwMine .fx > g.sinking", "14-potopeni-mobil");
  await A.locator(`#pwEnemy .cell[data-i="${duckCells[1]}"]`).click();
  await Promise.all([wSinkA, wSinkB]);
  await Promise.all([A.waitForFunction(() => document.querySelectorAll("#pwEnemy .toy.sunk").length === 1, null, { timeout: 8000 }), B.waitForFunction(() => document.querySelectorAll("#pwMine .toy.sunk").length === 1, null, { timeout: 8000 })]);
  await sleep(300);
  const stA = await cellStates(A, "#pwEnemy");
  check("potopení: obě pole kachny jsou 's', okolí jistá voda 'w'", stA[duckCells[0]] === "s" && stA[duckCells[1]] === "s" && L.around(duckCells[0]).filter(j => !duckCells.includes(j)).every(j => stA[j] === "w" || stA[j] === "m"));
  check("potopení: u střelce je viditelná splasklá hračka", await A.locator("#pwEnemy .toy.sunk").count() === 1);
  check("potopení: u obránce je jeho kachna splasklá", await B.locator("#pwMine .toy.sunk").count() === 1);
  // zbylé rány (střední = 3, bójka poklad/mina to změní): střílí se do volné vody, než se objeví výběr kategorie
  for (let g2 = 0; g2 < 6 && !(await A.locator("#panel .chip, #wheelBtn").count()); g2++) {
    const st2 = await cellStates(A, "#pwEnemy"), c2 = free.find(i => i !== missCell && i !== corner && !L.around(i).some(j => occB[j] >= 0) && L.radarArea(corner).indexOf(i) < 0 && st2[i] === ".");
    await A.waitForSelector("#pwEnemy.aim", { timeout: 8000 });
    await A.locator(`#pwEnemy .cell[data-i="${c2}"]`).click();
    await A.waitForFunction(k => document.querySelector(`#pwEnemy .cell[data-i="${k}"]`).dataset.st !== ".", c2, { timeout: 8000 });
    await sleep(900);
  }
  await A.waitForSelector("#panel .chip, #wheelBtn", { timeout: 8000 });
  check("po salvě: výběr kategorie soupeři ze tří nabídnutých", await A.locator("#panel .chip").count() === 3 && (await text(A, "#panel .pt")).includes("Co dostane Radka?"));
  await shot(A, "15-vyber-kategorie-desktop");
  const cat2Label = (await A.locator("#panel .chip").first().innerText()).trim();
  await A.locator("#panel .chip").first().click();
  await B.waitForSelector('#board[data-phase="pick-me"]', { timeout: T });
  check("Radka je na tahu, kategorie od Marka z nabídky", (await B.title()).startsWith("Jsi na tahu") && (await text(B, "#panel .catline")).includes(cat2Label), cat2Label);
  layout.push(...await fits(B, "mobil volba obtížnosti"));
  await shot(B, "16-obtiznost-mobil");

  // ---------- 5) přihlížející uprostřed partie
  const bC = await chromium.launch();
  const C = await (await bC.newContext({ ...devices["Pixel 7"], reducedMotion: "reduce" })).newPage();
  C.on("pageerror", e => errs.push("přihlížející: " + e.message));
  await C.goto(link);
  await C.waitForSelector('#board[data-phase="spec"]', { timeout: T });
  check("třetí návštěvník rovnou přihlíží (obě místa jsou obsazená, žádná výzva)", await C.locator("#intro").isHidden());
  await sleep(600);
  await shot(C, "17-prihlizejici-mobil");
  const specToys = await C.evaluate(() => ({ live: document.querySelectorAll(".toy:not(.sunk)").length, sunk: document.querySelectorAll(".toy.sunk").length, ls: Object.keys(localStorage).filter(k => k.startsWith("kl-fleet")).length, cells: [...document.querySelectorAll(".cell")].filter(c => c.getAttribute("aria-disabled") !== "true").length, pools: document.querySelectorAll(".pw").length, hits: document.querySelectorAll(".pw .mk.hit").length }));
  check("přihlížející vidí obě moře jen z odpovědí: žádné živé hračky ani flotila, jen potopená kachna", specToys.pools === 2 && specToys.live === 0 && specToys.sunk === 1 && specToys.ls === 0 && specToys.hits === 0, JSON.stringify(specToys));
  check("přihlížející nemůže střílet (všechna pole neaktivní) a vidí, kdo je na tahu", specToys.cells === 0 && (await text(C, "#panel")).includes("Radka") && (await text(C, "#panel")).includes("Přihlížíš"));
  check("přihlížející vidí radar a vedle na Markově straně (jen výsledky)", await C.locator('.pw[data-owner="o"] [data-radar]').count() === 1 && await C.locator('.pw[data-owner="o"] .mk.miss').count() >= 1);
  layout.push(...await fits(C, "přihlížející Pixel 7"));

  // ---------- 6) dohrání partie 1: Mark střílí bezchybně (zná flotilu v localStorage), Radka tipuje; Mark odpovídá vždy správně
  const cfgMark = { name: "Mark", diff: [2, 3, 1], right: () => true, aim: "perfect", radar: 0, cats: ["historie", "veda", "jidlo"], timeout: 300000 };
  const cfgRadka = { name: "Radka", diff: [2, 1, 3], right: n => n % 2 === 0, aim: "random", radar: 1, cats: ["priroda", "sport", "film-hudba"], timeout: 300000 };
  const t0 = Date.now();
  const midChecks = (async () => {
    // uprostřed hry: obránce se při cizím tahu nevyptává, v dokumentech pořád žádné rev
    await sleep(8000);
    const s = await synced();
    check("v průběhu hry pořád žádné odhalení flotily (rev)", /"rev":null/.test(s) && !s.includes(fleetX) && !s.includes(fleetO));
  })();
  const [sA, sB] = await Promise.all([drive(A, B, cfgMark), drive(B, A, cfgRadka), midChecks]);
  await Promise.all([A.waitForSelector("#endBox", { timeout: T }), B.waitForSelector("#endBox", { timeout: T })]);
  await sleep(2500);
  check(`partie 1 dohraná za ${Math.round((Date.now() - t0) / 1000)} s (Mark ${sA.shots} ran, Radka ${sB.shots})`, true);
  check("partie 1: viděné fáze Marka zahrnují obtížnost, odpověď i střelbu", ["pick-me", "answer-me", "shoot-me", "answer-opp", "shoot-opp"].every(x => sA.seen.has(x)), [...sA.seen].join(","));
  await shot(A, "18-vyhra-desktop"); await shot(B, "19-prohra-mobil");
  layout.push(...await fits(B, "mobil prohra"));
  check("výhra: Mark vidí „Vyhráváš“, Radka, že vyhrál Mark", (await text(A, "#endTitle")).includes("Vyhráváš") && (await text(B, "#endTitle")).includes("Vyhrál"));
  check("výhra: skóre série 1 : 0", (await text(A, "#endScore")).replace(/\s+/g, " ").includes("1 : 0") && (await text(B, "#endScore")).replace(/\s+/g, " ").includes("1 : 0"));
  check("sázka: Radka platí kafe", (await text(A, "#endStake")).includes("Radka platí kafe") && (await text(B, "#endStake")).includes("Radka platí kafe"));
  await Promise.all([A, B].map(p => p.waitForFunction(() => document.getElementById("sealBox") && document.getElementById("sealBox").dataset.v !== "wait", null, { timeout: T }).catch(async e => { const dx = await getDoc(id, "x"), dox = await getDoc(id, "o"); throw new Error("pečeť nedoběhla; rev x=" + JSON.stringify(!!(dx && dx.rev)) + " o=" + JSON.stringify(!!(dox && dox.rev)) + " seal=" + await p.evaluate(() => document.getElementById("sealBox").textContent)); })));
  check("ověření poctivosti: obě strany „Poctivě ověřeno“", (await text(A, "#sealBox")).includes("Poctivě ověřeno") && (await text(B, "#sealBox")).includes("Poctivě ověřeno"));
  check("prohra: Radka má tlačítko „Chci odvetu“, vítěz „Odveta“", (await text(B, "#rematchBtn")).includes("Chci odvetu") && (await text(A, "#rematchBtn")).trim() === "Odveta");
  const fin = JSON.stringify([await getDoc(id, "x"), await getDoc(id, "o")]);
  check("na konci jsou flotily odhalené (rev) a odpovídají závazku", fin.includes(fleetX) && fin.includes(fleetO));
  check("po konci vidí přihlížející vítěze a ověření", await C.waitForFunction(() => /Vyhrál/.test(document.getElementById("endTitle")?.textContent || ""), null, { timeout: T }).then(() => true, () => false));
  await C.waitForFunction(() => document.getElementById("sealBox") && document.getElementById("sealBox").dataset.v === "ok", null, { timeout: T }).catch(() => {});
  check("přihlížející vidí „Poctivě ověřeno“ a nemá tlačítko odvety", (await text(C, "#sealBox")).includes("Poctivě") && await C.locator("#rematchBtn").count() === 0);
  await shot(C, "20-prihlizejici-konec-mobil");

  // ---------- 7) odveta: začíná poražená Radka; druhou partii vyhrává Radka (1 : 1)
  await B.click("#rematchBtn");
  await Promise.all([A.waitForSelector('#board[data-phase="place"]', { timeout: T }), B.waitForSelector('#board[data-phase="place"]', { timeout: T })]);
  check("odveta: nová deska u obou, skóre série 1 : 0, začíná Radka", (await text(A, "#score")).replace(/\s+/g, "") === "1:0" && (await text(B, "#score")).replace(/\s+/g, "") === "1:0");
  await A.click("#randomBtn"); await A.click("#doneBtn");
  await B.click("#randomBtn"); await B.click("#doneBtn");     // Radka začíná → rovnou čeká
  await A.waitForSelector('#board[data-phase="cat0"]', { timeout: T });
  check("odveta: nezačínající (Mark) vybírá první kategorii ze tří", await A.locator("#panel .chip").count() === 3);
  await A.locator("#panel .chip").first().click();
  await B.waitForSelector('#board[data-phase="pick-me"]', { timeout: T });
  check("odveta: Radka je na tahu a použité otázky se neopakují", (await B.title()).startsWith("Jsi na tahu"));
  const cfgM2 = { name: "Mark2", diff: [1, 2], right: n => n % 3 === 0, aim: "random", radar: 0, cats: ["sport", "veda"], timeout: 400000 };
  const cfgR2 = { name: "Radka2", diff: [3, 2, 3], right: () => true, aim: "perfect", radar: 0, cats: ["jidlo", "historie"], timeout: 400000 };
  await Promise.all([drive(A, B, cfgM2), drive(B, A, cfgR2)]);
  await Promise.all([A.waitForSelector("#endBox", { timeout: T }), B.waitForSelector("#endBox", { timeout: T })]);
  await sleep(2200);
  await shot(B, "21-vyhra-mobil-partie2"); await shot(A, "22-prohra-desktop-partie2");
  check("partie 2: vyhrála Radka, skóre série 1 : 1", (await text(B, "#endTitle")).includes("Vyhráváš") && (await text(A, "#endScore")).replace(/\s+/g, " ").includes("1 : 1"));
  await Promise.all([A, B].map(p => p.waitForFunction(() => document.getElementById("sealBox")?.dataset.v === "ok", null, { timeout: T }))).then(() => check("partie 2: ověření poctivosti OK", true), () => check("partie 2: ověření poctivosti OK", false));
  const room = await getDoc(id, "hra");
  check("odveta zapsala do místnosti n = 2, w = [1,0] a použité otázky z 1. partie", room.g.n === 2 && room.g.w[0] === 1 && room.g.w[1] === 0 && room.g.s === "o" && room.g.used.length >= 6, `used ${room.g.used.length}`);
  const x2 = await getDoc(id, "x"), o2 = await getDoc(id, "o");
  const q2 = new Set([...(x2.T || []), ...(o2.T || [])].map(t => t.q));
  check("odveta: žádná otázka z 1. partie se v 2. partii neopakuje", [...q2].every(q => !room.g.used.includes(q)) && room.g.used.length > 0, `${q2.size} otázek ve 2. partii`);
  const synced2 = JSON.stringify([room, x2, o2]);
  const outsideAnswers = [...q2, ...room.g.used].filter(q => TRUTH.has(q) && TRUTH.get(q).length >= 5 && synced2.includes(TRUTH.get(q)));
  check("v žádném dokumentu není čitelná správná odpověď použité otázky", outsideAnswers.length === 0, outsideAnswers.join(","));
  // vrácení po obnovení stránky: Mark znovu otevře odkaz a vrátí se do koncové obrazovky
  await A.reload();
  await A.waitForSelector("#endBox", { timeout: T });
  check("po obnovení stránky se Mark vrátí na konec partie a skóre sedí", (await text(A, "#endScore")).replace(/\s+/g, " ").includes("1 : 1"));

  check("žádné chyby JavaScriptu ani konzole", errs.length === 0, errs.slice(0, 3).join(" | "));
  check("rozvržení: nic nepřesahuje, žádné posouvání, text ≥ 14 px", layout.length === 0, layout.slice(0, 4).join(" || "));
  console.log(`\n${pass} prošlo, ${fail} selhalo · ${link}`);
  fs.writeFileSync(path.join(SHOTS, "vysledek.txt"), log.join("\n") + `\n${pass} prošlo, ${fail} selhalo · ${link}\n`);
  await bA.close(); await bB.close(); await bC.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); if (errs.length) console.error("Chyby stránek:\n" + errs.join("\n")); process.exit(2); });
