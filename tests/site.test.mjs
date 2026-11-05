// Structural checks on the built guide: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";
import { build, NAV, ZIP_NAME, starterFiles, intervalRows, REQUIRED_SIZES } from "../scripts/build.mjs";

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

const STAGES = ["design", "methods", "repeated", "sample-size", "challenge"];
const text = (h) => h.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
const starterText = (name) => readFileSync(join(ROOT, "starter", name), "utf8").replace(/\s+/g, " ");

test("stages 2-6 share the same four sections, in order", () => {
  for (const p of STAGES) {
    const ids = ["task", "plan-build", "check", "record"].map((id) => html[p].indexOf(`id="${id}"`));
    assert.ok(ids.every((i) => i > 0) && ids.every((v, i) => i === 0 || v > ids[i - 1]), p);
    for (const title of ["Your task", "Plan and build", "Check your app", "Record your findings"]) assert.ok(html[p].includes(title), `${p}: ${title}`);
  }
});

test("required sample sizes give a valid systematic design for every dataset", () => {
  assert.deepEqual(REQUIRED_SIZES, [10, 40, 100, 160, 640]);
  for (const key of ["clinic", "costs", "heart"]) {
    const rows = intervalRows(key);
    assert.equal(rows.length, REQUIRED_SIZES.length);
    assert.ok(rows.every((r) => r.k >= 1), key);
  }
  assert.ok(intervalRows("clinic").find((r) => r.n === 100).whole, "clinic n=100 is a whole interval");
  assert.ok(!intervalRows("costs").find((r) => r.n === 100).whole, "costs n=100 needs the fractional interval");
  assert.ok(!intervalRows("heart").find((r) => r.n === 100).whole, "heart n=100 needs the fractional interval");
  for (const p of ["methods", "repeated", "sample-size"]) assert.equal((html[p].match(/data-sc-only="(clinic|costs|heart)"><table|class="table-wrap" data-sc-only/g) || []).length, 3, p);
});

test("the divisor-of-N option is gone and the repetition rule is consistent", () => {
  const files = [...Object.values(html), ...["AGENT_BRIEF.md", "DECISIONS.md", "README.md", "SETUP.md", "evidence/README.md"].map(starterText)];
  for (const f of files) {
    assert.ok(!/restrict (your )?(sample )?sizes? to|restricted sizes|only allow sample sizes where/i.test(text(f)), "no restricted-size option");
    assert.ok(!/changes? them only slightly|always (produces|gives) a different/i.test(text(f)), "no seed guarantee");
  }
  const rule = /at least 1,000 random repetitions, or all possible random starts when exact enumeration is available for systematic sampling/;
  for (const p of ["repeated", "challenge"]) assert.match(text(html[p]), rule, p);
  assert.match(starterText("AGENT_BRIEF.md"), /at least 1,000 random repetitions, or all possible random starts when\s+exact enumeration is available for systematic sampling/);
});

test("stage 5 requires simple random sampling at four sizes and makes other methods optional", () => {
  const t = text(html["sample-size"]);
  assert.match(t, /Simple random sampling at n = 10, 40, 160 and 640/);
  assert.match(t, /at least 1,000 random repetitions per size/);
  assert.match(t, /Optional Other methods are an optional extension/);
  assert.match(text(html.submit), /simple random sampling at n = 10, 40, 160 and 640, at least 1,000 random repetitions each/);
});

test("stage 6 explains unbiased-but-variable methods without example scenarios", () => {
  const t = text(html.challenge);
  assert.match(t, /unbiased for the finite-population mean/);
  assert.match(t, /stay unbiased and still become less reliable, because its estimates vary more/);
  assert.match(t, /small nonzero bias/);
  assert.match(t, /You do not need to produce bias or .{0,3}break.{0,3} a method/);
  assert.ok(!/for example,? (sort|reorder|inflate|remove|add|multiply|group)/i.test(t));
});

test("DECISIONS.md has every field the instructions ask students to fill in", () => {
  const d = starterText("DECISIONS.md");
  for (const field of ["Number of rows (N)", "Row order", "Date written", "Evidence that would contradict my hypothesis", "date written", "What changed as n grew", "stratification column"]) {
    assert.ok(d.includes(field), field);
  }
  assert.ok(!/Stage 6 \(what evidence I expect/.test(d), "stage 6 prediction lives with the hypothesis in section 5");
});

test("the overview opens with the agreed sentence and the guide invents no submission details", () => {
  assert.ok(text(html.index).includes("Build an interactive app with a coding agent to explore three sampling methods using one health dataset. You choose the design, predict the results, and explain what the evidence shows. Your agent writes and debugs the code."));
  for (const p of ["index", "submit"]) assert.ok(!/\b(TBD|TODO|\[instructor|insert (due|deadline))/i.test(html[p]), p);
});

test("the ZIP carries the updated starter files", () => {
  const zip = join(DIST, "downloads", ZIP_NAME);
  const read = (name) => execFileSync("python3", ["-I", "-c", "import sys, zipfile; sys.stdout.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]).decode())", zip, `judge-the-sample/${name}`]).toString();
  for (const name of ["AGENT_BRIEF.md", "DECISIONS.md", "README.md", "evidence/README.md"]) {
    assert.equal(read(name), readFileSync(join(ROOT, "starter", name), "utf8"), name);
  }
  assert.match(read("DECISIONS.md"), /Number of rows \(N\)/);
});
