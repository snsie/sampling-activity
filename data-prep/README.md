# Data preparation (instructor / maintainer only)

Students never run this. `prepare_data.py` rebuilds everything in `starter/data/` with the Python standard library only:

```bash
python3 data-prep/prepare_data.py            # downloads the Fitbit archive (~25 MB) to data-prep/cache/ if needed
python3 data-prep/prepare_data.py --offline  # no download; keeps the existing heart-rate CSV
```

| Output | Kind | How it is made |
|---|---|---|
| `clinic_visits.csv` | **Simulated** | Generated here, seed `20261105`. The course notebook's original file was not available, so this is a new, layout-compatible simulation; its values are not the notebook's. |
| `healthcare_costs.csv` | Public teaching dataset (simulated by its author) | `sources/insurance.csv`, a copy of the stedy/Machine-Learning-with-R-datasets file (SHA-256 checked), plus `row_id` and `age_band`. No licence is stated upstream. |
| `heart_rate_week.csv` | **Real** extract, CC BY 4.0 | Zenodo record 53894, export 4.12.16–5.12.16 (archive SHA-256 checked), participant 5577150313, 2016-04-25 to 2016-05-01. One row per recorded minute (mean of that minute's readings); `activity_state` from the same participant's sleep log and minute intensities. |

It also writes `datasets.json`, `manifest.json` (counts, true means, group sizes, SHA-256) and the student `README.md` dictionary. The guide's numbers are read from `manifest.json`, which is computed from the written CSVs.
