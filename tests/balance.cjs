// Simulace vyvážení: node tests/balance.cjs [počet partií na scénář]
// Dva boti hrají celou partii podle pravidel z engine.js (flotila, resolve, radar, salva). Střelba: lov po paritě + dobíjení kolem zásahu,
// radar využívá. Kvíz je modelovaný přesností podle obtížnosti (výchozí hráč 85/62/38 %) a dobou odpovědi.
// Cíl (SPEC): partie 8–15 min, kvíz pomáhá, ale sám nerozhoduje (lepší kvízař vyhraje zhruba 58–72 %).
const L = require("../engine.js");

const N = +(process.argv[2] || 3000);
const seeded = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rnd = seeded(20261031);
const ri = n => Math.floor(rnd() * n);

// ---- časy v sekundách (odhad dle SPEC: 20 s na odpověď, radar do 7 s, let balonku 0,6 s, dotazování 0,35 s, zápis ~0,15 s)
const TIME = {
  setup: 75,            // rozmístění + výběr první kategorie, oba hrají souběžně
  pick: 2.0,            // přečtení a volba obtížnosti
  read: { 1: 4.5, 2: 7.5, 3: 11 },   // medián doby, než hráč odpoví (lognormálně)
  reveal: 1.6,          // zpětná vazba k odpovědi, než se začne střílet
  aim: 1.8, flight: 0.6, sync: 0.5, anim: 0.5,   // na jednu ránu: zamíření, let, odezva obránce, animace
  radar: 3.2,           // klepnutí na Radar a do bazénu + odezva
  cat: 2.5,             // výběr kategorie soupeři
  net: 1.2,             // zápisy a dotazování mezi kroky (pick, odpověď, kategorie)
};
const lognormal = med => med * Math.exp(0.45 * (Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd())));

// ---- střelec
function makeShooter() {
  const R = ".".repeat(64).split(""), S = [], hot = [], water = new Set();
  const view = () => L.seaView(R.join(""), S);
  const unknown = v => { const u = []; v.forEach((c, i) => { if (c === "." && !water.has(i)) u.push(i); }); return u; };
  function next() {
    const v = view(), nb = [];
    const hits = []; v.forEach((c, i) => { if (c === "h") hits.push(i); });
    if (hits.length) {                                            // dobíjení: sousedé zásahů (ve směru, pokud jsou aspoň dva)
      const cand = new Set();
      for (const i of hits) {
        const [r, c] = L.rc(i);
        [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => { const j = L.at(r + dr, c + dc); if (j >= 0 && v[j] === "." && !water.has(j)) cand.add(j); });
      }
      const line = [...cand].filter(j => hits.some(h => { const a = L.rc(h), b = L.rc(j); return hits.some(h2 => h2 !== h && ((L.rc(h2)[0] === a[0] && a[0] === b[0]) || (L.rc(h2)[1] === a[1] && a[1] === b[1]))); }));
      const pool = line.length ? line : [...cand];
      if (pool.length) return pool[ri(pool.length)];
    }
    for (const a of hot) { const c = a.cells.filter(i => v[i] === "." && !water.has(i)); if (c.length && a.left > 0) return c[ri(c.length)]; }
    const u = unknown(v), par = u.filter(i => (L.rc(i)[0] + L.rc(i)[1]) % 2 === 0);
    // nejmenší zbývající loď: kachna (2) – parita platí; po potopení kachny stačí šachovnice po 3 (zde stále parita)
    const pool = par.length ? par : u;
    return pool[ri(pool.length)];
  }
  function radarTarget() {                                         // střed 3×3 s nejvíc neznámými poli
    const v = view(); let best = [], bc = -1;
    for (let i = 0; i < 64; i++) { const c = L.radarArea(i).filter(j => v[j] === "." && !water.has(j)).length; if (c > bc) { bc = c; best = [i]; } else if (c === bc) best.push(i); }
    return best[ri(best.length)];
  }
  function radarResult(i, count) {
    const v = view(), area = L.radarArea(i);
    const known = area.filter(j => v[j] === "h" || v[j] === "s").length, left = count - known;
    const cells = area.filter(j => v[j] === "." && !water.has(j));
    if (left <= 0) cells.forEach(j => water.add(j)); else hot.push({ cells, left });
  }
  return { R, S, next, radarTarget, radarResult, view };
}

// ---- volba obtížnosti
const STRAT = {
  lehka: () => 1, stredni: () => 2, tezka: () => 3,
  nahodne: () => 1 + ri(3),
  ev: ctx => { const ev = d => ctx.acc[d] * L.SALVO[d] + (1 - ctx.acc[d]) * L.WRONG; return [1, 2, 3].sort((a, b) => ev(b) - ev(a))[0]; },
  // chytře: počítá střední počet ran a při zaostávání riskuje těžkou, při vedení bere jistotu
  chytre: ctx => {
    const ev = d => ctx.acc[d] * L.SALVO[d] + (1 - ctx.acc[d]) * L.WRONG + (d === 1 ? 0 : 0);
    const best = [1, 2, 3].sort((a, b) => ev(b) - ev(a))[0];
    if (ctx.behind >= 2 && best < 3) return best + 1;
    if (ctx.behind <= -3 && best > 1) return best - 1;
    return best;
  },
};

function play(pa, pb, startA = true) {
  // pa, pb = { acc:{1,2,3}, strat }; hráč 0 začíná, když startA
  const P = [pa, pb], fleet = [L.randomFleet(rnd), L.randomFleet(rnd)];
  const sh = [makeShooter(), makeShooter()];            // sh[i] = pohled hráče i na moře soupeře (R[i] = odpovědi soupeře i^1)
  let secs = TIME.setup, turns = 0, who = startA ? 0 : 1, shots = [0, 0], correct = [0, 0], asked = [0, 0], radars = 0;
  for (;;) {
    const me = who, op = 1 - who, s = sh[me], p = P[me];
    turns++; asked[me]++;
    const behind = (L.hits(sh[op].R.join("")) - L.hits(s.R.join(""))) * 1;   // kolik zásahů soupeř vede
    const d = STRAT[p.strat]({ acc: p.acc, behind });
    secs += TIME.pick + TIME.net;
    const ok = rnd() < p.acc[d];
    let ms = Math.min(L.ANSWER_MS, lognormal(TIME.read[d]) * 1000);
    if (!ok && rnd() < 0.18) ms = L.ANSWER_MS;           // část špatných odpovědí je vypršený čas
    secs += ms / 1000 + TIME.reveal;
    if (ok) correct[me]++;
    let n = L.salvo(d, ok);
    const radar = ok && ms <= L.FAST_MS;
    if (radar) {
      const c = s.radarTarget(); radars++;
      s.radarResult(c, L.radarCount(fleet[op], c)); secs += TIME.radar;
    }
    for (let k = 0; k < n; k++) {
      const i = s.next();
      shots[me]++;
      const res = L.resolve(fleet[op], s.R.join(""), i);
      if (res.r === "s") { res.cells.forEach(j => s.R[j] = "s"); s.S.push(res.cells); } else s.R[i] = res.r;
      secs += TIME.aim + TIME.flight + TIME.sync + TIME.anim;
      if (s.S.length === L.SIZES.length) return { winner: me, turns, secs, shots, correct, asked, radars };
    }
    secs += TIME.cat + TIME.net;
    who = op;
    if (turns > 400) throw new Error("partie neskončila");
  }
}

const AVG = { 1: .85, 2: .62, 3: .38 }, PRO = { 1: .93, 2: .78, 3: .55 }, WEAK = { 1: .75, 2: .48, 3: .25 };
const fmt = x => x.toFixed(1);
function scenario(name, A, B, n = N) {
  let winsA = 0, winsStart = 0, turns = 0, secs = 0, secsMin = Infinity, secsMax = 0, over15 = 0, under8 = 0, shots = 0;
  const times = [];
  for (let i = 0; i < n; i++) {
    const startA = i % 2 === 0;
    const r = play(A, B, startA);
    if (r.winner === 0) winsA++;
    if ((r.winner === 0) === startA) winsStart++;
    turns += r.turns; secs += r.secs; shots += r.shots[0] + r.shots[1]; times.push(r.secs / 60);
    if (r.secs / 60 > 15) over15++; if (r.secs / 60 < 8) under8++;
  }
  times.sort((a, b) => a - b);
  const row = { name, winA: (100 * winsA / n), start: (100 * winsStart / n), turns: turns / n, shots: shots / n, min: secs / n / 60, p10: times[Math.floor(n * .1)], p90: times[Math.floor(n * .9)], over15: 100 * over15 / n, under8: 100 * under8 / n };
  console.log(`${name.padEnd(40)} A vyhrává ${fmt(row.winA).padStart(5)} %   začínající ${fmt(row.start).padStart(5)} %   tahů ${fmt(row.turns).padStart(5)}   ran ${fmt(row.shots).padStart(5)}   ${fmt(row.min).padStart(5)} min (p10 ${fmt(row.p10)}, p90 ${fmt(row.p90)}; <8 min ${fmt(row.under8)} %, >15 min ${fmt(row.over15)} %)`);
  return row;
}

console.log(`Simulace ${N} partií na scénář; hráč A vs B; střelba: parita + dobíjení + radar.\n`);
console.log("Délka partie a výchozí vyvážení (oba průměrní: 85/62/38 %)");
const base = scenario("průměr × průměr, oba chytře", { acc: AVG, strat: "chytre" }, { acc: AVG, strat: "chytre" });
console.log("\nStrategie volby obtížnosti (A zkouší strategii, B hraje chytře, oba průměrní)");
const strats = {};
for (const st of ["lehka", "stredni", "tezka", "nahodne", "ev", "chytre"]) strats[st] = scenario(`A = ${st}`, { acc: AVG, strat: st }, { acc: AVG, strat: "chytre" });
console.log("\nKolik dá lepší kvízař (A: 93/78/55 vs. B průměr 85/62/38; oba chytře)");
const better = scenario("lepší kvízař × průměr", { acc: PRO, strat: "chytre" }, { acc: AVG, strat: "chytre" });
const worse = scenario("průměr × slabší kvízař (75/48/25)", { acc: AVG, strat: "chytre" }, { acc: WEAK, strat: "chytre" });
const big = scenario("velký rozdíl: 93/78/55 × 75/48/25", { acc: PRO, strat: "chytre" }, { acc: WEAK, strat: "chytre" });
console.log("\nKolik dá kvíz samotný: znalec a nadlidský vševěd (100 % správně, vždy nejlepší obtížnost) × průměrný hráč (pravidla v1; bójky, rozcvička a finále v2 se v simulaci nemodelují)");
const znalec = scenario("znalec (96/85/65) × průměr", { acc: { 1: .96, 2: .85, 3: .65 }, strat: "chytre" }, { acc: AVG, strat: "chytre" });
const extreme = scenario("vševěd (100 %, jen pro představu)", { acc: { 1: 1, 2: 1, 3: 1 }, strat: "chytre" }, { acc: AVG, strat: "chytre" });

console.log("\nShrnutí");
const inRange = base.min >= 8 && base.min <= 15;
console.log(`Průměrná délka: ${fmt(base.min)} min ${inRange ? "(v cíli 8–15 min)" : "(MIMO cíl 8–15 min)"}, průměrně ${fmt(base.turns)} tahů celkem, ${fmt(base.shots)} ran.`);
console.log(`Lepší kvízař vyhrává ${fmt(better.winA)} % (velký rozdíl ${fmt(big.winA)} %); znalec proti průměrnému hráči ${fmt(znalec.winA)} % (nadlidský vševěd ${fmt(extreme.winA)} %); kdo začíná, vyhrává ${fmt(base.start)} % (v odvetě začíná poražený).`);
const okBalance = better.winA >= 58 && better.winA <= 72 && big.winA <= 85 && znalec.winA <= 88 && strats.stredni.winA > strats.lehka.winA && strats.stredni.winA > strats.tezka.winA;
console.log(okBalance ? "Vyvážení OK: kvíz pomáhá, ale sám nerozhoduje; střední obtížnost je nejlepší volba, lehká i těžká jsou ústupek nebo riziko." : "Vyvážení MIMO: upravit SALVO / WRONG v engine.js.");
process.exit(inRange && okBalance ? 0 : 1);
