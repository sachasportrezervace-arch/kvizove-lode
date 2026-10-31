// Vyrenderuje SVG návrhy do PNG s webfonty (Playwright). node design/render.cjs
const path = require("path"), fs = require("fs");
const { chromium } = require(path.join(process.env.APPDATA, "npm/node_modules/playwright"));
const FONTS = "https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Onest:wght@400;600;700&family=Alfa+Slab+One&family=Figtree:wght@400;600;700;800&family=Martian+Mono&display=block";
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1.5 });
  for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith(".svg"))) {
    const svg = fs.readFileSync(path.join(__dirname, f), "utf8");
    await p.setContent(`<link rel="stylesheet" href="${FONTS}"><style>body{margin:0}</style>${svg}`);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(400);
    await p.locator("svg").first().screenshot({ path: path.join(__dirname, f.replace(".svg", ".png")) });
    console.log("png", f);
  }
  await b.close();
})();
