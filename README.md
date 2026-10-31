# Nafukovací flotila (Kvízové lodě)

Lodě pro dva s vědomostní soutěží. Hraje se živě na jednom odkazu, bez účtů, na mobilu i počítači.
Hra: https://sachasportrezervace-arch.github.io/kvizove-lode/

## Pravidla v 5 větách
1. Každý si tažením rozmístí 4 nafukovací hračky do svého bazénu 8 × 8. Klepnutím je otočíš a nesmí se dotýkat ani rohem.
2. Na tahu ti soupeř vybere kategorii otázky ze tří nabídnutých a ty si zvolíš obtížnost.
3. Na odpověď máš 20 s. Za správnou dostaneš u lehké 2 rány, u střední 3 a u těžké 4. Za špatnou jen 1.
4. Správná odpověď do 7 s přidá radar, který v oblasti 3 × 3 prozradí, kolik je tam políček hraček.
5. Kdo první propíchne všechny soupeřovy hračky, vyhrává a odveta pokračuje ve skóre série.

## Aby se partie neopakovaly
- **Bójky** mají v každé partii jiná místa. Míč je poklad a dá +1 ránu. Sonar dá radar zdarma. Ježek je mina a příští salvu zkrátí o ránu.
- **Kolo štěstí** losuje kategorii každý 5. tah.
- **Rozcvička**: v prvních 2 tazích jde jen lehká a střední otázka.
- **Finále**: když soupeři zbývá poslední hračka, otázka je vždy těžká.
- **Záchranný kruh** dostane ten, kdo prohrává o 3 a víc zásahů. Za správnou odpověď má +1 ránu a jednou za tah může otázku vyměnit za lehčí.
- **Tituly v sérii**: Plavčík, Vodník, Kapitán nafukovačky, Admirál bazénu a Vševěd (i v ženském tvaru). S titulem se mění vzhled plavce.
- **Otázky se v sérii neopakují.**

## Otázky
Je jich 210 v 7 kategoriích (7 × 30, po 10 na každou obtížnost). Každá má zdroj (Wikipedie) a doslovnou citaci, kterou ověřuje skript `node tools/over-otazky.mjs data/zdroj/*.json`: výsledek 210/210.
Zdroje jsou v `data/zdroj/`. `node tools/build-otazky.mjs` z nich udělá `data/otazky.json`. Ve hře je správná odpověď jen jako hash a fakt je zašifrovaný.

## Vývoj a testy
- `node tools/serve.cjs` spustí server na http://127.0.0.1:8806/
- `node tests/engine.test.cjs`: pravidla, obránce, ověření poctivosti
- `node tests/balance.cjs`: simulace délky partie a vyvážení
- `node tests/duel.cjs http://localhost:8806/`: celá partie, odveta a přihlížející v Chromiu (desktop) a WebKitu (iPhone 13)
- `node tests/tri-partie.cjs http://localhost:8806/`: 3 partie za sebou, kontroluje, že se liší
- `node tests/solo.cjs http://localhost:8806/`: sólo trénink proti botovi (Chromium desktop + WebKit iPhone 13), celá partie bez jediného požadavku na mantledb
- Herna (protokol 1, `<meta name="herna-protokol">`): adresa `#herna=1&m=…&r=…&seat=…&names=A,B&zaklada=0|1` přeskočí výzvu i setup a výsledky jdou rodiči přes postMessage (blok „Herna“ v `src/app.js`); test `node tests/herna.cjs http://localhost:8806/` (iframe, Chromium + WebKit iPhone 13).
- Sólo trénink: tlačítko „Zkusit sám“ na úvodní obrazovce, nebo adresa `…/#solo`. Bot „Robo-plavčík“ hraje lokálně v paměti stránky (`src/solo.js`), nic se neukládá ani nepočítá do série.

Specifikace je v `docs/SPEC.md`, deník v `WORKLOG.md`.
