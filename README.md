# Judge the Sample

Student guide and starter for an individual, agent-assisted sampling activity. Students choose one health population, build their own app with a coding agent across six stages, and judge simple random, systematic and stratified sampling with repeated-sampling evidence.

> Which sampling method would you trust for this population, at what sample size, and with what limits?

The guide is a small static website. It contains instructions, copyable agent prompts, checklists and the starter download. It deliberately contains **no** finished sampling app, design gallery, challenge ideas or worked answers.

## Build and preview

Node.js 20+ and Python 3.9+; no dependencies to install.

```bash
npm run build                 # → dist/ (pages, starter files, downloads/judge-the-sample-starter.zip)
npm run preview               # build and serve at http://localhost:8000/
node scripts/serve.mjs 8000 --base /my-repo/   # serve under a project subpath, as GitHub Pages would
npm test                      # build + site structure tests + data/reference-sampler tests
```

Optional browser end-to-end check (needs Playwright with Chromium):

```bash
node scripts/serve.mjs 8765 --base /some-repo/ &
python tests/e2e_browser.py http://localhost:8765/some-repo/
```

## Publishing

Live site: https://snsie.github.io/sampling-activity/

Deployed by `.github/workflows/deploy.yml`: pushes to `main` build `dist/` and publish it to GitHub Pages (Settings → Pages → Source: GitHub Actions). Pull requests build but do not deploy. `dist/` uses only relative links, so it also works from any static host or project subpath.

## Layout

| Path | What it is |
|---|---|
| `site/pages/` | Page fragments: overview, six stage briefs, setup, glossary |
| `site/layout.html`, `site/assets/` | Shared layout, styles and behaviour (menu, help, checklists, scenario, copy) |
| `site/terms.json` | Glossary; inline `?` help is generated from it |
| `scripts/build.mjs` | Static build; fails on unknown terms, missing downloads or numbers, or stray tokens |
| `starter/` | Exactly what students download: README, SETUP, AGENT_BRIEF, blank DECISIONS, loader, data |
| `data-prep/` | Instructor-only data preparation (see its README) |
| `verify/` | Instructor-only reference sampler and checks; writes `verify/out/report.json` (git-ignored), including demonstration challenge comparisons. Keep it out of student materials. |
| `tests/` | Automated checks |

## Data and licences

- Clinic waiting times: simulated for this activity.
- Healthcare costs: `insurance.csv` from B. Lantz, *Machine Learning with R*, via github.com/stedy/Machine-Learning-with-R-datasets. No licence stated upstream; confirm reuse fits your course.
- Wearable heart rate: Furberg R, Brinton J, Keating M, Ortiz A. *Crowd-sourced Fitbit datasets 03.12.2016–05.12.2016*. Zenodo, 2016. doi:10.5281/zenodo.53894. CC BY 4.0.

The site's visual design follows the classification activity guide (snsie/classification-activity) as a reference; no code or assets were copied from it.
