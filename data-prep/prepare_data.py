"""Prepare the three bundled populations for Judge the Sample.

Instructor / maintainer script. Students never need to run it.

    python3 data-prep/prepare_data.py            # rebuild everything
    python3 data-prep/prepare_data.py --offline  # keep the existing heart-rate CSV (no download)

Standard library only, so the output does not depend on numpy/pandas versions.
Writes, under starter/data/:
    clinic_visits.csv      SIMULATED here (fixed seed), 10,000 appointments
    healthcare_costs.csv   the public educational "insurance.csv" (+ row_id, age_band)
    heart_rate_week.csv    REAL extract: one Fitbit user's week, one row per recorded minute
    datasets.json          data dictionary as data
    manifest.json          counts, true means, group sizes, SHA-256, provenance
    README.md              the data dictionary for students
Every number shown on the guide is read back from the written CSVs, never from the generator.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import math
import random
import statistics
import sys
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "starter" / "data"
SOURCES = ROOT / "data-prep" / "sources"
CACHE = ROOT / "data-prep" / "cache"

CLINIC_SEED = 20261105

INSURANCE_URL = "https://raw.githubusercontent.com/stedy/Machine-Learning-with-R-datasets/master/insurance.csv"
INSURANCE_SHA256 = "505c1cbc2e63d0363bac59501563df2530aadf4cdb9cfee226f4ef32f5468281"

FITBIT_RECORD = "https://zenodo.org/records/53894"
FITBIT_URL = "https://zenodo.org/records/53894/files/mturkfitbit_export_4.12.16-5.12.16.zip?download=1"
FITBIT_ZIP = "mturkfitbit_export_4.12.16-5.12.16.zip"
FITBIT_SHA256 = "4741dfabd18453de19b6dd0a7204e8fea6e45e70bc9ddbe396956c8e4fde02f8"
FITBIT_ID = "5577150313"
FITBIT_START = dt.datetime(2016, 4, 25)  # Monday 00:00, device local time
FITBIT_DAYS = 7
FITBIT_FMT = "%m/%d/%Y %I:%M:%S %p"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def write_csv(path: Path, header: list[str], rows: list[list]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        w.writerows(rows)


# ---------------------------------------------------------------- clinic (simulated)
def make_clinic() -> None:
    """10,000 SIMULATED appointments: 100 weeks x Mon-Fri x 20 slots, in chronological order.

    Model (documented in data/README.md):
      expected wait = 8 + 1.2 * (slot - 1)            delays build up through the day
                      + 4 if New, + 12 if Same-day    visit-type effect
                      + day effect ~ Normal(0, 4)     busy and quiet days
      wait = round(max(0, expected) * LogNormal(-0.1, 0.45)) minutes   (never negative)
    Visit types are drawn independently of slot: Follow-up 55%, New 25%, Same-day 20%.
    Only rng.random() is used (Box-Muller by hand), so the stream is stable across Python versions.
    """
    rng = random.Random(CLINIC_SEED)

    def normal() -> float:
        u1 = 1.0 - rng.random()  # (0, 1]
        u2 = rng.random()
        return math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)

    days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
    rows = []
    visit_id = 0
    for week in range(1, 101):
        for weekday in days:
            day_effect = 4.0 * normal()
            for slot in range(1, 21):
                visit_id += 1
                u = rng.random()
                vtype = "Follow-up" if u < 0.55 else ("New" if u < 0.80 else "Same-day")
                expected = 8 + 1.2 * (slot - 1) + {"Follow-up": 0, "New": 4, "Same-day": 12}[vtype] + day_effect
                wait = round(max(0.0, expected) * math.exp(-0.1 + 0.45 * normal()))
                rows.append([visit_id, week, weekday, slot, vtype, wait])
    write_csv(OUT / "clinic_visits.csv", ["visit_id", "week", "weekday", "slot", "visit_type", "wait_time"], rows)


# ---------------------------------------------------------------- healthcare costs (public)
def age_band(age: int) -> str:
    if age < 30:
        return "18-29"
    if age < 40:
        return "30-39"
    if age < 50:
        return "40-49"
    return "50-64"


def make_costs(offline: bool) -> None:
    src = SOURCES / "insurance.csv"
    if not src.exists():
        if offline:
            sys.exit("data-prep/sources/insurance.csv is missing and --offline was given")
        urllib.request.urlretrieve(INSURANCE_URL, src)
    if sha256(src) != INSURANCE_SHA256:
        sys.exit(f"{src} does not match the recorded SHA-256; the upstream file may have changed")
    rows = []
    with open(src, newline="", encoding="utf-8") as f:
        for i, r in enumerate(csv.DictReader(f), start=1):
            age = int(r["age"])
            rows.append([i, age, age_band(age), r["sex"], r["bmi"], r["children"], r["smoker"], r["region"], r["charges"]])
    write_csv(OUT / "healthcare_costs.csv",
              ["row_id", "age", "age_band", "sex", "bmi", "children", "smoker", "region", "charges"], rows)


# ---------------------------------------------------------------- heart rate (real extract)
def make_heart_rate(offline: bool) -> None:
    target = OUT / "heart_rate_week.csv"
    zpath = CACHE / FITBIT_ZIP
    if not zpath.exists():
        if offline:
            if target.exists():
                print("  --offline: keeping existing heart_rate_week.csv")
                return
            sys.exit("Fitbit archive not cached and --offline was given")
        CACHE.mkdir(parents=True, exist_ok=True)
        print(f"  downloading {FITBIT_URL} (about 25 MB)")
        urllib.request.urlretrieve(FITBIT_URL, zpath)
    if sha256(zpath) != FITBIT_SHA256:
        sys.exit(f"{zpath} does not match the recorded SHA-256")

    start, end = FITBIT_START, FITBIT_START + dt.timedelta(days=FITBIT_DAYS)

    def rows_of(z: zipfile.ZipFile, name: str):
        member = next(n for n in z.namelist() if n.endswith("/" + name))
        with z.open(member) as raw:
            reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8"))
            next(reader)
            for row in reader:
                if row[0] == FITBIT_ID:
                    yield row

    readings: dict[dt.datetime, list[int]] = defaultdict(list)
    asleep: set[dt.datetime] = set()
    active: set[dt.datetime] = set()
    with zipfile.ZipFile(zpath) as z:
        for _, t, v in rows_of(z, "heartrate_seconds_merged.csv"):
            ts = dt.datetime.strptime(t, FITBIT_FMT)
            if start <= ts < end:
                readings[ts.replace(second=0)].append(int(v))
        for _, t, value, _log in rows_of(z, "minuteSleep_merged.csv"):
            ts = dt.datetime.strptime(t, FITBIT_FMT).replace(second=0)
            if start <= ts < end and value in ("1", "2"):  # 1 asleep, 2 restless; 3 = awake in bed
                asleep.add(ts)
        for _, t, intensity in rows_of(z, "minuteIntensitiesNarrow_merged.csv"):
            ts = dt.datetime.strptime(t, FITBIT_FMT)
            if start <= ts < end and intensity in ("2", "3"):  # fairly / very active
                active.add(ts)

    rows = []
    for i, minute in enumerate(sorted(readings), start=1):
        vals = readings[minute]
        state = "sleep" if minute in asleep else ("exercise" if minute in active else "rest")
        rows.append([i, minute.strftime("%Y-%m-%d %H:%M"), f"{sum(vals) / len(vals):.1f}", len(vals), state])
    write_csv(target, ["row_id", "timestamp", "heart_rate_bpm", "n_readings", "activity_state"], rows)


# ---------------------------------------------------------------- dictionary + manifest
DATASETS = {
    "clinic": {
        "file": "clinic_visits.csv",
        "title": "Clinic waiting times",
        "default": True,
        "kind": "simulated",
        "row": "one appointment",
        "rows_word": "appointments",
        "target": "wait_time",
        "target_label": "waiting time",
        "units": "minutes",
        "order": "Chronological: visit_id runs week by week, Monday to Friday, slot 1 to 20 within each day.",
        "order_meaning": "Row order is time order. Neighbouring rows are neighbouring appointments.",
        "groups": ["visit_type", "weekday", "slot"],
        "scenario": "A clinic manager wants to know the average time patients wait past their appointment time over the last 100 weeks, without reviewing every record.",
        "population": "All 10,000 appointments in this file (100 weeks x 5 days x 20 slots). It is not every clinic or every week.",
        "provenance": "Newly simulated for this activity by data-prep/prepare_data.py (seed 20261105). It follows the layout of the course notebook's clinic_visits.csv, which was not available, so its values are NOT the notebook's values.",
        "source": "Simulated (no external source)",
        "url": "",
        "license": "Created for this activity; reuse with the rest of this repository.",
        "columns": [
            {"name": "visit_id", "meaning": "Appointment number, 1-10,000, in chronological order", "units": "id", "kind": "id"},
            {"name": "week", "meaning": "Week of the record, 1-100", "units": "week number", "kind": "order"},
            {"name": "weekday", "meaning": "Day of the week", "units": "Mon-Fri", "kind": "group"},
            {"name": "slot", "meaning": "Appointment slot within the day, 1 (first) to 20 (last)", "units": "slot number", "kind": "group"},
            {"name": "visit_type", "meaning": "Type of appointment", "units": "Follow-up, New, Same-day", "kind": "group"},
            {"name": "wait_time", "meaning": "Minutes the patient waited after the appointment time", "units": "minutes (whole)", "kind": "target"},
        ],
    },
    "costs": {
        "file": "healthcare_costs.csv",
        "title": "Healthcare costs",
        "default": False,
        "kind": "public",
        "row": "one person (a beneficiary record)",
        "rows_word": "people",
        "target": "charges",
        "target_label": "medical charges",
        "units": "US dollars",
        "order": "The order of the source file. row_id is added; the order has no documented meaning and is not a time sequence.",
        "order_meaning": "Row order is file order only. It is not a time sequence.",
        "groups": ["age_band", "region", "smoker", "sex"],
        "scenario": "A health-plan analyst wants to estimate average medical charges per person in this list without reviewing every record.",
        "population": "The 1,338 people in this file. It is a teaching dataset, not a representative sample of current claims.",
        "provenance": "The insurance.csv teaching dataset distributed with Brett Lantz's book Machine Learning with R (Packt), as mirrored in the stedy/Machine-Learning-with-R-datasets GitHub repository. The book describes it as hypothetical (simulated) data created using US Census Bureau demographic statistics; the repository itself documents nothing further, and how charges were generated is not published. Unchanged except for the added row_id and age_band columns.",
        "source": "stedy/Machine-Learning-with-R-datasets, insurance.csv",
        "url": INSURANCE_URL,
        "license": "No licence is stated in the source repository. Widely redistributed for teaching; confirm this use fits your course policy.",
        "columns": [
            {"name": "row_id", "meaning": "Row number in the source file, 1-1,338 (added)", "units": "id", "kind": "id"},
            {"name": "age", "meaning": "Age of the primary beneficiary", "units": "years", "kind": "attribute"},
            {"name": "age_band", "meaning": "Age group derived from age (added)", "units": "18-29, 30-39, 40-49, 50-64", "kind": "group"},
            {"name": "sex", "meaning": "Recorded sex", "units": "female, male", "kind": "group"},
            {"name": "bmi", "meaning": "Body mass index", "units": "kg/m²", "kind": "attribute"},
            {"name": "children", "meaning": "Number of dependants covered", "units": "count", "kind": "attribute"},
            {"name": "smoker", "meaning": "Smoker", "units": "yes, no", "kind": "group"},
            {"name": "region", "meaning": "US region of residence", "units": "northeast, northwest, southeast, southwest", "kind": "group"},
            {"name": "charges", "meaning": "Individual medical costs billed", "units": "US dollars", "kind": "target"},
        ],
    },
    "heart": {
        "file": "heart_rate_week.csv",
        "title": "Wearable heart rate",
        "default": False,
        "kind": "real",
        "row": "one recorded minute",
        "rows_word": "recorded minutes",
        "target": "heart_rate_bpm",
        "target_label": "heart rate",
        "units": "beats per minute",
        "order": "Chronological by timestamp. Minutes with no reading are absent, so consecutive rows are not always one minute apart.",
        "order_meaning": "Row order is time order, but with gaps: row number is not the same as time.",
        "groups": ["activity_state"],
        "scenario": "A researcher wants to estimate one wearer's average heart rate over a week from a subset of the recorded minutes.",
        "population": "The recorded minutes of one wearer's week (25 April - 1 May 2016). It is not every minute of that week, and not other people.",
        "provenance": "A real extract from the Crowd-sourced Fitbit datasets (Furberg, Brinton, Keating & Ortiz, Zenodo 2016): participant 5577150313, 2016-04-25 00:00 to 2016-05-01 23:59 (device local time), export 4.12.16-5.12.16. heart_rate_bpm is the mean of that minute's readings (the device records every few seconds). activity_state is derived from the same participant's Fitbit sleep log (asleep or restless = sleep) and minute intensity (fairly or very active = exercise); everything else is rest. These are device estimates, not observed or clinically verified labels.",
        "source": "Crowd-sourced Fitbit datasets 03.12.2016-05.12.2016, Zenodo record 53894",
        "url": FITBIT_RECORD,
        "license": "CC BY 4.0. Cite: Furberg R, Brinton J, Keating M, Ortiz A. Crowd-sourced Fitbit datasets 03.12.2016-05.12.2016. Zenodo; 2016. doi:10.5281/zenodo.53894",
        "columns": [
            {"name": "row_id", "meaning": "Row number, 1 to N, in time order", "units": "id", "kind": "id"},
            {"name": "timestamp", "meaning": "Start of the minute, device local time", "units": "YYYY-MM-DD HH:MM", "kind": "order"},
            {"name": "heart_rate_bpm", "meaning": "Mean of the heart-rate readings in that minute", "units": "beats per minute (1 decimal)", "kind": "target"},
            {"name": "n_readings", "meaning": "How many device readings were averaged for that minute", "units": "count", "kind": "attribute"},
            {"name": "activity_state", "meaning": "Device-derived state: sleep, rest or exercise (see provenance)", "units": "sleep, rest, exercise", "kind": "group"},
        ],
    },
}


WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"]


def group_order(item):
    k = item[0]
    if k.isdigit():
        return (0, int(k), "")
    if k in WEEKDAYS:
        return (1, WEEKDAYS.index(k), "")
    return (2, 0, k)


def summarize(key: str, meta: dict) -> dict:
    path = OUT / meta["file"]
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    y = [float(r[meta["target"]]) for r in rows]
    n = len(y)
    out = {
        "file": meta["file"],
        "n_rows": n,
        "columns": list(rows[0].keys()),
        "target": meta["target"],
        "true_mean": sum(y) / n,
        "population_sd": statistics.pstdev(y),
        "min": min(y),
        "median": statistics.median(y),
        "max": max(y),
        "missing_target": 0,
        "groups": {g: dict(sorted(Counter(r[g] for r in rows).items(), key=group_order)) for g in meta["groups"]},
        "sha256": sha256(path),
        "bytes": path.stat().st_size,
    }
    if key == "heart":
        times = [dt.datetime.strptime(r["timestamp"], "%Y-%m-%d %H:%M") for r in rows]
        gaps = [(b - a).total_seconds() / 60 for a, b in zip(times, times[1:])]
        out["minutes_in_week"] = FITBIT_DAYS * 24 * 60
        out["missing_minutes"] = FITBIT_DAYS * 24 * 60 - n
        out["longest_gap_minutes"] = int(max(gaps))
        out["first_timestamp"] = rows[0]["timestamp"]
        out["last_timestamp"] = rows[-1]["timestamp"]
    if key == "clinic":
        out["seed"] = CLINIC_SEED
    return out


def write_readme(manifest: dict) -> None:
    lines = ["# Data dictionary", "",
             "Choose ONE scenario. The whole CSV for that scenario is your finite population: "
             "every number you call the true mean is the mean of the target column over all its rows.", ""]
    for key, meta in DATASETS.items():
        m = manifest["datasets"][key]
        tag = {"simulated": "SIMULATED", "real": "REAL (public extract)", "public": "PUBLIC TEACHING DATASET, simulated by its original author"}[meta["kind"]]
        lines += [f"## {meta['title']}: `{meta['file']}` ({tag})", "",
                  f"- **One row:** {meta['row']}. **Rows:** {m['n_rows']:,}.",
                  f"- **Target:** `{meta['target']}` ({meta['units']}).",
                  f"- **Population:** {meta['population']}",
                  f"- **Row order:** {meta['order']}",
                  f"- **Provenance:** {meta['provenance']}",
                  f"- **Source:** {meta['source']}" + (f" <{meta['url']}>" if meta["url"] else ""),
                  f"- **Licence / reuse:** {meta['license']}",
                  f"- **SHA-256:** `{m['sha256']}`", "",
                  "| Column | Meaning | Units / values |", "|---|---|---|"]
        lines += [f"| `{c['name']}` | {c['meaning']} | {c['units']} |" for c in meta["columns"]]
        lines += ["", "Group sizes:", ""]
        for g, counts in m["groups"].items():
            if len(counts) <= 6:
                lines.append(f"- `{g}`: " + ", ".join(f"{k} {v:,}" for k, v in counts.items()))
            else:
                lines.append(f"- `{g}`: {len(counts)} values, {min(counts.values()):,}-{max(counts.values()):,} rows each")
        if key == "heart":
            lines += ["", f"Recorded minutes: {m['n_rows']:,} of {m['minutes_in_week']:,} in the week "
                          f"({m['missing_minutes']:,} minutes have no reading; the longest gap is {m['longest_gap_minutes']} minutes). "
                          "Do not assume rows are evenly spaced in time."]
        if key == "clinic":
            lines += ["", "Simulation model (so you can reason about it, not so you can skip the investigation): "
                          "waits are whole minutes and never negative; expected waits rise through the day and are longer "
                          "for Same-day visits; each day also has its own random busy/quiet effect. "
                          "Generator: `data-prep/prepare_data.py` in the guide's source repository, seed 20261105."]
        lines.append("")
    lines += ["No values are missing in any target column.", ""]
    (OUT / "README.md").write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true", help="do not download; keep heart-rate CSV if the archive is not cached")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    print("clinic_visits.csv (simulated)"); make_clinic()
    print("healthcare_costs.csv (public teaching data)"); make_costs(args.offline)
    print("heart_rate_week.csv (real Fitbit extract)"); make_heart_rate(args.offline)
    manifest = {
        "generated_by": "data-prep/prepare_data.py",
        "python": "standard library only",
        "datasets": {k: {**summarize(k, meta), "kind": meta["kind"]} for k, meta in DATASETS.items()},
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUT / "datasets.json").write_text(json.dumps(DATASETS, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_readme(manifest)
    for k, m in manifest["datasets"].items():
        print(f"  {k}: {m['n_rows']:,} rows, true mean of {m['target']} = {m['true_mean']:.4f}")


if __name__ == "__main__":
    main()
