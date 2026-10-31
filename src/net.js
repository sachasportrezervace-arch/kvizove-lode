// Sdílená místnost na mantledb.sh (bez účtu, CORS), architektura jako Kafíčka a Ovocný souboj.
// Tři dokumenty, každý má jediného zapisovatele (žádné kolize při živé hře):
//   kvizove-lode-<id>/hra  místnost: jména, sázka, série, kdo začíná; zapisuje se jen občas (čti–ověř–zapiš)
//   kvizove-lode-<id>/x    dokument hráče x, zapisuje jen zařízení s jeho tokenem
//   kvizove-lode-<id>/o    dokument hráče o, zapisuje jen zařízení s jeho tokenem
// Změřeno u Ovocného souboje: GET/POST ~120 ms, čtení po zápisu konzistentní, takže dotazování soupeře po ~350 ms stačí na živý tah.

export const API = (typeof window !== "undefined" && window.KL_API) || "https://mantledb.sh/v2/";
const APP = "kvizove-lode";
export const roomUrl = id => `${API}${APP}-${id}/hra`;
export const seatUrl = (id, seat) => `${API}${APP}-${id}/${seat}`;

async function req(url, opt = {}) {
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 8000);
  try { return await fetch(url, { ...opt, cache: "no-store", signal: ac.signal }); } finally { clearTimeout(timer); }
}
export async function load(url) {
  const r = await req(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("load " + r.status);
  return r.json();
}
export async function save(url, d) {
  const r = await req(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...d, u: Date.now() }) });
  if (!r.ok) throw new Error("save " + r.status);
}

const attempt = (fn, fb) => { try { return fn(); } catch { return fb; } };
export const store = {
  get: k => attempt(() => localStorage.getItem(k), null),
  set: (k, v) => attempt(() => localStorage.setItem(k, v)),
  del: k => attempt(() => localStorage.removeItem(k)),
};
export const randId = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => (b % 36).toString(36)).join("");
export const device = store.get("kl-dev") || randId(16);
store.set("kl-dev", device);

// místnost: čti, ověř, zapiš; ok(doc) vrací nový dokument, nebo null, když se zápis už nehodí
export async function commitRoom(id, ok) {
  const d = await load(roomUrl(id));
  const next = ok(d);
  if (!next) return { d, ok: false };
  const out = { ...next, v: (d ? d.v || 0 : 0) + 1 };
  await save(roomUrl(id), out);
  return { d: out, ok: true };
}

// vlastní dokument hráče: zápisy sloučené, nejvýš jeden na cestě, mezi nimi aspoň `gap` ms; vždy odejde poslední stav
export function seatWriter(id, seat, initial) {
  let doc = { ...initial }, dirty = false, flying = false, last = 0, timer = null, fails = 0;
  const w = {
    doc: () => doc,
    gap: 220,
    replace(d) { doc = { ...d }; },                                  // převzetí stavu z disku bez zápisu (po obnovení stránky)
    set(patch, urgent) { doc = { ...doc, ...patch }; dirty = true; w.kick(urgent); },
    kick(urgent) {
      if (flying || !dirty) return;
      const wait = urgent ? 0 : Math.max(0, last + w.gap - Date.now());
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (flying || !dirty) return;
        flying = true; dirty = false; last = Date.now();
        const snap = doc;
        try { await save(seatUrl(id, seat), snap); fails = 0; w.onNet && w.onNet(""); }
        catch { dirty = true; fails++; if (fails >= 2 && w.onNet) w.onNet("Spojení vázne, zkouším to znovu…"); }
        flying = false;
        if (dirty) setTimeout(() => w.kick(), fails ? Math.min(4000, 400 * 2 ** fails) : 0);
        else w.onSaved && w.onSaved(snap);
      }, wait);
    },
    pending: () => dirty || flying,
    stop() { clearTimeout(timer); dirty = false; },
  };
  return w;
}
