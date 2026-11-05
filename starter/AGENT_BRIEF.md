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
- **The student decides.** They choose and justify designs, write the
  challenge hypothesis, run the checks, interpret the evidence and write every explanation.
- **Preserve the student's chosen design.** Build what they chose. If you think it must change,
  say why and ask first; never silently replace it with a default.
- **Do not write the student's reasoning or responses.** Do not fill in or rewrite
  `DECISIONS.md`. You may build a display that shows notes the student wrote, unchanged.
- **Do not supply the stage-5 challenge hypothesis.** Do not suggest population changes,
  orderings or scenarios, before or after the student writes theirs. Do not suggest that a method
  should fail or show bias. The student does not have to "break" anything: a hypothesis that is
  not supported is a valid result. You may ask clarifying questions, check mathematical
  consistency, and help interpret evidence after the test.
- **Do not reveal results or predict them.** Do not tell the student what to expect from an
  experiment, and do not run one for them to interpret. Leave interpretation to the student.
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

Put every calculation in **one shared module** (for example `src/sampling.js`) and
call it from every display, so a different chart can never silently change an estimator.
At minimum it provides: true mean, the three samplers, the estimator for each, and a repeated-
sampling summary. Use a seedable random number generator and show the seed in the app. The same
seed and settings must reproduce the same samples and results; never claim that a different seed
gives a different sample.

The student checks the running app, not the source code. When you finish a stage, explain in plain
language how each rule behaves and what the student can check in the app.

- **Population and true mean.** N = number of rows. True mean = mean of the target over all N
  rows. Recompute it whenever population values or membership change.
- **Simple random sampling (SRS):** n distinct rows **without replacement**; every set of n rows
  equally likely. Support every n with 1 ≤ n ≤ N, including the required sizes 1, 10 and 100.
  Estimate = sample mean.
- **Systematic sampling with a random start**, in the file's row order (show that order). Support
  every n with 1 ≤ n ≤ N, including the required sizes 1, 10 and 100: never restrict n
  to divisors of N.
  - If N/n is a whole number k: random start r from 1..k, then rows r, r+k, r+2k, … (n rows).
  - Otherwise use the fractional-interval design: k = N/n, start u uniform on (0, k], rows
    ceil(u + j·k) for j = 0..n−1. Guard against floating-point rounding so that no row index
    exceeds N.
  - Both designs give exactly n distinct rows (k ≥ 1) and the same inclusion probability n/N for
    every row. Show which design applies for the current N and n. For a modified population, check
    again, because N can change.
  - Estimate = sample mean.
  - Row order matters. In the clinic and heart-rate files, row order is time order (heart rate
    has gaps, so row number is not time). In the healthcare-costs file, row order is only file
    order: interval sampling of an unordered list means something different from sampling a
    chronological record. Say this in the app; do not explain how it affects results.
- **Stratified sampling** on an observable group column the student chooses.
  - Make the allocation explicit and show it. Default: proportional allocation with
    largest-remainder rounding, at least 1 row per stratum, never more than the stratum size, and
    integer allocations that total exactly n. If n is smaller than the number of strata, say so and
    ask the student what to do; do not silently change the rule.
  - Within each stratum: SRS without replacement.
  - Estimate = **population-weighted** mean: Σ (N_h / N) × (sample mean in stratum h). Not the
    plain average of all sampled rows (they only agree when allocation is exactly proportional).
- **Same total n** for all three methods in any comparison. Default n = 100.
- **Repeated sampling:** at least 100 random repetitions (default 100, with a control to increase
  to 1,000), or all possible random starts when exact enumeration is available for systematic
  sampling, for each method, size and condition. The 100-repetition minimum applies only to Monte
  Carlo results; never replace exact enumeration with random repetitions.
  - Sample size and repetition count are separate settings. n is the number of rows in one
    sample; the repetition count is how many separate samples are drawn. At n = 10 with 100
    repetitions, draw 100 separate samples of 10 rows each and calculate 100 sample means. Each
    sample is drawn without replacement (no row twice within a sample); a row may appear again in
    a later repetition. Show both settings separately.
  - Tell users briefly: 100 repetitions usually reveal the main pattern; 1,000 give smoother
    distributions and more stable bias, SD and RMSE estimates. Neither guarantees stable results,
    and 100 repetitions cannot reliably separate small differences between methods. Users should
    rerun with different seeds to check whether their main conclusions hold.
  Report, in the target's original units:
  - bias = mean of estimates − true mean
  - SD of estimates (the spread across repetitions)
  - RMSE = √(mean of (estimate − true mean)²) — typical estimation error, combining bias and
    variability (RMSE² = bias² + SD² when SD divides by the number of repetitions).
- **Exact enumeration vs Monte Carlo.** Exact enumeration is available only for systematic
  sampling with a whole-number interval: there are k equally likely starts, so list all k and
  compute bias, SD and RMSE over them. This is exact, uses no random draws and needs no seed.
  Everything else (simple random, stratified, and systematic with a fractional interval) is
  Monte Carlo: at least 100 random seeded repetitions (default 100, up to 1,000). Label every
  result "exact" or "Monte Carlo". The specified designs with their correct estimators are
  unbiased for the finite-population mean, so a small nonzero bias in a Monte Carlo result can be
  simulation variability.
- **Current results.** The app must show its current results clearly identified with their
  settings: population or condition, method, settings (for example the stratification column and
  allocation), seed (where random), n, and the repetition count or exact-enumeration count.
  Summaries use one condition only. Never pool or average results that differ in any label.
  Re-running an experiment replaces its current result; it never silently adds to an old one.
  The app does **not** need to save earlier runs: the student records the key results in a table
  in `DECISIONS.md`. Saved experiment histories and tools for managing earlier runs are optional;
  build them only if the student asks.
- **Labels.** Always label the true population mean. Label a single sample's result separately
  from repeated-sampling results. Label baseline vs modified populations.
- **Modified populations (stage 5).** Keep the original data recoverable and unchanged on disk;
  apply changes to a copy, label it as modified, recompute its true mean (reordering rows does
  not change it; changing values or membership does), and keep n equal across methods and
  conditions. Never alter a sampling rule or estimator to force a result.

## Running the app

- Build a **browser-only JavaScript app**. Use **React with Vite** unless the student asks for
  another JavaScript setup (for example plain JavaScript with Vite). Do not use Python app
  frameworks such as Streamlit, and do not add a backend server: load the CSV and do every
  sampling calculation in the browser.
- Keep `data/` unchanged and load the student's CSV from it (for example with a Vite `?raw`
  import), parsing the target as numbers.
- Write `run_app.sh`, a Bash script that starts the app locally from the project folder: run
  `npm install` if `node_modules/` is missing, then start the Vite dev server (`npm run dev`).
  Save it with LF line endings. Print the address to open.
- Tell the student the exact command `bash run_app.sh`, where to run it, what address to open and
  how to stop it (Ctrl+C). Let the student run it themselves.
- Keep dependencies few and pinned in `package.json`, and commit `package-lock.json`. A
  charting library is fine if the student agrees; prefer one or none.

## Essential and optional

- **Essential:** the correct sampling rules and estimators, reproducible results (same seed and
  settings), and labels, controls and visualizations that a health professional can read and
  interpret. The population visualization is the student's own design and must show the full
  population, the sampled rows, and the sample estimate beside the labelled true mean.
- **Optional:** decorative styling, animations, elaborate layouts, experiment histories and extra
  app features. Do not add them unless the student asks, and never suggest they are needed to
  finish. Keep the app simple and clear.

## Stages (the student's guide has the full brief for each)

1. Understand the population (student work; no app yet).
2. Plan mode: brainstorm visualizations → student chooses → build the first app with a temporary,
   clearly labelled SRS of 100 rows so the display can be tested; add `run_app.sh`.
3. Plan mode: brainstorm interactions → student chooses → implement SRS, systematic and stratified
   sampling (rules above), with an explained selection rule, a changeable setting, and the selected
   rows and estimate updating.
4. Plan mode: brainstorm a presentation → student chooses → two experiments on the baseline
   population, each result labelled exact or Monte Carlo, with a distribution of estimates, the
   labelled true mean, bias, SD and RMSE (repetition rule above):
   - Experiment A: SRS, systematic and stratified at n = 100.
   - Experiment B: SRS at n = 1, 10 and 100, with the population and method held fixed. Reuse
     the SRS n = 100 result from experiment A when the population and settings match.
   Other methods across sizes are an optional extension: every size must follow that method's rules.
5. Student writes their own hypothesis first → Plan mode: plan controls for *their* hypothesis →
   student chooses → build user-controlled conditions, baseline vs modified comparison, repeated
   sampling (repetition rule above) for each method and condition, and an alternative method or
   justified correction.
6. Student assembles evidence: the results table, three findings and the challenge in `DECISIONS.md`.
