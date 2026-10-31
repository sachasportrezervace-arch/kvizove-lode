// Nafukovací flotila – aplikace: pohledy, synchronizace, tahy, obránce, odveta.
// Protokol dokumentů viz docs/SPEC.md (hra = místnost, x / o = dokumenty hráčů, každý má jednoho zapisovatele).
import { load, save, store, device, randId, commitRoom, seatWriter, roomUrl, seatUrl } from "./net.js";
import { COL, CAT, catIcon, icon, swimmerSVG, balloonSVG, INK, toyG, missMark, hitMark, buoyIcon } from "./art.js";
import { Pool, FX, sleep, coord } from "./pool.js";

const Lo = window.Lode;
const $ = id => document.getElementById(id);
const other = Lo.other;
const params = new URLSearchParams(location.search);
if (params.get("rychle")) FX.scale = .12;
FX.reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const attempt = (f, fb) => { try { return f(); } catch { return fb; } };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TITLE = "Nafukovací flotila";
const DIFF = { 1: "lehká", 2: "střední", 3: "těžká" };
const rnd = n => Math.floor(Math.random() * n);

// ---------------------------------------------------------------- sázky
const STAKES = {
  1: { t: "Kdo prohraje, platí kafe.", r: (w, l) => `${l} platí kafe.` },
  2: { t: "Vítěz vybírá místo na rande.", r: (w) => `${w} vybírá místo na rande.` },
  3: { t: "Kdo prohraje, zve na zmrzlinu.", r: (w, l) => `${l} zve na zmrzlinu.` },
  4: { t: "Vítěz vybírá film na večer.", r: (w) => `${w} vybírá film na večer.` },
  5: { t: "Kdo prohraje, pravdivě odpoví na jednu otázku.", r: (w, l) => `${l} pravdivě odpoví na jednu otázku.` },
  6: { t: "Jen o čest.", r: (w) => `Vítězí ${w}.` },
};
const stakeText = g => g.k === "c" && g.kc ? g.kc : (STAKES[g.k] || STAKES[6]).t;
const stakeResult = (g, w, l) => g.k === "c" && g.kc ? `Sázka: ${g.kc}` : (STAKES[g.k] || STAKES[6]).r(w, l);

// ---------------------------------------------------------------- stav
let QS = [], QBY = new Map();
let room = null;                 // {id, v, g, sx, so}
let me = null;                   // "x" | "o" | null (přihlížím)
let writer = null;               // zapisovač mého dokumentu
const docs = { x: null, o: null }; // naposledy načtené dokumenty (u mého sedadla platí writer.doc())
let fleetRec = null;             // {fleet, key, salt} moje flotila v této partii (jen v localStorage)
let view = "info", busy = false, gameKey = "", placeStage = "place";
let pools = {}, poolInit = {};
let pollT = null, pollSeq = 0, lastRoomPoll = 0, fails = 0, lastChange = Date.now();
let radarArmed = false, cardOpen = false, cardState = null, defending = false, defendAgain = false;
let panelKey = "", seenAt = new Map(), verifyKey = "", verdict = null, moodFx = { x: null, o: null };
let tickT = null, netMsg = "";

const getQ = id => QBY.get(id);
const qid = x => x && x.q;
const nameOf = seat => room ? room.g[seat] : "";
const myNameOpp = () => me ? nameOf(other(me)) : "";
const g = () => room.g;
const freeSeat = () => !room ? null : !room.sx ? "x" : !room.so ? "o" : null;

function fresh(n) { return { n, fh: "", ready: false, c0: "", T: [], R: ".".repeat(64), S: [], K: [], D: {}, rev: null }; }
function docOf(seat) {
  if (!room) return {};
  const d = seat === me && writer ? writer.doc() : docs[seat];
  return d && d.n === room.g.n ? d : {};
}
const PP = () => ({ x: docOf("x"), o: docOf("o") });
const seedCtx = seat => ({ seed: room && room.g.seed || "", seat });
const safeFlow = () => { try { return room ? Lo.flow(PP(), room.g.s, seedCtx()) : null; } catch { return null; } };
const viewOf = d => ({ R: d.R && d.R.length === 64 ? d.R : ".".repeat(64), S: d.S || [], K: d.K || [], D: d.D || {} });
const usedSet = () => { const s = new Set(g().used || []); for (const p of ["x", "o"]) (docOf(p).T || []).forEach(t => t && t.q && s.add(t.q)); return s; };
const seriesScore = () => {
  const w = [...g().w], F = safeFlow();
  if (F && F.kind === "end") w[F.winner === "x" ? 0 : 1]++;
  return w;
};

// ---------------------------------------------------------------- pohledy
function setView(v) {
  view = v;
  ["setup", "share", "intro", "info", "game"].forEach(id => $(id).hidden = id !== v);
  document.body.dataset.view = v;
  $("newGameBtn").hidden = v === "setup" || v === "info";
  $("copyTopBtn").hidden = !(room && (v === "game" || v === "share"));
  window.scrollTo(0, 0);
  updateTitle();
}
function info(title, meta, retry) {
  $("infoTitle").textContent = title; $("infoMeta").textContent = meta || ""; $("infoMeta").hidden = !meta;
  $("infoRetry").hidden = !retry; setView("info");
}
let toastT = null;
function toast(text) { const t = $("toast"); t.textContent = text; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3200); }
const linkFor = () => location.origin + location.pathname + "#r." + room.id;
async function copy(text, done) {
  try { await navigator.clipboard.writeText(text); toast(done); } catch { window.prompt("Zkopíruj si to:", text); }
}
function updateTitle() {
  let t = TITLE;
  if (view === "game" && room && me) {
    const ph = phase();
    if (["pick-me", "answer-me", "shoot-me", "cat0"].includes(ph.name)) t = "Jsi na tahu · " + TITLE;
    else if (ph.name === "place") t = "Rozmísti flotilu · " + TITLE;
    else if (ph.name === "end") t = (ph.win ? "Vyhráváš · " : "Prohráváš · ") + TITLE;
  }
  if (document.title !== t) document.title = t;
}

// ---------------------------------------------------------------- fáze hry z dokumentů
function phase() {
  const F = safeFlow(), mine = me ? docOf(me) : {};
  if (!F) return { name: "none", F };
  if (F.kind === "setup") {
    if (!me) return { name: "spec-setup", F };
    if (!mine.ready) return { name: placeStage === "cat" ? "cat0" : "place", F };
    return { name: "wait-setup", F };
  }
  if (F.kind === "end") return { name: "end", F, win: me ? F.winner === me : null };
  if (!me) return { name: "spec", F };
  const mineTurn = F.who === me;
  if (F.kind === "pick") return { name: mineTurn ? "pick-me" : "pick-opp", F };
  if (F.kind === "answer") return { name: mineTurn ? "answer-me" : "answer-opp", F };
  if (F.kind === "shoot") return { name: mineTurn ? "shoot-me" : "shoot-opp", F };
  return { name: "none", F };
}

// ---------------------------------------------------------------- start
async function boot() {
  const seq = ++bootSeq;
  clearTimeout(pollT); stopTick();
  room = null; me = null; writer = null; fleetRec = null; busy = false; gameKey = ""; poolInit = {}; pools = {}; docs.x = docs.o = null; fails = 0;
  $("pools").innerHTML = "";
  if (!QS.length) {
    try { QS = await (await fetch("data/otazky.json", { cache: "no-cache" })).json(); QBY = new Map(QS.map(q => [q.id, q])); }
    catch { info("Otázky se nepodařilo načíst.", "Zkontroluj připojení a zkus to znovu.", true); return; }
  }
  const h = (location.hash || "").replace(/^#/, ""), m = /^r\.([0-9a-z]{6,24})$/.exec(h);
  if (m) await openRoom(m[1], seq); else showSetup();
}
let bootSeq = 0;
async function openRoom(id, seq) {
  info("Otevírám hru…", "", false);
  let d;
  try { d = await load(roomUrl(id)); } catch { if (seq === bootSeq) info("Hru se nepodařilo načíst.", "Zkontroluj připojení a zkus to znovu.", true); return; }
  if (seq !== bootSeq) return;
  if (!d || !d.g || !d.g.x || !d.g.o) { info("Tahle hra tu není.", "Odkaz je špatně zkopírovaný, nebo hra vypršela.", false); return; }
  room = { id, v: d.v || 0, g: d.g, sx: d.sx || "", so: d.so || "" };
  const saved = store.get("kl-r-" + id);
  me = saved === "x" || saved === "o" ? saved : room.sx === device ? "x" : room.so === device ? "o" : null;
  if (!me && freeSeat()) { renderIntro(); setView("intro"); return; }
  await enterGame();
}

// ---------------------------------------------------------------- založení výzvy
function drawHero() {
  const h = $("heroSvg"); if (h.dataset.done) return; h.dataset.done = "1";
  let grid = ""; for (let i = 1; i < 8; i++) grid += `<path d="M${16 + i * 41}.0 16v118M16 ${16 + i * 29.5}h328"/>`;
  h.innerHTML = `<rect x="6" y="6" width="348" height="138" rx="24" fill="${COL.coping}" stroke="${INK}" stroke-width="2.5"/><rect x="16" y="16" width="328" height="118" rx="14" fill="${COL.water}"/><g stroke="#fff" stroke-opacity=".26" stroke-width="1.6">${grid}</g>
    <g transform="translate(30 22)">${toyG(0, false)}</g><g transform="translate(222 24) rotate(4 63 21)">${toyG(1, false)}</g><g transform="translate(34 84) rotate(-3 63 21)">${toyG(2, false)}</g><g transform="translate(206 86)">${toyG(3, false)}</g>
    <g transform="translate(150 96) scale(.0)"></g>${missMark(300, 100)}${missMark(180, 70)}${hitMark(130, 62)}
    <path d="M272 112q8 -6 16 0" stroke="#fff" stroke-opacity=".55" stroke-width="2" fill="none"/>`;
}
function showSetup() {
  drawHero();
  room = null; me = null;
  if (!$("nameX").value) $("nameX").value = store.get("kl-name") || "";
  $("customWrap").hidden = $("stakeSel").value !== "c";
  renderRecent();
  setView("setup");
}
function recentRooms() { return attempt(() => JSON.parse(store.get("kl-rooms") || "[]"), []).filter(r => r && /^[0-9a-z]{6,24}$/.test(r.id)); }
function remember() {
  if (!room) return;
  const list = recentRooms().filter(r => r.id !== room.id);
  list.unshift({ id: room.id, x: room.g.x, o: room.g.o, me });
  store.set("kl-rooms", JSON.stringify(list.slice(0, 5)));
}
function renderRecent() {
  const list = recentRooms();
  $("recent").hidden = !list.length;
  $("recentList").innerHTML = list.map(r => `<a class="recent-item" href="#r.${r.id}"><b>${esc(r.x)} × ${esc(r.o)}</b><span>${r.me ? "hraješ jako " + esc(r.me === "x" ? r.x : r.o) : "přihlížíš"}</span></a>`).join("");
}
for (const sid of ["starterSeg", "genderSeg", "introGenderSeg"]) $(sid).addEventListener("click", e => {
  const b = e.target.closest("button[data-v]"); if (!b) return;
  $(sid).querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
});
$("nameO").addEventListener("input", () => { $("starterO").textContent = $("nameO").value.trim() || "Soupeř"; });
$("stakeSel").addEventListener("change", () => { $("customWrap").hidden = $("stakeSel").value !== "c"; });
$("setupForm").addEventListener("submit", async ev => {
  ev.preventDefault();
  const x = $("nameX").value.trim().slice(0, 16), o = $("nameO").value.trim().slice(0, 16);
  if (!x || !o || busy) return;
  store.set("kl-name", x);
  let k = $("stakeSel").value, kc = "";
  if (k === "c") { kc = $("stakeCustom").value.trim().slice(0, 40); if (!kc) k = "6"; }
  const s = $("starterSeg").querySelector('[aria-pressed="true"]').dataset.v;
  const gg = { x, o, s, w: [0, 0], k, kc, c: $("setupNote").value.trim().slice(0, 60), n: 1, used: [], seed: randId(10), gx: $("genderSeg").querySelector('[aria-pressed="true"]').dataset.v, go: "m" };
  busy = true; $("setupSubmit").disabled = true;
  const id = randId(12), d = { app: "kl", g: gg, v: 1, sx: device, so: "" };
  try { await save(roomUrl(id), d); } catch { busy = false; $("setupSubmit").disabled = false; toast("Hru se nepodařilo založit. Zkontroluj připojení a zkus to znovu."); return; }
  busy = false; $("setupSubmit").disabled = false;
  room = { id, v: 1, g: gg, sx: device, so: "" }; me = "x"; store.set("kl-r-" + id, "x");
  history.replaceState(null, "", location.pathname + location.search + "#r." + id);
  remember(); renderShare(); setView("share");
});
function renderShare() {
  const gg = g(), link = linkFor();
  $("msg").value = `${gg.x} tě vyzývá na Nafukovací flotilu: lodě s kvízem, hraje se přímo v prohlížeči. ${stakeText(gg)}${gg.c ? " " + gg.c : ""} Odkaz: ${link}`;
  $("shareBtn").hidden = !navigator.share;
}
$("copyBtn").addEventListener("click", () => copy($("msg").value, "Zkopírováno, vlož to do chatu"));
$("copyLinkBtn").addEventListener("click", () => copy(linkFor(), "Odkaz je zkopírovaný"));
$("copyTopBtn").addEventListener("click", () => copy(linkFor(), "Odkaz je zkopírovaný"));
$("shareBtn").addEventListener("click", () => attempt(() => navigator.share({ title: TITLE, text: $("msg").value.replace(/ Odkaz:.*$/, ""), url: linkFor() })));
$("backBtn").addEventListener("click", () => enterGame());

// ---------------------------------------------------------------- výzva u soupeře
function renderIntro() {
  const gg = g();
  $("introTitle").textContent = `${gg.x} tě vyzývá`;
  $("introStake").textContent = stakeText(gg);
  $("introNote").textContent = gg.c ? `„${gg.c}“` : ""; $("introNote").hidden = !gg.c;
  $("introWho").textContent = `Hraješ jako ${gg.o}`;
}
$("acceptBtn").addEventListener("click", async () => {
  if (busy) return; busy = true; $("acceptBtn").disabled = true;
  try {
    const go = $("introGenderSeg").querySelector('[aria-pressed="true"]').dataset.v;
    const r = await commitRoom(room.id, d => d && !d.so ? { ...d, so: device, g: { ...d.g, go } } : null);
    busy = false; $("acceptBtn").disabled = false;
    if (!r.ok) { toast("Výzvu už přijal někdo jiný. Můžeš přihlížet."); if (r.d) { room = { id: room.id, v: r.d.v || 0, g: r.d.g, sx: r.d.sx || "", so: r.d.so || "" }; } me = null; await enterGame(); return; }
    room = { id: room.id, v: r.d.v, g: r.d.g, sx: r.d.sx, so: r.d.so }; me = "o"; store.set("kl-r-" + room.id, "o");
    await enterGame();
  } catch { busy = false; $("acceptBtn").disabled = false; toast("Spojení nevyšlo, zkus to znovu."); }
});
$("watchBtn").addEventListener("click", () => { me = null; store.set("kl-r-" + room.id, "-"); enterGame(); });

// ---------------------------------------------------------------- vstup do hry
async function enterGame() {
  setView("game");
  await initGame();
  remember();
  schedulePoll(0);
}
function buildPools() {
  const ph = $("pools"); ph.innerHTML = "";
  pools = {};
  for (const seat of ["x", "o"]) {
    const p = new Pool({ owner: seat, mine: seat === me, name: nameOf(seat) });
    p.onEvent = onPoolEvent; p.setBuoys(Lo.buoys(room.g.seed || "", seat));
    pools[seat] = p; ph.appendChild(p.wrap);
  }
  assignRoles();
}
function assignRoles() {
  for (const seat of ["x", "o"]) {
    const p = pools[seat], isMine = seat === me;
    p.mine = isMine;
    p.wrap.id = !me ? "pw" + seat.toUpperCase() : isMine ? "pwMine" : "pwEnemy";
    p.wrap.className = "pw " + (!me ? "spec" : isMine ? "mine" : "enemy") + (p.wrap.classList.contains("aim") ? " aim" : "") + (p.wrap.classList.contains("placing") ? " placing" : "");
    p.name = nameOf(seat);
    let cap = p.wrap.querySelector(".pcap");
    if (!cap) { cap = document.createElement("div"); cap.className = "pcap"; p.wrap.appendChild(cap); }
    cap.textContent = !me ? `Bazén: ${nameOf(seat)}` : isMine ? "Tvůj bazén" : `Bazén: ${nameOf(seat)}`;
    p.paintCells();
  }
}
async function initGame() {
  const id = room.id, n = g().n;
  gameKey = id + "|" + n; poolInit = {}; seenAt.clear(); verdict = null; verifyKey = ""; cardOpen = false; cardState = null; radarArmed = false; placeStage = "place"; panelKey = "";
  buildPools();
  let mine = fresh(n);
  if (me) {
    const [dx, dox] = await Promise.all([load(seatUrl(id, "x")).catch(() => null), load(seatUrl(id, "o")).catch(() => null)]);
    docs.x = dx; docs.o = dox;
    const remote = me === "x" ? dx : dox;
    if (remote && remote.n === n) mine = { ...fresh(n), ...remote };
    writer = seatWriter(id, me, mine);
    writer.onNet = m => { netMsg = m; renderStatusLine(); };
    fleetRec = attempt(() => { const r = JSON.parse(store.get(`kl-fleet-${id}-${n}-${me}`) || "null"); const f = r && Lo.fleetFrom(r.f); return f && Lo.valid(f) ? { fleet: f, key: r.f, salt: r.salt } : null; }, null);
    if (fleetRec) pools[me].setFleet(fleetRec.fleet);
    if (fleetRec && !mine.ready) { placeStage = "cat"; if (g().s === me) await submitReady(""); }
    else if (!fleetRec && !mine.ready) startPlacing();
  } else {
    writer = null;
    const [dx, dox] = await Promise.all([load(seatUrl(id, "x")).catch(() => null), load(seatUrl(id, "o")).catch(() => null)]);
    docs.x = dx; docs.o = dox;
  }
  for (const seat of ["x", "o"]) { pools[seat].reset(viewOf(docOf(seat))); poolInit[seat] = true; }
  syncPools(); renderAll(true); runDefense();
}
function startPlacing() {
  const p = pools[me], f = Lo.randomFleet();
  p.startPlacement(f, () => renderPanelState());
}

// ---------------------------------------------------------------- synchronizace bazénů
function syncPools() {
  if (!room) return;
  for (const seat of ["x", "o"]) {
    const p = pools[seat]; if (!p) continue;
    const shooter = other(seat), order = (docOf(shooter).T || []).flatMap(t => t && t.sh || []);
    const v = viewOf(docOf(seat));
    if (!poolInit[seat]) { p.reset(v); poolInit[seat] = true; continue; }
    p.apply(v, { order, origin: () => swimmerPoint(shooter), color: shooter === "x" ? COL.x : COL.o });
  }
}
function swimmerPoint(seat) {
  const e = document.querySelector(`#people .sw[data-seat="${seat}"]`); if (!e) return null;
  const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * .55 };
}
const BUOY_TEXT = {
  poklad: ["Poklad! +1 rána navíc.", "Trefil poklad, má ránu navíc."],
  radar: ["Sonar! Radar zdarma.", "Trefil sonar, má radar zdarma."],
  mina: ["Ježek! Příští salva bude o ránu kratší.", "Trefil ježka, příště má o ránu méně."],
};
function onPoolEvent(ev) {
  const owner = ev.owner, shooter = other(owner);
  if (ev.kind === "buoy") {
    const t = BUOY_TEXT[ev.type]; if (!t) return;
    toast(me === shooter ? t[0] : `${nameOf(shooter)}: ${t[1].replace(/^Trefil /, female(shooter) ? "Trefila " : "Trefil ")}`);
    document.body.dataset.buoy = ev.type; setTimeout(() => { delete document.body.dataset.buoy; }, 900);
    return;
  }
  const until = Date.now() + (ev.kind === "sunk" ? 2600 : 1500);
  if (ev.kind === "hit") { moodFx[owner] = { m: "shock", until }; moodFx[shooter] = { m: "smirk", until }; }
  else if (ev.kind === "sunk") { moodFx[owner] = { m: "worry", until }; moodFx[shooter] = { m: "win", until }; }
  else if (ev.kind === "miss") { moodFx[shooter] = { m: "worry", until: Date.now() + 900 }; }
  renderPeople(); setTimeout(renderPeople, until - Date.now() + 30);
}

// ---------------------------------------------------------------- obránce: odpovídá na soupeřovy rány
async function runDefense() {
  if (!me || !fleetRec || !writer) return;
  if (defending) { defendAgain = true; return; }
  defending = true;
  try {
    do {
      defendAgain = false;
      const opp = docOf(other(me)), mine = writer.doc();
      if (mine.n !== room.g.n || !mine.ready) continue;
      const r = await Lo.defend(fleetRec.fleet, opp.T || [], mine, getQ, seedCtx(me));
      if (r.changed) { writer.set({ R: r.R, S: r.S, K: r.K, D: r.D }, true); syncPools(); renderAll(); }
    } while (defendAgain);
    // konec partie: odhalit flotilu, ať ji soupeř může ověřit
    const F = safeFlow();
    if (F && F.kind === "end" && !writer.doc().rev) { writer.set({ rev: { f: fleetRec.key, salt: fleetRec.salt } }, true); renderAll(); }
  } finally { defending = false; }
}

// ---------------------------------------------------------------- dotazování
function pollSpeed() {
  if (document.hidden) return 6000;
  if (!me) return 1200;
  const F = safeFlow();
  if (!F || F.kind === "setup") return 900;
  if (F.kind === "end") return 1500;
  const oppActing = F.who !== me;
  const waitingResult = F.kind === "shoot" && F.who === me && (F.pending.length > 0 || F.pendingRadar || (pools[other(me)] && pools[other(me)].busy()));
  return oppActing || waitingResult || (F.kind === "answer") ? 350 : 1500;
}
function schedulePoll(ms) { clearTimeout(pollT); pollT = setTimeout(poll, ms === undefined ? pollSpeed() : ms); }
async function poll() {
  if (!room || view === "setup" || view === "info" || view === "intro") { schedulePoll(2000); return; }
  const seq = ++pollSeq, mySeq = bootSeq;
  const speed = pollSpeed(), wantRoom = Date.now() - lastRoomPoll > Math.max(1200, speed * 3);
  try {
    const jobs = [];
    if (me) jobs.push(load(seatUrl(room.id, other(me))).then(d => ["seat", other(me), d])); else { jobs.push(load(seatUrl(room.id, "x")).then(d => ["seat", "x", d])); jobs.push(load(seatUrl(room.id, "o")).then(d => ["seat", "o", d])); }
    if (wantRoom) jobs.push(load(roomUrl(room.id)).then(d => ["room", null, d]));
    const res = await Promise.all(jobs);
    if (seq !== pollSeq || mySeq !== bootSeq || !room) return;
    fails = 0;
    let changed = false, roomDoc = null;
    for (const [kind, seat, d] of res) {
      if (kind === "room") { lastRoomPoll = Date.now(); roomDoc = d; continue; }
      if (JSON.stringify(docs[seat]) !== JSON.stringify(d)) { docs[seat] = d; changed = true; lastChange = Date.now(); }
    }
    if (roomDoc) await applyRoom(roomDoc);
    if (changed && gameKey === room.id + "|" + g().n) { syncPools(); renderAll(); runDefense(); }
  } catch { fails++; }
  schedulePoll(fails ? Math.min(8000, 600 * 2 ** Math.min(fails, 4)) : undefined);
}
async function applyRoom(d) {
  if (!d || !d.g) return;
  const oldN = room.g.n, seatsChanged = (d.sx || "") !== room.sx || (d.so || "") !== room.so;
  if ((d.v || 0) === room.v && !seatsChanged) return;
  room = { id: room.id, v: d.v || 0, g: d.g, sx: d.sx || "", so: d.so || "" };
  if (room.g.n !== oldN) { await initGame(); return; }
  renderAll();
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) schedulePoll(0); });

// ---------------------------------------------------------------- rozmístění, hotovo, první kategorie
async function submitReady(c0) {
  if (!fleetRec) return;
  const fh = await Lo.sha(fleetRec.key + fleetRec.salt);
  writer.set({ ...fresh(room.g.n), n: room.g.n, fh, ready: true, c0 }, true);
  placeStage = "place"; renderAll(); schedulePoll(0);
}
async function donePlacing() {
  const p = pools[me];
  if (!p.placing || !Lo.valid(p.fleet)) return;
  const f = p.fleet.map(s => ({ ...s })), key = Lo.fleetKey(f), salt = randId(20);
  fleetRec = { fleet: f, key, salt };
  store.set(`kl-fleet-${room.id}-${room.g.n}-${me}`, JSON.stringify({ f: key, salt }));
  p.stopPlacement(); p.setFleet(f);
  if (g().s === me) await submitReady(""); else { placeStage = "cat"; renderAll(); }
}

// ---------------------------------------------------------------- v2: pestrost (rozcvička, finále, záchranný kruh, mina, bójky)
const female = seat => (seat === "x" ? g().gx : g().go) === "f";
const wonVerb = seat => female(seat) ? "Vyhrála" : "Vyhrál";
const sunkOf = seat => (docOf(seat).S || []).length;
const turnPhase = (seat, idx) => Lo.phaseOfTurn(idx, sunkOf(other(seat)));
// kdo prohrává o 3+ zasažená políčka, má záchranný kruh
const rescueFor = seat => room && me !== undefined && Lo.needsRescue(Lo.hits(docOf(seat).R), Lo.hits(docOf(other(seat)).R));
// mina z mého minulého tahu: v tomhle tahu o ránu méně
function minePenalty(seat, idx) {
  const prev = (docOf(seat).T || [])[idx - 1]; if (!prev) return false;
  return Lo.buoyHits(prev.sh, Lo.buoys(g().seed || "", other(seat)), "mina").length > 0;
}
// který z radarů je teď k dispozici: "r" (rychlá odpověď) nebo "r2" (sonarová bójka zdarma)
function radarSlot(F) {
  if (!F || F.kind !== "shoot") return null;
  const t = F.T;
  if (t && t.ok && Number.isFinite(t.ms) && t.ms <= Lo.FAST_MS && (t.r === null || t.r === undefined)) return "r";
  if (F.sonar && (t.r2 === null || t.r2 === undefined)) return "r2";
  return null;
}
const radarAvailable = t => !!(t && t.ok && Number.isFinite(t.ms) && t.ms <= Lo.FAST_MS && (t.r === null || t.r === undefined));
const categoryOffer = F => Lo.isWheel(F.k + 1) ? null : Lo.offeredCats(g().seed || "", F.k + 1, F.prevCat || "");

// ---------------------------------------------------------------- tah: obtížnost, otázka, odpověď
function pickDifficulty(d) {
  const F = safeFlow(); if (!F || F.kind !== "pick" || F.who !== me) return;
  const ph = turnPhase(me, F.k >> 1);
  d = Math.min(Lo.maxDifficulty(ph), Math.max(Lo.minDifficulty(ph), d));
  const cat = Lo.CATS.includes(F.cat) ? F.cat : Lo.CATS[rnd(7)];
  const q = Lo.pickQuestion(QS, cat, d, usedSet()), t = { d, q: q.id, o: Lo.shuffle4(), t0: Date.now(), a: null, ms: 0, ok: null, n: 0, sh: [], r: null, r2: null, nc: null };
  if (rescueFor(me) && ph !== "finale") t.rs = 1;
  const T = [...(writer.doc().T || [])]; T[F.k >> 1] = t;
  cardState = { phase: "ask" };
  writer.set({ T }, true);
  renderAll(); schedulePoll(0);
}
let answering = false;
async function submitAnswer(a) {
  const F = safeFlow(); if (answering || !F || F.kind !== "answer" || F.who !== me) return;
  answering = true;
  try {
    const t = F.T, q = getQ(t.q), ms = a < 0 ? Lo.ANSWER_MS : Math.min(Lo.ANSWER_MS, Date.now() - t.t0);
    const ok = await Lo.isCorrect(q, t.o, a), idx = F.k >> 1, n = Lo.baseShots(t, ok, { phase: turnPhase(me, idx), pen: minePenalty(me, idx) });
    const cj = await Lo.correctIndex(q, t.o);
    const fact = cj >= 0 ? await Lo.decryptFact(q.id, q.opts[+t.o[cj]], q.f).catch(() => "") : "";
    const T = [...writer.doc().T]; T[F.k >> 1] = { ...t, a, ms, ok, n };
    cardState = { phase: "result", a, ok, cj, fact, n, fast: ok && ms <= Lo.FAST_MS, k: F.k, rs: !!(ok && t.rs), pen: minePenalty(me, idx) };
    cardOpen = true;
    writer.set({ T }, true);
    renderAll(); schedulePoll(0);
    const hold = ok ? 2600 : 3600;
    setTimeout(closeCard, FX.scale < 1 ? 700 : hold + Math.min(1500, (fact.length || 0) * 12));
  } finally { answering = false; }
}
function swapEasier() {
  const F = safeFlow(); if (!F || F.kind !== "answer" || F.who !== me || !F.T.rs || F.T.sw || F.T.d <= 1 || turnPhase(me, F.k >> 1) === "finale") return;
  const cat = Lo.CATS.includes(F.cat) ? F.cat : Lo.CATS[rnd(7)], d = F.T.d - 1, q = Lo.pickQuestion(QS, cat, d, usedSet());
  const T = [...writer.doc().T]; T[F.k >> 1] = { ...F.T, d, q: q.id, o: Lo.shuffle4(), t0: Date.now(), sw: 1 };
  writer.set({ T }, true); sheetKey = ""; renderAll(); schedulePoll(0);
}
function closeCard() { if (!cardOpen) return; cardOpen = false; renderAll(); }

// ---------------------------------------------------------------- střelba, radar, kategorie
function shootAt(i) {
  const F = safeFlow(); if (!F || F.kind !== "shoot" || F.who !== me) return;
  const opp = other(me), pool = pools[opp];
  if (pool.busy() || F.pending.length || F.pendingRadar) return;
  const t = F.T, v = Lo.seaView(viewOf(docOf(opp)).R, viewOf(docOf(opp)).S);
  const slot = radarSlot(F);
  if (radarArmed && slot) {
    radarArmed = false;
    const T = [...writer.doc().T]; T[F.k >> 1] = { ...t, [slot]: i };
    writer.set({ T }, true); renderAll(); schedulePoll(0); return;
  }
  radarArmed = false;
  if (F.left <= 0 || (v[i] !== "." && v[i] !== "w") || (t.sh || []).includes(i)) return;
  const T = [...writer.doc().T]; T[F.k >> 1] = { ...t, sh: [...(t.sh || []), i] };
  writer.set({ T }, true);
  pool.launch(i, swimmerPoint(me), me === "x" ? COL.x : COL.o);
  renderAll(); schedulePoll(0);
}
function wheelSpin() {
  const F = safeFlow(); if (!F || F.kind !== "shoot" || F.who !== me || !Lo.isWheel(F.k + 1) || wheelBusy) return;
  wheelBusy = true;
  const target = Lo.wheelCat(g().seed || "", F.k + 1, F.prevCat || ""), box = $("wheelBox"), t0 = Date.now(); let n = 0;
  const tick = () => {
    const done = FX.scale < .05 || Date.now() - t0 > 1500 * Math.max(.2, FX.scale);
    const c = done ? target : Lo.CATS[(n++ * 3 + rnd(2)) % 7];
    if (box) box.innerHTML = `<span class="wc" style="--cc:${CAT[c].color}">${catIcon(c, 26)}<b>${CAT[c].name}</b></span>`;
    if (done) { wheelBusy = false; pickNextCategory(target); } else setTimeout(tick, 90 + (Date.now() - t0) / 14);
  };
  tick();
}
let wheelBusy = false;
function pickNextCategory(cat) {
  const F = safeFlow(); if (!F || F.kind !== "shoot" || F.who !== me || F.left > 0 || F.pending.length || F.pendingRadar) return;
  const T = [...writer.doc().T]; T[F.k >> 1] = { ...F.T, nc: cat };
  radarArmed = false;
  writer.set({ T }, true); renderAll(); schedulePoll(0);
}
async function pickFirstCategory(cat) { await submitReady(cat); }

// ---------------------------------------------------------------- odveta
async function rematch() {
  const F = safeFlow(); if (!F || F.kind !== "end" || busy) return;
  busy = true; $("rematchBtn").disabled = true;
  try {
    const nextG = () => {
      const gg = g(), w = [...gg.w]; w[F.winner === "x" ? 0 : 1]++;
      const used = [...new Set([...(gg.used || []), ...usedSet()])].slice(-170);
      return { ...gg, n: gg.n + 1, s: F.loser, w, used, seed: randId(10) };
    };
    const ng = nextG(), n0 = g().n;
    const r = await commitRoom(room.id, d => d && d.g && d.g.n === n0 ? { ...d, g: ng } : null);
    if (r.d && r.d.g) await applyRoom(r.d);
  } catch { toast("Spojení nevyšlo, zkus to znovu."); }
  busy = false; $("rematchBtn") && ($("rematchBtn").disabled = false);
}

// ---------------------------------------------------------------- vykreslení: lidé, skóre
function curMood(seat, ph) {
  const fx = moodFx[seat]; if (fx && fx.until > Date.now()) return fx.m;
  const F = ph.F;
  if (ph.name === "end") return F.winner === seat ? "win" : "cry";
  if (!F || F.kind === "setup") return "idle";
  if (F.kind === "shoot" && F.who === seat && F.left === 0 && !F.pending.length && !F.pendingRadar) return "devil";
  if (F.who === seat) return "focus";
  return "idle";
}
function renderPeople() {
  if (!room) return;
  const ph = phase(), sc = seriesScore(), sc2 = sc;
  for (const seat of ["x", "o"]) {
    const box = document.querySelector(`#people .sw[data-seat="${seat}"]`), m = curMood(seat, ph);
    const wins = sc2[seat === "x" ? 0 : 1], lvl = Lo.titleLevel(wins), mk = m + "|" + lvl;
    if (box.dataset.mood !== mk) { box.innerHTML = swimmerSVG(seat, m, lvl); box.dataset.mood = mk; }
    const who = document.querySelector(`#people .who-${seat}`);
    let ttl = who.querySelector(".ttl"); if (!ttl) { ttl = document.createElement("span"); ttl.className = "ttl"; who.querySelector(".nmrow").after(ttl); }
    ttl.textContent = Lo.titleName(wins, female(seat)); ttl.dataset.lvl = lvl;
    let rc = who.querySelector(".rescue"); if (!rc) { rc = document.createElement("span"); rc.className = "rescue"; rc.innerHTML = icon("ring", 18); rc.title = "Záchranný kruh: +1 rána a lehčí otázka"; rc.setAttribute("role", "img"); rc.setAttribute("aria-label", "Záchranný kruh"); who.appendChild(rc); }
    rc.hidden = !(ph.F && ph.F.kind !== "setup" && ph.F.kind !== "end" && rescueFor(seat));
    document.querySelector(`#people .who-${seat} .nm`).textContent = nameOf(seat);
    document.querySelector(`#people .who-${seat} .you`).hidden = me !== seat;
    document.querySelector(`#people .who-${seat}`).classList.toggle("turn", !!ph.F && (ph.F.who === seat) && ph.F.kind !== "end");
  }
  $("score").textContent = `${sc[0]} : ${sc[1]}`;
  $("score").setAttribute("aria-label", `Série: ${nameOf("x")} ${sc[0]}, ${nameOf("o")} ${sc[1]}`);
}

// ---------------------------------------------------------------- vykreslení: stav, panel, karta otázky
function statusText(ph) {
  const F = ph.F, opp = myNameOpp();
  switch (ph.name) {
    case "spec-setup": return "Hráči rozmisťují hračky do bazénů.";
    case "spec": return F.kind === "pick" ? `${nameOf(F.who)} volí obtížnost.` : F.kind === "answer" ? `${nameOf(F.who)} odpovídá.` : `${nameOf(F.who)} střílí.`;
    case "place": return "Rozmísti hračky do svého bazénu.";
    case "cat0": return "Vyber soupeři kategorii první otázky.";
    case "wait-setup": return room.so && room.sx ? `Čekám, až ${opp} rozmístí hračky.` : `Čekám, až výzvu přijme ${opp}.`;
    case "pick-me": return `Jsi na tahu. Kategorii ti vybral${female(other(me)) ? "a" : ""} ${opp}: ${CAT[F.cat] ? CAT[F.cat].name : ""}. Zvol obtížnost.`;
    case "pick-opp": return `${nameOf(F.who)} volí obtížnost (${CAT[F.cat] ? CAT[F.cat].name : ""}).`;
    case "answer-me": return "Odpověz na otázku.";
    case "answer-opp": return `${nameOf(F.who)} odpovídá (${CAT[F.cat] ? CAT[F.cat].name : ""}, ${DIFF[F.T.d]}).`;
    case "shoot-me": {
      if (F.pending.length || F.pendingRadar) return "Čekám na odpověď soupeře…";
      if (F.left > 0) return radarArmed ? "Klepni do bazénu, kde má radar skenovat." : `Klepni do soupeřova bazénu. Zbývá ${F.left} z ${F.T.n + (F.treasure || 0)}.`;
      return Lo.isWheel(F.k + 1) ? "Salva je venku. Příště rozhodne kolo štěstí." : "Salva je venku. Vyber soupeři kategorii z nabídky.";
    }
    case "shoot-opp": {
      const T = F.T, r = T.ok ? `${nameOf(F.who)} ${female(F.who) ? "odpověděla" : "odpověděl"} správně: ${T.n} ${T.n >= 5 ? "ran" : "rány"}${radarAvailable(T) || T.r !== null && T.r !== undefined ? " a radar" : ""}.` : `${nameOf(F.who)} ${female(F.who) ? "odpověděla" : "odpověděl"} špatně: jen 1 rána.`;
      return F.left > 0 || F.pending.length ? r : `${nameOf(F.who)} vybírá, jakou kategorii dostaneš.`;
    }
    case "end": return ph.win === null ? `${wonVerb(ph.F.winner)} ${nameOf(ph.F.winner)}.` : ph.win ? "Vyhráváš! Všechny soupeřovy hračky jsou splasklé." : "Prohráváš, všechny tvoje hračky splaskly.";
  }
  return "";
}
function renderStatusLine() {
  if (!room || view !== "game") return;
  const ph = phase();
  $("status").textContent = (statusText(ph) || "") + (netMsg ? " " + netMsg : "");
}
const chipsHTML = (list) => `<div class="chips" role="group" aria-label="Kategorie">${(list || Lo.CATS).map(c => `<button type="button" class="chip" data-cat="${c}" style="--cc:${CAT[c].color}" aria-label="${CAT[c].name}">${catIcon(c, 22)}<span>${CAT[c].name}</span></button>`).join("")}</div>`;
// legenda bójek pod bazénem soupeře: ikony stejné jako v bazénu
const buoyLegendHTML = () => `<p class="buoy-legend">${[["poklad", "míč +1 rána"], ["radar", "sonar radar zdarma"], ["mina", "ježek −1 rána"]].map(([k, t]) => `<span>${buoyIcon(k, 22)}${t}</span>`).join("")}</p>`;
function balloonsHTML(F) {
  const n = (F.T.n || 0) + (F.treasure || 0), used = (F.T.sh || []).length;
  return `<div class="balloons" id="balloons" role="img" aria-label="Zbývá ${Math.max(0, n - used)} z ${n} ran"><span class="bl">${[...Array(n)].map((_, i) => balloonSVG(me === "x" ? COL.x : COL.o, i < used, 30)).join("")}</span><b class="cnt">${Math.max(0, n - used)} / ${n}</b></div>`;
}
function panelHTML(ph) {
  const F = ph.F, opp = myNameOpp();
  switch (ph.name) {
    case "place":
      return `<h2 class="pt">Rozmísti hračky</h2><p class="pd">Přetáhni je prstem, klepnutím otočíš. Nesmí se dotýkat ani rohem.</p>
        <div class="btnrow"><button type="button" class="btn ghost" id="randomBtn" data-act="random">${icon("dice", 20)}Náhodně</button><button type="button" class="btn" id="doneBtn" data-act="done" ${pools[me] && pools[me].placing && Lo.valid(pools[me].fleet) ? "" : "disabled"}>${icon("check", 20)}Hotovo</button></div>
        <p class="pw-warn" id="placeWarn" role="status"></p>`;
    case "cat0":
      return `<h2 class="pt">Co dostane ${esc(opp)}?</h2><p class="pd">Vyber kategorii první otázky ze tří nabídnutých.</p>${chipsHTML(Lo.offeredCats(g().seed || "", 0, ""))}`;
    case "wait-setup":
      return `<h2 class="pt">Hotovo, čekáme</h2><p class="pd">${room.so ? `${esc(opp)} ještě rozmisťuje hračky.` : `Pošli soupeři odkaz na hru, ať výzvu přijme.`}</p>${room.so ? "" : `<div class="btnrow"><button type="button" class="btn" data-act="copylink">${icon("link", 20)}Zkopírovat odkaz</button></div>`}`;
    case "pick-me":
      return `<div class="catline" style="--cc:${CAT[F.cat].color}">${catIcon(F.cat, 22)}<b>${CAT[F.cat].name}</b><span>od: ${esc(opp)}</span></div>
        <h2 class="pt">Zvol obtížnost</h2>
        <div class="diffs">${[1, 2, 3].map(d => { const tp = turnPhase(me, F.k >> 1), off = d > Lo.maxDifficulty(tp) || d < Lo.minDifficulty(tp); return `<button type="button" class="diff d${d}" data-d="${d}" ${off ? "disabled" : ""}><b>${DIFF[d][0].toUpperCase() + DIFF[d].slice(1)}</b><span class="ct">${Lo.SALVO[d]} rány správně</span></button>`; }).join("")}</div>
        <p class="pd small">${{ warm: "Rozcvička: první dva tahy jen lehká a střední.", finale: "Finále: zbývá poslední hračka, otázka je těžká a platí 4 rány.", normal: `Špatná odpověď = jen 1 rána. Správně do ${Lo.FAST_MS / 1000} s přidá radar.` }[turnPhase(me, F.k >> 1)]}${minePenalty(me, F.k >> 1) ? " Ježek ti ubere ránu." : ""}</p>`;
    case "pick-opp":
      return `<div class="catline" style="--cc:${CAT[F.cat].color}">${catIcon(F.cat, 22)}<b>${CAT[F.cat].name}</b><span>tvoje volba</span></div><h2 class="pt">${esc(nameOf(F.who))} volí obtížnost</h2><p class="pd">Pak dostane otázku z téhle kategorie.</p>`;
    case "answer-opp":
      return `<div class="catline" style="--cc:${CAT[F.cat].color}">${catIcon(F.cat, 22)}<b>${CAT[F.cat].name}</b><span>${DIFF[F.T.d]} · ${Lo.SALVO[F.T.d]} rány</span></div>
        <h2 class="pt">${esc(nameOf(F.who))} odpovídá</h2>
        <div class="otimer"><div class="bar"><i id="obar"></i></div><span id="osec">20 s</span></div><p class="pd small">Otázku vidí jen ${female(F.who) ? "ona" : "on"}. Za chvíli uvidíš výsledek.</p>`;
    case "shoot-me": {
      const done = F.left <= 0 && !F.pending.length && !F.pendingRadar, T = F.T;
      let h = balloonsHTML(F);
      const slot = radarSlot(F);
      if (slot) h += `<button type="button" class="btn radar${radarArmed ? " on" : ""}" id="radarBtn" data-act="radar" aria-pressed="${radarArmed}">${icon("radar", 20)}${slot === "r2" ? "Radar zdarma" : "Radar 3 × 3"}</button>`;
      else if ((T.r !== null && T.r !== undefined) || (T.r2 !== null && T.r2 !== undefined)) h += `<span class="radar-used">${icon("radar", 18)}Radar použit</span>`;
      h = `<div class="shootrow">${h}</div>`;
      if (done) {
        const offer = categoryOffer(F);
        h += offer ? `<h2 class="pt">Co dostane ${esc(opp)}?</h2>${chipsHTML(offer)}`
          : `<h2 class="pt">Kolo štěstí</h2><p class="pd">${esc(opp)} dostane kategorii z kola.</p><div class="wheelbox" id="wheelBox"><span class="wc">${icon("wheel", 26)}<b>Zatoč kolem</b></span></div><div class="btnrow"><button type="button" class="btn" id="wheelBtn" data-act="wheel">${icon("wheel", 20)}Zatočit</button></div>`;
      }
      else h += `<p class="pd">${F.pending.length || F.pendingRadar ? "Čekám na odpověď soupeře…" : radarArmed ? "Klepni do bazénu, střed radaru." : `Klepni do soupeřova bazénu.`}</p>${buoyLegendHTML()}`;
      return h;
    }
    case "shoot-opp": {
      const T = F.T;
      return `<div class="catline" style="--cc:${CAT[F.cat].color}">${catIcon(F.cat, 22)}<b>${CAT[F.cat].name}</b><span>${DIFF[T.d]}</span></div>
        <h2 class="pt">${T.ok ? "Správně" : "Špatně"}: ${T.n} ${T.n === 1 ? "rána" : T.n < 5 ? "rány" : "ran"}</h2>
        <p class="pd">${F.left > 0 || F.pending.length ? `${esc(nameOf(F.who))} střílí do tvého bazénu.` : `${esc(nameOf(F.who))} vybírá, z jaké kategorie dostaneš otázku.`}</p>${balloonsHTML(F)}`;
    }
    case "end": return endHTML(ph);
    case "spec": return spectatorHTML(ph);
    case "spec-setup": return `<h2 class="pt">Přihlížíš</h2><p class="pd">Hráči rozmisťují hračky. Uvidíš jen jejich odpovědi, nikdy flotily.</p>`;
  }
  return "";
}
function spectatorHTML(ph) {
  const F = ph.F, w = F.who !== undefined ? nameOf(F.who) : "";
  const cat = F.cat && CAT[F.cat] ? `<div class="catline" style="--cc:${CAT[F.cat].color}">${catIcon(F.cat, 22)}<b>${CAT[F.cat].name}</b>${F.T ? `<span>${DIFF[F.T.d]}</span>` : ""}</div>` : "";
  const what = { pick: `${w} volí obtížnost`, answer: `${w} odpovídá`, shoot: F.T && F.T.ok !== null ? `${w} střílí: ${F.T.n} ran` : `${w} střílí` }[F.kind] || "";
  return `${cat}<h2 class="pt">${esc(what)}</h2><p class="pd">Přihlížíš, hrají jen dva.</p>`;
}
// povýšení vítěze na nový titul po této výhře
function promoHTML(F) {
  const i = F.winner === "x" ? 0 : 1, before = g().w[i], after = before + 1;
  if (Lo.titleLevel(after) <= Lo.titleLevel(before)) return "";
  const f = female(F.winner);
  return `<p class="promo" id="promo"><b>${esc(nameOf(F.winner))}</b> ${f ? "povýšila" : "povýšil"} na ${esc(Lo.titleName(after, f, true))}.</p>`;
}
function endHTML(ph) {
  const F = ph.F, W = nameOf(F.winner), L = nameOf(F.loser), sc = seriesScore();
  const title = ph.win ? "Vyhráváš!" : `${wonVerb(F.winner)} ${esc(W)}`;
  const sub = ph.win === null ? `${esc(L)} má všechny hračky splasklé.` : ph.win ? `${esc(L)} má všechny hračky splasklé.` : "Všechny tvoje hračky jsou splasklé.";
  return `<div id="endBox" class="endbox"><h2 class="pt big" id="endTitle">${title}</h2><p class="pd" id="endSub">${sub}</p>
    <div class="endscore" id="endScore" aria-label="Skóre série"><span>${esc(nameOf("x"))}</span><b>${sc[0]} : ${sc[1]}</b><span>${esc(nameOf("o"))}</span></div>
    ${promoHTML(F)}
    <p class="stake" id="endStake">${esc(stakeResult(g(), W, L))}</p>
    <p class="seal" id="sealBox" data-v="${verdict ? (verdict.ok ? "ok" : "bad") : "wait"}">${verdict ? (verdict.ok ? `${icon("seal", 20)}Poctivě ověřeno` : `Ověření nesedí: ${esc(verdict.why)}`) : "Ověřuji poctivost…"}</p>
    ${me ? `<div class="btnrow"><button type="button" class="btn" id="rematchBtn" data-act="rematch">${ph.win ? "Odveta" : "Chci odvetu"}</button><button type="button" class="btn ghost" data-act="copylink">${icon("link", 20)}Odkaz</button></div><p class="pd small">${esc(L)} začíná odvetu.</p>` : `<p class="pd small">Přihlížíš, odvetu založí hráči.</p>`}</div>`;
}
function renderPanelState() {
  const d = $("doneBtn"); if (d && me && pools[me] && pools[me].placing) {
    const ok = Lo.valid(pools[me].fleet); d.disabled = !ok;
    const w = $("placeWarn"); if (w) w.textContent = ok ? "" : "Hračky se nesmí překrývat ani dotýkat, ani rohem.";
  }
}

// karta otázky (spodní list na mobilu, ve sloupci na desktopu)
function sheetHTML(ph) {
  const F = ph.F;
  if (ph.name === "answer-me" || (cardOpen && cardState && cardState.phase === "result")) {
    const t = ph.name === "answer-me" ? F.T : docOf(me).T[cardState.k >> 1], q = getQ(t.q), cat = CAT[q.kat], cs = cardState && cardState.phase === "result" ? cardState : null;
    const opp = myNameOpp(), order = [...t.o].map(Number);
    return `<div class="qcard${cs ? " answered" : ""}" id="qcard" role="dialog" aria-label="Otázka" data-qid="${q.id}">
      <div class="qcat" style="--cc:${cat.color}">${catIcon(q.kat, 24)}<b>${cat.name}</b><span class="by">od: ${esc(opp)}</span><span class="lv">${DIFF[t.d]} · ${Lo.SALVO[t.d] + (t.rs ? 1 : 0)} rány</span></div>
      <div class="qtime"><div class="bar"><i id="qbar"></i><u class="mark" style="left:${(100 * (1 - Lo.FAST_MS / Lo.ANSWER_MS)).toFixed(1)}%"></u></div><div class="qt"><span id="qsec">20 s</span><span class="qfast" id="qfast">Radar ještě platí</span></div></div>
      <p class="qtext" id="qtext">${esc(q.q)}</p>
      <div class="opts">${order.map((oi, j) => `<button type="button" class="opt" data-opt="${j}" ${cs ? "disabled" : ""}><span class="ltr">${"ABCD"[j]}</span><span class="ot">${esc(q.opts[oi])}</span></button>`).join("")}</div>
      <p class="qhint" id="qhint">Správně ${Lo.SALVO[t.d] + (t.rs ? 1 : 0)} rány · špatně 1 rána${t.rs ? " (záchranný kruh +1)" : ""}</p>
      ${t.rs && !t.sw && t.d > 1 && !cs && turnPhase(me, cardState && cardState.phase === "result" ? cardState.k >> 1 : F.k >> 1) !== "finale" ? `<button type="button" class="btn ghost swap" id="swapBtn" data-act="swap">${icon("ring", 20)}Vyměnit za lehčí</button>` : ""}
      <div class="qfact" id="qfact" aria-live="polite" hidden></div></div>`;
  }
  return "";
}
let sheetKey = "";
function renderSheet(ph) {
  const sh = $("sheet");
  const show = ph.name === "answer-me" || (cardOpen && cardState && cardState.phase === "result");
  document.body.classList.toggle("sheet-open", !!show);
  const key = show ? (cardState && cardState.phase === "result" ? "res" + cardState.k : "ask" + (ph.F && ph.F.k)) : "";
  if (key === sheetKey) { if (show) paintCardState(); return; }
  sheetKey = key;
  sh.hidden = !show;
  sh.innerHTML = show ? sheetHTML(ph) : "";
  if (show) paintCardState();
}
function paintCardState() {
  const qc = $("qcard"); if (!qc) return;
  const cs = cardState && cardState.phase === "result" ? cardState : null;
  if (cs) {
    qc.classList.add("answered");
    qc.querySelectorAll(".opt").forEach(b => { const j = +b.dataset.opt; b.disabled = true; b.classList.toggle("right", j === cs.cj); b.classList.toggle("wrong", j === cs.a && !cs.ok); b.classList.toggle("dim", j !== cs.cj && j !== cs.a); });
    $("qhint").innerHTML = cs.a < 0 ? `<b>Čas vypršel</b>: jen 1 rána.` : cs.ok ? `<b>Správně!</b> ${cs.n} ${cs.n < 5 ? "rány" : "ran"}${cs.rs ? " (se záchranným kruhem)" : ""}${cs.fast ? " a navíc radar" : ""}${cs.pen ? ", ježek ubral ránu" : ""}.` : `<b>Špatně.</b> Jen 1 rána.`;
    const sb = $("swapBtn"); if (sb) sb.remove();
    qc.dataset.result = cs.ok ? "ok" : "bad";
    const f = $("qfact"); if (cs.fact) { f.hidden = false; f.textContent = cs.fact; }
  }
}
function tickCard() {
  const ph = phase();
  // moje otázka: odpočet podle t0 z dokumentu
  const qb = $("qbar");
  if (qb && ph.name === "answer-me" && !(cardState && cardState.phase === "result")) {
    const el = Date.now() - ph.F.T.t0, left = Math.max(0, Lo.ANSWER_MS - el);
    qb.style.transform = `scaleX(${left / Lo.ANSWER_MS})`;
    $("qsec").textContent = Math.ceil(left / 1000) + " s";
    const fast = el <= Lo.FAST_MS; $("qfast").textContent = fast ? `Radar ještě ${Math.ceil((Lo.FAST_MS - el) / 1000)} s` : "Radar už nehrozí"; $("qfast").classList.toggle("gone", !fast);
    $("qcard").classList.toggle("urgent", left < 6000);
    if (el >= Lo.ANSWER_MS) submitAnswer(-1);
  }
  // soupeřova otázka: odpočet od chvíle, kdy jsem ji poprvé viděl
  const ob = $("obar");
  if (ob && ph.name === "answer-opp") {
    const key = gameKey + "|" + ph.F.k; if (!seenAt.has(key)) seenAt.set(key, Date.now());
    const left = Math.max(0, Lo.ANSWER_MS - (Date.now() - seenAt.get(key)));
    ob.style.transform = `scaleX(${left / Lo.ANSWER_MS})`; $("osec").textContent = Math.ceil(left / 1000) + " s";
  }
  // pohyb nálady plavců po vypršení efektu
  for (const s of ["x", "o"]) if (moodFx[s] && moodFx[s].until < Date.now()) { moodFx[s] = null; renderPeople(); }
}
function startTick() { if (!tickT) tickT = setInterval(tickCard, 100); }
function stopTick() { clearInterval(tickT); tickT = null; }

// ---------------------------------------------------------------- celé vykreslení
function renderAll(force) {
  if (!room || view !== "game") return;
  const ph = phase(), F = ph.F, board = $("board");
  renderPeople();
  // zaostření: velký bazén = tam, kde se právě něco děje
  const focus = !me ? "both" : ["place", "cat0", "wait-setup", "pick-opp", "answer-opp", "shoot-opp"].includes(ph.name) ? "mine" : ph.name === "end" ? "enemy" : "enemy";
  board.dataset.focus = focus; board.dataset.phase = ph.name; board.dataset.me = me || "";
  board.dataset.wide = ["pick-me", "cat0", "place", "end", "answer-opp", "pick-opp", "wait-setup", "spec-setup"].includes(ph.name) || (ph.name === "shoot-me" && F.left <= 0 && !F.pending.length && !F.pendingRadar) ? "1" : "0";
  // interaktivita nepřátelského bazénu
  if (me) {
    const opp = pools[other(me)], canShoot = ph.name === "shoot-me" && !cardOpen && F.left + (radarSlot(F) ? 1 : 0) > 0 && !F.pending.length && !F.pendingRadar;
    opp.setInteractive(canShoot, shootAt);
    pools[me].wrap.classList.toggle("incoming", ph.name === "shoot-opp" || ph.name === "answer-opp" || ph.name === "pick-opp");
  }
  // panel jen při změně obsahu
  const pkey = [ph.name, F && F.k, F && F.cat, F && F.T && [F.T.d, F.T.n, F.T.ok, (F.T.sh || []).length, F.T.r, F.T.r2, F.T.nc, F.T.d, F.T.rs, F.T.sw, F.treasure, F.sonar].join(","), F && F.left, F && F.pending && F.pending.length, F && F.pendingRadar, radarArmed, placeStage, room.so ? 1 : 0, ph.name === "end" ? (verdict ? verdict.ok + (verdict.why || "") : "w") + seriesScore().join() : "", fleetRec ? 1 : 0].join("|");
  if (pkey !== panelKey || force) {
    panelKey = pkey;
    $("panel").innerHTML = panelHTML(ph);
    $("panel").dataset.phase = ph.name;
    renderPanelState();
  }
  renderSheet(ph);
  renderStatusLine();
  updateTitle();
  if (ph.name === "end") startVerify(ph);
  startTick();
  const rb = $("radarBtn"); if (rb) rb.setAttribute("aria-pressed", String(radarArmed));
}
// ověření poctivosti po konci: hash flotily + přehrání odpovědí na všechny rány
async function startVerify(ph) {
  const X = docOf("x"), O = docOf("o");
  if (!X.rev || !O.rev) return;
  const key = gameKey + "|" + JSON.stringify([X.rev, O.rev, X.R, O.R]);
  if (key === verifyKey) return; verifyKey = key;
  let a, b;
  try { [a, b] = await Promise.all([Lo.verify(X.rev, X.fh, O.T || [], X, getQ, seedCtx("x")), Lo.verify(O.rev, O.fh, X.T || [], O, getQ, seedCtx("o"))]); }
  catch (e) { console.warn("verify", e); a = { ok: false, why: "ověření selhalo: " + (e && e.message) }; b = { ok: true }; }
  verdict = a.ok && b.ok ? { ok: true } : { ok: false, why: (!a.ok ? `${nameOf("x")}: ${a.why}` : `${nameOf("o")}: ${b.why}`) };
  // odhalit zbylé hračky soupeře
  if (me) { const f = Lo.fleetFrom(docOf(other(me)).rev.f); if (f) pools[other(me)].setGhost(f); }
  else { for (const s of ["x", "o"]) { const f = Lo.fleetFrom(docOf(s).rev.f); if (f) pools[s].setGhost(f); } }
  panelKey = ""; renderAll();
}

// ---------------------------------------------------------------- ovládání (delegace)
$("panel").addEventListener("click", e => {
  const b = e.target.closest("[data-act],[data-d],[data-cat]"); if (!b || b.disabled) return;
  if (b.dataset.d) return pickDifficulty(+b.dataset.d);
  if (b.dataset.act === "wheel") return wheelSpin();
  if (b.dataset.cat) { const ph = phase(); return ph.name === "cat0" ? pickFirstCategory(b.dataset.cat) : pickNextCategory(b.dataset.cat); }
  switch (b.dataset.act) {
    case "random": { const p = pools[me]; if (p.placing) { p.fleet = Lo.randomFleet(); p.paint(); renderPanelState(); } break; }
    case "done": donePlacing(); break;
    case "radar": radarArmed = !radarArmed; renderAll(true); break;
    case "copylink": copy(linkFor(), "Odkaz je zkopírovaný"); break;
    case "rematch": rematch(); break;
  }
});
$("sheet").addEventListener("click", e => {
  const sw = e.target.closest("[data-act=swap]"); if (sw) return swapEasier();
  const b = e.target.closest(".opt"); if (!b || b.disabled) return;
  submitAnswer(+b.dataset.opt);
});
$("sheet").addEventListener("keydown", e => {
  const k = "1234".indexOf(e.key), a = "abcd".indexOf(e.key.toLowerCase());
  const j = k >= 0 ? k : a;
  if (j >= 0 && $("qcard") && !$("qcard").classList.contains("answered")) submitAnswer(j);
});
$("infoRetry").addEventListener("click", boot);
$("newGameBtn").addEventListener("click", () => {
  clearTimeout(pollT); bootSeq++;
  room = null; me = null; writer = null;
  history.pushState(null, "", location.pathname + location.search);
  document.title = TITLE; showSetup();
});
$("logo").addEventListener("click", e => { e.preventDefault(); $("newGameBtn").click(); });
window.addEventListener("hashchange", boot);

// ---------------------------------------------------------------- celá obrazovka a instalace
const FS_ICON = { enter: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5", exit: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" };
const fsRoot = document.documentElement;
const fsRequest = fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen;
const fsExit = document.exitFullscreen || document.webkitExitFullscreen;
const onPhone = /iPhone|iPod/.test(navigator.userAgent);
const canFs = !!fsRequest && !!fsExit && !onPhone && (document.fullscreenEnabled ?? document.webkitFullscreenEnabled) !== false;
const fsOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const installed = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
let hintT = null;
const hideHint = () => { clearTimeout(hintT); $("fsHint").hidden = true; };
function showHint() { $("fsHint").hidden = false; clearTimeout(hintT); hintT = setTimeout(hideHint, 12000); }
function syncFs() {
  const on = fsOn(), b = $("fsBtn"), label = on ? "Ukončit celou obrazovku" : "Celá obrazovka";
  fsRoot.classList.toggle("standalone", installed());
  b.hidden = installed();
  b.setAttribute("aria-label", label); b.title = label;
  if (canFs) b.setAttribute("aria-pressed", String(on)); else b.removeAttribute("aria-pressed");
  $("fsIcon").setAttribute("d", on ? FS_ICON.exit : FS_ICON.enter);
  if (on || b.hidden) hideHint();
}
$("fsBtn").addEventListener("click", async () => {
  if (!canFs) { $("fsHint").hidden ? showHint() : hideHint(); return; }
  try { await (fsOn() ? fsExit.call(document) : fsRequest.call(fsRoot, { navigationUI: "hide" })); } catch { showHint(); }
});
$("fsHintClose").addEventListener("click", hideHint);
["fullscreenchange", "webkitfullscreenchange"].forEach(ev => document.addEventListener(ev, syncFs));
attempt(() => matchMedia("(display-mode: standalone)").addEventListener("change", syncFs));
syncFs();
window.addEventListener("load", () => attempt(() => document.fonts.load('700 24px "DynaPuff"', "Ěščřžýáíéůú")));

boot();
