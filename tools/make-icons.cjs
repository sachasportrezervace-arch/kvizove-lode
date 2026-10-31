// Ikony hry z vlastního SVG (kachna v bazénu se záplatou po zásahu): node tools/make-icons.cjs
// Vyrobí icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png a icon.svg. Playwright z %APPDATA%/npm/node_modules/playwright.
const path = require("path"), fs = require("fs"), { pathToFileURL } = require("url");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium } = require(PW);
const ROOT = path.join(__dirname, "..");

(async () => {
  const art = await import(pathToFileURL(path.join(ROOT, "src", "art.js")).href);
  const svg = (scale, size = 512) => {
    let grid = "";
    for (let i = 1; i < 8; i++) grid += `<path d="M${i * 64} 0v512M0 ${i * 64}h512"/>`;
    const dw = 85 * scale, dh = 42 * scale;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
      <rect width="512" height="512" fill="${art.COL.water}"/>
      <g stroke="#fff" stroke-opacity=".3" stroke-width="3">${grid}</g>
      <path d="M0 0h512v22H22V512H0Z" fill="${art.COL.waterDeep}" opacity=".5"/>
      <g transform="translate(${256 - dw / 2 + 4} ${256 - dh / 2 + 10}) scale(${scale})">${art.toyG(3, false)}</g>
      <g transform="translate(${256 + dw * .12} ${256 - dh * .12}) scale(${scale * .62})">${art.hitMark(0, 0)}</g>
      <circle cx="${scale > 4 ? 96 : 120}" cy="${scale > 4 ? 420 : 396}" r="22" fill="none" stroke="#fff" stroke-width="7" opacity=".7"/>
      <circle cx="${scale > 4 ? 420 : 392}" cy="${scale > 4 ? 100 : 124}" r="22" fill="none" stroke="#fff" stroke-width="7" opacity=".7"/>
    </svg>`;
  };
  const jobs = [["icon-192.png", 192, 4.6], ["icon-512.png", 512, 4.6], ["icon-maskable-512.png", 512, 3.5], ["apple-touch-icon.png", 180, 4.6]];
  const b = await chromium.launch(), p = await b.newPage();
  for (const [name, size, scale] of jobs) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg(scale)}`);
    await p.screenshot({ path: path.join(ROOT, name), clip: { x: 0, y: 0, width: size, height: size } });
    console.log("ikona", name, size);
  }
  fs.writeFileSync(path.join(ROOT, "icon.svg"), svg(4.6));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
