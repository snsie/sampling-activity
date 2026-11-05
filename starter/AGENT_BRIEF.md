# Agent brief: Judge the Sample

Read this whole file before doing anything else, and follow it for the whole project.

## The task

A student is building **one** app, over several stages, that helps a health professional who
understands the scenario but is new to sampling answer:

> Which sampling method would you trust for this population, at what sample size, and with what limits?

The student chose ONE scenario. Its CSV in `data/` is the **finite population**: every row in that
file, nothing more. Read `data/README.md` for what one row means, the target column, units,
row order and provenance. Never describe the file as representing all patients, all clinics, all
days or all people.

| Scenario | File | Target column |
|---|---|---|
| Clinic waiting times | `data/clinic_visits.csv` | `wait_time` (minutes) |
| Healthcare costs | `data/healthcare_costs.csv` | `charges` (US dollars) |
| Wearable heart rate | `data/heart_rate_week.csv` | `heart_rate_bpm` (beats per minute) |

## Roles and boundaries

- **You write, run and debug code.** You explain what you did in plain language.
- **The student decides.** They choose and justify designs, record predictions, write the
  challenge hypothesis, run the checks, interpret the evidence and write every explanation.
- **Preserve the student's chosen design.** Build what they chose. If you think it must change,
  say why and ask first; never silently replace it with a default.
- **Do not write the student's reasoning or responses.** Do not fill in or rewrite
  `DECISIONS.md`. You may build a display that shows notes the student wrote, unchanged.
- **Do not supply the stage-6 challenge hypothesis.** Do not suggest population changes,
  orderings or scenarios that might make a method fail, before or after the student writes theirs.
  You may ask clarifying questions, check mathematical consistency, and help interpret evidence
  after the test.
- **Do not reveal results before the student predicts.** When the student is about to record a
  prediction, do not run the experiment or tell them what to expect.
- Do not calculate the population's true mean for the student in stage 1 unless they ask you to
  check a value they have already calculated themselves.

## Mode workflow

- **Plan mode** for every brainstorming or design discussion. While in Plan mode: discuss
  options, trade-offs and the student's choice. Do not create, edit or delete files and do not run
  commands that change anything.
- **Implementation mode** (the student switches you out of Plan mode) for building. Build only
  the option the student chose, carrying forward their stated reason.
- If the student asks you to implement while you are still in Plan mode, remind them to switch
  modes first.

## Sampling rules (must stay statistically correct, whatever the design)

Put every calculation in **one shared module** (for example `sampling.py` or `sampling.js`) and
call it from every display, so a different chart can never silently change an estimator.
At minimum it provides: true mean, the three samplers, the estimator for each, and a repeated-
sampling summary. Use a seedable random number generator and show the seed in the app.

- **Population and true mean.** N = number of rows. True mean = mean of the target over all N
  rows. Recompute it whenever population values or membership change.
- **Simple random sampling (SRS):** n distinct rows **without replacement**; every set of n rows
  equally likely. Estimate = sample mean.
- **Systematic sampling with a random start**, in the file's row order (show that order).
  - If N/n is a whole number k: random start r from 1..k, then rows r, r+k, r+2k, … (n rows).
  - Otherwise either restrict n to sizes where N/n is whole, or use the fractional-interval
    design: k = N/n, start u uniform on (0, k], rows ceil(u + j·k) for j = 0..n−1. Both give
    exactly n rows and the same inclusion probability n/N for every row. Document which you used.
  - Estimate = sample mean.
  - Row order matters. In the clinic and heart-rate files, row order is time order (heart rate
    has gaps, so row number is not time). In the healthcare-costs file, row order is only file
    order: interval sampling of an unordered list means something different from sampling a
    chronological record. Say this in the app; do not explain how it affects results.
- **Stratified sampling** on an observable group column the student chooses.
  - Make the allocation explicit and show it. Default: proportional allocation with
    largest-remainder rounding, at least 1 row per stratum, never more than the stratum size, and
    integer allocations that total exactly n.
  - Within each stratum: SRS without replacement.
  - Estimate = **population-weighted** mean: Σ (N_h / N) × (sample mean in stratum h). Not the
    plain average of all sampled rows (they only agree when allocation is exactly proportional).
- **Same total n** for all three methods in any comparison. Default n = 100.
- **Repeated sampling:** at least 1,000 repetitions per method (and per size, per condition).
  Keep every estimate. Report, in the target's original units:
  - bias = mean of estimates − true mean
  - SD of estimates (the spread across repetitions)
  - RMSE = √(mean of (estimate − true mean)²) — typical estimation error, combining bias and
    variability (RMSE² = bias² + SD² when SD divides by the number of repetitions).
- **Exact enumeration vs Monte Carlo.** When N/n is whole, systematic sampling has only k
  possible samples; you may enumerate all k starts (exact distribution) instead of repeating
  equivalent draws. Label enumerated results as exact and random repetitions as Monte Carlo.
- **Labels.** Always label the true population mean. Label a single sample's result separately
  from repeated-sampling results. Label baseline vs modified populations.
- **Modified populations (stage 6).** Keep the original data recoverable and unchanged on disk;
  apply changes to a copy, label it as modified, recompute its true mean, and keep n equal across
  methods and conditions. Never corrupt a sampling rule to manufacture a failure.

## Running the app

- Follow the student's course conventions and the stack the student agrees to; ask if unsure.
- Write `run_app.sh`, a Bash script that starts the app locally from the project folder (set up
  or reuse the environment, then launch). Save it with LF line endings. Print the address to open.
- Tell the student the exact command `bash run_app.sh`, where to run it, what address to open and
  how to stop it (Ctrl+C). Let the student run it themselves.
- Keep dependencies few and pinned (for example in `requirements.txt` or `package.json`).

## Stages (the student's guide has the full brief for each)

1. Understand the population (student work; no app yet).
2. Plan mode: brainstorm visualizations → student chooses → build the first app with a temporary,
   clearly labelled SRS of 100 rows so the display can be tested; add `run_app.sh`.
3. Plan mode: brainstorm interactions → student chooses → implement SRS, systematic and stratified
   sampling (rules above), with an explained selection rule, a changeable setting, and the selected
   rows and estimate updating.
4. Student predicts → Plan mode: brainstorm presentation → student chooses → repeated sampling
   (≥1,000 per method), distribution of estimates with labelled true mean, bias and RMSE.
5. Student predicts → Plan mode: brainstorm sample-size exploration → student chooses → several
   sizes (including 10, 40, 160, 640 with SRS), ≥1,000 repetitions per size, population and method
   held fixed.
6. Student writes their own hypothesis first → Plan mode: plan controls for *their* hypothesis →
   student chooses → build user-controlled conditions, baseline vs modified comparison, repeated
   sampling, and an alternative method or justified correction.
7. Student assembles evidence.
