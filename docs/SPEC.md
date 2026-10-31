# Nafukovací flotila – specifikace (2026-10-31)

Lodě 1v1 s kvízem pro Marka a Radku. Živě na jednom odkazu, bez účtů, GitHub Pages (`sachasportrezervace-arch/kvizove-lode`).
Vzory architektury: `../kaficka/index.html` (sync přes mantledb.sh, role Přihlížíš, fullscreen, „Přidat na plochu“, seznam rozehraných),
`../ovocny-souboj` (3 dokumenty, každý s jedním zapisovatelem, rychlé dotazování), `../zviratka-sogi` (engine.js + testy ve 2 prohlížečích).

## Twist – varianty a volba
1. **Otázka o každou ránu** (výchozí návrh): správně = rána, špatně = tah propadá. Mrtvé tahy, partie 25+ min, kvíz přebije lodě.
2. **Salva za vědomosti** (VYBRÁNO): jedna otázka na tah. Kategorii ti vybírá soupeř (škádlení), obtížnost si volíš sám (riziko).
   Špatně = 1 rána, správně = lehká 2 / střední 3 / těžká 4 rány, správně do 7 s = navíc radar 3×3 (ukáže počet lodních políček v oblasti).
   Proč: žádný tah není mrtvý, vědomosti zrychlují, volba obtížnosti je skutečné rozhodnutí, výběr kategorie soupeři je ten humor. Partie ~10 min.
3. **Prozrazená loď**: střílí se klasicky, při zásahu tvé lodi odpovídáš; špatně = soupeř dostane nápovědu (řádek další lodi). Kvíz trestá obránce, pomalé.

## Pravidla (5 vět pro Marka)
1. Každý si tažením rozmístí 4 nafukovací hračky do svého bazénu 8 × 8 (klepnutím otočíš, nesmí se dotýkat ani rohem).
2. Na tahu ti soupeř vybere kategorii otázky a ty si zvolíš obtížnost.
3. Na odpověď máš 20 s: správně = lehká 2 rány, střední 3, těžká 4; špatně = jen 1 rána.
4. Správná odpověď do 7 s přidá radar, který v oblasti 3 × 3 prozradí, kolik je tam políček hraček.
5. Kdo první propíchne všechny soupeřovy hračky, vyhrává a odveta pokračuje ve skóre série.

## Herní jádro
`engine.js` (window.Lode / module.exports) – hotové: flotila, kolize, náhodné rozmístění, odpověď obránce (`resolve`), radar, pohled na moře, výběr otázky, `flow()` = kdo je na tahu a v jaké fázi, `answerHash`.
Flotila `SIZES = [4,3,3,2]`: krokodýl (4), lehátko (3), jednorožec (3), kachna (2). Po potopení se okolní pole odhalí jako jistá voda.

## Synchronizace (mantledb.sh, vzor Kafíčka/Ovocný souboj)
Odkaz `#r.<id>`. Tři dokumenty, každý má jednoho zapisovatele (žádné kolize):
- `kvizove-lode-<id>/hra` – místnost: `{app:"kl", g:{x, o, s, w:[wx,wo], k, kc, c, n, used:[qid…]}, v, sx, so, u}`
  (jména, kdo začíná tuto partii, skóre série, sázka (předvolba/vlastní), vzkaz k výzvě, číslo partie, otázky použité v sérii, tokeny míst jako v Kafíčkách).
- `kvizove-lode-<id>/x` a `/o` – dokument hráče, zapisuje jen zařízení s jeho tokenem:
  `{n, fh, ready, c0, T:[…], R:"64 znaků", S:[[pole…]…], D:{pole:počet}, rev:{f, salt}|null}`
  - `fh` = sha256(fleetKey + salt) – závazek flotily; flotila + salt leží jen v localStorage zařízení (`kl-fleet-<id>-<n>-<seat>`).
  - `c0` = kategorie, kterou soupeři vybírám pro jeho první otázku (vybírá se po rozmístění).
  - `T[i]` = můj i-tý tah: `{d, q, o:"perm4", t0, a:null|-1|0..3, ms, ok, n, sh:[pole], r:pole|null, nc:kategorie|null}`
    (`a` = index zvolené možnosti v zobrazeném pořadí `o`, −1 = vypršel čas; `ok` = správně; `n` = povolený počet ran; `nc` = kategorie pro soupeřův další tah → tím tah končí).
  - `R`, `S`, `D` = moje odpovědi na soupeřovy výstřely: `R[i]` '.' / 'm' / 'h' / 's', `S` = potopené lodě (pole), `D` = radar.
- Obránce odpovídá automaticky, jakmile v soupeřově dokumentu uvidí nevyřízený výstřel nebo radar (i když zrovna není v popředí jeho UI) a nikdy nevyřídí víc ran, než dovoluje `n` (kontrola `ok` přes `answerHash`).
- Dotazování: během tahu soupeře a při čekání na odpověď výstřelu ~350 ms jen na soupeřův dokument; jinak 1,5 s; v pozadí 6 s. Zápisy vlastního dokumentu jdou frontou (vždy poslední stav, nikdy dva POSTy souběžně).
- Konec: obránce s potopenou celou flotilou je poražený; oba zapíší `rev`, druhý ověří `fh` a shodu odpovědí → odznak „Poctivě ověřeno“.
- Odveta: kdo klikne, zapíše do `hra` `n+1`, `w` (+1 vítězi), `s` = poražený začíná, `used` += otázky z partie. Dokumenty x/o s jiným `n` se berou jako prázdné.

## Otázky
Zdroj `data/zdroj/*.json` (7 kategorií × 30, se správnou odpovědí, zdrojem a doslovnou citací; ověřuje `tools/over-otazky.mjs`).
`tools/build-otazky.mjs` z nich udělá `data/otazky.json`, které hra načítá:
`{id, kat, obt, q, opts:[4 zamíchané], h: answerHash(id, správná), src, f: fakt zašifrovaný XORem klíčem sha256(id+"|"+správná)}`.
Správná odpověď tedy není v synchronizovaném stavu ani v načítaném JSON v čitelné podobě; po odpovědi klient najde správnou možnost porovnáním hashů a dešifruje fakt.
Otázku vybírá zařízení hráče na tahu ve chvíli volby obtížnosti (`pickQuestion`, vyloučí `used` + všechny `T[].q` obou hráčů). Soupeř vidí kategorii, obtížnost a časovač; text otázky a výsledek až po odpovědi.

## Vizuál – směr A „Bazén“ (vybrán design-eye 7/10 vs 5/10, render `design/navrh-a-bazen.png`)
Krémová dlažba kolem bazénu `#F4E7D4`, bílý okraj `#FFFDF8`, voda `#2DB3C7` s mřížkou dlaždic (bílá 26 %), inkoust `#1C2A39`.
Hráč x = korálová čepice `#FF5A2E`, hráč o = indigová `#3D5AFE`. Hračky: krokodýl zelený, lehátko růžové s pruhy, jednorožec bílý s fialovou hřívou, kachna žlutá.
Postavy: dva plavci za okrajem soupeřova bazénu, ruce na okraji, výrazy reagují (na tahu soustředěný, zásah = vyděšený, škodolibý při výběru kategorie, smutný při potopení, vítězný/plačící na konci).
Povinné opravy z design-eye (kolo 0):
- „Vedle“ = malý tenký prstenec ~40 % políčka, nízký kontrast; nejhlasitější na desce je zásah.
- Zásah = díra/záplata v hračce s čárkami unikajícího vzduchu; popisek „PSSST!“ mimo kurzor. Kurzor = přerušovaný rámeček.
- Potopená hračka = splasklá silueta té konkrétní hračky (zvrásněná, ztmavená, oči ×). Žádné nevysvětlené tečky – jistá voda jen jemně světlejší dlaždice.
- Postavy větší a odlišné: Mark brýle na čele, Radka na očích; nesouměrné reakce; žádné stejné hranaté šablony.
- Kvízová karta: kategorie jako barevný pruh přes celou šířku (bazénový praporek), ne SaaS pilulka; ztmavení do modré bazénu, ne šedé.
- Text min 14 px plnou barvou; slabší popisky max opacity .75. Display font jiný než Fredoka (vlastní řezy ve `fonts/`, čeština ověřená).
- Rány: počet „2 / 3“ u balonků; Radar sekundární (obrys), hlavní je klepnout do bazénu.
- Mini deska: zásah kontrastní (korálová), „vedle“ stejný tichý prstenec. Volitelné souřadnice A–H / 1–8 jemně na okraji.

## Prožitek (šťávu)
Výstřel: vodní balonek letí obloukem (~600 ms), dopad: vedle = šplouch + kruhy na vodě; zásah = PSSST, hračka cukne a upustí vzduch; potopení = hračka splaskne a klesne, ostatní okolí se zesvětlí. Vibrace, `prefers-reduced-motion` bez letu.
Rozmisťování: tažením (pointer events, přichytávání na mřížku, červené zvýraznění kolize), klepnutí = otočit, tlačítko Náhodně, Hotovo jen při platné flotile.
Výzva: jména obou + sázka (předvolby + vlastní) + vzkaz, sdílení odkazu. Výhra/prohra obrazovka se skóre série a Odvetou.
Rozvržení: mobil na výšku bez posouvání (soupeřův bazén nahoře velký, můj malý dole), desktop dva bazény vedle sebe + karta otázky vpravo, telefon na šířku vlastní. Fullscreen tlačítko + iOS nápověda „Přidat na plochu“, manifest + ikony.

## Pestrost partií (v2, zadání Marka přes hlavní session: „ne tolik repetitivní“)
Každá partie má náhodné semínko `g.seed` (v dokumentu `hra`, nové při každé odvetě) a z něj se odvozuje:
- **Speciální bójky**: v každém bazénu 3 viditelné plovoucí předměty na náhodných polích (ze semínka, různě pro x a o): **míč = poklad** (trefíš ho → +1 rána hned), **sonarový kroužek = radar zdarma** (trefíš → radar 3×3 kamkoli), **ježek = mina** (trefíš → tvoje příští salva má o 1 ránu méně, min. 1). Bójka platí jednou, pak zmizí; leží na poli bez ohledu na hračky (může být i na hračce: pak zásah + efekt). Střelec tak volí mezi lovem a pokladem.
- **Kategorie ke škádlení**: soupeř nevybírá ze všech 7, ale ze 3 nabídnutých (ze semínka + číslo tahu); kategorie, kterou měl hráč minule, se nenabízí. **Každý 5. tah je „Kolo štěstí“**: kategorii losuje hra (kolo s kategoriemi se roztočí).
- **Průběh**: první 2 tahy každého hráče jen lehká/střední („Rozcvička“); když soupeři zbývá poslední hračka, otázka je vždy těžká a správně = 4 rány („Finále“).
- **Návrat do hry („Záchranný kruh“)**: kdo má o 3+ zasažená políčka víc než soupeř, dostane při správné odpovědi +1 ránu a nabídku lehčí otázky než zvolil (tlačítko „Vyměnit za lehčí“ jednou za tah). Zobrazit nenápadně ikonou kruhu u jména.
- **Postup v sérii**: tituly podle výher v sérii – Plavčík (0), Vodník (1), Kapitán nafukovačky (3), Admirál bazénu (5), Vševěd (8); s titulem se mění vzhled (pruhy na čepici, zlatá kachna od Kapitána, korunka od Admirála). Titul pod jménem a na obrazovce výhry („Radka postoupila na Kapitánku nafukovačky“, ženský tvar podle volby při výzvě: kapitán/kapitánka – tvar si hráč vybere sám, nehádat z jména).
- **Otázky se v sérii neopakují** (`used` v `hra` + všechny `T[].q`); když dojdou, až pak opakování.
- Test: `tests/tri-partie.cjs` – 3 partie za sebou ve 2 prohlížečích (odveta), kontrola, že se liší bójky, nabídnuté kategorie, první hráč, otázky (žádná se neopakuje) a že titul/vzhled po výhrách postoupí; screenshot každé partie.

## Testy
`node tests/engine.test.cjs` · `node tests/balance.cjs` (simulace délky partie a vyvážení) · `node tests/duel.cjs <URL>` (Chromium desktop × WebKit iPhone 13 na výšku, celá partie, odveta, přihlížející) · design-eye verdikt „profi indie hra“ max 3 kola.
Lokální port 8806 (`node tools/serve.cjs`).
