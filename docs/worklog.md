# Deník – Nafukovací flotila (kvizove-lode)

## 2026-10-31 · Claude (stavba hry + doplnění „Pestrost partií v2“)

### Hotovo
- Otázky: `tools/build-otazky.mjs` (+ `tools/over-otazky.mjs`) staví `data/otazky.json` ze `data/zdroj/*.json` (hash odpovědi, XOR-šifrovaný fakt, validace). Poslední sestavení: 210 otázek, 7 kategorií po 30.
- Engine `engine.js` (+ testy): flotila, kolize, obránce `defend` (ověřuje odpověď hashem, povolený počet ran, radar do 7 s), `verify` (přehraje obranu proti všem tahům po konci), `flow`.
- Hra: `index.html`, `src/{app,pool,art,net}.js`, `style.css`, manifest, ikony, statické fonty (DynaPuff, Onest); celý průběh výzva, rozmístění, tah, otázka, střelba, radar, konec, odveta, přihlížející; tři rozvržení (mobil na výšku, desktop, telefon na šířku).
- Oprava chyby pečeti „Poctivě ověřeno“: hráč, který zapsal `rev` jako poslední, se nepřekreslil a zůstal na „Ověřuji…“ (po zápisu `rev` je teď `renderAll`); ověření je navíc v `try/catch`.
- v2 Pestrost partií (zadání Marka „ne tolik repetitivní“, SPEC sekce Pestrost partií):
  - semínko partie `g.seed` (nové při každé odvetě); 3 bójky v každém bazénu (míč = +1 rána, sonar = radar zdarma `T.r2`, ježek = −1 rána v příštím tahu), každý druh jednou, zmizí po zásahu;
  - nabídka 3 kategorií místo 7 (bez minulé kategorie hráče), každý 5. tah Kolo štěstí;
  - Rozcvička (první 2 tahy jen lehká/střední) a Finále (poslední hračka: jen těžká, 4 rány), vynucuje obránce i `verify`;
  - Záchranný kruh (o 3+ zásahy víc obdržených než uštědřených: +1 rána, jednou „Vyměnit za lehčí“, ikona u jména);
  - tituly Plavčík, Vodník, Kapitán nafukovačky, Admirál bazénu, Vševěd (0/1/3/5/8 výher) s tvarem kapitán/kapitánka z výběru hráče, vzhled plavce (pruhy, zlatá kachna, korunka, zlatý lem), hláška o povýšení na obrazovce výhry;
  - otázky se v sérii neopakují (`used` + všechny `T[].q`).
- Rozvržení: nová karta otázky v telefonu na šířku zabírá pravý sloupec, malý telefon 375×667 se vejde i s titulem pod jménem (legenda bójek se tam skrývá).

### Testy (poslední běh, server `node tools/serve.cjs` na 8811)
- `node tests/engine.test.cjs`: 26 PASS, 0 FAIL.
- `node tests/balance.cjs`: průměrná partie 10,9 min (p10 8,9, p90 13,1), 22 tahů; lepší kvízař vyhrává 63,9 % (velký rozdíl 79,0 %), znalec 76,5 %, nadlidský vševěd 96,4 % (jen informativně); střední obtížnost nejlepší.
- `node tests/duel.cjs http://localhost:8811/`: 54 PASS, 0 FAIL (Chromium 1440×900 × WebKit iPhone 13, partie 1 a 2, odveta, přihlížející, kontrola čitelných odpovědí a flotily v synchronizovaných dokumentech, konzole).
- `node tests/tri-partie.cjs http://localhost:8811/`: 3 partie za sebou (60 až 77 s s `?rychle=1`), lišící se semínka, bójky, nabídky kategorií, první hráč, žádná opakovaná otázka, postup titulu (Plavčík, Vodník, Kapitán nafukovačky); snímky `tests/shots/tri/`.
- `node tests/layout.cjs http://localhost:8811/`: 36 kontrol ve 4 oknech (390×844, 375×667, 1280×720, 844×390), bez posouvání v herních fázích, nic mimo okno, text ≥ 14 px; snímky `tests/shots/layout/`.

### Předpoklady a známé mezery
- Ztracené `localStorage` = zařízení nemůže dál bránit (flotila je jen tam). Nezavřená otázka při zavřené záložce nemá časový limit na straně soupeře.
- Přímé klepnutí vystřelí hned (bez potvrzení). Žádný zvuk. Souřadnicové popisky na okraji bazénu chybí.
- Klíč faktu používá `"f|"+id+"|"+správná` (SPEC původně jinak). Dokument navíc obsahuje `K` (pořadí potopených hraček).
- Záchranný kruh (`T.rs`) obránce ověřit neumí (potřebuje stav střelce v tu chvíli): bere se na slovo, maximální zisk +1 rána za tah.
- Tvar titulu (kapitán/kapitánka) volí hráč sám (založitel při výzvě, soupeř při přijetí); z jména se nehádá.
- `tests/balance.cjs` modeluje základní pravidla; bójky, rozcvičku a finále nesimuluje (dopad: finále dává poslednímu zásahu až 4 rány, průměrnou délku nejspíš mírně zkracuje).
- Neověřeno na skutečném iPhonu (jen headless WebKit). Použité fonty jsou lokální soubory (licence OFL).
