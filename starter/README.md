# Judge the Sample: my sampling app

<!-- If your course asks for a public app, put its link on the next line. Otherwise delete this comment. -->
App link (optional):

**Central question:** Which sampling method would you trust for this population, at what sample size, and with what limits?

- **Scenario:** <!-- clinic waiting times / healthcare costs / wearable heart rate -->
- **Data file:** `data/<!-- file name -->` (source, licence and provenance in `data/README.md`)
- **Seed(s) used for my evidence** (exact enumeration needs no seed):

## Run it on your computer

```bash
bash run_app.sh
```

Run it in a Bash terminal (macOS/Linux Terminal, or Git Bash/WSL on Windows) inside this folder.
Open the address it prints. Stop it with Ctrl+C.

## What's here

| File | What it is |
|---|---|
| `AGENT_BRIEF.md` | Instructions and rules for the coding agent. It reads this first. |
| `SETUP.md` | Setup, running, backing up and (optional) publishing. |
| `DECISIONS.md` | My own decisions, predictions, hypothesis and interpretation. |
| `data/` | The three populations, data dictionary (`README.md`), `manifest.json` and `datasets.json`. |
| `load_data.py` | Minimal loader: prints the size and columns of a dataset. |
| `evidence/` | Screenshots or exported results for my submission. |

My agent adds the app files, the shared sampling module and `run_app.sh`.
