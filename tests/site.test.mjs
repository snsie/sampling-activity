// Structural checks on the built guide: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";
import { build, NAV, ZIP_NAME, starterFiles } from "../scripts/build.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");
build();
const PAGES = NAV.filter((n) => n.file).map((n) => n.file);
const PATH = PAGES.filter((p) => p !== "glossary");
const html = Object.fromEntries([...PAGES, "404"].map((p) => [p, readFileSync(join(DIST, `${p}.html`), "utf8")]));
const fileOf = (href) => (href === "./" ? "index.html" : href);

test("every page marks exactly one nav link as current, and it is itself", () => {
  for (const p of PAGES) {
    const cur = [...html[p].matchAll(/<a href="([^"]+)" aria-current="page">/g)].map((m) => m[1]);
    assert.deepEqual(cur.map(fileOf), [`${p}.html`], p);
  }
});

test("Previous/Next follow the seven-stage path in order", () => {
  PATH.forEach((p, i) => {
    const prev = html[p].match(/rel="prev" href="([^"]+)"/)?.[1];
    const next = html[p].match(/rel="next" href="([^"]+)"/)?.[1];
    assert.equal(prev && fileOf(prev), i > 0 ? `${PATH[i - 1]}.html` : undefined, `${p} prev`);
    assert.equal(next && fileOf(next), i < PATH.length - 1 ? `${PATH[i + 1]}.html` : undefined, `${p} next`);
  });
  assert.ok(!/rel="(prev|next)"/.test(html.glossary), "glossary is off the path");
});

test("stage numbers 1-7 each appear once in the navigation, nothing higher", () => {
  const labels = NAV.filter((n) => n.file).map((n) => n.label);
  const nums = labels.map((l) => l.match(/^(\d+)\./)?.[1]).filter(Boolean).map(Number);
  assert.deepEqual(nums, [1, 2, 3, 4, 5, 6, 7]);
});

test("every relative link and download resolves to a built file", () => {
  for (const [p, src] of Object.entries(html)) {
    for (const [, href] of src.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)) {
      if (/^(https?:|mailto:|data:)/.test(href)) continue;
      assert.ok(!href.startsWith("/"), `${p}: absolute link ${href} breaks under a project subpath`);
      const target = join(DIST, fileOf(href.split("?")[0]));
      assert.ok(existsSync(target), `${p}: broken link ${href}`);
    }
  }
});

test("in-page anchors used across pages exist", () => {
  for (const src of Object.values(html)) {
    for (const [, file, id] of src.matchAll(/href="([\w-]+\.html|\.\/)#([\w-]+)"/g)) {
      const page = fileOf(file).replace(".html", "");
      assert.ok(new RegExp(`id="${id}"`).test(html[page]), `missing #${id} on ${page}`);
    }
  }
});

test("the starter ZIP contains exactly the advertised starter files, intact", () => {
  const zip = join(DIST, "downloads", ZIP_NAME);
  const listed = execFileSync("python3", ["-I", "-c",
    "import sys, zipfile; z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print('\\n'.join(z.namelist()))", zip]).toString().trim().split("\n");
  const expected = starterFiles().map((f) => `judge-the-sample/${relative(join(ROOT, "starter"), f)}`);
  assert.deepEqual(listed.sort(), expected.sort());
  for (const name of ["README.md", "SETUP.md", "AGENT_BRIEF.md", "DECISIONS.md", "data/clinic_visits.csv", "data/healthcare_costs.csv", "data/heart_rate_week.csv", "data/README.md"]) {
    assert.ok(listed.includes(`judge-the-sample/${name}`), name);
  }
  const table = [...html.data.matchAll(/<tr><td><a class="file" href="starter\/([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(table.sort(), expected.map((e) => e.replace("judge-the-sample/", "")).sort(), "file table matches ZIP");
});

test("the starter contains no finished sampling app or launcher", () => {
  const names = starterFiles().map((f) => relative(join(ROOT, "starter"), f));
  assert.ok(!names.some((n) => /run_app\.sh|sampling\.(py|js)|app\.(py|js)/.test(n)), names.join(", "));
});

test("every Plan-mode prompt tells the agent to stay in Plan mode and not implement", () => {
  for (const p of ["design", "methods", "repeated", "sample-size", "challenge"]) {
    const blocks = [...html[p].matchAll(/<div class="callout plan-task">([\s\S]*?)<\/div>\s*\n/g)].map((m) => m[1]);
    assert.equal(blocks.length, 1, `${p} has one Plan-mode block`);
    assert.match(blocks[0], /switch your agent to Plan mode/i, `${p} visible switch instruction`);
    assert.match(blocks[0], /Stay in Plan mode and do not implement changes yet/, `${p} prompt constraint`);
    assert.match(html[p], /Switch out of Plan mode before sending this/, `${p} switch to implementation`);
  }
});

test("stage 6: the hypothesis task comes before any agent prompt", () => {
  const src = html.challenge;
  assert.ok(src.indexOf("write your hypothesis") < src.indexOf('<pre class="prompt"'));
  assert.ok(src.indexOf("I have already written my own hypothesis independently") > 0);
});

test("checklists have unique ids site-wide and a status line", () => {
  const ids = Object.values(html).flatMap((s) => [...s.matchAll(/data-store="([\w-]+)"/g)].map((m) => m[1]));
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(Object.values(html).some((s) => s.includes(`data-for="${id}"`)), id);
});

test("numbers on the guide come from the manifest", () => {
  const m = JSON.parse(readFileSync(join(ROOT, "starter/data/manifest.json"), "utf8")).datasets;
  assert.ok(html.data.includes(`${m.clinic.true_mean.toFixed(2)} minutes`));
  assert.ok(html.data.includes(`${m.heart.true_mean.toFixed(2)} bpm`));
  assert.ok(html.data.includes(m.costs.true_mean.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })));
});
