// Bazén: SVG deska 8×8 s hračkami, značkami, efekty (let balonku, šplouch, PSSST, splasknutí, radar) a rozmisťováním tažením.
import { CELL, INK, COL, toyG, toyTransform, missMark, hitMark, TOY_NAMES_CAP, buoyG } from "./art.js";
const Lo = window.Lode;
const NS = "http://www.w3.org/2000/svg";
const LET = "ABCDEFGH";
export const coord = i => LET[i % 8] + (Math.floor(i / 8) + 1);
export const center = i => [(i % 8) * CELL + CELL / 2, Math.floor(i / 8) * CELL + CELL / 2];

// zrychlení a omezení pohybu: ?rychle=1 zkrátí animace, prefers-reduced-motion je vypne (zůstává jen výsledek)
export const FX = { scale: 1, reduced: false };
const ease = { out: t => 1 - (1 - t) ** 3, inout: t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2, back: t => { const c = 1.9; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; } };
export const sleep = ms => new Promise(r => setTimeout(r, FX.reduced ? 0 : ms * FX.scale));
export function tween(ms, fn, e = t => t) {
  return new Promise(res => {
    if (FX.reduced || ms * FX.scale <= 16) { fn(1); res(); return; }
    const d = ms * FX.scale, t0 = performance.now();
    const step = now => { const t = Math.min(1, (now - t0) / d); fn(e(t), t); t < 1 ? requestAnimationFrame(step) : res(); };
    requestAnimationFrame(step);
  });
}
const el = (tag, attrs = {}, html = "") => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (html) n.innerHTML = html; return n; };
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };

export class Pool {
  constructor({ owner, mine, name }) {
    this.owner = owner; this.mine = mine; this.name = name || "";
    this.wrap = document.createElement("div");
    this.wrap.className = "pw " + (mine ? "mine" : "enemy");
    this.wrap.dataset.owner = owner;
    this.wrap.innerHTML = `<svg class="pool" viewBox="-12 -12 360 360" role="group" focusable="false">
      <rect class="coping" x="-9" y="-9" width="354" height="354" rx="15" fill="${COL.coping}"/>
      <rect class="water" x="0" y="0" width="336" height="336" rx="6" fill="${COL.water}"/>
      <g class="grid" stroke="#fff" stroke-opacity=".26" stroke-width="1.6">${[...Array(7)].map((_, i) => `<path d="M${(i + 1) * CELL} 0v336M0 ${(i + 1) * CELL}h336"/>`).join("")}</g>
      <path d="M0 0h336v9.2H9.2V336H0Z" fill="${COL.waterDeep}" opacity=".5"/>
      <g class="tiles"></g><g class="buoys"></g><g class="toys"></g><g class="radar"></g><g class="marks"></g><g class="fx"></g><g class="cursor"></g><g class="cells"></g></svg>`;
    this.svg = this.wrap.querySelector("svg");
    this.L = {}; ["tiles", "buoys", "toys", "radar", "marks", "fx", "cursor", "cells"].forEach(c => this.L[c] = this.svg.querySelector("." + c));
    this.shown = { R: ".".repeat(64), S: [], K: [], D: {} }; this.last = this.shown;
    this.buoys = {}; this.fleet = null; this.ghost = null; this.queue = []; this.pumping = false; this.inflight = new Map(); this.seenTiles = new Set();
    this.interactive = false; this.onCell = null; this.onEvent = null; this.origin = null; this.placing = null;
    for (let i = 0; i < 64; i++) {
      const [cx, cy] = center(i);
      const c = el("rect", { class: "cell", x: cx - CELL / 2, y: cy - CELL / 2, width: CELL, height: CELL, fill: "transparent", "data-i": i, "data-pool": mine ? "mine" : "enemy", tabindex: -1, role: "button" });
      this.L.cells.appendChild(c);
    }
    this.svg.addEventListener("click", e => { const c = e.target.closest && e.target.closest(".cell"); if (c && this.interactive && this.onCell) this.onCell(+c.dataset.i); });
    this.svg.addEventListener("keydown", e => this.key(e));
    this.svg.addEventListener("pointermove", e => { if (this.interactive && e.pointerType === "mouse") { const c = e.target.closest && e.target.closest(".cell"); this.setCursor(c ? +c.dataset.i : null); } });
    this.svg.addEventListener("pointerleave", () => { if (this.interactive) this.setCursor(null); });
    this.paint();
  }

  // ------------------------------------------------------------ stav a kresba
  setFleet(f) { this.fleet = f; this.paint(); }
  setBuoys(b) { this.buoys = b || {}; this.paint(); }
  setGhost(f) { this.ghost = f; this.paint(); }
  reset(view) {
    this.queue = []; this.inflight.clear();
    this.shown = { R: view.R, S: view.S.map(c => [...c]), K: [...view.K], D: { ...view.D } };
    this.last = this.shown; this.seenTiles = new Set(Lo.seaView(this.shown.R, this.shown.S).map((c, i) => c === "w" ? i : -1).filter(i => i >= 0));
    this.paint();
  }
  setInteractive(on, onCell) {
    this.interactive = on; this.onCell = onCell || null;
    this.wrap.classList.toggle("aim", on);
    if (!on) this.setCursor(null);
    this.paintCells();
  }
  setCursor(i) {
    this.L.cursor.innerHTML = "";
    if (i === null || i === undefined) return;
    const [cx, cy] = center(i);
    this.L.cursor.appendChild(el("rect", { x: cx - 19, y: cy - 19, width: 38, height: 38, rx: 8, fill: "none", stroke: COL.x, "stroke-width": 3.4, "stroke-dasharray": "7 5" }));
  }
  // jednotlivé kreslicí vrstvy ze `shown`
  paint() {
    const { R, S, K, D } = this.shown, v = Lo.seaView(R, S);
    // jistá voda: jemně světlejší dlaždice (nové se rozsvítí)
    let t = "";
    v.forEach((c, i) => { if (c === "w") { const [cx, cy] = center(i); const fresh = !this.seenTiles.has(i); if (fresh) this.seenTiles.add(i); t += `<rect class="safe${fresh ? " fresh" : ""}" x="${cx - CELL / 2 + .8}" y="${cy - CELL / 2 + .8}" width="${CELL - 1.6}" height="${CELL - 1.6}" rx="5" fill="#fff" opacity=".13"/>`; } });
    this.L.tiles.innerHTML = t;
    // bójky plavou, dokud do pole nikdo nestřelil
    this.L.buoys.innerHTML = Object.keys(this.buoys).filter(k => R[+k] === ".").map(k => { const [cx, cy] = center(+k); return buoyG(this.buoys[k], cx, cy); }).join("");
    // hračky: vlastní bazén = celá flotila (potopené splasklé), cizí bazén = jen potopené, na konci i odhalené zbylé
    const sunkIdx = new Set(); let toys = "";
    const shipAt = (cells) => { const a = [...cells].sort((x, y) => x - y), r = Math.floor(a[0] / 8), c = a[0] % 8; return { r, c, v: a.length > 1 && a[1] - a[0] === 8 }; };
    if (this.fleet) {
      const bad = this.placing ? new Set(Lo.conflicts(this.fleet)) : new Set();
      this.fleet.forEach((s, k) => {
        const cells = Lo.shipCells(s, Lo.SIZES[k]).filter(i => i >= 0), sunk = S.some(e => e.includes(cells[0]) && cells.length === e.length);
        toys += `<g class="toy${sunk ? " sunk" : ""}${bad.has(k) ? " bad" : ""}${this.placing && this.placing.drag && this.placing.drag.k === k ? " lift" : ""}" data-ship="${k}" ${this.placing ? `tabindex="0" role="button" aria-label="${TOY_NAMES_CAP[k]}, ${Lo.SIZES[k]} políčka, ${coord(cells[0] >= 0 ? cells[0] : 0)}, ${s.v ? "svisle" : "vodorovně"}. Šipky posouvají, mezerník otáčí."` : ""} transform="${toyTransform(s)}">${toyG(k, sunk)}</g>`;
        if (bad.has(k)) cells.forEach(i => { const [cx, cy] = center(i); toys += `<rect class="clash" x="${cx - CELL / 2 + 1}" y="${cy - CELL / 2 + 1}" width="${CELL - 2}" height="${CELL - 2}" rx="7" fill="#FF2D2D" opacity=".38" stroke="#fff" stroke-width="2"/>`; });
      });
    } else {
      S.forEach((cells, idx) => { const k = Number.isInteger(K[idx]) ? K[idx] : (cells.length === 4 ? 0 : cells.length === 2 ? 3 : (sunkIdx.has(1) ? 2 : 1)); sunkIdx.add(k); toys += `<g class="toy sunk" transform="${toyTransform(shipAt(cells))}">${toyG(k, true)}</g>`; });
      if (this.ghost) this.ghost.forEach((s, k) => { const cells = Lo.shipCells(s, Lo.SIZES[k]); if (!S.some(e => e.includes(cells[0]))) toys += `<g class="toy ghost" transform="${toyTransform(s)}" opacity=".5">${toyG(k, false)}</g>`; });
    }
    this.L.toys.innerHTML = toys;
    // značky: vedle = tenký prstenec, zásah = záplata (potopené hračky mají splasklou siluetu, bez záplat)
    let m = "";
    v.forEach((c, i) => { const [cx, cy] = center(i); if (c === "m") m += `<g class="mk miss">${missMark(cx, cy)}</g>`; else if (c === "h") m += `<g class="mk hit">${hitMark(cx, cy)}</g>`; });
    this.L.marks.innerHTML = m;
    // radar: obrys oblasti 3×3 a číslo v jejím středu
    let rd = "";
    Object.keys(D).forEach(k => {
      const i = +k, [cx, cy] = center(i), r0 = Math.floor(i / 8), c0 = i % 8, x0 = Math.max(0, c0 - 1), x1 = Math.min(7, c0 + 1), y0 = Math.max(0, r0 - 1), y1 = Math.min(7, r0 + 1);
      rd += `<g class="rd" data-radar="${i}"><rect x="${x0 * CELL + 2}" y="${y0 * CELL + 2}" width="${(x1 - x0 + 1) * CELL - 4}" height="${(y1 - y0 + 1) * CELL - 4}" rx="9" fill="#fff" fill-opacity=".1" stroke="#fff" stroke-width="2.4" stroke-dasharray="6 5"/>
        <circle cx="${cx}" cy="${cy}" r="14" fill="#fff" stroke="${INK}" stroke-width="2.4"/><text x="${cx}" y="${cy + 6.4}" text-anchor="middle" font-family="DynaPuff, sans-serif" font-size="19" fill="${INK}">${D[k]}</text></g>`;
    });
    this.L.radar.innerHTML = rd;
    this.paintCells();
  }
  paintCells() {
    const { R, S } = this.shown, v = Lo.seaView(R, S), who = this.mine ? "tvoje pole" : "pole soupeře";
    const lab = { ".": "neznámé", m: "vedle", h: "zásah", s: "potopeno", w: "jistá voda" };
    this.L.cells.querySelectorAll(".cell").forEach(c => {
      const i = +c.dataset.i, st = v[i];
      c.dataset.st = st;
      c.setAttribute("aria-label", `${coord(i)}, ${lab[st]}${this.interactive && (st === "." || st === "w") ? ", vystřelit" : ""}`);
      c.setAttribute("aria-disabled", String(!(this.interactive && (st === "." || st === "w"))));
      c.style.pointerEvents = this.interactive || this.placing ? "all" : "none";
      c.style.cursor = this.interactive && (st === "." || st === "w") ? "crosshair" : "default";
    });
    this.svg.setAttribute("aria-label", `${this.mine ? "Tvůj bazén" : "Bazén soupeře"}${this.name ? " – " + this.name : ""}`);
  }
  key(e) {
    if (this.placing) {
      const g = e.target.closest && e.target.closest(".toy"); if (!g) return;
      const k = +g.dataset.ship, s = this.fleet[k], d = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[e.key];
      if (d) { e.preventDefault(); this.moveShip(k, s.r + d[0], s.c + d[1]); }
      else if (e.key === " " || e.key === "Enter" || e.key.toLowerCase() === "r") { e.preventDefault(); this.rotateShip(k); }
      else return;
      this.svg.querySelector(`.toy[data-ship="${k}"]`)?.focus();
      return;
    }
    if (!this.interactive) return;
    const c = e.target.closest && e.target.closest(".cell"); if (!c) return;
    const i = +c.dataset.i, d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[e.key];
    if (d) { e.preventDefault(); const j = i + d; if (j >= 0 && j < 64 && !(e.key === "ArrowLeft" && i % 8 === 0) && !(e.key === "ArrowRight" && i % 8 === 7)) this.focusCell(j); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (this.onCell) this.onCell(i); }
  }
  focusCell(i) { this.L.cells.querySelectorAll(".cell").forEach(c => c.setAttribute("tabindex", +c.dataset.i === i ? "0" : "-1")); this.L.cells.querySelector(`.cell[data-i="${i}"]`).focus(); this.setCursor(i); }

  // ------------------------------------------------------------ rozmisťování tažením
  startPlacement(fleet, onChange) {
    this.fleet = fleet; this.placing = { drag: null, onChange };
    this.wrap.classList.add("placing");
    this.paint();
    this.hd = {
      down: e => {
        const [x, y] = this.local(e.clientX, e.clientY), r = Math.floor(y / CELL), c = Math.floor(x / CELL);
        if (r < 0 || c < 0 || r > 7 || c > 7) return;
        const k = Lo.occupancy(this.fleet)[r * 8 + c];
        if (k < 0) return;
        const s = this.fleet[k];
        this.placing.drag = { k, dr: r - s.r, dc: c - s.c, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, id: e.pointerId };
        try { this.svg.setPointerCapture(e.pointerId); } catch {}
        e.preventDefault(); this.paint();
      },
      move: e => {
        const d = this.placing && this.placing.drag; if (!d || e.pointerId !== d.id) return;
        const [x, y] = this.local(e.clientX, e.clientY), r = Math.floor(y / CELL) - d.dr, c = Math.floor(x / CELL) - d.dc;
        if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 7) d.moved = true;
        if (d.moved) this.moveShip(d.k, r, c, true);
      },
      up: e => {
        const d = this.placing && this.placing.drag; if (!d || e.pointerId !== d.id) return;
        this.placing.drag = null;
        try { this.svg.releasePointerCapture(e.pointerId); } catch {}
        if (!d.moved && performance.now() - d.t0 < 500) this.rotateShip(d.k); else { this.paint(); this.placing.onChange && this.placing.onChange(this.fleet); }
      },
    };
    this.svg.addEventListener("pointerdown", this.hd.down);
    this.svg.addEventListener("pointermove", this.hd.move);
    this.svg.addEventListener("pointerup", this.hd.up);
    this.svg.addEventListener("pointercancel", this.hd.up);
  }
  stopPlacement() {
    if (!this.placing) return;
    ["down", "move", "up"].forEach(n => this.svg.removeEventListener("pointer" + (n === "up" ? "up" : n === "down" ? "down" : "move"), this.hd[n]));
    this.svg.removeEventListener("pointercancel", this.hd.up);
    this.placing = null; this.wrap.classList.remove("placing"); this.paint();
  }
  local(cx, cy) { const p = this.svg.createSVGPoint(); p.x = cx; p.y = cy; const q = p.matrixTransform(this.svg.getScreenCTM().inverse()); return [q.x, q.y]; }
  clampShip(s, k) { const L = Lo.SIZES[k]; return { ...s, r: Math.max(0, Math.min(s.v ? 8 - L : 7, s.r)), c: Math.max(0, Math.min(s.v ? 7 : 8 - L, s.c)) }; }
  moveShip(k, r, c, keepDrag) {
    const n = this.clampShip({ ...this.fleet[k], r, c }, k);
    if (n.r === this.fleet[k].r && n.c === this.fleet[k].c) return;
    this.fleet[k] = n; this.paint(); this.placing && this.placing.onChange && this.placing.onChange(this.fleet);
  }
  rotateShip(k) {
    const s = this.fleet[k]; this.fleet[k] = this.clampShip({ ...s, v: !s.v }, k);
    this.paint(); this.placing && this.placing.onChange && this.placing.onChange(this.fleet);
  }

  // ------------------------------------------------------------ animace dopadů
  // novým stavem (obránce) se vyrobí fronta dopadů v pořadí střelby; `opts.order` = pole ran v pořadí, `opts.origin` = funkce vracející obrazovkový bod výstřelu
  apply(view, opts = {}) {
    const prev = this.last, order = opts.order || [];
    const cells = [];
    for (let i = 0; i < 64; i++) if (prev.R[i] === "." && view.R[i] !== ".") cells.push(i);
    cells.sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)));
    for (const i of cells) {
      const si = view.S.findIndex(e => e.includes(i));
      this.queue.push({ type: "shot", i, r: view.R[i] === "s" ? "s" : view.R[i], cells: si >= 0 ? view.S[si] : null, ship: si >= 0 ? view.K[si] : null, origin: opts.origin });
    }
    Object.keys(view.D || {}).forEach(k => { if (!(k in prev.D)) this.queue.push({ type: "radar", i: +k, n: view.D[k] }); });
    this.last = { R: view.R, S: view.S.map(c => [...c]), K: [...view.K], D: { ...view.D } };
    this.pump();
  }
  async pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.queue.length) {
        const ev = this.queue.shift();
        if (ev.type === "radar") await this.radarFX(ev); else await this.shotFX(ev);
      }
      // po dojetí fronty zobraz přesně cílový stav (např. R: h → s u dříve zasažených polí)
      this.shown = { R: this.last.R, S: this.last.S.map(c => [...c]), K: [...this.last.K], D: { ...this.last.D } };
      this.paint();
    } finally { this.pumping = false; this.idle && this.idle.forEach(f => f()); this.idle = []; }
  }
  whenIdle() { return this.pumping || this.queue.length ? new Promise(r => (this.idle = this.idle || []).push(r)) : Promise.resolve(); }
  busy() { return this.pumping || this.queue.length > 0 || this.inflight.size > 0; }
  fx(node) { this.L.fx.appendChild(node); return node; }
  // vodní balonek letí obloukem z místa střelce na políčko
  fly(i, from, color, ms = 620) {
    if (FX.reduced || FX.scale < .02) return Promise.resolve();
    const [tx, ty] = center(i);
    const [fx0, fy0] = from ? this.local(from.x, from.y) : [tx, 420];
    const g = this.fx(el("g", { class: "flyer" }, `<path d="M0 -15c9 0 13 8 13 14a13 13 0 0 1-26 0c0-6 4-14 13-14z" fill="${color}" stroke="#fff" stroke-width="2.4"/><path d="M-3.4 -15.6l3.4 -5.4l3.4 5.4z" fill="${color}" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M-6 -3q2 -5 6 -6" stroke="#fff" stroke-opacity=".75" stroke-width="2.6" fill="none" stroke-linecap="round"/>`));
    const cx = (fx0 + tx) / 2, cy = Math.min(fy0, ty) - 110;
    return tween(ms, t => {
      const u = 1 - t, x = u * u * fx0 + 2 * u * t * cx + t * t * tx, y = u * u * fy0 + 2 * u * t * cy + t * t * ty;
      const dx = 2 * u * (cx - fx0) + 2 * t * (tx - cx), dy = 2 * u * (cy - fy0) + 2 * t * (ty - cy);
      const sc = .8 + .55 * Math.sin(Math.PI * t) + (1 - t) * .15, rot = Math.atan2(dy, dx) * 180 / Math.PI + 90;
      g.setAttribute("transform", `translate(${x} ${y}) rotate(${rot * .35}) scale(${sc})`);
    }, ease.inout).then(() => g.remove());
  }
  // vystřelené políčko: balonek letí hned při klepnutí a čeká, až obránce odpoví
  launch(i, from, color) { const p = this.fly(i, from, color); this.inflight.set(i, p); p.then(() => { }); return p; }
  async shotFX(ev) {
    const { i } = ev;
    if (this.inflight.has(i)) { await this.inflight.get(i); this.inflight.delete(i); }
    else if (ev.origin) await this.fly(i, ev.origin(), ev.color || COL.o, 520);
    // bójka platí jednou: oznámit ji dřív, než zmizí
    const bk = this.buoys[i]; if (bk && this.shown.R[i] === ".") this.onEvent && this.onEvent({ kind: "buoy", owner: this.owner, i, type: bk });
    // výsledek se zapíše do zobrazeného stavu až při dopadu
    const sh = { R: this.shown.R.slice(0, i) + (ev.r === "s" ? "h" : ev.r) + this.shown.R.slice(i + 1), S: this.shown.S, K: this.shown.K, D: this.shown.D };
    this.shown = sh; this.paint();
    if (ev.r === "m") { this.onEvent && this.onEvent({ kind: "miss", owner: this.owner, i }); await this.splash(i); }
    else {
      this.onEvent && this.onEvent({ kind: ev.r === "s" ? "sunk" : "hit", owner: this.owner, i, ship: ev.ship });
      await this.psst(i);
      if (ev.r === "s") await this.sink(ev);
    }
  }
  async splash(i) {
    const [cx, cy] = center(i), g = this.fx(el("g")), reduce = FX.reduced;
    if (reduce) { await sleep(60); g.remove(); return; }
    const rings = [0, 1, 2].map(n => g.appendChild(el("circle", { cx, cy, r: 4, fill: "none", stroke: "#fff", "stroke-width": 3, opacity: 0 })));
    const drops = [...Array(9)].map((_, n) => g.appendChild(el("circle", { cx, cy, r: 3.2 + (n % 3), fill: "#fff", opacity: 0 })));
    await tween(720, (t) => {
      rings.forEach((r, n) => { const u = Math.max(0, Math.min(1, (t - n * .14) / .7)); r.setAttribute("r", 5 + u * 27); r.setAttribute("opacity", u > 0 ? (1 - u) * .85 : 0); r.setAttribute("stroke-width", 3.4 * (1 - u) + .6); });
      drops.forEach((d, n) => { const a = n / 9 * Math.PI * 2 + .4, dist = 8 + 22 * ease.out(t), lift = Math.sin(Math.PI * Math.min(1, t * 1.25)) * 16; d.setAttribute("cx", cx + Math.cos(a) * dist); d.setAttribute("cy", cy + Math.sin(a) * dist * .7 - lift); d.setAttribute("opacity", t < .8 ? 1 - t * .6 : (1 - t) * 2.4); });
    }, ease.out);
    g.remove();
  }
  async psst(i) {
    const [cx, cy] = center(i), g = this.fx(el("g"));
    const tx = Math.max(52, Math.min(284, cx)), ty = Math.max(34, cy - 38);
    buzz(45);
    this.wrap.animate && !FX.reduced && this.wrap.animate([{ transform: "translate(0,0)" }, { transform: "translate(-4px,2px) rotate(-.5deg)" }, { transform: "translate(4px,-2px) rotate(.5deg)" }, { transform: "translate(-3px,1px)" }, { transform: "translate(0,0)" }], { duration: 300 * FX.scale });
    if (FX.reduced) { g.appendChild(el("text", { x: tx, y: ty, "text-anchor": "middle", "font-family": "DynaPuff, sans-serif", "font-size": 30, fill: "#fff", stroke: INK, "stroke-width": 7, "paint-order": "stroke", "stroke-linejoin": "round" }, "PSSST!")); await sleep(500); g.remove(); return; }
    const lines = [...Array(8)].map((_, n) => g.appendChild(el("path", { stroke: "#fff", "stroke-width": 5, "stroke-linecap": "round", opacity: 0 })));
    const txt = g.appendChild(el("text", { x: 0, y: 0, "text-anchor": "middle", "font-family": "DynaPuff, sans-serif", "font-size": 30, fill: "#fff", stroke: INK, "stroke-width": 7, "paint-order": "stroke", "stroke-linejoin": "round", opacity: 0 }, "PSSST!"));
    await tween(900, t => {
      lines.forEach((l, n) => { const a = n * Math.PI / 4 + .2, r1 = 17 + 10 * ease.out(Math.min(1, t * 2)), r2 = r1 + 12 + (n % 2) * 6; l.setAttribute("d", `M${cx + Math.cos(a) * r1} ${cy + Math.sin(a) * r1}L${cx + Math.cos(a) * r2} ${cy + Math.sin(a) * r2}`); l.setAttribute("opacity", t < .55 ? 1 : Math.max(0, 1 - (t - .55) * 2.4)); });
      const pop = ease.back(Math.min(1, t * 3.2)), sc = .35 + .65 * pop, wob = Math.sin(t * 30) * (1 - t) * 3;
      txt.setAttribute("transform", `translate(${tx} ${ty}) rotate(${-8 + wob}) scale(${sc})`); txt.setAttribute("opacity", t < .7 ? 1 : Math.max(0, 1 - (t - .7) * 3.3));
    });
    g.remove();
  }
  // splasknutí: hračka se zmenší do splasklé siluety, vyletí bublinky, okolí se rozsvítí (v paint jako .fresh)
  async sink(ev) {
    const cells = [...ev.cells].sort((a, b) => a - b), k = Number.isInteger(ev.ship) ? ev.ship : (cells.length === 4 ? 0 : cells.length === 2 ? 3 : 1);
    const r = Math.floor(cells[0] / 8), c = cells[0] % 8, v = cells.length > 1 && cells[1] - cells[0] === 8, L = cells.length;
    const flat = this.fx(el("g", { transform: toyTransform({ r, c, v }), opacity: 0 }, toyG(k, true)));
    const mid = cells.map(center).reduce((a, p) => [a[0] + p[0] / L, a[1] + p[1] / L], [0, 0]);
    const bub = [...Array(6)].map(() => this.fx(el("circle", { r: 3 + Math.random() * 3, fill: "#fff", opacity: 0 })));
    const seeds = bub.map((_, n) => ({ dx: (n - 2.5) * 11, ph: n * .13 }));
    this.wrap.animate && !FX.reduced && this.wrap.animate([{ transform: "translate(0,0)" }, { transform: "translate(0,3px)" }, { transform: "translate(0,0)" }], { duration: 380 * FX.scale });
    buzz([30, 40, 70]);
    await tween(1100, t => {
      flat.setAttribute("opacity", Math.min(1, t * 2.4));
      bub.forEach((b, n) => { const u = Math.max(0, Math.min(1, (t - seeds[n].ph) / .6)); b.setAttribute("cx", mid[0] + seeds[n].dx * (1 + u)); b.setAttribute("cy", mid[1] - u * 46); b.setAttribute("opacity", u > 0 && u < 1 ? .9 * (1 - u) : 0); });
    }, ease.out);
    flat.remove(); bub.forEach(b => b.remove());
    // zapsat potopení do zobrazeného stavu
    const R = [...this.shown.R]; cells.forEach(j => R[j] = "s");
    this.shown = { R: R.join(""), S: [...this.shown.S, cells], K: [...this.shown.K, k], D: this.shown.D };
    this.paint();
  }
  async radarFX(ev) {
    const [cx, cy] = center(ev.i), g = this.fx(el("g"));
    const ring = g.appendChild(el("circle", { cx, cy, r: 4, fill: "none", stroke: "#fff", "stroke-width": 4, opacity: 0 }));
    if (!FX.reduced) await tween(650, t => { ring.setAttribute("r", 6 + 64 * t); ring.setAttribute("opacity", (1 - t) * .95); }, ease.out);
    g.remove();
    this.shown = { ...this.shown, D: { ...this.shown.D, [ev.i]: ev.n } }; this.paint();
    this.onEvent && this.onEvent({ kind: "radar", owner: this.owner, i: ev.i, n: ev.n });
    await sleep(220);
  }
}
