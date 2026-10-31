// Kresby hry (SVG řetězce): hračky, plavci, kategorie. Směr „Bazén“ z design/mocks.mjs, přenesený a rozšířený.
// Jednotka v bazénu = 1 políčko = 42 jednotek viewBoxu.
export const CELL = 42;
export const INK = "#1C2A39";
export const COL = { deck: "#F4E7D4", deck2: "#E9D6BC", coping: "#FFFDF8", water: "#2DB3C7", waterDeep: "#1E9BB0", x: "#FF5A2E", o: "#3D5AFE", skinX: "#F1C39F", skinO: "#C88B66" };

// ---------------------------------------------------------------- hračky (vodorovně, počátek vlevo nahoře, výška 1 políčko)
const PAL = {
  croc: { body: "#3FAE49", edge: "#27782F", belly: "#7BD07E", spike: "#2E8A37", sbody: "#7F9C74", sedge: "#566B4F", sbelly: "#9FB496", sspike: "#62785B" },
  mat: { body: "#FF7FA8", edge: "#D4578A", stripe: "#FFFFFF", pillow: "#FFB3CB", sbody: "#C493A6", sedge: "#8E6676", sstripe: "#E8D5DC", spillow: "#D3B0BE" },
  uni: { body: "#FFFFFF", edge: "#B9A8F0", belly: "#F1ECFF", mane: "#B79CFF", horn: "#FFC23C", sbody: "#D9D4E4", sedge: "#8D86A6", sbelly: "#C4BED3", smane: "#8F83B0", shorn: "#BFA164" },
  duck: { body: "#FFD23F", edge: "#C99A05", wing: "#F2B705", beak: "#FF8A1E", sbody: "#CDB766", sedge: "#8F7E3D", swing: "#A89448", sbeak: "#B98C55" },
};
const eyeOpen = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x + r * .3}" cy="${y}" r="${r * .5}" fill="${INK}"/>`;
const eyeX = (x, y, r) => `<path d="M${x - r} ${y - r}l${r * 2} ${r * 2}M${x + r} ${y - r}l${-r * 2} ${r * 2}" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
// vrásky splasklé hračky přes tělo
const wrinkles = (x0, x1, y) => { let d = ""; const n = Math.max(2, Math.round((x1 - x0) / 22)); for (let i = 0; i < n; i++) { const x = x0 + (i + .5) * (x1 - x0) / n; d += `M${x - 5} ${y - 7}q5 7 0 14`; } return `<path d="${d}" stroke="${INK}" stroke-opacity=".38" stroke-width="2" fill="none" stroke-linecap="round"/>`; };
const shadow = (L) => `<ellipse cx="${L * CELL / 2 + 2}" cy="${CELL / 2 + 5}" rx="${L * CELL / 2 - 4}" ry="${CELL * .34}" fill="#0E5F70" opacity=".28"/>`;

function croc(sunk) {
  const p = PAL.croc, L = 4 * CELL, h = 32.8, cy = 21, B = sunk ? p.sbody : p.body, E = sunk ? p.sedge : p.edge;
  const spikes = [0, 1, 2, 3].map(i => `<circle cx="${29 + i * 29}" cy="${cy - h * .52}" r="3.8" fill="${sunk ? p.sspike : p.spike}"/><circle cx="${29 + i * 29}" cy="${cy + h * .52}" r="3.8" fill="${sunk ? p.sspike : p.spike}"/>`).join("");
  return `${sunk ? "" : shadow(4)}<g${sunk ? ` transform="translate(0 ${cy * .26}) scale(1 .74)"` : ""}>
    ${spikes}
    <rect x="4" y="${cy - h / 2}" width="${L - 23}" height="${h}" rx="${h / 2}" fill="${B}" stroke="${E}" stroke-width="2"/>
    <path d="M${L - 25} ${cy - h * .38}q23 4 21 ${h * .38}q0 ${h * .34} -21 ${h * .38}z" fill="${B}" stroke="${E}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="14" y="${cy - h * .17}" width="${L - 54}" height="${h * .34}" rx="${h * .17}" fill="${sunk ? p.sbelly : p.belly}"/>
    ${sunk ? "" : `<path d="M16 ${cy - h * .34}q${(L - 60) / 2} -7 ${L - 60} 0" stroke="#fff" stroke-opacity=".55" stroke-width="3.2" fill="none" stroke-linecap="round"/>`}
    <path d="M1 ${cy}q-5 -4 -2 -9l9 5zM1 ${cy}q-5 4 -2 9l9 -5z" fill="${B}" stroke="${E}" stroke-width="1.6" stroke-linejoin="round"/>
    ${sunk ? eyeX(L - 24, cy - h * .24, 3.4) + eyeX(L - 24, cy + h * .24, 3.4) : eyeOpen(L - 24, cy - h * .24, 4.2) + eyeOpen(L - 24, cy + h * .24, 4.2)}
  </g>${sunk ? wrinkles(26, L - 44, cy) : ""}`;
}
function mattress(sunk) {
  const p = PAL.mat, L = 3 * CELL - 6, h = 33.6, cy = 21, B = sunk ? p.sbody : p.body, E = sunk ? p.sedge : p.edge;
  return `${sunk ? "" : shadow(3)}<g${sunk ? ` transform="translate(0 ${cy * .24}) scale(1 .76)"` : ""}>
    <rect x="3.4" y="${cy - h / 2}" width="${L}" height="${h}" rx="10" fill="${B}" stroke="${E}" stroke-width="2"/>
    ${[1, 2, 3, 4, 5].map(i => `<rect x="${3.4 + i * L / 6 - 3}" y="${cy - h / 2 + 3}" width="6" height="${h - 6}" rx="3" fill="${sunk ? p.sstripe : p.stripe}" opacity="${sunk ? .75 : .9}"/>`).join("")}
    <rect x="6" y="${cy - h / 2 + 3.5}" width="21" height="${h - 7}" rx="8" fill="${sunk ? p.spillow : p.pillow}"/>
    ${sunk ? "" : `<path d="M32 ${cy - h * .33}h${L - 40}" stroke="#fff" stroke-opacity=".5" stroke-width="2.4" stroke-linecap="round"/>`}
  </g>${sunk ? wrinkles(34, L - 6, cy) : ""}`;
}
function unicorn(sunk) {
  const p = PAL.uni, L = 3 * CELL, h = 33.6, cy = 21;
  return `${sunk ? "" : shadow(3)}<g${sunk ? ` transform="translate(0 ${cy * .26}) scale(1 .74)"` : ""}>
    <ellipse cx="${L * .45}" cy="${cy}" rx="${L * .4}" ry="${h / 2}" fill="${sunk ? p.sbody : p.body}" stroke="${sunk ? p.sedge : p.edge}" stroke-width="2"/>
    <ellipse cx="${L * .45}" cy="${cy}" rx="${L * .26}" ry="${h * .26}" fill="${sunk ? p.sbelly : p.belly}"/>
    <path d="M${L * .2} ${cy - h * .45}q${L * .3} -${h * .2} ${L * .6} 0" fill="none" stroke="${sunk ? p.smane : p.mane}" stroke-width="5.6" stroke-linecap="round"/>
    <circle cx="${L * .86}" cy="${cy}" r="${h * .34}" fill="${sunk ? p.sbody : p.body}" stroke="${sunk ? p.sedge : p.edge}" stroke-width="2"/>
    <path d="M${L * .96} ${cy - 2}l13 -2l-12 8z" fill="${sunk ? p.shorn : p.horn}"/>
    <path d="M${L * .06} ${cy}q-4 -10 1 -16M${L * .06} ${cy}q-6 8 1 15" stroke="${sunk ? p.smane : p.mane}" stroke-width="4.2" fill="none" stroke-linecap="round"/>
    ${sunk ? eyeX(L * .88, cy - 5, 2.6) : `<circle cx="${L * .88}" cy="${cy - 5}" r="2.4" fill="${INK}"/>`}
  </g>${sunk ? wrinkles(L * .18, L * .7, cy) : ""}`;
}
function duck(sunk) {
  const p = PAL.duck, cy = 21;
  return `${sunk ? "" : shadow(2)}<g${sunk ? ` transform="translate(0 ${cy * .26}) scale(1 .74)"` : ""}>
    <ellipse cx="38" cy="${cy}" rx="34" ry="15.5" fill="${sunk ? p.sbody : p.body}" stroke="${sunk ? p.sedge : p.edge}" stroke-width="2"/>
    <circle cx="64" cy="${cy}" r="12.5" fill="${sunk ? p.sbody : p.body}" stroke="${sunk ? p.sedge : p.edge}" stroke-width="2"/>
    <path d="M74 ${cy - 4}l11 4l-11 4z" fill="${sunk ? p.sbeak : p.beak}" stroke="${sunk ? p.sedge : "#C46410"}" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M12 ${cy - 7}q17 9 34 0" fill="none" stroke="${sunk ? p.swing : p.wing}" stroke-width="3.4" stroke-linecap="round"/>
    ${sunk ? eyeX(65, cy - 4, 2.4) : `<circle cx="66" cy="${cy - 4}" r="2.3" fill="${INK}"/>`}
  </g>${sunk ? wrinkles(14, 52, cy) : ""}`;
}
const TOYS = [croc, mattress, unicorn, duck];
export const TOY_NAMES = ["krokodýl", "lehátko", "jednorožec", "kachna"];
export const TOY_NAMES_CAP = ["Krokodýl", "Lehátko", "Jednorožec", "Kachna"];
// transformace pro loď {r,c,v}: vodorovná kresba se otočí kolem levého horního rohu
export const toyTransform = s => s.v ? `translate(${s.c * CELL + CELL} ${s.r * CELL}) rotate(90)` : `translate(${s.c * CELL} ${s.r * CELL})`;
export const toyG = (k, sunk) => TOYS[k](sunk);

// ---------------------------------------------------------------- značky na desce
export const missMark = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="8.6" fill="none" stroke="#fff" stroke-width="2" opacity=".62"/>`;
// zásah = záplata v hračce: korálová, bílý lem, černá štěrbina a čárky unikajícího vzduchu
export const hitMark = (cx, cy) => `<g transform="translate(${cx} ${cy})">
  <g stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".95"><path d="M-17 -12l-5 -4M17 -12l5 -4M0 -19v-6"/></g>
  <circle r="13.6" fill="#fff"/><circle r="10.6" fill="${COL.x}"/>
  <path d="M-5.4 3.6l3.6 -7.4l3.4 5.4l3.6 -6.6" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>`;

// ---------------------------------------------------------------- kategorie
export const CAT = {
  zemepis: { name: "Zeměpis", color: "#1B6FD1", icon: `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3q5 9 0 18M12 3q-5 9 0 18"/>` },
  historie: { name: "Historie", color: "#8F5522", icon: `<path d="M4 20h16M6 20V10M10 20V10M14 20V10M18 20V10M3 10l9-6 9 6z"/>` },
  priroda: { name: "Příroda", color: "#23824A", icon: `<path d="M5 19C5 10 10 5 20 4c0 10-5 15-13 15M5 19l8-8"/>` },
  sport: { name: "Sport", color: "#BF5A00", icon: `<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3.5 8.5q5 3.5 0 7M20.5 8.5q-5 3.5 0 7"/>` },
  "film-hudba": { name: "Film a hudba", color: "#A82A86", icon: `<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.6"/><circle cx="17.5" cy="16" r="2.6"/>` },
  jidlo: { name: "Jídlo", color: "#C8344B", icon: `<path d="M4 8q8-6 16 0l-8 13z"/><circle cx="10" cy="10" r="1.2"/><circle cx="14" cy="11" r="1.2"/><circle cx="12" cy="15" r="1.1"/>` },
  veda: { name: "Věda", color: "#6A3FC2", icon: `<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M8 15h8"/>` },
};
export const catIcon = (cat, size = 22) => `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${CAT[cat] ? CAT[cat].icon : ""}</svg>`;
export const icon = (name, size = 22) => {
  const P = {
    fs: `<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>`, fsOff: `<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>`,
    link: `<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>`,
    plus: `<path d="M12 5v14M5 12h14"/>`, close: `<path d="M6 6l12 12M18 6L6 18"/>`,
    radar: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 12l6-6"/>`,
    rot: `<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>`, dice: `<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/>`,
    check: `<path d="M5 12.5l4.5 4.5L19 7.5"/>`, share: `<path d="M12 15V4M8 7.5L12 3.5l4 4M7 10H6v11h12V10h-1"/>`, seal: `<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>`,
    ring: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.6"/><path d="M5.6 5.6l3.9 3.9M18.4 5.6l-3.9 3.9M5.6 18.4l3.9-3.9M18.4 18.4l-3.9-3.9"/>`, wheel: `<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/><circle cx="12" cy="12" r="2"/>`,
  };
  return `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${P[name] || ""}</svg>`;
};
// vodní balonek (rány)
export const balloonSVG = (color, used, size = 30) => `<svg class="balloon${used ? " used" : ""}" viewBox="-14 -20 28 36" width="${size}" height="${size * 36 / 28}" aria-hidden="true"><path d="M0 -14c8 0 12 7 12 13a12 12 0 0 1-24 0c0-6 4-13 12-13z" fill="${color}"/><path d="M-3.5 -14.5l3.5 -5l3.5 5z" fill="${color}"/><path d="M-6 -3q2 -5 6 -6" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;

// ---------------------------------------------------------------- plavci
// Mark (místo x): hranatější čelist, strniště, brýle vyhrnuté na čepici. Radka (místo o): kulatá hlava, culík, brýle na očích, náušnice.
const MOODS = {   // bl, br = [vnitřní konec, vnější konec] obočí (kladně = dolů)
  idle: { bl: [0, 0], br: [0, 0], eyes: "dot", mouth: "smile" },
  focus: { bl: [3, -2], br: [3, -2], eyes: "dot", mouth: "flat" },
  smirk: { bl: [0, 0], br: [-6, -4], eyes: "side", mouth: "smirk" },
  shock: { bl: [-8, -8], br: [-8, -8], eyes: "wide", mouth: "o" },
  devil: { bl: [4, -3], br: [4, -3], eyes: "side", mouth: "grin" },
  worry: { bl: [-4, 3], br: [-4, 3], eyes: "dot", mouth: "frown" },
  win: { bl: [-4, -4], br: [-4, -4], eyes: "happy", mouth: "big" },
  cry: { bl: [-5, 4], br: [-5, 4], eyes: "cry", mouth: "wail" },
};
export const MOOD_NAMES = Object.keys(MOODS);
function mouthPath(kind, cx, y) {
  const s = (d, extra = "") => `<path d="${d}" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  switch (kind) {
    case "smile": return s(`M${cx - 9} ${y}q9 8 18 0`);
    case "flat": return s(`M${cx - 7} ${y + 2}h14`);
    case "smirk": return s(`M${cx - 9} ${y + 3}q10 6 19 -5`);
    case "o": return `<ellipse cx="${cx}" cy="${y + 4}" rx="6.5" ry="8.5" fill="${INK}"/><ellipse cx="${cx}" cy="${y + 8}" rx="4" ry="3.4" fill="#FF7F7F"/>`;
    case "grin": return `<path d="M${cx - 12} ${y - 1}q12 14 24 0z" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M${cx - 8} ${y + .4}h16v3.4h-16z" fill="#fff"/>`;
    case "frown": return s(`M${cx - 9} ${y + 6}q4.5 -6 9 0t9 0`);
    case "big": return `<path d="M${cx - 14} ${y - 3}q14 22 28 0z" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M${cx - 8} ${y + 8}q8 6 16 0" fill="#FF7F7F" stroke="none"/>`;
    case "wail": return `<path d="M${cx - 10} ${y + 10}q10 -16 20 0z" fill="${INK}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
  }
  return "";
}
function eyeSet(kind, x, y, r, side) {
  switch (kind) {
    case "wide": return `<circle cx="${x}" cy="${y}" r="${r + 1.5}" fill="#fff" stroke="${INK}" stroke-width="2.6"/><circle cx="${x}" cy="${y}" r="${r * .38}" fill="${INK}"/>`;
    case "side": return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x + side * r * .42}" cy="${y + r * .1}" r="${r * .52}" fill="${INK}"/>`;
    case "happy": return `<path d="M${x - r} ${y + 2}q${r} ${-r * 1.5} ${r * 2} 0" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
    case "cry": return `<path d="M${x - r} ${y - 1}q${r} ${r * 1.4} ${r * 2} 0" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M${x + side * 2} ${y + 6}q-3 8 0 12q3 -4 0 -12z" fill="#7CD6FF" stroke="${INK}" stroke-width="1.2"/>`;
    default: return `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x + .6}" cy="${y + .6}" r="${r * .5}" fill="${INK}"/>`;
  }
}
const brow = (x, y, w, [inner, outer], dir) => {   // dir -1 = levé obočí (vnitřní konec vpravo), +1 = pravé
  const xo = x + dir * w / 2, xi = x - dir * w / 2;
  return `<path d="M${xo.toFixed(1)} ${y + outer}L${xi.toFixed(1)} ${y + inner}" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/>`;
};
export function swimmerSVG(seat, mood = "idle", level = 0) {
  const m = MOODS[mood] || MOODS.idle, isX = seat === "x";
  const skin = isX ? COL.skinX : COL.skinO, cap = isX ? COL.x : COL.o, capD = isX ? "#E04418" : "#2F46D1";
  const ex = isX ? [50, 82] : [48, 84], ey = isX ? 69 : 65, er = isX ? 8 : 8.6, my = isX ? 91 : 91, by = isX ? 57 : 47;
  const cheeks = `<circle cx="${isX ? 36 : 34}" cy="84" r="6" fill="#FF8C7A" opacity=".42"/><circle cx="${isX ? 96 : 98}" cy="84" r="6" fill="#FF8C7A" opacity=".42"/>`;
  let head, eyes, goggles = "";
  if (isX) {
    head = `<circle cx="23" cy="70" r="8.5" fill="${skin}"/><circle cx="109" cy="70" r="8.5" fill="${skin}"/>
      <path d="M24 62C24 36 42 24 66 24s42 12 42 38v14c0 20-16 29-42 29S24 96 24 76z" fill="${skin}"/>
      <path d="M22 58C22 30 42 15 66 15s44 15 44 43q-44 -9 -88 0z" fill="${cap}"/><path d="M26 49q40 -10 80 0" stroke="${capD}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M30 40q8 -12 26 -15" stroke="#fff" stroke-opacity=".4" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    goggles = `<g><rect x="20" y="30" width="92" height="5.5" rx="2.7" fill="${INK}" opacity=".88"/><circle cx="49" cy="33" r="12" fill="#BDEFF6" stroke="${INK}" stroke-width="3.4"/><circle cx="83" cy="33" r="12" fill="#BDEFF6" stroke="${INK}" stroke-width="3.4"/><path d="M42 30l5 -3M76 30l5 -3" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></g>`;
    eyes = eyeSet(m.eyes, ex[0], ey, er, -1) + eyeSet(m.eyes, ex[1], ey, er, -1)
      + brow(ex[0], by + 2, 20, m.bl, -1) + brow(ex[1], by + 2, 20, m.br, 1)
      + `<path d="M64 74q-3 7 1 9" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".5"/>`
      + `<g fill="${INK}" opacity=".22">${[44, 52, 60, 68, 76, 84].map((x, i) => `<circle cx="${x}" cy="${103 - (i % 2) * 3}" r="1.5"/>`).join("")}</g>`;
  } else {
    head = `<circle cx="116" cy="40" r="11.5" fill="#2A1B16"/><path d="M110 46q9 6 8 14" stroke="#2A1B16" stroke-width="7" fill="none" stroke-linecap="round"/><circle cx="108" cy="49" r="5.2" fill="${COL.x}"/>
      <circle cx="24" cy="72" r="7.5" fill="${skin}"/><circle cx="108" cy="72" r="7.5" fill="${skin}"/><circle cx="24" cy="81" r="3.2" fill="#FFC23C" stroke="#B88400" stroke-width="1"/>
      <ellipse cx="66" cy="64" rx="41" ry="43" fill="${skin}"/>
      <path d="M25 58C25 28 44 14 66 14s41 14 41 44q-41 -8 -82 0z" fill="${cap}"/><path d="M30 46q36 -9 72 0" stroke="${capD}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
      <path d="M34 36q8 -12 24 -14" stroke="#fff" stroke-opacity=".4" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    goggles = `<g><rect x="23" y="62" width="86" height="5" rx="2.5" fill="${INK}" opacity=".88"/><circle cx="48" cy="65" r="15.5" fill="#CFF3F8" stroke="${INK}" stroke-width="3.6"/><circle cx="84" cy="65" r="15.5" fill="#CFF3F8" stroke="${INK}" stroke-width="3.6"/><path d="M63.5 63h5" stroke="${INK}" stroke-width="3.4"/></g>`;
    eyes = `<clipPath id="lensA"><circle cx="48" cy="65" r="12"/></clipPath><clipPath id="lensB"><circle cx="84" cy="65" r="12"/></clipPath>
      <g clip-path="url(#lensA)">${eyeSet(m.eyes, ex[0], ey, er, 1)}</g><g clip-path="url(#lensB)">${eyeSet(m.eyes, ex[1], ey, er, 1)}</g>
      <path d="M40 54l-6 -3M48 52l-1 -5M56 54l3 -4" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity="0"/>
      ${brow(ex[0], by, 22, m.bl, -1)}${brow(ex[1], by, 22, m.br, 1)}
      <path d="M65 83q-2 3 1 4" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".5"/>`;
  }
  const mouth = mouthPath(m.mouth, 66, my);
  const sweat = mood === "worry" ? `<path d="M110 30q-6 12 0 16q6 -4 0 -16z" fill="#7CD6FF" stroke="${INK}" stroke-width="1.6"/>` : "";
  const hand = (cx) => `<rect x="${cx - 14}" y="102" width="28" height="16" rx="8" fill="${skin}"/>`;
  return `<svg class="swimmer swimmer-${seat} mood-${mood}" viewBox="0 0 132 118" aria-hidden="true">${head}${cheeks}${goggles}${eyes}${mouth}${sweat}${hand(30)}${hand(102)}${rankDecor(seat, level)}</svg>`;
}

// bójky v bazénu: míč = poklad, sonarový kroužek = radar zdarma, ježek = mina (středy v souřadnicích bazénu)
export function buoyG(kind, cx, cy) {
  const base = `<ellipse cx="${cx}" cy="${cy + 15}" rx="14" ry="3.6" fill="#0B5E6E" opacity=".28"/>`;
  if (kind === "poklad") return `<g class="buoy buoy-poklad" data-buoy="poklad">${base}<circle cx="${cx}" cy="${cy}" r="14" fill="#FFD23F" stroke="${INK}" stroke-width="2.6"/><path d="M${cx - 13} ${cy - 3}q13 8 26 0M${cx - 11} ${cy + 7}q11 5 22 0" stroke="#FF5A2E" stroke-width="3.4" fill="none" stroke-linecap="round"/><path d="M${cx - 8} ${cy - 8}q4 -4 9 -4" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".85"/></g>`;
  if (kind === "radar") return `<g class="buoy buoy-radar" data-buoy="radar">${base}<circle cx="${cx}" cy="${cy}" r="14" fill="#BDEFF6" stroke="${INK}" stroke-width="2.6"/><circle cx="${cx}" cy="${cy}" r="8" fill="none" stroke="${INK}" stroke-width="2.4"/><circle cx="${cx}" cy="${cy}" r="3" fill="${INK}"/><path d="M${cx} ${cy}L${cx + 9} ${cy - 9}" stroke="#FF5A2E" stroke-width="3" stroke-linecap="round"/></g>`;
  const sp = [...Array(10)].map((_, i) => { const a = i * Math.PI / 5, x1 = cx + Math.cos(a) * 11, y1 = cy + Math.sin(a) * 11, x2 = cx + Math.cos(a) * 19, y2 = cy + Math.sin(a) * 19; return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`; }).join("");
  return `<g class="buoy buoy-mina" data-buoy="mina">${base}${sp}<circle cx="${cx}" cy="${cy}" r="12.5" fill="#7A5CC9" stroke="${INK}" stroke-width="2.6"/><circle cx="${cx - 4}" cy="${cy - 2}" r="2.2" fill="#fff"/><circle cx="${cx + 4}" cy="${cy - 2}" r="2.2" fill="#fff"/><path d="M${cx - 4} ${cy + 5}q4 3 8 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></g>`;
}
// ozdoby plavce podle úrovně titulu 0–4: pruhy na čepici (Vodník), zlatá kachna (Kapitán), korunka (Admirál), zlatý lem (Vševěd)
export function rankDecor(seat, level) {
  if (!level) return "";
  const isX = seat === "x", y0 = isX ? 15 : 14, cx = 66;
  let d = "";
  if (level >= 1) d += `<path d="M${cx - 30} ${y0 + 8}q30 -8 60 0M${cx - 34} ${y0 + 15}q34 -9 68 0" stroke="#fff" stroke-width="3.6" fill="none" stroke-linecap="round" opacity=".92"/>`;
  if (level >= 2) d += `<g transform="translate(${isX ? 93 : 92} ${y0 + 4}) rotate(14)"><ellipse cx="0" cy="3" rx="11" ry="8" fill="#FFD23F" stroke="${INK}" stroke-width="2.2"/><circle cx="-8" cy="-5" r="6" fill="#FFD23F" stroke="${INK}" stroke-width="2.2"/><path d="M-13 -5l-6 2l6 2z" fill="#FF8A1E" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="-9" cy="-6" r="1.2" fill="${INK}"/></g>`;
  if (level >= 3) d += `<g transform="translate(${cx} ${y0 - 7})"><path d="M-17 4L-20 -12L-9 -3L0 -15L9 -3L20 -12L17 4z" fill="#FFD23F" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="0" cy="-15" r="2.6" fill="#FF5A2E" stroke="${INK}" stroke-width="1.4"/><circle cx="-20" cy="-12" r="2.2" fill="#FF5A2E" stroke="${INK}" stroke-width="1.2"/><circle cx="20" cy="-12" r="2.2" fill="#FF5A2E" stroke="${INK}" stroke-width="1.2"/></g>`;
  if (level >= 4) d += `<circle cx="${cx}" cy="${isX ? 62 : 64}" r="${isX ? 47 : 48}" fill="none" stroke="#FFD23F" stroke-width="3.4" opacity=".75"/>`;
  return `<g class="rank rank-${level}">${d}</g>`;
}
