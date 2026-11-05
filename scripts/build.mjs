// Builds the static guide into dist/. No dependencies: node scripts/build.mjs
//
// Pages are HTML fragments in site/pages/, wrapped in site/layout.html. Build-time tokens:
//   {{help term}} {{help term|label}}   inline help button (falls back to a glossary link)
//   {{dl path|text}}                    download link to a starter file, with its size
//   {{zip}}                             starter ZIP button
//   {{num key.field}} {{mean key}}      numbers read from starter/data/manifest.json
//   {{dataset key}}                     a dataset card (dictionary, provenance, licence)
//   {{intervals key}}                   systematic design (whole or fractional interval) at each required n
//   {{sc field}}                        scenario-adapted text (filled in by site.js)
//   {{checklist id ... }}               a saved checklist with "X of Y done" status
//   {{files}} {{glossary}} {{scenario-picker}}
// The build fails on an unknown term, a missing download or number, or any unexpanded token,
// so broken links and invented numbers cannot ship. All links are relative (project-subpath safe).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, relative } from "node:path";
import { makeZip } from "./zip.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const SITE = join(ROOT, "site");
const STARTER = join(ROOT, "starter");
const OUT = join(ROOT, "dist");
export const ZIP_NAME = "judge-the-sample-starter.zip";
const ZIP_DIR = "judge-the-sample";
const VERSION = (() => {
  try { return execSync("git rev-parse --short HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return "local"; }
})();

export const NAV = [
  { group: "Start" },
  { file: "index", label: "Overview", title: "Overview" },
  { group: "Get started" },
  { file: "data", label: "1. Data & files", title: "Stage 1: Data & files" },
  { file: "setup", label: "Setup & run", title: "Setup & run" },
  { group: "Build & investigate" },
  { file: "design", label: "2. Design your app", title: "Stage 2: Design your app" },
  { file: "methods", label: "3. Explore sampling methods", title: "Stage 3: Explore sampling methods" },
  { file: "compare", label: "4. Compare methods & sample size", title: "Stage 4: Compare methods & sample size" },
  { file: "challenge", label: "5. Challenge a method", title: "Stage 5: Challenge a method" },
  { group: "Finish" },
  { file: "submit", label: "6. Submit evidence", title: "Stage 6: Submit evidence" },
  { group: "Resources" },
  { file: "glossary", label: "Glossary", title: "Glossary" },
];
const PATH = NAV.filter((n) => n.file && n.file !== "glossary");
const PAGES = [...NAV.filter((n) => n.file).map((n) => n.file), "404"];

const terms = JSON.parse(readFileSync(join(SITE, "terms.json"), "utf8"));
const datasets = JSON.parse(readFileSync(join(STARTER, "data", "datasets.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(STARTER, "data", "manifest.json"), "utf8"));

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const int = (v) => Number(v).toLocaleString("en-US");
const size = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);

export function starterFiles(dir = STARTER) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? starterFiles(join(dir, e.name)) : [join(dir, e.name)]))
    .filter((p) => !/__pycache__|\.venv|node_modules|\.DS_Store/.test(p))
    .sort();
}

// ---- formatting of manifest numbers -----------------------------------------------------
const UNITS_SHORT = { clinic: "minutes", costs: "US dollars", heart: "bpm" };
function fmtMean(key) {
  const v = manifest.datasets[key].true_mean;
  if (key === "costs") return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${v.toFixed(2)} ${UNITS_SHORT[key]}`;
}
function fact(path) {
  const [key, ...rest] = path.split(".");
  let v = manifest.datasets[key];
  for (const p of rest) v = v?.[p];
  if (typeof v !== "number") throw new Error(`no number in manifest.json for ${path}`);
  return int(v);
}

// ---- tokens -----------------------------------------------------------------------------
function help(id, label) {
  const t = terms[id];
  if (!t) throw new Error(`unknown glossary term: ${id}`);
  const name = label || t.term;
  return `<a class="help" href="glossary.html#${id}" data-help="${id}" aria-label="What is ${esc(name)}?" title="What is ${esc(name)}?"><span aria-hidden="true">?</span></a>`;
}

function download(path, text) {
  const file = join(STARTER, path);
  if (!existsSync(file)) throw new Error(`missing download: starter/${path}`);
  return `<a class="file" href="starter/${path}" download>${esc(text || path.split("/").pop())}</a> <span class="size">${size(statSync(file).size)}</span>`;
}

const KIND = {
  simulated: '<span class="tag sim">Simulated</span>',
  real: '<span class="tag real">Real data</span>',
  public: '<span class="tag sim">Public teaching data, simulated by its author</span>',
};

function datasetCard(key) {
  const d = datasets[key];
  const m = manifest.datasets[key];
  const groups = Object.entries(m.groups).map(([g, counts]) => {
    const entries = Object.entries(counts);
    const body = entries.length <= 6
      ? entries.map(([k, v]) => `${esc(k)} ${int(v)}`).join(", ")
      : `${entries.length} values, ${int(Math.min(...Object.values(counts)))}–${int(Math.max(...Object.values(counts)))} rows each`;
    return `<li><code>${esc(g)}</code>: ${body}</li>`;
  }).join("");
  const rows = d.columns.map((c) => `<tr${c.kind === "target" ? ' class="target"' : ""}><td><code>${esc(c.name)}</code>${c.kind === "target" ? ' <span class="tag">Target</span>' : ""}</td><td>${esc(c.meaning)}</td><td>${esc(c.units)}</td></tr>`).join("");
  const extra = key === "heart"
    ? `<p class="data-facts">${int(m.n_rows)} of the week's ${int(m.minutes_in_week)} minutes have a reading; ${int(m.missing_minutes)} minutes are missing (longest gap ${m.longest_gap_minutes} minutes). Rows are in time order but not evenly spaced. ${help("row-order")}</p>`
    : "";
  return `<div class="dataset" id="${key}" data-sc-only="${key}">
  <h3>${esc(d.title)} ${KIND[d.kind]}${d.default ? ' <span class="tag optional">Default track</span>' : ""}</h3>
  <p>${esc(d.scenario)}</p>
  <p>${download(`data/${d.file}`)} <button type="button" class="choose" data-choose="${key}">Use this scenario</button></p>
  <dl class="facts">
    <dt>One row</dt><dd>${esc(d.row)} ${help("unit")}</dd>
    <dt>Rows (N)</dt><dd>${int(m.n_rows)}</dd>
    <dt>Target</dt><dd><code>${esc(d.target)}</code>, in ${esc(d.units)} ${help("target")}</dd>
    <dt>Population</dt><dd>${esc(d.population)} ${help("population")}</dd>
    <dt>Row order</dt><dd>${esc(d.order)}</dd>
    <dt>Group columns</dt><dd><ul class="plain">${groups}</ul></dd>
  </dl>
  ${extra}
  <div class="table-wrap"><table>
    <caption>Columns in <code>${esc(d.file)}</code></caption>
    <thead><tr><th scope="col">Column</th><th scope="col">Meaning</th><th scope="col">Units / values</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
  <details><summary>Provenance, licence and fingerprint</summary><div class="details-body">
    <p>${esc(d.provenance)}</p>
    <p><strong>Source:</strong> ${d.url ? `<a href="${esc(d.url)}">${esc(d.source)}</a>` : esc(d.source)}</p>
    <p><strong>Licence / reuse:</strong> ${esc(d.license)}</p>
    <p class="small"><strong>SHA-256:</strong> <code>${m.sha256}</code></p>
  </div></details>
</div>`;
}

const FILE_NOTES = {
  "README.md": "Your project README: scenario, seed, how to run, optional app link.",
  "SETUP.md": "Setup, running, git backup and optional publishing.",
  "AGENT_BRIEF.md": "Your agent's task, sampling rules, mode workflow and boundaries. It reads this first.",
  "DECISIONS.md": "Your notes file (blank): you write every section yourself.",
  "load_data.mjs": "Minimal Node.js loader: prints a dataset's size and columns. No sampling.",
  ".gitignore": "Keeps environments, caches and secrets out of git.",
  ".gitattributes": "Keeps run_app.sh with LF line endings, so it runs on Windows checkouts.",
  "evidence/README.md": "Where to save screenshots or exports for your submission.",
  "data/README.md": "Data dictionary: rows, units, order, provenance and licences.",
  "data/datasets.json": "The same dictionary, as data.",
  "data/manifest.json": "Row counts, group sizes and SHA-256 fingerprints for each CSV.",
  "data/clinic_visits.csv": "Clinic waiting times (simulated).",
  "data/healthcare_costs.csv": "Healthcare costs (public teaching data).",
  "data/heart_rate_week.csv": "Wearable heart rate (real extract).",
};

function fileList() {
  const rows = starterFiles().map((f) => {
    const rel = relative(STARTER, f);
    const note = FILE_NOTES[rel];
    if (!note) throw new Error(`no description for starter/${rel}: add it to FILE_NOTES`);
    return `<tr><td>${download(rel, rel)}</td><td>${esc(note)}</td></tr>`;
  });
  return `<div class="table-wrap"><table class="files"><thead><tr><th scope="col">File</th><th scope="col">What it is</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}

function glossary() {
  const groups = {};
  for (const [id, t] of Object.entries(terms)) (groups[t.group] ||= []).push([id, t]);
  return Object.entries(groups).map(([g, items]) => `<section class="glossary-group"><h2>${esc(g)}</h2><dl>${items
    .map(([id, t]) => `<div class="term" id="${id}"><dt>${esc(t.term)}</dt><dd><p>${esc(t.short)}</p>${t.more ? `<p class="more">${esc(t.more)}</p>` : ""}</dd></div>`)
    .join("")}</dl></section>`).join("");
}

// Scenario-adapted text: generic wording is in the HTML (works without JS); site.js fills it in.
const SC_FALLBACK = {
  title: "your scenario", file: "your CSV file", row: "one row", target: "the target column",
  units: "the target's units", groups: "the group columns", order: "row order", n: "the number of rows", rows: "rows",
};
function sc(field) {
  if (!(field in SC_FALLBACK)) throw new Error(`unknown scenario field: ${field}`);
  return `<span class="sc" data-sc="${field}">${esc(SC_FALLBACK[field])}</span>`;
}
function scenarioData() {
  const out = {};
  for (const [k, d] of Object.entries(datasets)) {
    const m = manifest.datasets[k];
    out[k] = {
      title: d.title, file: d.file, row: d.row, target: d.target, units: d.units,
      groups: d.groups.join(", "), order: d.order_meaning, n: int(m.n_rows), rows: d.rows_word,
    };
  }
  return out;
}

// Systematic-sampling design for each required sample size, computed from the manifest's row counts.
export const REQUIRED_SIZES = [1, 10, 100];
const fmtRatio = (r) => (Number.isInteger(r) ? int(r) : r.toLocaleString("en-US", { maximumFractionDigits: 2 }));
export function intervalRows(key) {
  const N = manifest.datasets[key].n_rows;
  return REQUIRED_SIZES.map((n) => {
    const k = N / n;
    if (n > N) throw new Error(`required n=${n} exceeds N=${N} for ${key}`);
    return { n, k, whole: Number.isInteger(k), text: fmtRatio(k) };
  });
}
function intervalTable(key) {
  const N = manifest.datasets[key].n_rows;
  const rows = intervalRows(key).map((r) => `<tr><td>${r.n}</td><td>${int(N)} ÷ ${r.n} = ${r.text}</td><td>${r.whole ? "Whole-number interval; exact enumeration available" : "Fractional interval; Monte Carlo"}</td></tr>`).join("");
  return `<div class="table-wrap" data-sc-only="${key}"><table>
    <caption>Systematic sampling design at each required sample size: ${esc(datasets[key].title)}</caption>
    <thead><tr><th scope="col">n</th><th scope="col">Interval k = N/n</th><th scope="col">Design to use</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function scenarioPicker() {
  const opts = Object.entries(datasets).map(([k, d]) => `<label class="pick"><input type="radio" name="scenario-pick" value="${k}"> <span><strong>${esc(d.title)}</strong> ${KIND[d.kind]}<br><span class="small muted">${int(manifest.datasets[k].n_rows)} ${esc(d.rows_word)} · target <code>${esc(d.target)}</code> (${esc(d.units)})</span></span></label>`).join("");
  return `<fieldset class="picker" data-scenario-picker><legend>Your scenario</legend>${opts}<p class="small muted picker-note">Saved in this browser only. You can change it at any time; it changes the instructions and prompts, not your files.</p></fieldset>`;
}

let checklistCount = 0;
function checklist(id, body) {
  const items = body.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("- ")).map((l) => l.slice(2));
  if (!items.length) throw new Error(`empty checklist ${id}`);
  checklistCount++;
  const lis = items.map((text, i) => {
    const helps = (text.match(/\{\{help [^}]+\}\}/g) || []).join(" ");
    const label = text.replace(/\s*\{\{help [^}]+\}\}/g, "");
    return `<li><input type="checkbox" id="${id}-${i + 1}"><div class="item-body"><label for="${id}-${i + 1}">${label}</label>${helps ? ` ${helps}` : ""}</div></li>`;
  }).join("");
  return `<p class="checklist-status" data-for="${id}" aria-live="polite"></p><ul class="checklist" data-store="${id}">${lis}</ul>`;
}

function expand(html, zipBytes) {
  return html
    .replace(/\{\{checklist ([\w-]+)\n([\s\S]*?)\n\}\}/g, (_, id, body) => checklist(id, body))
    .replace(/\{\{help ([a-z0-9-]+)(?:\|([^}]+))?\}\}/g, (_, id, label) => help(id, label))
    .replace(/\{\{dl ([^|}]+)(?:\|([^}]+))?\}\}/g, (_, p, t) => download(p.trim(), t))
    .replace(/\{\{num ([\w.]+)\}\}/g, (_, p) => fact(p))
    .replace(/\{\{mean (\w+)\}\}/g, (_, k) => fmtMean(k))
    .replace(/\{\{dataset (\w+)\}\}/g, (_, k) => datasetCard(k))
    .replace(/\{\{intervals (\w+)\}\}/g, (_, k) => intervalTable(k))
    .replace(/\{\{sc (\w+)\}\}/g, (_, f) => sc(f))
    .replace(/\{\{scenario-picker\}\}/g, () => scenarioPicker())
    .replace(/\{\{glossary\}\}/g, () => glossary())
    .replace(/\{\{files\}\}/g, () => fileList())
    .replace(/\{\{zip\}\}/g, () => `<a class="button primary" href="downloads/${ZIP_NAME}" download>Download the starter (.zip, ${size(zipBytes)})</a>`)
    .replace(/<pre>/g, '<pre tabindex="0">');
}

const href = (file) => (file === "index" ? "./" : `${file}.html`);
function pager(current) {
  const i = PATH.findIndex((n) => n.file === current);
  if (i < 0) return "";
  const link = (n, rel, text) => (n ? `<a class="card-link" rel="${rel}" href="${href(n.file)}"><span class="small muted">${text}</span><br>${esc(n.label)}</a>` : "<span></span>");
  return `<nav class="pager" aria-label="Previous and next">${link(PATH[i - 1], "prev", "Previous")}${link(PATH[i + 1], "next", "Next")}</nav>`;
}
function nav(current) {
  let html = "";
  let open = false;
  for (const n of NAV) {
    if (n.group) {
      if (open) html += "</ul></li>";
      html += `<li class="nav-group"><span class="nav-group-label" id="nav-${n.group.replace(/\W+/g, "-").toLowerCase()}">${esc(n.group)}</span><ul aria-labelledby="nav-${n.group.replace(/\W+/g, "-").toLowerCase()}">`;
      open = true;
    } else {
      html += `<li><a href="${href(n.file)}"${n.file === current ? ' aria-current="page"' : ""}>${esc(n.label)}</a></li>`;
    }
  }
  return html + (open ? "</ul></li>" : "");
}

// ---- build ----------------------------------------------------------------------------
export function build() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "downloads"), { recursive: true });
  cpSync(join(SITE, "assets"), join(OUT, "assets"), { recursive: true });
  cpSync(STARTER, join(OUT, "starter"), { recursive: true, filter: (p) => !/__pycache__|\.venv|node_modules/.test(p) });
  writeFileSync(join(OUT, ".nojekyll"), "");
  writeFileSync(join(OUT, "assets", "terms.js"), `// Generated from site/terms.json\nexport const TERMS = ${JSON.stringify(terms)};\n`);
  writeFileSync(join(OUT, "assets", "scenarios.js"), `// Generated from starter/data/datasets.json and manifest.json\nexport const SCENARIOS = ${JSON.stringify(scenarioData())};\n`);
  for (const f of readdirSync(join(OUT, "assets")).filter((f) => f.endsWith(".js"))) {
    const p = join(OUT, "assets", f);
    writeFileSync(p, readFileSync(p, "utf8").replace(/(from\s+"\.\/[\w-]+\.js)"/g, `$1?v=${VERSION}"`));
  }
  const files = starterFiles();
  const zip = makeZip(files.map((f) => ({ name: `${ZIP_DIR}/${relative(STARTER, f)}`, data: readFileSync(f) })));
  writeFileSync(join(OUT, "downloads", ZIP_NAME), zip);

  const layout = readFileSync(join(SITE, "layout.html"), "utf8");
  for (const page of PAGES) {
    const src = readFileSync(join(SITE, "pages", `${page}.html`), "utf8");
    const meta = JSON.parse(src.match(/^<!--meta (.*?) -->/)[1]);
    const navEntry = NAV.find((n) => n.file === page);
    const title = navEntry?.title || meta.title;
    const body = expand(src.replace(/^<!--meta .*? -->\n?/, ""), zip.length);
    const html = layout
      .replaceAll("{{title}}", esc(title))
      .replaceAll("{{description}}", esc(meta.description))
      .replaceAll("{{page}}", page)
      .replace("{{nav}}", nav(page))
      .replace("{{version}}", VERSION === "local" ? "local build" : `version ${VERSION}`)
      .replace("{{content}}", body + pager(page))
      .replaceAll("{{v}}", VERSION);
    const left = html.match(/\{\{[^}]*\}\}/);
    if (left) throw new Error(`unexpanded token in ${page}: ${left[0]}`);
    writeFileSync(join(OUT, `${page}.html`), html);
  }
  return { pages: PAGES.length, files: files.length, zip: zip.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = build();
  console.log(`built ${r.pages} pages, ${r.files} starter files, ${ZIP_NAME} (${size(r.zip)}) → dist/`);
}
