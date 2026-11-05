// Preview the built guide: node scripts/serve.mjs [port] [--base /some-subpath/]
// The --base option serves dist/ under a project subpath, the way GitHub Pages would.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const DIST = new URL("../dist", import.meta.url).pathname;
const args = process.argv.slice(2);
const port = Number(args.find((a) => /^\d+$/.test(a)) || 8000);
const baseArg = args.indexOf("--base");
const BASE = baseArg >= 0 ? args[baseArg + 1].replace(/\/?$/, "/") : "/";
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".csv": "text/csv; charset=utf-8", ".md": "text/markdown; charset=utf-8",
  ".py": "text/x-python; charset=utf-8", ".zip": "application/zip", ".svg": "image/svg+xml",
};

createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!path.startsWith(BASE)) { res.writeHead(404).end("outside base"); return; }
  path = normalize(path.slice(BASE.length - 1));
  if (path.includes("..")) { res.writeHead(400).end(); return; }
  let file = join(DIST, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    res.writeHead(404, { "content-type": TYPES[".html"] }).end(readFileSync(join(DIST, "404.html")));
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }).end(readFileSync(file));
}).listen(port, () => console.log(`Judge the Sample guide: http://localhost:${port}${BASE}  (Ctrl+C to stop)`));
