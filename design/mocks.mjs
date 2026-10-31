// Dva statické návrhy herní obrazovky (mobil 390×844, dvě fáze: střelba a otázka).
// node design/mocks.mjs → design/navrh-a-bazen.svg, design/navrh-b-admiral.svg
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const DIR = path.dirname(fileURLToPath(import.meta.url));

const W = 390, H = 844, GAP = 48, PAD = 32;
const frame = (x, y, inner, bg, label) => `
  <text x="${x}" y="${y - 12}" font-family="Onest" font-size="14" fill="#6B7280">${label}</text>
  <g transform="translate(${x} ${y})">
    <clipPath id="clip${x}"><rect width="${W}" height="${H}" rx="44"/></clipPath>
    <g clip-path="url(#clip${x})"><rect width="${W}" height="${H}" fill="${bg}"/>${inner}</g>
    <rect width="${W}" height="${H}" rx="44" fill="none" stroke="#111" stroke-width="6"/>
  </g>`;
const page = (body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAD * 2 + W * 2 + GAP} ${H + PAD * 2 + 24}" width="${PAD * 2 + W * 2 + GAP}" height="${H + PAD * 2 + 24}">
<rect width="100%" height="100%" fill="${bg}"/>${body}</svg>`;

// ---------------------------------------------------------------- A: BAZÉN (nafukovací flotila)
const A = {
  deck: "#F4E7D4", deck2: "#E9D6BC", coping: "#FFFDF8", water: "#2DB3C7", waterDeep: "#1E9BB0",
  ink: "#1C2A39", x: "#FF5A2E", o: "#3D5AFE", skin1: "#F1C39F", skin2: "#C88B66",
};
function poolA(x, y, cell, n = 8) {
  const s = cell * n, c = 8 * cell / 42;
  let g = `<rect x="${x - c}" y="${y - c}" width="${s + 2 * c}" height="${s + 2 * c}" rx="${14 * cell / 42}" fill="${A.coping}"/>`;
  g += `<rect x="${x - c}" y="${y + s + c - 3}" width="${s + 2 * c}" height="3" fill="${A.deck2}" opacity=".0"/>`;
  g += `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${6 * cell / 42}" fill="${A.water}"/>`;
  for (let i = 1; i < n; i++) {
    g += `<line x1="${x + i * cell}" y1="${y}" x2="${x + i * cell}" y2="${y + s}" stroke="#fff" stroke-opacity=".26" stroke-width="${cell > 30 ? 1.6 : 1}"/>`;
    g += `<line x1="${x}" y1="${y + i * cell}" x2="${x + s}" y2="${y + i * cell}" stroke="#fff" stroke-opacity=".26" stroke-width="${cell > 30 ? 1.6 : 1}"/>`;
  }
  // stín od okraje (hloubka) – jen horní a levý pruh
  g += `<path d="M${x} ${y}h${s}v${cell * .22}H${x + cell * .22}V${y + s}H${x}Z" fill="${A.waterDeep}" opacity=".55"/>`;
  return g;
}
// nafukovací hračky shora; (cx, cy) střed, délka v buňkách, vodorovně
function croc(x, y, cell, flat = false) {
  const L = cell * 4, h = cell * .78, cy = y + cell / 2, op = flat ? .55 : 1;
  return `<g opacity="${op}">
    <rect x="${x + cell * .1}" y="${cy - h / 2}" width="${L - cell * .55}" height="${h}" rx="${h / 2}" fill="#3FAE49"/>
    <path d="M${x + L - cell * .6} ${cy - h * .38} q${cell * .55} ${h * .1} ${cell * .5} ${h * .38} q0 ${h * .3} -${cell * .5} ${h * .38}z" fill="#3FAE49"/>
    <rect x="${x + cell * .3}" y="${cy - h * .18}" width="${L - cell * 1.2}" height="${h * .36}" rx="${h * .18}" fill="#7BD07E"/>
    ${[0, 1, 2, 3].map(i => `<circle cx="${x + cell * (.7 + i * .7)}" cy="${cy - h * .5}" r="${cell * .09}" fill="#2E8A37"/><circle cx="${x + cell * (.7 + i * .7)}" cy="${cy + h * .5}" r="${cell * .09}" fill="#2E8A37"/>`).join("")}
    ${flat ? `<path d="M${x + L - cell * .62} ${cy - h * .3}l${cell * .14} ${cell * .14}m0 -${cell * .14}l-${cell * .14} ${cell * .14}M${x + L - cell * .62} ${cy + h * .14}l${cell * .14} ${cell * .14}m0 -${cell * .14}l-${cell * .14} ${cell * .14}" stroke="${A.ink}" stroke-width="${cell * .05}" stroke-linecap="round"/>`
      : `<circle cx="${x + L - cell * .55}" cy="${cy - h * .24}" r="${cell * .1}" fill="#fff"/><circle cx="${x + L - cell * .52}" cy="${cy - h * .24}" r="${cell * .05}" fill="${A.ink}"/><circle cx="${x + L - cell * .55}" cy="${cy + h * .24}" r="${cell * .1}" fill="#fff"/><circle cx="${x + L - cell * .52}" cy="${cy + h * .24}" r="${cell * .05}" fill="${A.ink}"/>`}
  </g>`;
}
function mattress(x, y, cell, vertical = false) {
  const L = cell * 3 - cell * .16, h = cell * .8;
  const g = `<rect x="${cell * .08}" y="${-h / 2}" width="${L}" height="${h}" rx="${cell * .24}" fill="#FF7FA8"/>
    ${[1, 2, 3, 4, 5].map(i => `<rect x="${cell * .08 + i * L / 6 - cell * .07}" y="${-h / 2 + cell * .06}" width="${cell * .14}" height="${h - cell * .12}" rx="${cell * .07}" fill="#fff" opacity=".85"/>`).join("")}
    <rect x="${cell * .14}" y="${-h / 2 + cell * .08}" width="${cell * .5}" height="${h - cell * .16}" rx="${cell * .18}" fill="#FFB3CB"/>`;
  return vertical ? `<g transform="translate(${x + cell / 2} ${y}) rotate(90)">${g}</g>` : `<g transform="translate(${x} ${y + cell / 2})">${g}</g>`;
}
function unicorn(x, y, cell) {
  const L = cell * 3, h = cell * .8, cy = y + cell / 2;
  return `<g>
    <ellipse cx="${x + L * .45}" cy="${cy}" rx="${L * .4}" ry="${h / 2}" fill="#fff"/>
    <ellipse cx="${x + L * .45}" cy="${cy}" rx="${L * .26}" ry="${h * .26}" fill="#F1ECFF"/>
    <path d="M${x + L * .2} ${cy - h * .45} q${L * .3} -${h * .2} ${L * .6} 0" fill="none" stroke="#B79CFF" stroke-width="${cell * .14}" stroke-linecap="round"/>
    <circle cx="${x + L * .86}" cy="${cy}" r="${h * .34}" fill="#fff"/>
    <path d="M${x + L * .97} ${cy - h * .06} l${cell * .32} ${-h * .05} l-${cell * .3} ${h * .2}z" fill="#FFC23C"/>
    <circle cx="${x + L * .88}" cy="${cy - h * .13}" r="${cell * .05}" fill="${A.ink}"/>
    <path d="M${x + L * .06} ${cy} q-${cell * .1} -${h * .25} ${cell * .02} -${h * .4} M${x + L * .06} ${cy} q-${cell * .14} ${h * .2} ${cell * .02} ${h * .38}" stroke="#B79CFF" stroke-width="${cell * .1}" fill="none" stroke-linecap="round"/>
  </g>`;
}
function duck(x, y, cell, vertical = false, flat = false) {
  const g = `<g opacity="${flat ? .55 : 1}">
    <ellipse cx="${cell * .95}" cy="0" rx="${cell * .9}" ry="${cell * .38}" fill="#FFD23F"/>
    <circle cx="${cell * 1.55}" cy="0" r="${cell * .3}" fill="#FFD23F"/>
    <path d="M${cell * 1.8} ${-cell * .1} l${cell * .2} ${cell * .1} l-${cell * .2} ${cell * .1}z" fill="#FF8A1E"/>
    <path d="M${cell * .3} ${-cell * .2} q${cell * .45} ${cell * .2} ${cell * .9} 0" fill="none" stroke="#F2B705" stroke-width="${cell * .08}" stroke-linecap="round"/>
    ${flat ? `<path d="M${cell * 1.5} ${-cell * .14}l${cell * .1} ${cell * .1}m0 -${cell * .1}l-${cell * .1} ${cell * .1}" stroke="${A.ink}" stroke-width="${cell * .045}" stroke-linecap="round"/>` : `<circle cx="${cell * 1.58}" cy="${-cell * .1}" r="${cell * .05}" fill="${A.ink}"/>`}
  </g>`;
  return vertical ? `<g transform="translate(${x + cell / 2} ${y}) rotate(90)">${g}</g>` : `<g transform="translate(${x} ${y + cell / 2})">${g}</g>`;
}
const missA = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r * .42}" fill="none" stroke="#fff" stroke-width="${r * .09}" opacity=".95"/><circle cx="${cx}" cy="${cy}" r="${r * .18}" fill="#fff" opacity=".9"/>`;
const dotA = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r * .08}" fill="#fff" opacity=".55"/>`;
const hitA = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r * .4}" fill="${A.ink}"/><path d="M${cx - r * .2} ${cy - r * .05}l${r * .1} ${r * .12}l${r * .1} -${r * .14}l${r * .1} ${r * .12}" stroke="#fff" stroke-width="${r * .07}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

function swimmer(cx, cy, cap, skin, mood, flip = false) {
  // hlava za okrajem bazénu, ruce na okraji; nálada: smirk / shock / devil / worry
  const eyes = {
    smirk: `<path d="M-15 -2q5 -5 10 0M5 -2q5 -5 10 0" stroke="${A.ink}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
    shock: `<circle cx="-10" cy="-2" r="9" fill="#fff" stroke="${A.ink}" stroke-width="3"/><circle cx="10" cy="-2" r="9" fill="#fff" stroke="${A.ink}" stroke-width="3"/><circle cx="-10" cy="-2" r="3.4" fill="${A.ink}"/><circle cx="10" cy="-2" r="3.4" fill="${A.ink}"/><rect x="-2" y="-4" width="4" height="3" fill="${A.ink}"/>`,
    devil: `<circle cx="-10" cy="0" r="3.6" fill="${A.ink}"/><circle cx="10" cy="0" r="3.6" fill="${A.ink}"/><path d="M-17 -9l12 4M17 -11l-12 6" stroke="${A.ink}" stroke-width="3.4" stroke-linecap="round"/>`,
    worry: `<circle cx="-10" cy="0" r="3.6" fill="${A.ink}"/><circle cx="10" cy="0" r="3.6" fill="${A.ink}"/><path d="M-16 -8l10 -4M16 -8l-10 -4" stroke="${A.ink}" stroke-width="3.2" stroke-linecap="round"/>`,
  }[mood];
  const mouth = {
    smirk: `<path d="M-6 14q8 6 14 -3" stroke="${A.ink}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
    shock: `<ellipse cx="0" cy="17" rx="6" ry="8" fill="${A.ink}"/><ellipse cx="0" cy="21" rx="4" ry="3" fill="#FF7F7F"/>`,
    devil: `<path d="M-10 12q10 10 20 0z" fill="${A.ink}"/><path d="M-7 12.5h14v3h-14z" fill="#fff"/>`,
    worry: `<path d="M-8 18q4 -4 8 0t8 0" stroke="${A.ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
  }[mood];
  const goggles = mood === "shock" ? "" : `<g transform="translate(0 -21)"><rect x="-30" y="-2" width="60" height="4" fill="${A.ink}" opacity=".85"/><circle cx="-11" cy="0" r="8" fill="#BDEFF6" stroke="${A.ink}" stroke-width="3"/><circle cx="11" cy="0" r="8" fill="#BDEFF6" stroke="${A.ink}" stroke-width="3"/><path d="M-14 -3l4 -2M8 -3l4 -2" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>`;
  return `<g transform="translate(${cx} ${cy}) scale(${flip ? -1 : 1} 1)">
    <path d="M-34 6a34 36 0 0 1 68 0v40h-68z" fill="${skin}"/>
    <path d="M-36 -2a36 34 0 0 1 72 0z" fill="${cap}"/>
    <path d="M-36 -2h72" stroke="${cap}" stroke-width="6" stroke-linecap="round"/>
    <path d="M-12 -30q12 -6 24 0" stroke="#fff" stroke-opacity=".35" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${goggles}
    <g transform="translate(0 14)">${eyes}${mouth}</g>
    <circle cx="-22" cy="26" r="5" fill="#FF8C7A" opacity=".45"/><circle cx="22" cy="26" r="5" fill="#FF8C7A" opacity=".45"/>
  </g>`;
}
const hands = (cx, y, skin) => `<rect x="${cx - 40}" y="${y - 7}" width="22" height="15" rx="7.5" fill="${skin}"/><rect x="${cx + 18}" y="${y - 7}" width="22" height="15" rx="7.5" fill="${skin}"/>`;
const balloon = (x, y, c, used) => `<g transform="translate(${x} ${y})" opacity="${used ? .28 : 1}"><path d="M0 -13c8 0 12 7 12 13a12 12 0 0 1-24 0c0-6 4-13 12-13z" fill="${c}"/><path d="M-3 -14l3 -4 3 4z" fill="${c}"/><path d="M-6 -3q2 -5 6 -6" stroke="#fff" stroke-opacity=".6" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>`;

function topA(score, moodX, moodO) {
  return `
  <text x="24" y="62" font-family="Fredoka" font-weight="600" font-size="17" fill="${A.ink}">Nafukovací flotila</text>
  <g transform="translate(352 56)" stroke="${A.ink}" stroke-width="2.6" fill="none" stroke-linecap="round"><path d="M-9 -3v-6h6M3 -9h6v6M9 3v6h-6M-3 9h-6v-6"/></g>
  ${swimmer(82, 150, A.x, A.skin1, moodX)}${swimmer(308, 150, A.o, A.skin2, moodO, true)}
  <text x="195" y="146" text-anchor="middle" font-family="Fredoka" font-weight="600" font-size="40" fill="${A.ink}">${score}</text>
  <text x="195" y="168" text-anchor="middle" font-family="Onest" font-size="12" fill="${A.ink}" opacity=".55">série</text>
  <text x="82" y="102" text-anchor="middle" font-family="Onest" font-weight="700" font-size="13" fill="${A.ink}">Mark</text>
  <text x="308" y="102" text-anchor="middle" font-family="Onest" font-weight="700" font-size="13" fill="${A.ink}">Radka</text>`;
}

function mockA() {
  const cell = 42, px = 27, py = 208, C = (c, r) => [px + c * cell + cell / 2, py + r * cell + cell / 2];
  let p1 = topA("2 : 1", "smirk", "shock");
  p1 += poolA(px, py, cell);
  // soupeřův bazén: miny, zásahy, potopená kachna G7–G8 + okolí odhalené
  const miss = [[0, 0], [5, 1], [2, 6], [6, 3], [3, 2], [7, 5]];
  miss.forEach(([c, r]) => { const [x, y] = C(c, r); p1 += missA(x, y, cell); });
  [[5, 5], [5, 6], [5, 7], [7, 5]].forEach(([c, r]) => { const [x, y] = C(c, r); p1 += dotA(x, y, cell); });
  p1 += duck(px + 6 * cell, py + 6 * cell, cell, true, true);
  p1 += `<text x="${C(6, 6)[0] + 26}" y="${C(6, 7)[1] + 48}" font-family="Onest" font-size="0"> </text>`;
  [[2, 4]].forEach(([c, r]) => { const [x, y] = C(c, r); p1 += hitA(x, y, cell); });
  // čerstvý zásah D5: šplouch + PSST
  const [hx, hy] = C(3, 4);
  p1 += `<g transform="translate(${hx} ${hy})">
    ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i * Math.PI / 4 + .2, r1 = 26, r2 = 40 + (i % 2) * 8; return `<path d="M${Math.cos(a) * r1} ${Math.sin(a) * r1}L${Math.cos(a) * r2} ${Math.sin(a) * r2}" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`; }).join("")}
    <circle r="22" fill="#fff"/><circle r="17" fill="${A.ink}"/>
    <path d="M-9 -2l4 5l4 -6l4 5l4 -4" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <g transform="translate(${hx + 18} ${hy - 50}) rotate(-8)">
    <text font-family="Fredoka" font-weight="700" font-size="30" fill="#fff" stroke="${A.ink}" stroke-width="7" paint-order="stroke" stroke-linejoin="round">PSSST!</text>
  </g>`;
  // zaměřovač F2
  const [ax, ay] = C(5, 1 + 1);
  p1 += `<g transform="translate(${ax} ${ay})"><rect x="-19" y="-19" width="38" height="38" rx="9" fill="none" stroke="${A.x}" stroke-width="4"/><circle r="4" fill="${A.x}"/></g>`;
  // ruce na okraji
  p1 += hands(82, 201, A.skin1) + hands(308, 201, A.skin2);

  // spodní panel: můj bazén + rány
  const mc = 18, mx = 28, my = 600;
  p1 += poolA(mx, my, mc);
  p1 += croc(mx + 0 * mc, my + 0 * mc, mc) + mattress(mx + 5 * mc, my + 2 * mc, mc, true) + unicorn(mx + 1 * mc, my + 5 * mc, mc) + duck(mx + 5 * mc, my + 7 * mc, mc);
  [[3, 3], [7, 1], [0, 7]].forEach(([c, r]) => p1 += missA(mx + c * mc + mc / 2, my + r * mc + mc / 2, mc));
  p1 += hitA(mx + 5 * mc + mc / 2, my + 3 * mc + mc / 2, mc);
  p1 += `<text x="${mx + 72}" y="${my + 172}" text-anchor="middle" font-family="Onest" font-size="12" fill="${A.ink}" opacity=".6">Tvůj bazén</text>`;
  p1 += `<g transform="translate(206 606)">
    <text font-family="Onest" font-weight="700" font-size="13" fill="${A.ink}" opacity=".6">TVOJE RÁNY</text>
    ${balloon(14, 38, A.x, true)}${balloon(46, 38, A.x)}${balloon(78, 38, A.x)}
    <text y="76" font-family="Onest" font-size="13" fill="${A.ink}">Správně, střední otázka</text>
    <g transform="translate(0 94)"><rect width="156" height="46" rx="23" fill="${A.ink}"/>
      <g transform="translate(26 23)" fill="none" stroke="#fff" stroke-width="2.4"><circle r="9"/><circle r="4"/><path d="M0 0l7 -7" stroke-linecap="round"/></g>
      <text x="46" y="29" font-family="Onest" font-weight="700" font-size="15" fill="#fff">Radar 3 × 3</text></g>
  </g>
  <text x="195" y="800" text-anchor="middle" font-family="Onest" font-weight="600" font-size="15" fill="${A.ink}">Klepni do Radčina bazénu</text>`;

  // obrazovka 2: otázka
  let p2 = topA("2 : 1", "worry", "devil");
  p2 += poolA(px, py, cell);
  miss.forEach(([c, r]) => { const [x, y] = C(c, r); p2 += missA(x, y, cell); });
  p2 += duck(px + 6 * cell, py + 6 * cell, cell, true, true) + hitA(...C(2, 4), cell) + hitA(...C(3, 4), cell);
  p2 += hands(82, 201, A.skin1) + hands(308, 201, A.skin2);
  p2 += `<rect y="0" width="${W}" height="${H}" fill="${A.ink}" opacity=".42"/>`;
  p2 += `<g transform="translate(14 300)">
    <rect width="362" height="530" rx="30" fill="${A.coping}"/>
    <g transform="translate(22 30)">
      <rect width="96" height="34" rx="17" fill="${A.o}"/>
      <g transform="translate(20 17)" fill="none" stroke="#fff" stroke-width="2.4"><circle r="8"/><path d="M-8 0h16M0 -8q5 8 0 16M0 -8q-5 8 0 16"/></g>
      <text x="36" y="23" font-family="Onest" font-weight="700" font-size="15" fill="#fff">Sport</text>
      <text x="108" y="23" font-family="Onest" font-size="14" fill="${A.ink}" opacity=".7">vybrala ti Radka</text>
      <text x="318" y="23" text-anchor="end" font-family="Onest" font-weight="700" font-size="14" fill="${A.ink}">střední · 3 rány</text>
    </g>
    <g transform="translate(22 84)">
      <rect width="318" height="12" rx="6" fill="${A.deck}"/>
      <rect width="${318 * .62}" height="12" rx="6" fill="${A.x}"/>
      <rect x="${318 * .75 - 1}" y="-4" width="2.5" height="20" fill="${A.ink}" opacity=".5"/>
      <text x="0" y="36" font-family="Onest" font-size="12" fill="${A.ink}" opacity=".6">12 s</text>
      <text x="${318 * .75}" y="36" text-anchor="middle" font-family="Onest" font-size="12" fill="${A.ink}" opacity=".6">rychle = radar</text>
    </g>
    <text font-family="Fredoka" font-weight="600" font-size="26" fill="${A.ink}">
      <tspan x="22" y="172">Ve kterém městě vyhráli</tspan><tspan x="22" y="204">čeští hokejisté olympijské</tspan><tspan x="22" y="236">zlato v roce 1998?</tspan></text>
    ${[["Lillehammer", 0, 0], ["Nagano", 1, 0], ["Salt Lake City", 0, 1], ["Albertville", 1, 1]].map(([t, c, r], i) => `
      <g transform="translate(${22 + c * 164} ${276 + r * 86})">
        <rect y="4" width="154" height="74" rx="18" fill="${A.ink}"/>
        <rect width="154" height="74" rx="18" fill="${A.deck}" stroke="${A.ink}" stroke-width="2.5"/>
        <circle cx="24" cy="37" r="12" fill="${A.coping}" stroke="${A.ink}" stroke-width="2"/>
        <text x="24" y="42" text-anchor="middle" font-family="Onest" font-weight="700" font-size="13" fill="${A.ink}">${"ABCD"[i]}</text>
        <text x="44" y="43" font-family="Onest" font-weight="700" font-size="${t.length > 12 ? 15 : 17}" fill="${A.ink}">${t}</text>
      </g>`).join("")}
    <text x="181" y="474" text-anchor="middle" font-family="Onest" font-size="13" fill="${A.ink}" opacity=".6">Správně 3 rány · špatně 1 rána</text>
  </g>`;
  return page(frame(PAD, PAD + 24, p1, A.deck, "A · Bazén – střelba (čerstvý zásah)") + frame(PAD + W + GAP, PAD + 24, p2, A.deck, "A · Bazén – otázka (kategorii vybrala soupeřka)"), "#ECE7E1");
}

// ---------------------------------------------------------------- B: ADMIRÁL (klasické moře, signální vlajky)
const B = {
  sea: "#0F2F4D", board: "#17507A", line: "rgba(255,255,255,.13)", paper: "#F3E8D0", ink: "#14202C",
  x: "#E8452C", o: "#F2B233", steel: "#A7B6C5", steel2: "#7D90A3", skin1: "#F0C29C", skin2: "#C48B67",
};
function boardB(x, y, cell, n = 8, coords = true) {
  const s = cell * n;
  let g = `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="6" fill="${B.board}"/>`;
  for (let i = 1; i < n; i++) g += `<path d="M${x + i * cell} ${y}v${s}M${x} ${y + i * cell}h${s}" stroke="${B.line}" stroke-width="1.2"/>`;
  if (coords) for (let i = 0; i < n; i++) {
    g += `<text x="${x + i * cell + cell / 2}" y="${y - 7}" text-anchor="middle" font-family="Martian Mono" font-size="10" fill="${B.paper}" opacity=".6">${"ABCDEFGH"[i]}</text>`;
    g += `<text x="${x - 8}" y="${y + i * cell + cell / 2 + 4}" text-anchor="middle" font-family="Martian Mono" font-size="10" fill="${B.paper}" opacity=".6">${i + 1}</text>`;
  }
  return g;
}
function shipB(x, y, cell, len, vertical = false, sunk = false) {
  const L = cell * len - cell * .18, h = cell * .62;
  const fill = sunk ? "#3A4C5E" : B.steel, deck = sunk ? "#2C3A48" : B.steel2;
  const g = `<path d="M${cell * .09} ${-h / 2}H${L - cell * .3}Q${L + cell * .09} 0 ${L - cell * .3} ${h / 2}H${cell * .09}Q${-cell * .02} 0 ${cell * .09} ${-h / 2}z" fill="${fill}"/>
    <rect x="${cell * .4}" y="${-h * .22}" width="${L - cell * 1.2}" height="${h * .44}" rx="${h * .12}" fill="${deck}"/>
    ${[...Array(len - 1)].map((_, i) => `<circle cx="${cell * (.75 + i)}" cy="0" r="${cell * .12}" fill="${sunk ? "#22303D" : "#5E7387"}"/>`).join("")}`;
  return vertical ? `<g transform="translate(${x + cell / 2} ${y}) rotate(90)">${g}</g>` : `<g transform="translate(${x} ${y + cell / 2})">${g}</g>`;
}
const missB = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r * .16}" fill="${B.paper}" opacity=".8"/>`;
const hitB = (cx, cy, r) => `<g transform="translate(${cx} ${cy})"><path d="${star(r * .42, r * .2, 8)}" fill="${B.x}"/><circle r="${r * .14}" fill="${B.o}"/></g>`;
function star(R, r, n) { let d = ""; for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n - Math.PI / 2, q = i % 2 ? r : R; d += (i ? "L" : "M") + (Math.cos(a) * q).toFixed(1) + " " + (Math.sin(a) * q).toFixed(1); } return d + "Z"; }
function admiral(cx, cy, skin, accent, mood, flip = false) {
  const face = {
    smirk: `<path d="M-15 -1q5 -4 10 0M5 -1q5 -4 10 0" stroke="${B.ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/><path d="M-7 16q8 5 14 -3" stroke="${B.ink}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
    shock: `<circle cx="-10" cy="0" r="5" fill="${B.ink}"/><circle cx="10" cy="0" r="5" fill="${B.ink}"/><path d="M-16 -10l10 2M16 -10l-10 2" stroke="${B.ink}" stroke-width="3" stroke-linecap="round"/><ellipse cx="0" cy="18" rx="5" ry="7" fill="${B.ink}"/>`,
    devil: `<circle cx="-10" cy="1" r="3.6" fill="${B.ink}"/><circle cx="10" cy="1" r="3.6" fill="${B.ink}"/><path d="M-17 -8l12 4M17 -10l-12 6" stroke="${B.ink}" stroke-width="3.2" stroke-linecap="round"/><path d="M-10 13q10 9 20 0z" fill="${B.ink}"/>`,
    worry: `<circle cx="-10" cy="1" r="3.6" fill="${B.ink}"/><circle cx="10" cy="1" r="3.6" fill="${B.ink}"/><path d="M-16 -7l10 -4M16 -7l-10 -4" stroke="${B.ink}" stroke-width="3" stroke-linecap="round"/><path d="M-8 19q4 -4 8 0t8 0" stroke="${B.ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  }[mood];
  return `<g transform="translate(${cx} ${cy}) scale(${flip ? -1 : 1} 1)">
    <path d="M-30 30q30 18 60 0v20h-60z" fill="#22364B"/>
    <circle r="32" fill="${skin}"/>
    <path d="M-50 -16q50 -54 100 0q-50 -12 -100 0z" fill="#1A1F26"/>
    <path d="M-44 -18q44 -10 88 0" stroke="#D9A93A" stroke-width="3" fill="none"/>
    <circle cx="0" cy="-30" r="7" fill="${accent}"/>
    <g transform="translate(0 6)">${face}</g>
  </g>`;
}
function topB(score, mx, mo) {
  return `
  <text x="24" y="62" font-family="Alfa Slab One" font-size="17" fill="${B.paper}">Admirál Vševěd</text>
  <g transform="translate(352 56)" stroke="${B.paper}" stroke-width="2.6" fill="none" stroke-linecap="round"><path d="M-9 -3v-6h6M3 -9h6v6M9 3v6h-6M-3 9h-6v-6"/></g>
  ${admiral(80, 140, B.skin1, B.x, mx)}${admiral(310, 140, B.skin2, B.o, mo, true)}
  <text x="195" y="146" text-anchor="middle" font-family="Alfa Slab One" font-size="36" fill="${B.paper}">${score}</text>
  <text x="80" y="200" text-anchor="middle" font-family="Figtree" font-weight="700" font-size="13" fill="${B.paper}">Mark</text>
  <text x="310" y="200" text-anchor="middle" font-family="Figtree" font-weight="700" font-size="13" fill="${B.paper}">Radka</text>`;
}
function mockB() {
  const cell = 40, px = 35, py = 232, C = (c, r) => [px + c * cell + cell / 2, py + r * cell + cell / 2];
  const marks = () => {
    let g = "";
    [[0, 0], [5, 1], [2, 6], [6, 3], [3, 2], [7, 5], [5, 5], [5, 6], [5, 7], [7, 5]].forEach(([c, r]) => g += missB(...C(c, r), cell));
    g += shipB(px + 6 * cell, py + 6 * cell, cell, 2, true, true);
    g += hitB(...C(2, 4), cell);
    return g;
  };
  let p1 = topB("2 : 1", "smirk", "shock") + boardB(px, py, cell) + marks();
  const [hx, hy] = C(3, 4);
  p1 += `<g transform="translate(${hx} ${hy})"><path d="${star(38, 18, 10)}" fill="${B.o}"/><path d="${star(26, 12, 8)}" fill="${B.x}"/><circle r="8" fill="${B.paper}"/></g>
  <text x="${hx + 22}" y="${hy - 34}" font-family="Alfa Slab One" font-size="24" fill="${B.paper}" transform="rotate(-6 ${hx} ${hy})">ZÁSAH!</text>`;
  const [ax, ay] = C(5, 2);
  p1 += `<rect x="${ax - 18}" y="${ay - 18}" width="36" height="36" fill="none" stroke="${B.paper}" stroke-width="3" stroke-dasharray="7 5"/>`;
  const mc = 17, mx = 30, my = 600;
  p1 += boardB(mx, my, mc, 8, false) + shipB(mx, my, mc, 4) + shipB(mx + 5 * mc, my + 2 * mc, mc, 3, true) + shipB(mx + mc, my + 5 * mc, mc, 3) + shipB(mx + 5 * mc, my + 7 * mc, mc, 2);
  [[3, 3], [7, 1], [0, 7]].forEach(([c, r]) => p1 += missB(mx + c * mc + mc / 2, my + r * mc + mc / 2, mc));
  p1 += hitB(mx + 5 * mc + mc / 2, my + 3 * mc + mc / 2, mc);
  p1 += `<text x="${mx + 68}" y="${my + 160}" text-anchor="middle" font-family="Figtree" font-size="12" fill="${B.paper}" opacity=".6">Tvoje flotila</text>
  <g transform="translate(196 606)">
    <text font-family="Figtree" font-weight="700" font-size="13" fill="${B.paper}" opacity=".6">SALVA</text>
    ${[0, 1, 2].map(i => `<circle cx="${14 + i * 30}" cy="34" r="11" fill="${i ? B.o : "none"}" stroke="${B.o}" stroke-width="3"/>`).join("")}
    <text y="72" font-family="Figtree" font-size="13" fill="${B.paper}">Správně, střední otázka</text>
    <g transform="translate(0 90)"><rect width="160" height="46" rx="8" fill="${B.paper}"/><text x="80" y="29" text-anchor="middle" font-family="Figtree" font-weight="800" font-size="15" fill="${B.ink}">Radar 3 × 3</text></g>
  </g>
  <text x="195" y="800" text-anchor="middle" font-family="Figtree" font-weight="600" font-size="15" fill="${B.paper}">Vyber cíl v Radčině moři</text>`;

  let p2 = topB("2 : 1", "worry", "devil") + boardB(px, py, cell) + marks() + hitB(...C(3, 4), cell);
  p2 += `<rect width="${W}" height="${H}" fill="#06121E" opacity=".55"/>`;
  p2 += `<g transform="translate(14 300)">
    <rect width="362" height="530" rx="10" fill="${B.paper}"/>
    <path d="M0 0h362v46H0z" fill="${B.o}"/>
    <g transform="translate(22 15)">${[0, 1, 2, 3].map(i => `<rect x="${i * 18}" y="0" width="14" height="16" fill="${i % 2 ? B.ink : B.paper}"/>`).join("")}</g>
    <text x="104" y="29" font-family="Alfa Slab One" font-size="16" fill="${B.ink}">SPORT</text>
    <text x="340" y="29" text-anchor="end" font-family="Figtree" font-weight="700" font-size="13" fill="${B.ink}">od Radky · střední</text>
    <g transform="translate(22 70)">
      <rect width="318" height="10" fill="#E2D3B2"/><rect width="${318 * .62}" height="10" fill="${B.x}"/>
      <text y="30" font-family="Martian Mono" font-size="11" fill="${B.ink}" opacity=".7">12 s</text>
    </g>
    <text font-family="Alfa Slab One" font-size="23" fill="${B.ink}">
      <tspan x="22" y="150">Ve kterém městě vyhráli</tspan><tspan x="22" y="180">čeští hokejisté olympijské</tspan><tspan x="22" y="210">zlato v roce 1998?</tspan></text>
    ${[["Lillehammer", 0, 0], ["Nagano", 1, 0], ["Salt Lake City", 0, 1], ["Albertville", 1, 1]].map(([t, c, r], i) => `
      <g transform="translate(${22 + c * 164} ${256 + r * 86})">
        <rect width="154" height="74" rx="6" fill="none" stroke="${B.ink}" stroke-width="2.5"/>
        <text x="16" y="44" font-family="Martian Mono" font-size="13" fill="${B.ink}" opacity=".6">${"ABCD"[i]}</text>
        <text x="40" y="44" font-family="Figtree" font-weight="700" font-size="${t.length > 12 ? 15 : 17}" fill="${B.ink}">${t}</text>
      </g>`).join("")}
    <text x="181" y="460" text-anchor="middle" font-family="Figtree" font-size="13" fill="${B.ink}" opacity=".6">Správně 3 rány · špatně 1 rána</text>
  </g>`;
  return page(frame(PAD, PAD + 24, p1, B.sea, "B · Admirál – střelba (čerstvý zásah)") + frame(PAD + W + GAP, PAD + 24, p2, B.sea, "B · Admirál – otázka (kategorii vybrala soupeřka)"), "#ECE7E1");
}

fs.writeFileSync(path.join(DIR, "navrh-a-bazen.svg"), mockA());
fs.writeFileSync(path.join(DIR, "navrh-b-admiral.svg"), mockB());
console.log("ok");
