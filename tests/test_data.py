"""Data and reference-sampler checks: python3 -m unittest discover -s tests -p 'test_*.py'"""
import csv
import hashlib
import importlib.util
import json
import math
import random
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "starter" / "data"


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


prep = load_module("prepare_data", ROOT / "data-prep" / "prepare_data.py")
ref = load_module("reference_sampling", ROOT / "verify" / "reference_sampling.py")
MANIFEST = json.loads((DATA / "manifest.json").read_text())["datasets"]
META = json.loads((DATA / "datasets.json").read_text())


class TestBundledData(unittest.TestCase):
    def rows(self, key):
        with open(DATA / META[key]["file"], newline="") as f:
            return list(csv.DictReader(f))

    def test_manifest_matches_files(self):
        for key, m in MANIFEST.items():
            path = DATA / m["file"]
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), m["sha256"], key)
            rows = self.rows(key)
            self.assertEqual(len(rows), m["n_rows"])
            y = [float(r[m["target"]]) for r in rows]
            self.assertAlmostEqual(math.fsum(y) / len(y), m["true_mean"], places=9)
            self.assertTrue(all(v >= 0 for v in y))

    def test_clinic_layout(self):
        rows = self.rows("clinic")
        self.assertEqual([int(r["visit_id"]) for r in rows], list(range(1, 10001)))
        self.assertEqual({r["visit_type"] for r in rows}, {"Follow-up", "New", "Same-day"})
        for i, r in enumerate(rows):
            self.assertEqual(int(r["slot"]), i % 20 + 1)
            self.assertEqual(int(r["week"]), i // 100 + 1)
        by_slot = lambda s: [float(r["wait_time"]) for r in rows if int(r["slot"]) == s]
        self.assertGreater(sum(by_slot(20)) / 500, sum(by_slot(1)) / 500, "later slots wait longer")
        mean_type = lambda t: (lambda v: sum(v) / len(v))([float(r["wait_time"]) for r in rows if r["visit_type"] == t])
        self.assertGreater(mean_type("Same-day"), mean_type("Follow-up"))

    def test_clinic_generation_is_deterministic(self):
        with tempfile.TemporaryDirectory() as d:
            old = prep.OUT
            prep.OUT = Path(d)
            try:
                prep.make_clinic()
                fresh = (Path(d) / "clinic_visits.csv").read_bytes()
            finally:
                prep.OUT = old
        self.assertEqual(hashlib.sha256(fresh).hexdigest(), MANIFEST["clinic"]["sha256"])

    def test_heart_rate_is_time_ordered_with_gaps(self):
        rows = self.rows("heart")
        ts = [r["timestamp"] for r in rows]
        self.assertEqual(ts, sorted(ts))
        self.assertEqual(len(set(ts)), len(ts))
        self.assertEqual(MANIFEST["heart"]["missing_minutes"], 7 * 24 * 60 - len(rows))
        self.assertEqual({r["activity_state"] for r in rows}, {"sleep", "rest", "exercise"})

    def test_costs_unchanged_from_source(self):
        with open(ROOT / "data-prep" / "sources" / "insurance.csv", newline="") as f:
            src = list(csv.DictReader(f))
        rows = self.rows("costs")
        self.assertEqual(len(src), len(rows))
        for a, b in zip(src, rows):
            for col in ("age", "sex", "bmi", "children", "smoker", "region", "charges"):
                self.assertEqual(a[col], b[col])


class TestReferenceDesigns(unittest.TestCase):
    def test_systematic_whole_interval_enumerates_every_row_once(self):
        hits = [0] * 10000
        for r in range(1, 101):
            for i in ref.systematic(10000, 100, None, start=r):
                hits[i] += 1
        self.assertEqual(set(hits), {1})

    def test_fractional_systematic_has_n_distinct_rows(self):
        rng = random.Random(3)
        for N, n in ((1338, 100), (9864, 160), (10000, 640)):
            for _ in range(200):
                idx = ref.systematic(N, n, rng)
                self.assertEqual(len(set(idx)), n)
                self.assertTrue(0 <= min(idx) and max(idx) < N)

    def test_allocation_totals_and_limits(self):
        sizes = {"a": 5475, "b": 2469, "c": 2056}
        for n in (3, 10, 40, 100, 160, 640):
            alloc = ref.proportional_allocation(sizes, n)
            self.assertEqual(sum(alloc.values()), n)
            self.assertTrue(all(1 <= alloc[h] <= sizes[h] for h in sizes))
        tiny = {"x": 2, "y": 1000}
        alloc = ref.proportional_allocation(tiny, 500)
        self.assertEqual(sum(alloc.values()), 500)
        self.assertLessEqual(alloc["x"], 2)

    def test_required_sample_sizes_work_for_every_dataset(self):
        """n = 10, 100, 640 must give exactly n distinct rows and inclusion probability n/N."""
        rng = random.Random(11)
        for key, m in MANIFEST.items():
            N = m["n_rows"]
            for n in (10, 100, 640):
                k = N / n
                if N % n == 0:
                    hits = [0] * N
                    for r in range(1, N // n + 1):
                        idx = ref.systematic(N, n, None, start=r)
                        self.assertEqual(len(set(idx)), n, (key, n))
                        for i in idx:
                            hits[i] += 1
                    self.assertEqual(set(hits), {1}, (key, n))
                    continue
                for u in [k, 1e-9, k / 2] + [k * (1.0 - rng.random()) for _ in range(150)]:
                    idx = ref.systematic(N, n, None, start=u)
                    self.assertEqual(len(set(idx)), n, (key, n, u))
                    self.assertTrue(0 <= min(idx) and max(idx) < N, (key, n, u))
                # exact inclusion probability of every row: measure of starts u in (0, k] that select it
                measure = [0.0] * (N + 1)
                for j in range(n):
                    for i in range(max(1, math.floor(j * k)), min(N, math.ceil(j * k + k)) + 1):
                        lo, hi = max(0.0, i - 1 - j * k), min(k, i - j * k)
                        measure[i] += max(0.0, hi - lo)
                for i in range(1, N + 1):
                    self.assertAlmostEqual(measure[i] / k, n / N, places=9, msg=(key, n, i))

    def test_full_checks_pass_quickly(self):
        for key in ("clinic", "costs", "heart"):
            report = ref.check_dataset(key, reps=200)
            for s in report["baseline_n100"].values():
                self.assertAlmostEqual(s["rmse"] ** 2, s["bias"] ** 2 + s["sd"] ** 2, delta=1e-6 * max(1, s["rmse"] ** 2))


if __name__ == "__main__":
    unittest.main()
