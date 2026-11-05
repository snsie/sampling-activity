"""Instructor verification: an independent reference implementation of the three designs.

NOT part of the student workflow and not linked from the guide. It checks that the bundled
populations behave as the guide claims, and it lets an instructor sanity-check a student's
numbers. It prints results; it never asserts which method "should" win.

    python3 verify/reference_sampling.py            # checks + report to verify/out/report.json
    python3 verify/reference_sampling.py --reps 2000

Standard library only.
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "starter" / "data"
OUT = Path(__file__).resolve().parent / "out"


# ------------------------------------------------------------------ population
def load(key: str) -> tuple[list[dict], str]:
    meta = json.loads((DATA / "datasets.json").read_text())[key]
    with open(DATA / meta["file"], newline="") as f:
        rows = list(csv.DictReader(f))
    return rows, meta["target"]


def mean(xs) -> float:
    xs = list(xs)
    return math.fsum(xs) / len(xs)


# ------------------------------------------------------------------ designs (return 0-based row indices)
def srs(N: int, n: int, rng: random.Random) -> list[int]:
    """Simple random sampling without replacement: every n-subset equally likely."""
    if not 1 <= n <= N:
        raise ValueError("need 1 <= n <= N")
    return sorted(rng.sample(range(N), n))


def systematic(N: int, n: int, rng: random.Random, start: float | None = None) -> list[int]:
    """Systematic sampling with a random start, in the file's row order.

    k = N / n. If k is a whole number: start r in 1..k, rows r, r+k, ..., r+(n-1)k.
    Otherwise (fractional interval): start u ~ Uniform(0, k], rows ceil(u + j*k), j = 0..n-1.
    Both give exactly n distinct rows and inclusion probability n/N for every row.
    `start` (1-based r, or u) may be given to enumerate.
    """
    if not 1 <= n <= N:
        raise ValueError("need 1 <= n <= N")
    if N % n == 0:
        k = N // n
        r = int(start) if start is not None else rng.randint(1, k)
        return [r - 1 + j * k for j in range(n)]
    k = N / n
    u = start if start is not None else k * (1.0 - rng.random())  # (0, k]
    # min(N, ...) guards floating-point rounding at u = k, where the exact last row is N
    return [min(N, math.ceil(u + j * k)) - 1 for j in range(n)]


def proportional_allocation(sizes: dict[str, int], n: int) -> dict[str, int]:
    """Largest-remainder proportional allocation, at least 1 per stratum, never above N_h, total exactly n."""
    N = sum(sizes.values())
    if n < len(sizes) or n > N:
        raise ValueError("need (number of strata) <= n <= N")
    quota = {h: n * Nh / N for h, Nh in sizes.items()}
    alloc = {h: min(sizes[h], max(1, math.floor(q))) for h, q in quota.items()}
    while sum(alloc.values()) < n:  # add to the largest remainder that still has room
        h = max((h for h in sizes if alloc[h] < sizes[h]), key=lambda h: (quota[h] - alloc[h], h))
        alloc[h] += 1
    while sum(alloc.values()) > n:  # only possible after the at-least-1 rule
        h = max((h for h in sizes if alloc[h] > 1), key=lambda h: (alloc[h] - quota[h], h))
        alloc[h] -= 1
    return alloc


def stratified(groups: list[str], n: int, rng: random.Random) -> tuple[list[int], dict[str, int]]:
    by: dict[str, list[int]] = {}
    for i, g in enumerate(groups):
        by.setdefault(g, []).append(i)
    alloc = proportional_allocation({h: len(ix) for h, ix in by.items()}, n)
    picked = []
    for h, ix in by.items():
        picked += rng.sample(ix, alloc[h])
    return sorted(picked), alloc


def stratified_estimate(y: list[float], groups: list[str], idx: list[int]) -> float:
    """Population-weighted mean: sum over strata of (N_h / N) * (sample mean in h)."""
    N = len(y)
    sizes: dict[str, int] = {}
    for g in groups:
        sizes[g] = sizes.get(g, 0) + 1
    sample: dict[str, list[float]] = {}
    for i in idx:
        sample.setdefault(groups[i], []).append(y[i])
    return math.fsum(sizes[h] / N * mean(v) for h, v in sample.items())


def summary(estimates: list[float], truth: float) -> dict:
    m = mean(estimates)
    sd = math.sqrt(mean((e - m) ** 2 for e in estimates))  # spread of the estimates (divide by R)
    rmse = math.sqrt(mean((e - truth) ** 2 for e in estimates))
    return {"reps": len(estimates), "mean_estimate": m, "bias": m - truth, "sd": sd, "rmse": rmse,
            "min": min(estimates), "max": max(estimates)}


def repeat(method: str, y, groups, n: int, reps: int, seed: int) -> list[float]:
    rng = random.Random(seed)
    N, est = len(y), []
    for _ in range(reps):
        if method == "srs":
            est.append(mean(y[i] for i in srs(N, n, rng)))
        elif method == "systematic":
            est.append(mean(y[i] for i in systematic(N, n, rng)))
        else:
            idx, _ = stratified(groups, n, rng)
            est.append(stratified_estimate(y, groups, idx))
    return est


def enumerate_systematic(y, n: int) -> list[float]:
    """Exact: every possible start, each with probability 1/k (only when k = N/n is whole)."""
    N = len(y)
    assert N % n == 0
    k = N // n
    return [mean(y[i] for i in systematic(N, n, None, start=r)) for r in range(1, k + 1)]


# ------------------------------------------------------------------ checks
STRATA = {"clinic": "visit_type", "costs": "age_band", "heart": "activity_state"}


def check_dataset(key: str, reps: int) -> dict:
    rows, target = load(key)
    manifest = json.loads((DATA / "manifest.json").read_text())["datasets"][key]
    y = [float(r[target]) for r in rows]
    N = len(y)
    truth = mean(y)
    assert N == manifest["n_rows"], "row count differs from manifest"
    assert abs(truth - manifest["true_mean"]) < 1e-9, "true mean differs from manifest"
    assert all(v >= 0 for v in y), "negative target value"
    groups = [r[STRATA[key]] for r in rows]
    rng = random.Random(1)

    for n in (10, 40, 100, 160, 640):
        a = srs(N, n, rng)
        assert len(set(a)) == n and len(a) == n
        b = systematic(N, n, rng)
        assert len(set(b)) == n and 0 <= min(b) and max(b) < N, f"systematic n={n}"
        c, alloc = stratified(groups, n, rng)
        assert len(set(c)) == n and sum(alloc.values()) == n
        assert all(alloc[h] <= groups.count(h) for h in alloc)
    # every row has inclusion probability n/N under systematic sampling (exact count over starts)
    for n in (100, 160, 640):
        k = N / n
        if N % n == 0:
            hits = [0] * N
            for r in range(1, N // n + 1):
                for i in systematic(N, n, None, start=r):
                    hits[i] += 1
            assert set(hits) == {1}
        else:  # fractional interval: row i (1-based) is hit when u lies in an interval of length 1
            # check by the exact rule: for each row, measure of u in (0,k] with ceil(u + j k) = i for some j
            for i in (1, 2, N // 2, N - 1, N):
                total = 0.0
                for j in range(n):
                    lo, hi = max(0.0, i - 1 - j * k), min(k, i - j * k)
                    total += max(0.0, hi - lo)
                assert abs(total / k - n / N) < 1e-9, f"inclusion probability row {i}"
    # weights: census through the stratified estimator returns the true mean exactly
    assert abs(stratified_estimate(y, groups, list(range(N))) - truth) < 1e-9
    # seeds reproduce
    assert repeat("stratified", y, groups, 100, 50, seed=7) == repeat("stratified", y, groups, 100, 50, seed=7)
    assert repeat("srs", y, groups, 100, 50, seed=7) != repeat("srs", y, groups, 100, 50, seed=8)

    report = {"N": N, "true_mean": truth, "strata_column": STRATA[key],
              "allocation_n100": proportional_allocation({h: groups.count(h) for h in set(groups)}, 100),
              "baseline_n100": {}, "srs_by_size": {}}
    for i, m in enumerate(("srs", "systematic", "stratified")):
        s = summary(repeat(m, y, groups, 100, reps, seed=100 + i), truth)
        assert abs(s["rmse"] ** 2 - (s["bias"] ** 2 + s["sd"] ** 2)) < 1e-6 * max(1.0, s["rmse"] ** 2)
        report["baseline_n100"][m] = s
    if N % 100 == 0:
        report["baseline_n100"]["systematic_exact"] = summary(enumerate_systematic(y, 100), truth)
    for n in (10, 40, 160, 640):
        report["srs_by_size"][n] = summary(repeat("srs", y, groups, n, reps, seed=200 + n), truth)
    report["demonstration_challenges"] = demonstrations(key, rows, target, reps)
    return report


def demonstrations(key: str, rows: list[dict], target: str, reps: int) -> dict:
    """Instructor-only worked comparisons. Computed every run; nothing about the outcome is asserted
    except that each comparison is fair (same n, true mean recomputed for the modified population)."""
    y0 = [float(r[target]) for r in rows]
    g0 = [r[STRATA[key]] for r in rows]
    out = {}

    def compare(label, y, g, note):
        truth = mean(y)
        out[label] = {"note": note, "true_mean": truth,
                      **{m: summary(repeat(m, y, g, 100, reps, seed=300 + i), truth)
                         for i, m in enumerate(("srs", "systematic", "stratified"))}}

    compare("baseline", y0, g0, "Supplied population, supplied row order.")
    # A reordering keeps every value (true mean unchanged) but changes what a systematic sample sees.
    order = sorted(range(len(y0)), key=lambda i: (g0[i], i))
    compare("rows_grouped_by_stratum", [y0[i] for i in order], [g0[i] for i in order],
            "Same values, rows reordered so each stratum is contiguous.")
    order = sorted(range(len(y0)), key=lambda i: y0[i])
    compare("rows_sorted_by_target", [y0[i] for i in order], [g0[i] for i in order],
            "Same values, rows sorted by the target.")
    # A value change: inflate one stratum's values by 50% (true mean must be recomputed).
    top = max(set(g0), key=lambda h: mean(y0[i] for i in range(len(y0)) if g0[i] == h))
    y1 = [v * 1.5 if g0[i] == top else v for i, v in enumerate(y0)]
    compare("highest_stratum_x1.5", y1, g0, f"Values in stratum '{top}' multiplied by 1.5; true mean recomputed.")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reps", type=int, default=1000)
    args = ap.parse_args()
    OUT.mkdir(exist_ok=True)
    full = {}
    for key in ("clinic", "costs", "heart"):
        rep = check_dataset(key, args.reps)
        full[key] = rep
        print(f"\n== {key}: N={rep['N']:,}, true mean {rep['true_mean']:.4f}, strata '{rep['strata_column']}' "
              f"allocation at n=100 {rep['allocation_n100']}")
        for m, s in rep["baseline_n100"].items():
            print(f"   n=100 {m:<17} bias {s['bias']:+10.4f}  SD {s['sd']:10.4f}  RMSE {s['rmse']:10.4f}  ({s['reps']} samples)")
        for n, s in rep["srs_by_size"].items():
            print(f"   SRS n={n:<4} SD {s['sd']:10.4f}  RMSE {s['rmse']:10.4f}")
    (OUT / "report.json").write_text(json.dumps(full, indent=2) + "\n")
    print(f"\nAll checks passed. Full report, including demonstration challenges: {OUT / 'report.json'}")


if __name__ == "__main__":
    main()
