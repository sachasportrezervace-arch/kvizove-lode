// Regrese: tween() nesmí volat animaci se záporným t, když časová značka requestAnimationFrame předběhne start
// (WebKit; jinak SVG kruh dostane záporný poloměr a do konzole spadne „Invalid negative value for <circle> attribute r“).
// node tests/tween.cjs [URL]
const { pw } = require("./lib.cjs");
const URL = process.argv[2] || "http://127.0.0.1:8806/";
const PAGE_CODE = `(async () => {
  const { tween } = await import("/src/pool.js");
  const raf = window.requestAnimationFrame, seen = [];
  window.requestAnimationFrame = f => raf(() => f(performance.now() - 300));
  await tween(650, (v, t) => { seen.push(t); });
  window.requestAnimationFrame = raf;
  return seen;
})()`;
(async () => {
  const b = await pw.chromium.launch(), p = await b.newPage();
  await p.goto(URL);
  const ts = await p.evaluate(PAGE_CODE);   // časová značka rAF o 300 ms před startem
  await b.close();
  const ok = ts.length > 0 && ts.every(t => t >= 0 && t <= 1);
  console.log(`${ok ? "PASS" : "FAIL"}  tween: t vždy v <0, 1> (${ts.length} kroků, min ${Math.min(...ts)})`);
  process.exit(ok ? 0 : 1);
})();
