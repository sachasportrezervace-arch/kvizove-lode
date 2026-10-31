// Sólo režim: jednoduchý bot „Robo-plavčík“ hraje za sedadlo o proti hráči x. Žádná síť, dokumenty jdou přes paměť (viz net.js `local`).
// Bot používá stejné pravidlové jádro jako lidský hráč: rozmístí náhodnou flotilu, vybírá obtížnost i kategorii, „odpovídá“ s přesností podle obtížnosti,
// střílí lovem po paritě a dobíjením kolem zásahu (logika z tests/balance.cjs) a na hráčovy rány odpovídá přes Lode.defend.
import { load, seatWriter, seatUrl, randId } from "./net.js";
import { FX } from "./pool.js";

const Lo = window.Lode;
export const BOT_NAME = "Robo-plavčík";
const ACC = { 1: .85, 2: .62, 3: .38 };               // přesnost odpovědí podle obtížnosti (průměrný hráč)
const READ = { 1: 4.5, 2: 7.5, 3: 11 };               // medián doby odpovědi v sekundách (z balance.cjs), odtud občas rychlá odpověď pod 7 s = radar
const rnd = n => Math.floor(Math.random() * n);
const choice = a => a[rnd(a.length)];
const lognormal = med => med * Math.exp(.45 * (Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())));
// pauzy se krátí s ?rychle=1; reduced-motion je nezkracuje, bot má být čitelný i tam
const wait = ms => new Promise(r => setTimeout(r, ms * FX.scale));

// Co bot vidí na hráčově moři: odpovědi obránce (R, S) a výsledky radarů (D). Bez znalosti flotily.
function knowledge(X, T) {
  const v = Lo.seaView(X.R && X.R.length === 64 ? X.R : ".".repeat(64), X.S || []), water = new Set(), hot = [];
  for (const [c, n] of Object.entries(X.D || {})) {
    const area = Lo.radarArea(+c), known = area.filter(j => v[j] === "h" || v[j] === "s").length, left = n - known;
    const cells = area.filter(j => v[j] === ".");
    if (left <= 0) cells.forEach(j => water.add(j)); else hot.push({ cells, left });
  }
  const mine = new Set(T.sh || []);
  const free = i => v[i] === "." && !water.has(i) && !mine.has(i);
  return { v, hot, free };
}
// další rána: dobíjení kolem zásahu (ve směru, když jsou aspoň dva), pak podezřelé oblasti z radaru, jinak lov po paritě
function nextShot(X, T) {
  const { v, hot, free } = knowledge(X, T), hits = [];
  v.forEach((c, i) => { if (c === "h") hits.push(i); });
  if (hits.length) {
    const cand = new Set();
    for (const i of hits) {
      const [r, c] = Lo.rc(i);
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => { const j = Lo.at(r + dr, c + dc); if (j >= 0 && free(j)) cand.add(j); });
    }
    const line = [...cand].filter(j => hits.some(h => hits.some(h2 => h2 !== h && ((Lo.rc(h2)[0] === Lo.rc(h)[0] && Lo.rc(h)[0] === Lo.rc(j)[0]) || (Lo.rc(h2)[1] === Lo.rc(h)[1] && Lo.rc(h)[1] === Lo.rc(j)[1])))));
    const pool = line.length ? line : [...cand];
    if (pool.length) return choice(pool);
  }
  for (const a of hot) { const c = a.cells.filter(free); if (c.length && a.left > 0) return choice(c); }
  const all = []; for (let i = 0; i < Lo.CELLS; i++) if (free(i)) all.push(i);
  const par = all.filter(i => (Lo.rc(i)[0] + Lo.rc(i)[1]) % 2 === 0);
  // každá pátá rána v lovu je jen tip: bot je hratelný, ne dokonalý
  return Math.random() < .2 || !par.length ? choice(all) : choice(par);
}
// střed radaru 3×3 s nejvíc neznámými poli; vrací null, když by radar nic nového neřekl
function radarCenter(X, T) {
  const { free } = knowledge(X, T);
  let best = [], bc = 1;
  for (let i = 0; i < Lo.CELLS; i++) { const c = Lo.radarArea(i).filter(free).length; if (c > bc) { bc = c; best = [i]; } else if (c === bc && best.length) best.push(i); }
  return best.length ? choice(best) : null;
}

// ctx: {id, g (dokument hra), QS, getQ}. Vrací {stop()}.
export function startBot(ctx) {
  const { id, g, QS, getQ } = ctx, n = g.n, seed = g.seed, seat = "o", opp = "x";
  let alive = true, fleet = Lo.randomFleet(), salt = randId(20), key = Lo.fleetKey(fleet), bw = null;
  const sunkOf = X => (X.S || []).length;
  const usedSet = X => { const s = new Set(g.used || []); for (const t of [...(X.T || []), ...(bw.doc().T || [])]) if (t && t.q) s.add(t.q); return s; };
  const minePenalty = idx => { const prev = (bw.doc().T || [])[idx - 1]; return !!prev && Lo.buoyHits(prev.sh, Lo.buoys(seed, opp), "mina").length > 0; };
  const putTurn = (k, t) => { const T = [...(bw.doc().T || [])]; T[k >> 1] = t; bw.set({ T }, true); };

  async function setReady() {
    const fh = await Lo.sha(key + salt);
    // nezačínající vybírá první kategorii hráči, začínající nechá c0 prázdné (to vybírá hráč botovi)
    const c0 = g.s === seat ? "" : choice(Lo.offeredCats(seed, 0, ""));
    bw.set({ n, fh, ready: true, c0, T: [], R: ".".repeat(64), S: [], K: [], D: {}, rev: null }, true);
  }

  async function step() {
    const raw = await load(seatUrl(id, opp)), X = raw && raw.n === n ? raw : {};
    if (!bw.doc().ready) { await wait(500 + rnd(400)); if (alive) await setReady(); return; }
    // obrana: odpovědi na hráčovy rány
    const r = await Lo.defend(fleet, X.T || [], bw.doc(), getQ, { seed, seat });
    if (r.changed) bw.set({ R: r.R, S: r.S, K: r.K, D: r.D }, true);
    const F = Lo.flow({ x: X, o: bw.doc() }, g.s, { seed });
    if (F.kind === "end") { if (!bw.doc().rev) bw.set({ rev: { f: key, salt } }, true); return; }
    if (F.kind !== "pick" && F.kind !== "answer" && F.kind !== "shoot") return;
    if (F.who !== seat) return;
    const idx = F.k >> 1, phase = Lo.phaseOfTurn(idx, sunkOf(X));

    if (F.kind === "pick") {
      await wait(800 + rnd(700)); if (!alive) return;
      const w = Math.random(), want = w < .25 ? 1 : w < .75 ? 2 : 3;
      const d = Math.min(Lo.maxDifficulty(phase), Math.max(Lo.minDifficulty(phase), want));
      const cat = Lo.CATS.includes(F.cat) ? F.cat : choice(Lo.CATS);
      const q = Lo.pickQuestion(QS, cat, d, usedSet(X));
      const t = { d, q: q.id, o: Lo.shuffle4(), t0: Date.now(), a: null, ms: 0, ok: null, n: 0, sh: [], r: null, r2: null, nc: null };
      if (Lo.needsRescue(Lo.hits(bw.doc().R), Lo.hits(X.R)) && phase !== "finale") t.rs = 1;
      putTurn(F.k, t);
      return;
    }

    if (F.kind === "answer") {
      const t = F.T, q = getQ(t.q), cj = await Lo.correctIndex(q, t.o);
      const ok = cj >= 0 && Math.random() < ACC[t.d];
      let ms = Math.max(1500, Math.min(Lo.ANSWER_MS, lognormal(READ[t.d]) * 1000));
      if (!ok && Math.random() < .18) ms = Lo.ANSWER_MS;                  // část špatných odpovědí je vypršený čas
      await wait(Math.min(3800, 700 + ms * .3)); if (!alive) return;     // skutečná pauza je kratší než zapsaná doba odpovědi
      const a = ok ? cj : ms >= Lo.ANSWER_MS ? -1 : choice([0, 1, 2, 3].filter(j => j !== cj));
      const shots = Lo.baseShots(t, ok, { phase, pen: minePenalty(idx) });
      putTurn(F.k, { ...t, a, ms: Math.round(ms), ok, n: shots });
      return;
    }

    // střelba: počkat na odpověď obránce, radar, rány po jedné s pauzou, nakonec kategorie pro hráče
    if (F.pending.length || F.pendingRadar) return;
    const t = F.T, radarSlot = t.ok && Number.isFinite(t.ms) && t.ms <= Lo.FAST_MS && (t.r === null || t.r === undefined) ? "r" : F.sonar && (t.r2 === null || t.r2 === undefined) ? "r2" : null;
    if (radarSlot) {
      const c = radarCenter(X, t);
      if (c !== null) { await wait(500 + rnd(300)); if (alive) putTurn(F.k, { ...t, [radarSlot]: c }); return; }
    }
    if (F.left > 0) {
      await wait(600 + rnd(300)); if (!alive) return;
      putTurn(F.k, { ...t, sh: [...(t.sh || []), nextShot(X, t)] });
      return;
    }
    await wait(600 + rnd(400)); if (!alive) return;
    const nc = Lo.isWheel(F.k + 1) ? Lo.wheelCat(seed, F.k + 1, F.prevCat || "") : choice(Lo.offeredCats(seed, F.k + 1, F.prevCat || ""));
    putTurn(F.k, { ...t, nc });
  }

  (async () => {
    bw = seatWriter(id, seat, { n, ready: false, T: [], R: ".".repeat(64), S: [], K: [], D: {}, rev: null });
    while (alive) {
      try { await step(); } catch (e) { console.warn("bot", e); }
      await wait(150);
    }
  })();
  return { stop() { alive = false; if (bw) bw.stop(); } };
}
