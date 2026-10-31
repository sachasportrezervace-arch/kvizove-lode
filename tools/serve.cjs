// Statický server pro vývoj a testy: node tools/serve.cjs [port]   (výchozí 8806, kořen = složka hry)
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), PORT = +(process.argv[2] || process.env.PORT || 8806);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon" };
const HIDDEN = /^\/(\.git|node_modules|tests|tools|docs|design)(\/|$)/;
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const f = path.normalize(path.join(ROOT, p));
  const rel = "/" + path.relative(ROOT, f).split(path.sep).join("/");
  if (!f.startsWith(ROOT) || HIDDEN.test(rel)) { res.writeHead(404); return res.end("404"); }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); return res.end("404"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(buf);
  });
});
server.listen(PORT, "127.0.0.1", 511, () => console.log(`Nafukovací flotila: http://127.0.0.1:${PORT}/`));
