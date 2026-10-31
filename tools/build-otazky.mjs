// Sestaví data/otazky.json ze zdrojů data/zdroj/*.json (spusť: node tools/build-otazky.mjs).
// Z každé otázky udělá { id, kat, obt, q, opts:[4 zamíchané], h: answerHash, src, f: zašifrovaný fakt } – správná odpověď tak
// není v načítaném JSON čitelně; klient najde správnou možnost porovnáním hashů a fakt dešifruje (viz engine.js).
// Zdroje se průběžně doplňují (chybějící kategorie se přeskočí); neplatné otázky se vypíšou a vynechají.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const L = createRequire(import.meta.url)(path.join(DIR, "engine.js"));
const ZDROJ = path.join(DIR, "data", "zdroj");

// deterministické míchání podle id, ať je build opakovatelný a diff čitelný
function rng(seed) {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e9) / 1e9; };
}
const shuffled = (arr, rnd) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const out = [], bad = [], seen = new Set(), perCat = {};
const files = fs.existsSync(ZDROJ) ? fs.readdirSync(ZDROJ).filter(f => f.endsWith(".json")).sort() : [];
for (const f of files) {
  let list;
  try { list = JSON.parse(fs.readFileSync(path.join(ZDROJ, f), "utf8")); } catch (e) { bad.push(`${f}: neplatný JSON (${e.message})`); continue; }
  if (!Array.isArray(list)) { bad.push(`${f}: očekávám pole`); continue; }
  for (const q of list) {
    const err = [];
    if (!q || typeof q !== "object") { bad.push(`${f}: položka není objekt`); continue; }
    if (!q.id || seen.has(q.id)) err.push("id chybí nebo se opakuje");
    if (!L.CATS.includes(q.kat)) err.push("neznámá kategorie " + q.kat);
    if (![1, 2, 3].includes(q.obt)) err.push("obt mimo 1–3");
    if (!q.q || q.q.length > 110) err.push("otázka prázdná nebo > 110 znaků");
    if (!q.spravne || !Array.isArray(q.spatne) || q.spatne.length !== 3) err.push("potřebuji správnou a 3 špatné");
    else {
      const all = [q.spravne, ...q.spatne].map(x => String(x).trim());
      if (new Set(all.map(x => x.toLowerCase())).size !== 4) err.push("možnosti se opakují");
      if (all.some(x => !x || x.length > 28)) err.push("možnost prázdná nebo > 28 znaků");
    }
    if (!q.fakt || q.fakt.length > 140) err.push("fakt chybí nebo > 140 znaků");
    if (!q.src) err.push("chybí zdroj");
    if (err.length) { bad.push(`${f} ${q.id}: ${err.join("; ")}`); continue; }
    seen.add(q.id);
    const correct = String(q.spravne).trim();
    const opts = shuffled([correct, ...q.spatne.map(x => String(x).trim())], rng(q.id));
    const rec = { id: q.id, kat: q.kat, obt: q.obt, q: q.q.trim(), opts, h: await L.answerHash(q.id, correct), src: q.src, f: await L.encryptFact(q.id, correct, q.fakt.trim()) };
    if (q.plati) rec.plati = q.plati;
    out.push(rec);
    perCat[q.kat] = (perCat[q.kat] || 0) + 1;
  }
}
out.sort((a, b) => a.kat.localeCompare(b.kat) || a.obt - b.obt || a.id.localeCompare(b.id));
fs.writeFileSync(path.join(DIR, "data", "otazky.json"), JSON.stringify(out));
console.log(`otazky.json: ${out.length} otázek`, perCat);
const missing = L.CATS.filter(c => !perCat[c]);
if (missing.length) console.log("Chybí zdroj pro kategorie:", missing.join(", "));
if (bad.length) { console.log(`Vynecháno ${bad.length}:`); bad.forEach(b => console.log("  " + b)); }
