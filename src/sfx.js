// Zvuky bez souborů (WebAudio): hod balonku, šplouch, zásah (pop + syčení), splasknutí (pískavé vypouštění), správně/špatně, tah.
// Vypínač v hlavičce, volba v localStorage `kl-zvuk`. Bez podpory WebAudio se tiše nic nehraje.
let ctx = null, master = null, nb = null, on = true;
try { on = localStorage.getItem("kl-zvuk") !== "0"; } catch {}
export const sound = {
  get on() { return on; },
  set(v) { on = !!v; try { localStorage.setItem("kl-zvuk", on ? "1" : "0"); } catch {} if (on) ac(); },
};
function ac() {
  if (!on) return null;
  try {
    if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = .7; master.connect(ctx.destination); }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch { return null; }
}
// iOS pustí zvuk až po gestu: kontext se vytvoří při prvním klepnutí
for (const e of ["pointerdown", "keydown"]) addEventListener(e, () => ac(), { capture: true, passive: true });

function noise(c) {
  if (!nb) { nb = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = c.createBufferSource(); s.buffer = nb; s.loop = true; return s;
}
// obálka hlasitosti: náběh a a dozvuk d (s), vrchol p
function gainEnv(c, t, a, p, d) { const g = c.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(p, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); return g; }
function tone(c, t, type, f0, f1, a, p, d, dest = master) {
  const o = c.createOscillator(), g = gainEnv(c, t, a, p, d);
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
  o.connect(g).connect(dest); o.start(t); o.stop(t + a + d + .05);
  return o;
}
function hiss(c, t, kind, f0, f1, q, a, p, d) {
  const s = noise(c), f = c.createBiquadFilter(), g = gainEnv(c, t, a, p, d);
  f.type = kind; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + a + d);
  s.connect(f).connect(g).connect(master); s.start(t, Math.random() * .5); s.stop(t + a + d + .05);
}

const SFX = {
  // hod: krátké svištění
  throw(c, t) { hiss(c, t, "bandpass", 500, 1900, 1.4, .06, .09, .26); },
  // šplouch: tlumený šum + pár kapek
  splash(c, t) {
    hiss(c, t, "lowpass", 1400, 260, .8, .01, .42, .38);
    for (let i = 0; i < 4; i++) tone(c, t + .05 + i * .055 + Math.random() * .03, "sine", 900 + Math.random() * 700, 1500 + Math.random() * 600, .005, .07, .06);
  },
  // zásah: měkké „pop“ a syčení unikajícího vzduchu
  hit(c, t) {
    tone(c, t, "sine", 210, 70, .005, .7, .16);
    tone(c, t, "triangle", 520, 240, .004, .18, .07);
    hiss(c, t + .04, "highpass", 3200, 2200, .7, .03, .22, .55);
  },
  // splasknutí: pískavé vypouštění s chvěním, nakonec mlasknutí o hladinu
  sink(c, t) {
    const o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), f = c.createBiquadFilter(), g = gainEnv(c, t, .04, .16, 1.0);
    o.type = "sawtooth"; o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(150, t + 1.0);
    lfo.frequency.value = 22; lg.gain.value = 55; lfo.connect(lg).connect(o.frequency);
    f.type = "lowpass"; f.frequency.value = 1700;
    o.connect(f).connect(g).connect(master); o.start(t); lfo.start(t); o.stop(t + 1.1); lfo.stop(t + 1.1);
    hiss(c, t, "bandpass", 1800, 600, 2, .05, .12, .95);
    tone(c, t + 1.0, "sine", 160, 55, .005, .6, .2);
    hiss(c, t + 1.0, "lowpass", 900, 200, .7, .01, .25, .3);
  },
  // správně: dvě stoupající noty, špatně: tupé „bonk“
  ok(c, t) { tone(c, t, "sine", 660, 660, .01, .3, .16); tone(c, t + .11, "sine", 990, 990, .01, .3, .3); },
  bad(c, t) { tone(c, t, "triangle", 230, 140, .01, .4, .32); },
  // jsi na tahu: jemné cinknutí
  turn(c, t) { tone(c, t, "sine", 880, 880, .01, .16, .2); tone(c, t + .09, "sine", 1320, 1320, .01, .1, .22); },
  // bójka: bublinkový trylek
  buoy(c, t) { for (let i = 0; i < 5; i++) tone(c, t + i * .06, "sine", 500 + i * 160, 700 + i * 200, .005, .14, .07); },
};
export function sfx(name) {
  const c = ac(); if (!c || !SFX[name]) return;
  try { SFX[name](c, c.currentTime + .01); } catch {}
}
