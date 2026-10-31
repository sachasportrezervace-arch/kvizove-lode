PŘEVZATO 31. 10. – dodělává session na účtu P, jiná session sem nepíše.

# Deník – Kvízové lodě (Nafukovací flotila)

## 2026-10-31
- 17:43 přerušeno (limit účtu Teams), stará session `ac5eb979`. Poslední běh `tests/duel.cjs`: 33 PASS, pak timeout partie (Radka, fáze shoot-me).
- Převzetí: WIP commit `ee1da5a`. Port změněn na 8806 (serve, testy, SPEC). `node tests/engine.test.cjs` 24/0 exit 0 (v2 pravidla v enginu hotová).
  `node tools/over-otazky.mjs data/zdroj/*.json` 210/210 exit 0; `build-otazky` beze změny (otazky.json aktuální, 7×30).
- `node tests/duel.cjs http://localhost:8806/` exit 2: 33 PASS, pak zaseknutí 1. partie (Radka shoot-opp, Mark nestřílí) → ladí subagent.
- PŘÍČINA zaseknutí (debugger): `defend()` v engine.js při opakovaném průchodu (obránce odpovídá po každé ráně) přeskočil už vyřešená pole dřív, než vyhodnotil bójku → bonus pokladu (+1 rána), sonar (radar zdarma) i mina se ztratily, rána navíc zůstala bez odpovědi napořád (náhodné: záleží, zda padne bójka poklad). Oprava: bójka se vyhodnotí i u již vyřešeného pole (jednou na pole a tah, ne na pole z dřívějšího tahu). Regresní test `v2: defend po částech…` bez opravy padal (3 !== 4).
- Dál: duel filtruje konzolové 404 jako tri-partie (čtení neexistujícího dokumentu mantledb); CSS konec partie na krátkém telefonu (390×664): menší bazén + titul, nic nepřesahuje. Výsledky: `engine.test.cjs` 25/0 exit 0; `duel.cjs` 54/0 exit 0; `tri-partie.cjs` 15/0 exit 0; `balance.cjs` exit 0, průměr 10,9 min, 22,3 tahů.
- Zbývá: (bylo) oprava zaseknutí, duel + tri-partie zeleně, design-eye „profi“ (desktop + iPhone), README, repo + Pages + živý test.
