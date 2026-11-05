// Minimal loader for the supplied populations (Node.js 20+, no dependencies).
//
//     node load_data.mjs data/clinic_visits.csv
//
// Prints the number of rows and the columns, and shows the first three rows.
// It deliberately computes no means or samples: that is your app's job.
// The supplied CSVs have no quoted fields, so a plain split on commas is enough here.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

export function load(path) {
  const [header, ...lines] = readFileSync(path, "utf8").trim().split(/\r?\n/);
  const cols = header.split(",");
  return lines.map((line) => Object.fromEntries(line.split(",").map((v, i) => [cols[i], v])));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) {
    console.error("usage: node load_data.mjs data/<file>.csv");
    process.exit(1);
  }
  const path = process.argv[2];
  const rows = load(path);
  console.log(`${basename(path)}: ${rows.length.toLocaleString("en-US")} rows`);
  console.log("columns:", Object.keys(rows[0]).join(", "));
  for (const r of rows.slice(0, 3)) console.log("  ", r);
}
