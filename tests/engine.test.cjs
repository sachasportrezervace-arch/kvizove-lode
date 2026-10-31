// Testy herního jádra: node tests/engine.test.cjs  (exit 0 = vše prošlo)
const fs = require("fs"), path = require("path"), assert = require("assert");
const L = require("../engine.js");

let pass = 0, fail = 0;
const todo = [];
const test = (name, fn) => todo.push([name, fn]);
// deterministický generátor (mulberry32), ať jsou testy opakovatelné
const seeded = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const S = (r, c, v = false) => ({ r, c, v });
const GOOD = [S(0, 0), S(2, 0), S(4, 0), S(6, 0)];               // 4 vodorovně v řádcích 0, 2, 4, 6 (nedotýkají se)
const getQ = id => QS.find(q => q.id === id);
const QS = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "otazky.json"), "utf8"));
const FAKE = [
  { id: "t-1", kat: "sport", obt: 1, q: "Kolik je 2+2?", opts: ["3", "4", "5", "6"], h: null },
  { id: "t-2", kat: "sport", obt: 2, q: "Kolik je 3+3?", opts: ["6", "7", "8", "9"], h: null },
];
const goodO = "0123";                                              // zobrazené pořadí = pořadí v opts

test("konstanty a rozměry flotily", () => {
  assert.deepStrictEqual(L.SIZES, [4, 3, 3, 2]);
  assert.strictEqual(L.FLEET_CELLS, 12);
  assert.strictEqual(L.CELLS, 64);
  assert.strictEqual(L.SALVO[1], 2); assert.strictEqual(L.SALVO[2], 3); assert.strictEqual(L.SALVO[3], 4);
  assert.strictEqual(L.WRONG, 1);
  assert.strictEqual(L.CATS.length, 7);
});

test("kolize: platná flotila, dotyk bokem, rohem, překryv, mimo desku", () => {
  assert.ok(L.valid(GOOD));
  assert.deepStrictEqual(L.conflicts(GOOD), []);
  assert.deepStrictEqual(L.conflicts([S(0, 0), S(1, 0), S(4, 0), S(6, 0)]).sort(), [0, 1]);          // bok na bok
  assert.deepStrictEqual(L.conflicts([S(0, 0), S(1, 4), S(4, 0), S(6, 0)]).sort(), [0, 1]);          // roh na roh (krokodýl končí ve sloupci 3)
  assert.deepStrictEqual(L.conflicts([S(0, 0), S(0, 3), S(4, 0), S(6, 0)]).sort(), [0, 1]);          // překryv
  assert.deepStrictEqual(L.conflicts([S(0, 5), S(2, 0), S(4, 0), S(6, 0)]), [0]);                     // krokodýl přes okraj
  assert.deepStrictEqual(L.conflicts([S(0, 0), S(2, 0), S(4, 0), S(7, 0, true)]), [3]);               // kachna svisle přes okraj
  assert.ok(!L.valid([S(0, 0)]));
  assert.ok(!L.valid(null));
  // diagonální dotyk
  assert.ok(L.conflicts([S(0, 0), S(1, 4), S(4, 0), S(6, 0)]).length === 2);
  assert.ok(L.valid([S(0, 0), S(1, 5), S(4, 0), S(6, 0)]));
});

test("náhodná flotila je vždy platná (1000×) a pokrývá celou desku", () => {
  const rnd = seeded(7), seen = new Set();
  for (let i = 0; i < 1000; i++) {
    const f = L.randomFleet(rnd);
    assert.ok(L.valid(f), "neplatná flotila " + L.fleetKey(f));
    L.occupancy(f).forEach((k, j) => { if (k >= 0) seen.add(j); });
  }
  assert.ok(seen.size > 60, "flotila nechodí do všech polí: " + seen.size);
});

test("fleetKey a fleetFrom jsou inverzní, špatný klíč vrací null", () => {
  const f = L.randomFleet(seeded(3));
  assert.deepStrictEqual(L.fleetFrom(L.fleetKey(f)), f);
  assert.strictEqual(L.fleetFrom("abc"), null);
  assert.strictEqual(L.fleetFrom("8001" + "000000000000"), null);
  assert.strictEqual(L.occupancy(f).filter(k => k >= 0).length, 12);
});

test("resolve: vedle, zásah, potopení; po potopení se pole označí s", () => {
  const R = ".".repeat(64);
  assert.deepStrictEqual(L.resolve(GOOD, R, 63), { r: "m" });
  assert.deepStrictEqual(L.resolve(GOOD, R, 0), { r: "h" });
  // lehátko (index 1) leží na polích 16, 17, 18
  const r = [...R]; r[16] = "h"; r[17] = "h";
  const last = L.resolve(GOOD, r.join(""), 18);
  assert.strictEqual(last.r, "s"); assert.strictEqual(last.ship, 1); assert.deepStrictEqual(last.cells, [16, 17, 18]);
  r[17] = "."; assert.strictEqual(L.resolve(GOOD, r.join(""), 18).r, "h", "bez prostředního pole ještě není potopeno");
  const sunk = [...R]; [16, 17, 18].forEach(i => sunk[i] = "s");
  assert.strictEqual(L.resolve(GOOD, sunk.join(""), 17).r, "s", "již potopené pole zůstává potopené");
});

test("radar 3×3: počet lodních polí, v rohu se ořízne", () => {
  assert.strictEqual(L.radarArea(0).length, 4);
  assert.strictEqual(L.radarArea(9).length, 9);
  const manual = L.radarArea(9).filter(i => L.occupancy(GOOD)[i] >= 0).length;
  assert.strictEqual(L.radarCount(GOOD, 9), manual);
  assert.strictEqual(manual, 6);                                  // pole 9 = (1,1): krokodýl (0,0)–(0,2) = 3 a lehátko (2,0)–(2,2) = 3
  assert.strictEqual(L.radarCount(GOOD, 63), 0);
});

test("seaView: potopená loď odhalí okolí jako jistou vodu, neznámé zůstává", () => {
  const R = [...".".repeat(64)]; [48, 49].forEach(i => R[i] = "s"); R[0] = "m";
  const v = L.seaView(R.join(""), [[48, 49]]);
  assert.strictEqual(v[48], "s"); assert.strictEqual(v[0], "m");
  assert.strictEqual(v[40], "w"); assert.strictEqual(v[50], "w"); assert.strictEqual(v[57], "w");
  assert.strictEqual(v[63], ".");
  assert.strictEqual(L.seaView(undefined, undefined).every(c => c === "."), true);
  assert.strictEqual(L.hits(R.join("")), 2);
});

test("salvo: správně podle obtížnosti, špatně 1", () => {
  assert.deepStrictEqual([1, 2, 3].map(d => L.salvo(d, true)), [2, 3, 4]);
  assert.deepStrictEqual([1, 2, 3].map(d => L.salvo(d, false)), [1, 1, 1]);
});

test("pickQuestion: nepoužitá, kategorie + obtížnost, postupný ústup, nikdy undefined", () => {
  const rnd = seeded(11);
  for (let i = 0; i < 200; i++) {
    const q = L.pickQuestion(QS, "sport", 2, new Set(), rnd);
    assert.strictEqual(q.kat, "sport"); assert.strictEqual(q.obt, 2);
  }
  const used = new Set(QS.filter(q => q.kat === "sport" && q.obt === 2).map(q => q.id));
  const q1 = L.pickQuestion(QS, "sport", 2, used, rnd);
  assert.strictEqual(q1.kat, "sport"); assert.ok(Math.abs(q1.obt - 2) === 1, "ústup na sousední obtížnost");
  QS.filter(q => q.kat === "sport").forEach(q => used.add(q.id));
  const q2 = L.pickQuestion(QS, "sport", 2, used, rnd);
  assert.ok(!used.has(q2.id) && q2.obt === 2, "kategorie došla: stejná obtížnost jinde");
  const all = new Set(QS.map(q => q.id));
  assert.ok(L.pickQuestion(QS, "sport", 2, all, rnd), "všechno použito: vrátí aspoň něco");
  const ids = new Set();
  for (let i = 0; i < 300; i++) ids.add(L.pickQuestion(QS, "veda", 1, new Set(), rnd).id);
  assert.ok(ids.size >= 8, "výběr je náhodný");
});

test("shuffle4 vrací platnou permutaci", () => {
  const rnd = seeded(5);
  for (let i = 0; i < 200; i++) assert.ok(L.isPerm4(L.shuffle4(rnd)));
  assert.ok(!L.isPerm4("0012")); assert.ok(!L.isPerm4("012")); assert.ok(!L.isPerm4("0124")); assert.ok(!L.isPerm4(null));
});

test("hash odpovědi: stabilní, závisí na id i textu, ořezává mezery; fakt se šifruje a dešifruje", async () => {
  const a = await L.answerHash("x-1", "Nagano");
  assert.strictEqual(a.length, 16);
  assert.strictEqual(a, await L.answerHash("x-1", "  Nagano "));
  assert.notStrictEqual(a, await L.answerHash("x-2", "Nagano"));
  assert.notStrictEqual(a, await L.answerHash("x-1", "Nagan"));
  const f = await L.encryptFact("x-1", "Nagano", "Čeští hokejisté vyhráli zlato v roce 1998 – ěščřžýáíéůú.");
  assert.ok(!f.includes("hokej"));
  assert.strictEqual(await L.decryptFact("x-1", "Nagano", f), "Čeští hokejisté vyhráli zlato v roce 1998 – ěščřžýáíéůú.");
  assert.notStrictEqual(await L.decryptFact("x-1", "Salt Lake City", f), "Čeští hokejisté vyhráli zlato v roce 1998 – ěščřžýáíéůú.");
});

test("otazky.json: každá otázka má právě jednu možnost odpovídající hashi, fakt jde dešifrovat, žádná čitelná odpověď", async () => {
  assert.ok(QS.length >= 180, "otázek: " + QS.length);
  const ids = new Set();
  for (const q of QS) {
    assert.ok(!ids.has(q.id)); ids.add(q.id);
    assert.ok(L.CATS.includes(q.kat) && [1, 2, 3].includes(q.obt) && q.opts.length === 4 && new Set(q.opts).size === 4, q.id);
    assert.deepStrictEqual(Object.keys(q).filter(k => /spravne|correct|answer/i.test(k)), [], "nečitelná správná odpověď: " + q.id);
    const hit = [];
    for (let j = 0; j < 4; j++) if (await L.answerHash(q.id, q.opts[j]) === q.h) hit.push(j);
    assert.strictEqual(hit.length, 1, "hash neodpovídá právě jedné možnosti: " + q.id);
    const fact = await L.decryptFact(q.id, q.opts[hit[0]], q.f);
    assert.ok(fact.length > 10 && fact.length <= 140 && /^[\p{L}\p{N}„“"(]/u.test(fact), "fakt: " + q.id + " " + fact);
  }
  // správná odpověď není pořád na stejném místě
  const pos = [0, 0, 0, 0];
  for (const q of QS) for (let j = 0; j < 4; j++) if (await L.answerHash(q.id, q.opts[j]) === q.h) pos[j]++;
  assert.ok(Math.min(...pos) > QS.length * 0.15, "správná odpověď je předvídatelná: " + pos);
});

test("flow: setup → pick → answer → shoot → pick soupeře (kategorie z nc) → end", () => {
  const empty = () => ({ ready: true, c0: "sport", T: [], R: ".".repeat(64), S: [], D: {} });
  assert.strictEqual(L.flow({ x: {}, o: {} }, "x").kind, "setup");
  assert.deepStrictEqual(L.flow({ x: { ready: true }, o: {} }, "x").ready, { x: true, o: false });
  const P = { x: empty(), o: empty() };
  P.o.c0 = "zemepis";
  let f = L.flow(P, "x");
  assert.deepStrictEqual([f.kind, f.who, f.k, f.cat], ["pick", "x", 0, "zemepis"]);
  P.x.T.push({ d: 2, q: "q1", o: goodO, t0: 1, a: null, ms: 0, n: 0, sh: [], r: null, nc: null });
  f = L.flow(P, "x"); assert.deepStrictEqual([f.kind, f.who], ["answer", "x"]);
  Object.assign(P.x.T[0], { a: 1, ms: 5000, ok: true, n: 3 });
  f = L.flow(P, "x"); assert.deepStrictEqual([f.kind, f.who, f.left], ["shoot", "x", 3]);
  P.x.T[0].sh = [5, 6]; f = L.flow(P, "x"); assert.deepStrictEqual([f.kind, f.left, f.pending], ["shoot", 1, [5, 6]]);
  P.o.R = "." .repeat(5) + "mm" + ".".repeat(57);
  f = L.flow(P, "x"); assert.deepStrictEqual([f.left, f.pending.length], [1, 0]);
  P.x.T[0].sh = [5, 6, 7]; P.o.R = ".....mmm" + ".".repeat(56);
  f = L.flow(P, "x"); assert.deepStrictEqual([f.kind, f.left], ["shoot", 0], "salva je vystřílená, ale chybí nc");
  P.x.T[0].r = 20; f = L.flow(P, "x"); assert.strictEqual(f.pendingRadar, true);
  P.o.D = { 20: 2 }; f = L.flow(P, "x"); assert.strictEqual(f.pendingRadar, false);
  P.x.T[0].nc = "jidlo";
  f = L.flow(P, "x"); assert.deepStrictEqual([f.kind, f.who, f.k, f.cat], ["pick", "o", 1, "jidlo"]);
  P.o.T.push({ d: 1, q: "q2", o: goodO, t0: 2, a: -1, ms: 20000, ok: false, n: 1, sh: [3], r: null, nc: "veda" });
  P.x.R = "...m" + ".".repeat(60);
  f = L.flow(P, "x"); assert.deepStrictEqual([f.kind, f.who, f.k, f.cat], ["pick", "x", 2, "veda"]);
  P.x.S = [[0, 1], [8, 9, 10], [16, 17, 18], [24, 25, 26, 27]];
  f = L.flow(P, "x"); assert.deepStrictEqual([f.kind, f.winner, f.loser], ["end", "o", "x"]);
  // začíná o: první tah patří o, kategorii vybírá x
  const Q = { x: empty(), o: empty() }; Q.x.c0 = "veda";
  f = L.flow(Q, "o"); assert.deepStrictEqual([f.kind, f.who, f.cat], ["pick", "o", "veda"]);
});

// pomocník: dokument střelce s jedním tahem
const turn = (extra = {}) => ({ d: 2, q: "t-1", o: goodO, t0: 1, a: 1, ms: 5000, ok: true, n: 3, sh: [], r: null, nc: null, ...extra });

async function prepFake() {
  FAKE[0].h = await L.answerHash("t-1", "4");
  FAKE[1].h = await L.answerHash("t-2", "6");
  QS.push(...FAKE.filter(f => !QS.includes(f)));
}

test("allowance: počet ran a radar podle ověřené odpovědi", () => {
  assert.deepStrictEqual(L.allowance(turn({ d: 3, n: 4 }), true), { shots: 4, radar: true });
  assert.deepStrictEqual(L.allowance(turn({ d: 3, n: 4, ms: 7001 }), true), { shots: 4, radar: false });
  assert.deepStrictEqual(L.allowance(turn({ d: 3, n: 4 }), false), { shots: 1, radar: false });
  assert.deepStrictEqual(L.allowance(turn({ d: 1, n: 9 }), true), { shots: 2, radar: true });
  assert.deepStrictEqual(L.allowance(turn({ d: 9, n: 9 }), true), { shots: 0, radar: false });
});

test("defend: poctivá salva, správná odpověď = povolený počet ran; sunk se zapíše do S, K a R", async () => {
  await prepFake();
  const T = [turn({ d: 2, a: 1, n: 3, sh: [0, 1, 2] })];                // 4 je na indexu 1 → správně
  let r = await L.defend(GOOD, T, {}, getQ);
  assert.strictEqual(r.R.slice(0, 3), "hhh");
  assert.strictEqual(r.S.length, 0);
  const T2 = [turn({ d: 2, a: 1, n: 3, sh: [0, 1, 2] }), turn({ d: 1, a: 1, n: 2, sh: [3, 63] })];
  r = await L.defend(GOOD, T2, {}, getQ);
  assert.deepStrictEqual(r.S, [[0, 1, 2, 3]]); assert.deepStrictEqual(r.K, [0]);
  assert.strictEqual(r.R.slice(0, 4), "ssss"); assert.strictEqual(r.R[63], "m");
  const again = await L.defend(GOOD, T2, r, getQ);
  assert.strictEqual(again.changed, false, "opakované zpracování nic nemění");
  assert.strictEqual(again.R, r.R);
});

test("defend: podvod – víc ran než n, špatná odpověď s plnou salvou, pozdní radar, neexistující otázka", async () => {
  await prepFake();
  let r = await L.defend(GOOD, [turn({ d: 2, n: 3, sh: [0, 1, 2, 3, 4, 5, 6] })], {}, getQ);
  assert.strictEqual([...r.R].filter(c => c !== ".").length, 3, "víc než n ran se ignoruje");
  r = await L.defend(GOOD, [turn({ d: 3, a: 0, ok: true, n: 4, sh: [0, 1, 2, 3] })], {}, getQ);            // a=0 je špatně ("3"), tvrdí ok
  assert.strictEqual([...r.R].filter(c => c !== ".").length, 1, "špatná odpověď = jen 1 rána");
  r = await L.defend(GOOD, [turn({ d: 3, a: -1, ok: true, n: 4, sh: [0, 1, 2, 3] })], {}, getQ);
  assert.strictEqual([...r.R].filter(c => c !== ".").length, 1, "vypršený čas = 1 rána");
  r = await L.defend(GOOD, [turn({ ms: 8000, r: 9 })], {}, getQ);
  assert.deepStrictEqual(r.D, {}, "radar po 7 s se neodpoví");
  r = await L.defend(GOOD, [turn({ ms: 6900, r: 9 })], {}, getQ);
  assert.deepStrictEqual(r.D, { 9: 6 }, "radar do 7 s ano");
  r = await L.defend(GOOD, [turn({ ms: 6900, ok: true, a: 0, r: 9 })], {}, getQ);
  assert.deepStrictEqual(r.D, {}, "špatná odpověď nemá radar ani při tvrzení ok");
  r = await L.defend(GOOD, [turn({ q: "neexistuje", sh: [0] })], {}, getQ);
  assert.strictEqual(r.R, ".".repeat(64));
  r = await L.defend(GOOD, [turn({ o: "0012", sh: [0] })], {}, getQ);
  assert.strictEqual([...r.R].filter(c => c !== ".").length, 0 + 1, "neplatné pořadí možností = jako špatná odpověď (1 rána)");
  r = await L.defend(GOOD, [turn({ a: null, sh: [0] })], {}, getQ);
  assert.strictEqual(r.R[0], ".", "dokud není odpověď, nic neplatí");
  r = await L.defend(GOOD, [turn({ sh: [0, 99, -1, 1.5, "x"] })], {}, getQ);
  assert.strictEqual(r.R[0], "h"); assert.strictEqual([...r.R].filter(c => c !== ".").length, 1, "neplatná pole se přeskočí");
});

test("defend: obránce neodpoví na pole, které už odpověděl, a po potopení celé flotily přestane", async () => {
  await prepFake();
  const all = [];
  L.occupancy(GOOD).forEach((k, i) => { if (k >= 0) all.push(i); });
  const T = [];
  for (let i = 0; i < all.length; i += 3) T.push(turn({ d: 2, n: 3, sh: all.slice(i, i + 3) }));
  const r = await L.defend(GOOD, T.concat([turn({ sh: [63, 62] })]), {}, getQ);
  assert.strictEqual(r.S.length, 4);
  assert.strictEqual(r.R[63], ".", "po konci se už neodpovídá");
  assert.strictEqual(L.flow({ x: { ready: true, T: T.concat([]), R: ".".repeat(64) }, o: { ready: true, S: r.S, R: r.R, T: [] } }, "x").kind, "end");
});

test("verify: poctivá partie projde, podvržený zásah, jiná flotila i sůl neprojdou", async () => {
  await prepFake();
  const key = L.fleetKey(GOOD), salt = "abc123", fh = await L.sha(key + salt);
  const T = [turn({ d: 2, n: 3, sh: [0, 1, 63], r: 9 })];
  const doc = await L.defend(GOOD, T, {}, getQ);
  const mine = { R: doc.R, S: doc.S, K: doc.K, D: doc.D };
  assert.deepStrictEqual(await L.verify({ f: key, salt }, fh, T, mine, getQ), { ok: true });
  const lie = { ...mine, R: "m" + mine.R.slice(1) };
  assert.strictEqual((await L.verify({ f: key, salt }, fh, T, lie, getQ)).ok, false, "zásah vydávaný za vedle");
  assert.strictEqual((await L.verify({ f: key, salt: "jina" }, fh, T, mine, getQ)).ok, false, "špatná sůl");
  const other = L.fleetKey([S(1, 0), S(3, 0), S(5, 0), S(7, 0)]);
  assert.strictEqual((await L.verify({ f: other, salt }, fh, T, mine, getQ)).ok, false, "jiná flotila než závazek");
  const radarLie = { ...mine, D: { 9: 1 } };
  assert.strictEqual((await L.verify({ f: key, salt }, fh, T, radarLie, getQ)).ok, false, "špatný radar");
  assert.strictEqual((await L.verify(null, fh, T, mine, getQ)).ok, false);
});

// ---------------------------------------------------------------- v2: pestrost partií
test("v2: bójky jsou deterministické ze semínka, 3 různé druhy na 3 různých polích, jinak pro x a o", () => {
  const a = L.buoys("sem1", "x"), a2 = L.buoys("sem1", "x"), b = L.buoys("sem1", "o"), c = L.buoys("sem2", "x");
  assert.deepStrictEqual(a, a2);
  assert.strictEqual(Object.keys(a).length, 3); assert.deepStrictEqual(Object.values(a).sort(), ["mina", "poklad", "radar"]);
  assert.notDeepStrictEqual(a, b, "x a o mají různé bójky");
  assert.notDeepStrictEqual(a, c, "jiné semínko, jiné bójky");
  assert.deepStrictEqual(L.buoys("", "x"), {}, "bez semínka žádné bójky");
  const seen = new Set(); for (let i = 0; i < 30; i++) seen.add(Object.keys(L.buoys("s" + i, "x")).sort().join()); assert.ok(seen.size > 20, "bójky se opravdu mění");
});
test("v2: nabídka 3 kategorií ze semínka, nikdy ne ta minulá; kolo štěstí každý 5. tah", () => {
  for (let k = 0; k < 40; k++) {
    const o = L.offeredCats("s", k, "sport"); assert.strictEqual(o.length, 3); assert.strictEqual(new Set(o).size, 3); assert.ok(!o.includes("sport"));
    assert.deepStrictEqual(o, L.offeredCats("s", k, "sport"));
    assert.ok(L.CATS.includes(L.wheelCat("s", k, "sport")) && L.wheelCat("s", k, "sport") !== "sport");
  }
  assert.deepStrictEqual([0, 1, 3, 4, 5, 8, 9, 14].map(L.isWheel), [false, false, false, true, false, false, true, true]);
  const all = new Set(); for (let k = 0; k < 60; k++) L.offeredCats("s", k, "").forEach(c => all.add(c)); assert.strictEqual(all.size, 7, "časem se nabídnou všechny kategorie");
});
test("v2: tituly podle výher a tvary pro kapitán/kapitánka", () => {
  assert.deepStrictEqual([0, 1, 2, 3, 4, 5, 7, 8, 20].map(L.titleLevel), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.strictEqual(L.titleName(0, false), "Plavčík"); assert.strictEqual(L.titleName(3, true), "Kapitánka nafukovačky");
  assert.strictEqual(L.titleName(3, true, true), "Kapitánku nafukovačky"); assert.strictEqual(L.titleName(5, false, true), "Admirála bazénu");
  assert.strictEqual(L.titleName(8, true), "Vševědka");
});
test("v2: rozcvička, finále a záchranný kruh ovlivňují počet ran", () => {
  assert.deepStrictEqual([L.phaseOfTurn(0, 0), L.phaseOfTurn(1, 2), L.phaseOfTurn(2, 0), L.phaseOfTurn(0, 3)], ["warm", "warm", "normal", "finale"]);
  assert.strictEqual(L.baseShots({ d: 3 }, true, { phase: "warm" }), 1, "těžká v rozcvičce se nepočítá");
  assert.strictEqual(L.baseShots({ d: 2 }, true, { phase: "finale" }), 1, "ve finále jen těžká");
  assert.strictEqual(L.baseShots({ d: 3 }, true, { phase: "finale" }), 4);
  assert.strictEqual(L.baseShots({ d: 2, rs: 1 }, true, { phase: "normal" }), 4, "záchranný kruh +1");
  assert.strictEqual(L.baseShots({ d: 2, rs: 1 }, false, { phase: "normal" }), 1, "špatná odpověď nedostane nic navíc");
  assert.strictEqual(L.baseShots({ d: 1 }, true, { phase: "normal", pen: true }), 1, "mina: −1, ale minimum 1");
  assert.strictEqual(L.baseShots({ d: 3 }, true, { phase: "normal", pen: true }), 3);
  assert.strictEqual(L.needsRescue(7, 4), true); assert.strictEqual(L.needsRescue(5, 4), false);
});
test("v2: defend – poklad dá +1 ránu, radar zdarma jde jen po zásahu sonaru, mina ubere ránu v příštím tahu", async () => {
  await prepFake();
  const seed = "test-semeno", bu = L.buoys(seed, "o"), cell = k => +Object.keys(bu).find(i => bu[i] === k);
  const free = [...Array(64).keys()].filter(i => !(i in bu) && ![0, 1, 2, 3, 16, 17, 18, 19, 32, 33, 34, 35, 48, 49, 50, 51].includes(i)).slice(0, 8);
  const ctx = { seed, seat: "o" };
  // poklad: n = 3 (střední), s pokladem 4 rány; páté se ignoruje
  let r = await L.defend(GOOD, [turn({ d: 2, n: 3, sh: [free[0], cell("poklad"), free[1], free[2], free[3]] })], {}, getQ, ctx);
  assert.strictEqual([...r.R].filter(c => c !== ".").length, 4, "3 + 1 za poklad");
  r = await L.defend(GOOD, [turn({ d: 2, n: 3, sh: [free[0], free[1], free[2], free[3]] })], {}, getQ, ctx);
  assert.strictEqual([...r.R].filter(c => c !== ".").length, 3, "bez pokladu jen 3");
  // sonar: r2 platí jen po zásahu sonaru
  r = await L.defend(GOOD, [turn({ d: 2, n: 3, ms: 9000, sh: [free[0]], r2: 9 })], {}, getQ, ctx);
  assert.deepStrictEqual(r.D, {}, "bez sonaru žádný radar zdarma");
  r = await L.defend(GOOD, [turn({ d: 2, n: 3, ms: 9000, sh: [cell("radar")], r2: 9 })], {}, getQ, ctx);
  assert.deepStrictEqual(r.D, { 9: 6 }, "sonar = radar zdarma i po 7 s");
  // mina: v příštím tahu o 1 ránu méně (střední 3 → 2), jinak 3
  const t1 = turn({ d: 2, n: 3, sh: [cell("mina"), free[0], free[1]] }), t2 = turn({ d: 2, n: 3, sh: [free[2], free[3], free[4]] });
  r = await L.defend(GOOD, [t1, t2], {}, getQ, ctx);
  assert.strictEqual([...r.R].filter(c => c !== ".").length, 3 + 2, "po minové salvě o ránu méně");
  r = await L.defend(GOOD, [turn({ d: 2, n: 3, sh: [free[5], free[0], free[1]] }), t2], {}, getQ, ctx);
  assert.strictEqual([...r.R].filter(c => c !== ".").length, 6, "bez miny plná druhá salva");
});
test("v2: flow – poklad zvýší počet ran v salvě, sonar zpřístupní druhý radar; verify s bójkami projde", async () => {
  await prepFake();
  const seed = "flow-seed", bu = L.buoys(seed, "o"), cp = +Object.keys(bu).find(i => bu[i] === "poklad"), cr = +Object.keys(bu).find(i => bu[i] === "radar");
  const other = [...Array(64).keys()].filter(i => !(i in bu))[0];
  const P = { x: { ready: true, T: [turn({ d: 1, n: 2, sh: [cp, other], nc: null })], R: ".".repeat(64) }, o: { ready: true, c0: "sport", T: [], R: [...".".repeat(64)].map((c, i) => i === cp || i === other ? "m" : c).join(""), S: [], D: {} } };
  let f = L.flow(P, "x", { seed });
  assert.deepStrictEqual([f.kind, f.left, f.treasure], ["shoot", 1, 1], "2 rány + 1 za poklad, vystřeleny 2 → zbývá 1");
  f = L.flow(P, "x"); assert.strictEqual(f.left, 0, "bez semínka se bójky neberou v potaz");
  P.x.T[0].sh = [cr]; P.o.R = [...".".repeat(64)].map((c, i) => i === cr ? "m" : c).join("");
  f = L.flow(P, "x", { seed }); assert.strictEqual(f.sonar, true);
  P.x.T[0].r2 = 9; f = L.flow(P, "x", { seed }); assert.strictEqual(f.pendingRadar, true);
  P.o.D = { 9: 1 }; f = L.flow(P, "x", { seed }); assert.strictEqual(f.pendingRadar, false);
  // verify: stejná obrana a stejný kontext → shoda
  const T = [turn({ d: 2, n: 3, sh: [cp, other, 40, 41] })];
  const rev = { f: L.fleetKey(GOOD), salt: "s" }, fh = await L.sha(rev.f + rev.salt);
  const mine = await L.defend(GOOD, T, {}, getQ, { seed, seat: "o" });
  assert.ok((await L.verify(rev, fh, T, mine, getQ, { seed, seat: "o" })).ok);
});

(async () => {
  for (const [name, fn] of todo) {
    try { await fn(); pass++; console.log("PASS  " + name); }
    catch (e) { fail++; console.log("FAIL  " + name + "\n      " + (e && e.message || e).toString().split("\n").join("\n      ")); }
  }
  console.log(`\n${pass} prošlo, ${fail} selhalo`);
  process.exit(fail ? 1 : 0);
})();
