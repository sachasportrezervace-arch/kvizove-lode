// Ověří otázky proti zdroji: stáhne stránku ze `src` a hledá v ní doslovný úryvek `cit`.
// Wikipedie: prostý text článku (extracts) i zdrojový wikitext (kvůli infoboxům). Jiné weby: HTML bez značek.
// node tools/over-otazky.mjs data/zdroj/zemepis.json [další.json …]   → vypíše FAIL a souhrn, exit 1 při chybě
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UA = { "User-Agent": "kvizove-lode-overeni/1.0 (info@le-artist.cz)" };
const CACHE = path.join(path.dirname(fileURLToPath(import.meta.url)), ".cache");
fs.mkdirSync(CACHE, { recursive: true });

const norm = s => s.toLowerCase()
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")     // [[odkaz|text]] → text
  .replace(/'{2,}/g, "").replace(/\{\{[^{}]*\}\}/g, " ")
  .replace(/[„“”"‚‘’'«»]/g, "'").replace(/[–—−]/g, "-").replace(/ | | /g, " ")
  .replace(/\s+/g, " ").trim();

async function get(url) {
  const key = path.join(CACHE, Buffer.from(url).toString("base64url").slice(0, 180) + ".txt");
  if (fs.existsSync(key)) return fs.readFileSync(key, "utf8");
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.ok) { const t = await r.text(); fs.writeFileSync(key, t); return t; }
      if (r.status === 404) return "";
    } catch {}
    await new Promise(r => setTimeout(r, 800 * (i + 1)));
  }
  return "";
}

async function pageText(src) {
  const m = src.match(/^https?:\/\/(\w+)\.(?:m\.)?wikipedia\.org\/wiki\/([^#?]+)/);
  if (m) {
    const [, lang, title] = m, t = decodeURIComponent(title);
    const api = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&formatversion=2&titles=${encodeURIComponent(t)}`;
    const raw = `https://${lang}.wikipedia.org/w/index.php?action=raw&title=${encodeURIComponent(t)}`;
    let ex = "";
    try { ex = JSON.parse(await get(api)).query.pages[0].extract || ""; } catch {}
    let wt = await get(raw);
    // přesměrování ve wikitextu
    const red = wt.match(/^#(?:REDIRECT|PŘESMĚRUJ)\s*\[\[([^\]]+)\]\]/i);
    if (red) wt = await get(`https://${lang}.wikipedia.org/w/index.php?action=raw&title=${encodeURIComponent(red[1])}`);
    return { ok: !!(ex || wt), text: norm(ex) + " ¦ " + norm(wt) };
  }
  const html = await get(src);
  return { ok: !!html, text: norm(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")) };
}

const files = process.argv.slice(2);
let n = 0, bad = 0;
const ids = new Set();
for (const f of files) {
  const list = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const q of list) {
    n++;
    const errs = [];
    if (ids.has(q.id)) errs.push("duplicitní id");
    ids.add(q.id);
    if (!q.src || !q.cit) errs.push("chybí src/cit");
    if (!Array.isArray(q.spatne) || q.spatne.length !== 3) errs.push("spatne != 3");
    const all = [q.spravne, ...(q.spatne || [])];
    if (new Set(all.map(a => String(a).toLowerCase())).size !== 4) errs.push("možnosti se opakují");
    if (all.some(a => String(a).length > 30)) errs.push("možnost > 30 znaků");
    if (String(q.q).length > 120) errs.push("otázka > 120 znaků");
    if (![1, 2, 3].includes(q.obt)) errs.push("obt");
    if (q.src && q.cit) {
      const p = await pageText(q.src);
      if (!p.ok) errs.push("zdroj nedostupný");
      else if (!p.text.includes(norm(q.cit))) errs.push("úryvek nenalezen ve zdroji");
    }
    if (errs.length) { bad++; console.log(`FAIL ${q.id}: ${errs.join(", ")}  [${q.src}]`); }
  }
}
console.log(`\n${n - bad}/${n} ověřeno (úryvek nalezen ve zdroji), ${bad} k opravě`);
process.exit(bad ? 1 : 0);
