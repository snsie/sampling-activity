"""Minimal loader for the supplied populations (standard library only).

    python3 load_data.py data/clinic_visits.csv

Prints the number of rows and the columns, and shows the first three rows.
It deliberately computes no means or samples: that is your app's job.
"""
import csv
import sys
from pathlib import Path


def load(path):
    """Return the CSV as a list of dicts (all values are strings)."""
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python3 load_data.py data/<file>.csv")
    path = Path(sys.argv[1])
    rows = load(path)
    print(f"{path.name}: {len(rows):,} rows")
    print("columns:", ", ".join(rows[0].keys()))
    for r in rows[:3]:
        print("  ", r)
