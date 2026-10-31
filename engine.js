// Herní jádro „Nafukovací flotily“ (lodě 1v1 s kvízem). Bez DOM, sdílí ho hra i testy.
// Moře 8×8, pole i = řádek * 8 + sloupec. Flotila 4 + 3 + 3 + 2, lodě se nesmí dotýkat ani rohem.
// Každý hráč zná jen svou flotilu; na výstřely soupeře odpovídá jeho vlastní zařízení (pole R, S, D v jeho dokumentu).
(function (root) {
  const N = 8, CELLS = 64, SIZES = [4, 3, 3, 2], FLEET_CELLS = 12;
  const SALVO = { 1: 2, 2: 3, 3: 4 }, WRONG = 1, FAST_MS = 7000, ANSWER_MS = 20000;
  const CATS = ["zemepis", "historie", "priroda", "sport", "film-hudba", "jidlo", "veda"];
  const other = p => p === "x" ? "o" : "x";
  const rc = i => [Math.floor(i / N), i % N];
  const at = (r, c) => r < 0 || c < 0 || r >= N || c >= N ? -1 : r * N + c;
  const around = i => { const [r, c] = rc(i), out = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const j = at(r + dr, c + dc); if (j >= 0 && j !== i) out.push(j); } return out; };

  // loď = {r, c, v} (v = svisle), délka podle pořadí ve SIZES
  const shipCells = (s, len) => [...Array(len)].map((_, k) => s.v ? at(s.r + k, s.c) : at(s.r, s.c + k));
  function fits(s, len) { return shipCells(s, len).every(i => i >= 0) && (s.v ? s.r + len <= N : s.c + len <= N); }
  // vrátí seznam kolizí (indexy lodí), prázdné = flotila platí
  function conflicts(fleet) {
    const own = new Map(), bad = new Set();
    fleet.forEach((s, k) => {
      if (!fits(s, SIZES[k])) { bad.add(k); return; }
      shipCells(s, SIZES[k]).forEach(i => own.set(i, k));
    });
    fleet.forEach((s, k) => {
      if (bad.has(k)) return;
      shipCells(s, SIZES[k]).forEach(i => [i, ...around(i)].forEach(j => { const o = own.get(j); if (o !== undefined && o !== k) { bad.add(k); bad.add(o); } }));
    });
    return [...bad];
  }
  const valid = f => Array.isArray(f) && f.length === SIZES.length && conflicts(f).length === 0;
  function randomFleet(rnd = Math.random) {
    for (;;) {
      const f = [];
      let ok = true;
      for (let k = 0; k < SIZES.length && ok; k++) {
        ok = false;
        for (let t = 0; t < 200; t++) {
          const v = rnd() < .5, s = { v, r: Math.floor(rnd() * (v ? N - SIZES[k] + 1 : N)), c: Math.floor(rnd() * (v ? N : N - SIZES[k] + 1)) };
          if (valid([...f, s].concat(SIZES.slice(k + 1).map(() => null)).filter(Boolean)) || conflicts([...f, s]).length === 0) { f.push(s); ok = true; break; }
        }
      }
      if (ok && valid(f)) return f;
    }
  }
  const fleetKey = f => f.map(s => `${s.r}${s.c}${s.v ? 1 : 0}`).join("");
  const fleetFrom = k => /^([0-7][0-7][01]){4}$/.test(k || "") ? [0, 1, 2, 3].map(i => ({ r: +k[i * 3], c: +k[i * 3 + 1], v: k[i * 3 + 2] === "1" })) : null;
  const occupancy = f => { const m = new Array(CELLS).fill(-1); f.forEach((s, k) => shipCells(s, SIZES[k]).forEach(i => m[i] = k)); return m; };

  // obránce: odpověď na výstřel do pole i, když už dříve zasažená pole jsou v `R` (řetězec 64 znaků)
  function resolve(fleet, R, i) {
    const occ = occupancy(fleet), k = occ[i];
    if (k < 0) return { r: "m" };
    const cells = shipCells(fleet[k], SIZES[k]);
    const sunk = cells.every(j => j === i || R[j] === "h" || R[j] === "s");
    return sunk ? { r: "s", ship: k, cells } : { r: "h" };
  }
  // radar 3×3 kolem středu: kolik lodních polí tam je
  const radarArea = i => [i, ...around(i)].sort((a, b) => a - b);
  const radarCount = (fleet, i) => { const occ = occupancy(fleet); return radarArea(i).filter(j => occ[j] >= 0).length; };

  // pohled střelce na soupeřovo moře z odpovědí obránce: '.' neznámo, 'm' vedle, 'h' zásah, 's' potopeno, 'w' jistá voda
  function seaView(R, S) {
    const v = [...(R || ".".repeat(CELLS))];
    (S || []).forEach(cells => cells.forEach(i => { v[i] = "s"; around(i).forEach(j => { if (v[j] === ".") v[j] = "w"; }); }));
    return v;
  }
  const sunkCount = S => (S || []).length;
  const hits = R => [...(R || "")].filter(ch => ch === "h" || ch === "s").length;

  const salvo = (d, correct) => correct ? SALVO[d] : WRONG;

  // výběr otázky: nepoužitá, kategorie a obtížnost; když dojde, nejbližší obtížnost, pak jiná kategorie
  function pickQuestion(pool, cat, d, used, rnd = Math.random) {
    const free = pool.filter(q => !used.has(q.id));
    const tiers = [
      q => q.kat === cat && q.obt === d,
      q => q.kat === cat && Math.abs(q.obt - d) === 1,
      q => q.kat === cat,
      q => q.obt === d,
      () => true,
    ];
    for (const f of tiers) { const c = free.filter(f); if (c.length) return c[Math.floor(rnd() * c.length)]; }
    return pool[Math.floor(rnd() * pool.length)];
  }
  function shuffle4(rnd = Math.random) { const a = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.join(""); }

  // průběh partie z dokumentů obou hráčů: kdo je na tahu a v jaké fázi
  // P = {x: docX, o: docO}, s = kdo začíná. Tah k patří hráči s (sudé k) nebo druhému (liché k), záznam je P[hráč].T[k>>1].
  // ctx = {seed}: z něj se odvodí bójky v moři soupeře (poklad = +1 rána, sonar = druhý radar)
  function flow(P, s, ctx) {
    const X = P.x || {}, O = P.o || {};
    if (!X.ready || !O.ready) return { kind: "setup", ready: { x: !!X.ready, o: !!O.ready } };
    const doc = p => p === "x" ? X : O;
    // konec: obránce nahlásil potopení celé flotily
    for (const p of ["x", "o"]) if (sunkCount(doc(p).S) >= SIZES.length) return { kind: "end", winner: other(p), loser: p };
    const seed = ctx && ctx.seed;
    for (let k = 0; ; k++) {
      const who = k % 2 === 0 ? s : other(s), opp = other(who), T = (doc(who).T || [])[k >> 1];
      const catAt = j => j < 0 ? "" : j === 0 ? (doc(other(s)).c0 || "") : (((doc(j % 2 === 0 ? other(s) : s).T || [])[(j - 1) >> 1] || {}).nc || "");
      const cat = k === 0 ? doc(opp).c0 : ((doc(opp).T || [])[(k - 1) >> 1] || {}).nc, prevCat = catAt(k - 1);
      if (!T) return { kind: "pick", who, k, cat, prevCat };          // vybírá obtížnost
      if (T.a === null || T.a === undefined) return { kind: "answer", who, k, cat, T, prevCat };
      const R = doc(opp).R || ".".repeat(CELLS), bu = buoys(seed, opp);
      const shots = T.sh || [], pending = shots.filter(i => R[i] === ".");
      const done = shots.filter(i => R[i] !== ".");
      const treasure = buoyHits(done, bu, "poklad").length, sonar = buoyHits(done, bu, "radar").length > 0;
      const D = doc(opp).D || {};
      const pendingRadar = (T.r !== null && T.r !== undefined && D[T.r] === undefined) || (T.r2 !== null && T.r2 !== undefined && D[T.r2] === undefined);
      const total = (T.n || 0) + treasure;
      if (pending.length || pendingRadar || shots.length < total || !T.nc) {
        return { kind: "shoot", who, k, cat, T, prevCat, left: Math.max(0, total - shots.length), pending, pendingRadar, treasure, sonar };
      }
    }
  }

  // ---------------------------------------------------------------- v2: pestrost partií (vše ze semínka partie g.seed)
  // malý deterministický generátor: stejné semínko = stejné bójky a nabídky u obou hráčů
  function rngFrom(text) {
    let h = 1779033703 ^ String(text).length;
    for (const ch of String(text)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pickN = (arr, n, rnd) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  // bójky v moři hráče seat: {pole: "poklad"|"radar"|"mina"}, každý druh jednou, na různých polích; bez semínka žádné
  const BUOYS = ["poklad", "radar", "mina"];
  function buoys(seed, seat) {
    if (!seed) return {};
    const rnd = rngFrom(`b|${seed}|${seat}`), cells = pickN([...Array(CELLS).keys()], BUOYS.length, rnd), out = {};
    BUOYS.forEach((t, j) => out[cells[j]] = t);
    return out;
  }
  // kategorie nabízené soupeři pro tah k: 3 ze 7, ne ta, kterou měl hráč minule
  const offeredCats = (seed, k, last) => pickN(CATS.filter(c => c !== last), 3, rngFrom(`c|${seed}|${k}`));
  // každý 5. tah (k = 4, 9, 14 …) losuje kategorii kolo štěstí
  const isWheel = k => k > 0 && (k + 1) % 5 === 0;
  const wheelCat = (seed, k, last) => { const c = CATS.filter(x => x !== last); return c[Math.floor(rngFrom(`w|${seed}|${k}`)() * c.length)]; };
  // titul podle výher v sérii; úroveň 0–4 řídí i vzhled plavce (pruhy, zlatá kachna, korunka)
  const TITLES = [
    { w: 0, m: "Plavčík", f: "Plavčice", ma: "Plavčíka", fa: "Plavčici" },
    { w: 1, m: "Vodník", f: "Vodnice", ma: "Vodníka", fa: "Vodnici" },
    { w: 3, m: "Kapitán nafukovačky", f: "Kapitánka nafukovačky", ma: "Kapitána nafukovačky", fa: "Kapitánku nafukovačky" },
    { w: 5, m: "Admirál bazénu", f: "Admirálka bazénu", ma: "Admirála bazénu", fa: "Admirálku bazénu" },
    { w: 8, m: "Vševěd", f: "Vševědka", ma: "Vševěda", fa: "Vševědku" },
  ];
  const titleLevel = wins => { let l = 0; TITLES.forEach((t, i) => { if (wins >= t.w) l = i; }); return l; };
  const titleName = (wins, female, acc) => { const t = TITLES[titleLevel(wins)]; return acc ? (female ? t.fa : t.ma) : (female ? t.f : t.m); };
  // pravidla tahu: rozcvička (první 2 tahy hráče jen lehká/střední), finále (soupeři zbývá poslední hračka: jen těžká), záchranný kruh (+1 rána)
  const phaseOfTurn = (idx, oppSunk) => oppSunk >= SIZES.length - 1 ? "finale" : idx < 2 ? "warm" : "normal";
  const maxDifficulty = ph => ph === "warm" ? 2 : 3;
  const minDifficulty = ph => ph === "finale" ? 3 : 1;
  const RESCUE_GAP = 3;
  const needsRescue = (myTaken, myDealt) => myTaken - myDealt >= RESCUE_GAP;
  // základ ran tahu po ověření odpovědi; ctx = {phase, pen (mina z minulého tahu)}; bez ctx se chová jako v1
  function baseShots(t, ok, ctx) {
    const c = ctx || {}, d = SALVO[t.d] ? t.d : 0;
    if (!d) return 0;
    if (!ok) return WRONG;
    if (c.phase === "finale" && d !== 3) return WRONG;
    if (c.phase === "warm" && d === 3) return WRONG;
    return Math.max(1, SALVO[d] + (t.rs ? 1 : 0) - (c.pen ? 1 : 0));
  }
  // které z výstřelů tahu zasáhly bójku daného druhu
  const buoyHits = (shots, bu, kind) => (shots || []).filter(i => bu && bu[i] === kind);

  async function sha(text) {
    const b = new TextEncoder().encode(text);
    const h = await (root.crypto || require("crypto").webcrypto).subtle.digest("SHA-256", b);
    return [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, "0")).join("");
  }
  const answerHash = (id, text) => sha(id + "|" + text.trim()).then(h => h.slice(0, 16));

  // ---- ověření odpovědi a šifrovaný fakt (správná odpověď není nikde čitelně)
  // T.o = řetězec „perm4“ (pořadí možností na obrazovce), T.a = index zvolené možnosti v tom pořadí
  const isPerm4 = o => typeof o === "string" && /^[0-3]{4}$/.test(o) && new Set(o).size === 4;
  async function correctIndex(q, o) {
    if (!q || !isPerm4(o)) return -1;
    for (let j = 0; j < 4; j++) if (await answerHash(q.id, q.opts[+o[j]]) === q.h) return j;
    return -1;
  }
  async function isCorrect(q, o, a) { return Number.isInteger(a) && a >= 0 && a < 4 && (await correctIndex(q, o)) === a; }
  const factKey = (id, correct) => sha("f|" + id + "|" + correct.trim());
  const keyBytes = h => h.match(/../g).map(x => parseInt(x, 16));
  const xorBytes = (bytes, keyHex) => { const k = keyBytes(keyHex); return bytes.map((b, i) => b ^ k[i % k.length]); };
  async function encryptFact(id, correct, text) {
    const x = xorBytes([...new TextEncoder().encode(text)], await factKey(id, correct));
    return btoa(String.fromCharCode(...x));
  }
  async function decryptFact(id, correct, f) {
    const bytes = [...atob(f)].map(c => c.charCodeAt(0));
    return new TextDecoder().decode(new Uint8Array(xorBytes(bytes, await factKey(id, correct))));
  }

  // kolik ran smí tah T (po ověření odpovědi) opravdu vystřelit a smí-li radar
  const cellOk = i => Number.isInteger(i) && i >= 0 && i < CELLS;
  function allowance(T, ok, ctx) {
    const d = SALVO[T.d] ? T.d : 0;
    return { shots: d ? Math.min(Math.max(0, T.n | 0), baseShots(T, ok, ctx)) : 0, radar: !!(ok && d && Number.isFinite(T.ms) && T.ms <= FAST_MS) };
  }
  // obránce: z tahů soupeře T[] a mého dosavadního dokumentu spočítá moje odpovědi (R, S, K, D).
  // Odpoví jen na to, co soupeř smí (správná odpověď podle hashe, počet ran, radar do FAST_MS); getQ(id) → otázka z otazky.json.
  // ctx = {seed, seat}: bójky v mém moři (poklad +1 rána hned, radar zdarma = T.r2, mina −1 rána v příštím tahu soupeře)
  async function defend(fleet, T, mine, getQ, ctx) {
    const m = mine || {}, bu = ctx && ctx.seed ? buoys(ctx.seed, ctx.seat) : {};
    const R = [...(m.R && m.R.length === CELLS ? m.R : ".".repeat(CELLS))];
    const S = (m.S || []).map(c => [...c]), K = [...(m.K || [])], D = { ...(m.D || {}) };
    let changed = false, pen = false;
    for (let idx = 0; idx < (T || []).length; idx++) {
      const t = T[idx];
      if (!t || t.a === null || t.a === undefined) break;            // dokud není zodpovězená otázka, nic dalšího neplatí
      if (S.length >= SIZES.length) break;                           // moje flotila už je potopená
      const q = getQ(t.q);
      if (!q) break;
      const phase = phaseOfTurn(idx, S.length);
      const ok = await isCorrect(q, t.o, t.a), al = allowance(t, ok, { phase, pen });
      let budget = al.shots, used = 0, sonar = false, mine = false;
      for (const i of t.sh || []) {
        if (used >= budget) break;
        used++;
        if (!cellOk(i) || R[i] !== "." || S.length >= SIZES.length) continue;
        const res = resolve(fleet, R.join(""), i);
        if (res.r === "s") { res.cells.forEach(j => R[j] = "s"); S.push(res.cells); K.push(res.ship); } else R[i] = res.r;
        changed = true;
        if (bu[i] === "poklad") budget++;
        else if (bu[i] === "radar") sonar = true;
        else if (bu[i] === "mina") mine = true;
      }
      pen = mine;
      if (al.radar && cellOk(t.r) && D[t.r] === undefined) { D[t.r] = radarCount(fleet, t.r); changed = true; }
      if (sonar && cellOk(t.r2) && D[t.r2] === undefined) { D[t.r2] = radarCount(fleet, t.r2); changed = true; }
    }
    return { R: R.join(""), S, K, D, changed };
  }
  // ověření poctivosti po konci: soupeř odhalil flotilu + sůl; přehraje se jeho obrana proti mým tahům a porovná s tím, co zapsal
  async function verify(rev, fh, T, doc, getQ, ctx) {
    if (!rev || !rev.f || typeof rev.salt !== "string") return { ok: false, why: "chybí odhalení flotily" };
    const fleet = fleetFrom(rev.f);
    if (!fleet || !valid(fleet)) return { ok: false, why: "neplatná flotila" };
    if (await sha(rev.f + rev.salt) !== fh) return { ok: false, why: "flotila nesedí na závazek" };
    const r = await defend(fleet, T, {}, getQ, ctx);
    if (r.R !== doc.R) return { ok: false, why: "odpovědi na rány nesedí" };
    const key = a => a.map(c => [...c].sort((x, y) => x - y).join(",")).sort().join("|");
    if (key(r.S) !== key(doc.S || [])) return { ok: false, why: "potopené hračky nesedí" };
    const dk = d => JSON.stringify(Object.keys(d || {}).sort((a, b) => a - b).map(k => [k, d[k]]));
    if (dk(r.D) !== dk(doc.D)) return { ok: false, why: "radar nesedí" };
    return { ok: true };
  }

  root.Lode = { N, CELLS, SIZES, FLEET_CELLS, SALVO, WRONG, FAST_MS, ANSWER_MS, CATS, other, rc, at, around, shipCells, fits, conflicts, valid, randomFleet, fleetKey, fleetFrom, occupancy, resolve, radarArea, radarCount, seaView, sunkCount, hits, salvo, pickQuestion, shuffle4, flow, sha, answerHash, isPerm4, correctIndex, isCorrect, factKey, encryptFact, decryptFact, allowance, defend, verify,
    rngFrom, buoys, BUOYS, offeredCats, isWheel, wheelCat, TITLES, titleLevel, titleName, phaseOfTurn, maxDifficulty, minDifficulty, needsRescue, RESCUE_GAP, baseShots, buoyHits };
  if (typeof module !== "undefined") module.exports = root.Lode;
})(typeof globalThis !== "undefined" ? globalThis : this);
