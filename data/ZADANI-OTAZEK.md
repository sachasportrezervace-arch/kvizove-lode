# Zadání otázek pro „Admirál Vševěd“ (kvízové lodě)

Hrají dva dospělí Češi (30–45 let) na mobilu. Otázka se čte na 4 tlačítkách 2×2, časovač 20 s.

## Výstup
Soubor `data/zdroj/<kategorie>.json` = JSON pole přesně 30 otázek: 10× obt 1, 10× obt 2, 10× obt 3.
```json
{
  "id": "zem-1-01",
  "kat": "zemepis",
  "obt": 1,
  "q": "Které město je hlavním městem Austrálie?",
  "spravne": "Canberra",
  "spatne": ["Sydney", "Melbourne", "Perth"],
  "fakt": "Jedna krátká věta navíc, zobrazí se po odpovědi (max 140 znaků).",
  "src": "https://cs.wikipedia.org/wiki/Canberra",
  "cit": "hlavní město Austrálie",
  "plati": null
}
```
- `id`: prefix kategorie - obtížnost - pořadí.
- `obt`: 1 = zná většina dospělých, 2 = průměrný kvízař, 3 = fajnšmekr (ale ne obskurní trivia).
- `cit`: DOSLOVNÝ úryvek ze zdroje (8–160 znaků), který správnou odpověď dokládá.
- `plati`: jen u faktu, který se může změnit, datum platnosti „2026-10“; jinak null.

## Pravidla
- Každé fakto ověř na zdroji, který si v této session opravdu stáhneš: Wikipedie (cs, nebo en, když cs nemá) nebo oficiální web (instituce, organizace). Nic z paměti.
- `cit` musí být doslovně v textu stránky (prostý text článku NEBO zdrojový wikitext infoboxu). Ověř to příkazem
  `node tools/over-otazky.mjs data/zdroj/<kategorie>.json` (spouštěj ve složce `C:/Users/le artist/Desktop/react-apps/kvizove-lode`). Musí skončit 30/30. Co neprojde, oprav nebo nahraď jinou otázkou.
- Rychlé čtení článku přes curl (prostý text):
  `curl -s -A "kvizove-lode/1.0" "https://cs.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&formatversion=2&titles=Canberra"`
  Wikitext s infoboxem: `https://cs.wikipedia.org/w/index.php?action=raw&title=Canberra`.
- Vynech sporné, nejednoznačné a časem měnitelné otázky: rekordy, aktuální počty obyvatel, „nejnovější“, „současný“ držitel, žebříčky. Výjimečně s `plati`.
- Jedna jasně správná odpověď. Distraktory věrohodné, stejného typu a podobné délky (město × města, rok × roky blízko u sebe), žádný vtipný nesmysl, žádné „všechny uvedené“, žádné záporné otázky „Co NENÍ…“.
- Otázka max 110 znaků, každá možnost max 28 znaků. Správná odpověď nesmí být prozrazena v otázce.
- Čeština bez chyb. Asi třetina otázek s českou souvislostí.
- Žádné otázky na politiku po roce 1990, náboženské spory, tragédie s oběťmi, zdraví a nemoci.
- Drž se své kategorie, ať se s ostatními nepřekrýváš.
- Pestrost: ne 10 otázek na hlavní města; různé typy (kdo, kde, kdy, co, kolik).

Kategorie a prefixy: zemepis (zem), historie (his), priroda (pri), sport (spo), film-hudba (fim), jidlo (jid), veda (ved).
